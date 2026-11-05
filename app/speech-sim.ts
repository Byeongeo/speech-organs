/**
 * 발음 시뮬레이션 엔진
 *
 * - 자세(ArtParams): 아래턱 각도, 입술 닫힘·둥글게 하기, 혀 조절점 6개의 이동, 여린입천장 내림, 목청 떨림
 * - 소리마다 단계 4개의 목표 자세와 공기 흐름(AirState)을 정하고, SimPlayer 가 시간에 따라 이어 준다
 * - 공기는 기관에서 올라와 입(또는 코)으로 나가는 입자(AirFlow)로 그린다
 * - 여린입천장은 원본 자료에 겉면이 없어 설명용 모형(makeVelum)을 만든다
 *
 * 좌표: 모든 기준점은 몸 한가운데 면 위의 [y, z] 이다. 얼굴은 +z 쪽, 위는 +y 쪽이다.
 */
import * as T from 'three';
import {Line2} from 'three/examples/jsm/lines/Line2.js';
import {LineGeometry} from 'three/examples/jsm/lines/LineGeometry.js';
import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
import type {Sound,Place} from './sounds';

type YZ=[number,number];
export interface Landmarks {
 jawPivot:YZ;chin:YZ;tongueTip:YZ;tongueTop:YZ[];tongueBottom:YZ[];pns:YZ;palateVaultY:number;incisorEdge:YZ;
 palate:YZ[];uvulaTip:YZ;glottis:YZ;epiglottisTip:YZ;tracheaBottom:YZ;hyoid:YZ;
 pharynxWall:{naso:YZ;oro:YZ;laryngo:YZ};lip:{center:YZ;front:number;halfWidth:number;fissure?:[number,number,number]};nostril:YZ;nasalCavity:YZ;
}

/** 혀 조절점 이름 (앞에서 뒤로) */
export const TONGUE_POINTS=['tip','blade','front','mid','back','root'] as const;
export interface ArtParams {jaw:number;lipClose:number;lipRound:number;tongue:YZ[];velum:number;voice:number;tense:number}
export type AirMode='none'|'rise'|'blocked'|'burst'|'flow'|'friction'|'glottal';
export interface AirState {mode:AirMode;path:'oral'|'nasal'|'lateral';strength:number;place:Place|'none'}

const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const ease=(t:number)=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
/** [y,z] 곡선에서 z 에 해당하는 y (z 오름차순 곡선) */
function yAt(curve:YZ[],z:number){
 const c=[...curve].sort((a,b)=>a[1]-b[1]);
 if(z<=c[0][1])return c[0][0];
 for(let i=1;i<c.length;i++)if(z<=c[i][1]){const t=(z-c[i-1][1])/(c[i][1]-c[i-1][1]);return lerp(c[i-1][0],c[i][0],t);}
 return c[c.length-1][0];
}

/** 시뮬레이션 기하: 기준점에서 조절점, 접촉 목표, 여린입천장 위치를 계산한다 */
export class SpeechGeometry {
 L:Landmarks;midX:number;pns:YZ;tongueRest:YZ[];radius=0.0105;velumMax=0.42;
 constructor(L:Landmarks,midX:number){
  this.L=L;this.midX=midX;
  const back=[...L.palate].sort((a,b)=>a[1]-b[1])[0];
  this.pns=[back[0],L.pns[1]];
  const tip=L.tongueTip;
  const offs=[0.003,0.012,0.024,0.036,0.048,0.058];
  this.tongueRest=offs.map((o,i)=>{const z=tip[1]-o;return [i===0?tip[0]+0.001:yAt(L.tongueTop,z)-0.001,z] as YZ;});
 }
 palateY(z:number){return yAt(this.L.palate,z);}
 /** 여린입천장 아랫면의 점 (각도 a 만큼 내렸을 때, z 위치에서) */
 velumUnder(z:number,a:number):YZ{
  const [py,pz]=this.pns,[ty,tz]=[this.L.uvulaTip[0]-0.004,this.L.uvulaTip[1]];
  const t=Math.min(1,Math.max(0,(pz-z)/(pz-tz)));
  const y=lerp(py,ty,t)-0.0035,zz=lerp(pz,tz,t);
  return rotYZ([y,zz],this.pns,-a);
 }
 alveolar():YZ{const z=this.tongueRest[0][1]+0.002;return [this.palateY(z),z];}
 hardPalate():YZ{const z=this.tongueRest[2][1];return [this.palateY(z),z];}
}
/** [y,z] 점을 pivot 둘레로 a 만큼 돌린다 (x 축 회전, 셰이더와 같은 식) */
export function rotYZ(p:YZ,pivot:YZ,a:number):YZ{
 const c=Math.cos(a),s=Math.sin(a),ry=p[0]-pivot[0],rz=p[1]-pivot[1];
 return [pivot[0]+ry*c-rz*s,pivot[1]+ry*s+rz*c];
}

const ZERO6=():YZ[]=>TONGUE_POINTS.map(()=>[0,0] as YZ);
export const REST=():ArtParams=>({jaw:0.02,lipClose:0,lipRound:0,tongue:ZERO6(),velum:0,voice:0,tense:0});

/** 조절점 i 를 목표 [y,z] 로 보내는 이동량 (gap 만큼 덜 간다) */
function toward(g:SpeechGeometry,i:number,target:YZ,gap=0,amount=1):YZ{
 const r=g.tongueRest[i];return [(target[0]-gap-r[0])*amount,(target[1]-r[1])*amount];
}

/** 자음의 막음·좁힘 자세 */
function closure(g:SpeechGeometry,place:Place,near=false,velum=0):ArtParams{
 const p=REST();p.velum=velum;p.jaw=0.035;
 const k=near?0.72:1;
 if(place==='lips'){p.lipClose=1;p.jaw=0.025;}
 if(place==='alveolar'){
  p.tongue[0]=toward(g,0,g.alveolar(),near?0.0022:-0.0006,1);
  p.tongue[1]=toward(g,1,[g.palateY(g.tongueRest[1][1]),g.tongueRest[1][1]],0.006,0.55*k);
 }
 if(place==='palatal'){
  const h=g.hardPalate();
  p.tongue[2]=toward(g,2,h,-0.0006,1);
  p.tongue[1]=toward(g,1,[g.palateY(g.tongueRest[1][1]),g.tongueRest[1][1]],0.001,0.85);
  p.tongue[3]=toward(g,3,[g.palateY(g.tongueRest[3][1]),g.tongueRest[3][1]],0.004,0.6);
  p.tongue[0]=[-0.002,-0.001];
 }
 if(place==='velar'){
  const v=g.velumUnder(g.tongueRest[4][1],velum*g.velumMax);
  p.tongue[4]=toward(g,4,v,-0.0006,1);
  p.tongue[3]=toward(g,3,g.velumUnder(g.tongueRest[3][1]+0.002,velum*g.velumMax),0.003,0.7);
  p.tongue[5]=[0.002,0.001];
  p.tongue[0]=[-0.002,-0.002];
 }
 return p;
}

/** 모음 자세: 혀의 높낮이·앞뒤, 입술 모양, 턱 벌림 */
function vowelPose(g:SpeechGeometry,s:Extract<Sound,{kind:'vowel'}>,withLips:boolean):ArtParams{
 const p=REST();
 const jaw={high:0.05,mid:0.11,low:s.front?0.17:0.21}[s.height];
 p.jaw=withLips?jaw:jaw*0.6;
 const pal=(i:number,gap:number,amt=1)=>toward(g,i,[g.palateY(g.tongueRest[i][1]),g.tongueRest[i][1]],gap,amt);
 const vel=(i:number,gap:number)=>toward(g,i,g.velumUnder(g.tongueRest[i][1],0),gap,1);
 if(s.front){
  if(s.height==='high'){p.tongue[2]=pal(2,0.0035);p.tongue[1]=pal(1,0.0045);p.tongue[3]=pal(3,0.006,0.8);p.tongue[0]=[0.001,0.002];p.tongue[4]=[-0.002,0.003];p.tongue[5]=[0,0.004];}
  if(s.height==='mid'){p.tongue[2]=pal(2,0.008,0.9);p.tongue[1]=pal(1,0.009,0.8);p.tongue[3]=[0.001,0.001];p.tongue[4]=[-0.003,0.002];p.tongue[5]=[0,0.002];}
  if(s.height==='low'){p.tongue[2]=[-0.001,0.002];p.tongue[1]=[-0.001,0.002];p.tongue[3]=[-0.002,0];p.tongue[4]=[-0.004,0];p.tongue[0]=[-0.001,0.001];}
 }else{
  if(s.height==='high'){p.tongue[4]=vel(4,0.0035);p.tongue[3]=pal(3,0.006,0.7);p.tongue[2]=[-0.002,-0.003];p.tongue[1]=[-0.003,-0.004];p.tongue[0]=[-0.003,-0.005];p.tongue[5]=[0,-0.003];}
  if(s.height==='mid'){p.tongue[4]=[0.002,-0.004];p.tongue[3]=[0,-0.003];p.tongue[2]=[-0.003,-0.003];p.tongue[1]=[-0.003,-0.004];p.tongue[0]=[-0.003,-0.004];p.tongue[5]=[0,-0.005];}
  if(s.height==='low'){p.tongue[4]=[-0.002,-0.006];p.tongue[3]=[-0.004,-0.004];p.tongue[2]=[-0.005,-0.003];p.tongue[1]=[-0.004,-0.003];p.tongue[0]=[-0.004,-0.003];p.tongue[5]=[0,-0.007];}
 }
 if(withLips&&s.round){p.lipRound=s.height==='high'?1:0.75;}
 return p;
}

/** 소리마다 단계 4개의 목표 자세와 공기 흐름 */
export type Step={pose:ArtParams;air:AirState;mark?:YZ};
/** 조음 위치의 닿는 자리 */
export function placePoint(g:SpeechGeometry,place:Place,velum=0):YZ{
 if(place==='lips')return [g.L.lip.center[0],g.L.lip.front-0.003];
 if(place==='alveolar')return g.alveolar();
 if(place==='palatal')return g.hardPalate();
 if(place==='velar')return g.velumUnder(g.tongueRest[4][1],velum*g.velumMax);
 return g.L.glottis;
}
export function buildSteps(g:SpeechGeometry,s:Sound):Step[]{
 const steps=buildPoses(g,s);
 if(s.kind==='vowel')return steps;
 const at=placePoint(g,s.place,s.manner==='nasal'?1:0);
 const from=s.manner==='nasal'?1:s.place==='glottal'?1:2;
 return steps.map((st,i)=>i>=from?{...st,mark:at}:st);
}
function buildPoses(g:SpeechGeometry,s:Sound):Step[]{
 const A=(mode:AirMode,path:AirState['path']='oral',strength=1,place:AirState['place']='none'):AirState=>({mode,path,strength,place});
 const rest=REST();
 if(s.kind==='vowel'){
  const p0=vowelPose(g,s,false),p1=vowelPose(g,s,true),p2={...p1,voice:1},p3={...p1,voice:1};
  return [{pose:p0,air:A('none')},{pose:p1,air:A('none')},{pose:p2,air:A('rise')},{pose:p3,air:A('flow')}];
 }
 const strength=s.phonation==='aspirated'?2:s.phonation==='tense'?0.7:1;
 const TN=s.phonation==='tense'?1:0;
 if(s.manner==='nasal'){
  const lowered={...rest,velum:1};
  const shut=closure(g,s.place,false,1);
  return [{pose:lowered,air:A('none')},{pose:shut,air:A('none')},{pose:{...shut,voice:1},air:A('rise','nasal')},{pose:{...shut,voice:1},air:A('flow','nasal',1,s.place)}];
 }
 if(s.manner==='liquid'){
  const touch=closure(g,'alveolar');touch.tongue[0]=toward(g,0,g.alveolar(),0.0004,1);
  return [{pose:rest,air:A('rise')},{pose:{...rest,voice:1},air:A('rise')},{pose:{...touch,voice:1},air:A('rise')},{pose:{...touch,voice:1},air:A('flow','lateral',1,'alveolar')}];
 }
 if(s.place==='glottal'){
  const open={...rest,jaw:0.08};
  return [{pose:rest,air:A('rise')},{pose:open,air:A('rise')},{pose:open,air:A('glottal','oral',1.2,'glottal')},{pose:open,air:A('flow','oral',1.1)}];
 }
 if(s.manner==='fricative'){
  const near={...closure(g,s.place,true),tense:s.phonation==='tense'?1:0},restF={...rest,tense:near.tense};
  return [{pose:rest,air:A('rise')},{pose:restF,air:A('rise')},{pose:near,air:A('rise')},{pose:near,air:A('friction','oral',strength,s.place)}];
 }
 const shut={...closure(g,s.place),tense:TN},restT={...rest,tense:TN};
 if(s.manner==='affricate'){
  const loose={...closure(g,s.place,true),tense:TN};
  return [{pose:rest,air:A('rise')},{pose:restT,air:A('rise')},{pose:shut,air:A('blocked','oral',1,s.place)},{pose:loose,air:A('friction','oral',strength,s.place)}];
 }
 const open={...rest,jaw:0.07,tense:TN};
 return [{pose:rest,air:A('rise')},{pose:restT,air:A('rise')},{pose:shut,air:A('blocked','oral',1,s.place)},{pose:open,air:A('burst','oral',strength,s.place)}];
}

function blend(a:ArtParams,b:ArtParams,t:number):ArtParams{
 return {jaw:lerp(a.jaw,b.jaw,t),lipClose:lerp(a.lipClose,b.lipClose,t),lipRound:lerp(a.lipRound,b.lipRound,t),
  tongue:a.tongue.map((v,i)=>[lerp(v[0],b.tongue[i][0],t),lerp(v[1],b.tongue[i][1],t)] as YZ),velum:lerp(a.velum,b.velum,t),voice:b.voice,tense:lerp(a.tense,b.tense,t)};
}

/** 시간에 따라 단계를 진행시키는 재생기 */
export class SimPlayer {
 g:SpeechGeometry;sound:Sound|null=null;steps:Step[]=[];t=0;stepDur=2.4;hold=1;back=1.2;
 constructor(g:SpeechGeometry){this.g=g;}
 start(s:Sound,speed:'slow'|'normal'){this.sound=s;this.steps=buildSteps(this.g,s);this.t=0;this.stepDur=speed==='slow'?2.4:1.3;}
 stop(){this.sound=null;this.t=0;}
 get total(){return this.stepDur*4+this.hold+this.back;}
 seek(t:number){this.t=Math.max(0,Math.min(this.total,t));}
 update(dt:number){
  if(!this.sound)return {params:REST(),air:{mode:'none',path:'oral',strength:1,place:'none'} as AirState,step:-1,progress:0,done:true,within:0,mark:undefined as YZ|undefined};
  this.t=Math.min(this.total,this.t+dt);
  const t=this.t,D=this.stepDur,end=4*D;
  if(t<end){
   const step=Math.floor(t/D),within=(t-step*D)/D;
   const prev=step===0?REST():this.steps[step-1].pose;
   return {params:blend(prev,this.steps[step].pose,ease(within/0.45)),air:this.steps[step].air,step,progress:t/this.total,done:false,within,mark:within>0.3?this.steps[step].mark:(step>0?this.steps[step-1].mark:undefined)};
  }
  const last=this.steps[3];
  if(t<end+this.hold)return {params:last.pose,air:last.air,step:4,progress:t/this.total,done:false,within:1,mark:last.mark};
  const k=ease((t-end-this.hold)/this.back);
  return {params:blend(last.pose,REST(),k),air:{...last.air,mode:'none'} as AirState,step:4,progress:t/this.total,done:t>=this.total,within:1,mark:undefined as YZ|undefined};
 }
}

/** 여린입천장 설명용 모형: 입천장 뒤끝에서 목젖 끝까지 이어지는 휘어진 판 */
export function makeVelum(g:SpeechGeometry,material:T.Material){
 const [py,pz]=g.pns,[ty,tz]=[g.L.uvulaTip[0]-0.004,g.L.uvulaTip[1]];
 const U=18,V=14,pos:number[]=[],idx:number[]=[];
 for(let i=0;i<=U;i++){
  const u=i/U;
  const cy=lerp(py,ty,u)-Math.sin(u*Math.PI)*0.002,cz=lerp(pz,tz,u);
  const dy=(ty-py),dz=(tz-pz),len=Math.hypot(dy,dz),ny=-dz/len,nz=dy/len; // 중심선에 수직인 방향
  const w=lerp(0.013,0.004,u)*(u>0.85?1-(u-0.85)*2:1),th=lerp(0.0042,0.0026,u);
  for(let j=0;j<V;j++){
   const a=j/V*Math.PI*2,ex=Math.cos(a)*w,en=Math.sin(a)*th;
   pos.push(g.midX+ex,cy+ny*en,cz+nz*en);
  }
 }
 for(let i=0;i<U;i++)for(let j=0;j<V;j++){
  const a=i*V+j,b=i*V+(j+1)%V,c=(i+1)*V+j,d=(i+1)*V+(j+1)%V;idx.push(a,c,b,b,c,d);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
 const mesh=new T.Mesh(geo,material);mesh.position.set(-g.midX,-py,-pz);
 const pivot=new T.Group();pivot.position.set(g.midX,py,pz);pivot.add(mesh);pivot.visible=false;
 return pivot;
}

/** 공기 입자 */
export class AirFlow {
 points:T.Points;private N=260;private pos:Float32Array;private s:Float32Array;private v:Float32Array;private j:Float32Array;private alive:Uint8Array;
 private paths:Record<'oral'|'nasal',T.Vector3[]>;private marks:Record<string,number>;private spawnAcc=0;private g:SpeechGeometry;
 constructor(g:SpeechGeometry){
  this.g=g;const L=g.L,x=g.midX+0.004;
  const P=(yz:YZ)=>new T.Vector3(x,yz[0],yz[1]);
  const pal=(z:number,frac:number)=>{const t=yAt(L.tongueTop,z),p=g.palateY(z);return [lerp(t,p,frac),z] as YZ;};
  const common:YZ[]=[L.tracheaBottom,[lerp(L.tracheaBottom[0],L.glottis[0],0.55),lerp(L.tracheaBottom[1],L.glottis[1],0.6)],L.glottis,[L.glottis[0]+0.014,L.glottis[1]-0.001],
   [L.epiglottisTip[0]-0.004,lerp(L.epiglottisTip[1],L.pharynxWall.laryngo[1],0.55)],[L.pharynxWall.oro[0]-0.008,lerp(L.tongueTop[0][1],L.pharynxWall.oro[1],0.5)]];
  const oral:YZ[]=[...common,[L.uvulaTip[0]-0.004,(L.uvulaTip[1]+g.tongueRest[4][1])/2],pal(g.tongueRest[4][1],0.55),pal(g.tongueRest[3][1],0.6),pal(g.tongueRest[2][1],0.6),pal(g.tongueRest[1][1],0.55),
   [lerp(L.tongueTip[0],g.alveolar()[0],0.5),L.tongueTip[1]+0.006],[L.incisorEdge[0]+0.001,L.incisorEdge[1]+0.002],[L.lip.center[0],L.lip.front+0.002],[L.lip.center[0]-0.004,L.lip.front+0.035]];
  const nasal:YZ[]=[...common,[L.pharynxWall.naso[0]-0.004,L.pharynxWall.naso[1]+0.006],[g.pns[0]+0.009,g.pns[1]-0.002],[L.nasalCavity[0]-0.004,L.nasalCavity[1]],
   [L.nostril[0]+0.004,L.nostril[1]-0.018],[L.nostril[0],L.nostril[1]],[L.nostril[0]-0.012,L.nostril[1]+0.03]];
  const sample=(pts:YZ[])=>new T.CatmullRomCurve3(pts.map(P),false,'centripetal').getSpacedPoints(400);
  this.paths={oral:sample(oral),nasal:sample(nasal)};
  const near=(path:T.Vector3[],yz:YZ)=>{let b=0,d=Infinity;path.forEach((p,i)=>{const e=Math.hypot(p.y-yz[0],p.z-yz[1]);if(e<d){d=e;b=i;}});return b/(path.length-1);};
  const o=this.paths.oral;
  this.marks={rise:near(o,common[common.length-1]),glottal:near(o,L.glottis),lips:near(o,[L.lip.center[0],L.lip.front-0.004]),alveolar:near(o,g.alveolar()),
   palatal:near(o,g.hardPalate()),velar:near(o,g.velumUnder(g.tongueRest[4][1],0))};
  this.pos=new Float32Array(this.N*3).fill(1e4);this.s=new Float32Array(this.N);this.v=new Float32Array(this.N);this.j=new Float32Array(this.N*2);this.alive=new Uint8Array(this.N);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(this.pos,3));
  const mat=new T.PointsMaterial({color:0x2f8fd8,size:6,sizeAttenuation:false,transparent:true,opacity:.9,depthTest:false});
  mat.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;');};
  this.points=new T.Points(geo,mat);this.points.frustumCulled=false;this.points.renderOrder=20;this.points.visible=false;
 }
 reset(){this.alive.fill(0);this.pos.fill(1e4);this.points.geometry.attributes.position.needsUpdate=true;this.spawnAcc=0;}
 update(dt:number,air:AirState){
  const path=air.path==='nasal'?this.paths.nasal:this.paths.oral,n=path.length-1,M=this.marks;
  const closeAt=air.place!=='none'&&air.place in M?M[air.place]:1;
  const stopAt=air.mode==='rise'?M.rise:air.mode==='blocked'?closeAt-0.012:Infinity;
  const rate=air.mode==='none'?0:air.mode==='burst'?260*air.strength:120*(air.mode==='rise'?0.8:air.strength);
  this.spawnAcc+=rate*dt;
  for(let i=0;i<this.N&&this.spawnAcc>=1;i++){if(this.alive[i])continue;this.alive[i]=1;this.s[i]=Math.random()*0.02;this.v[i]=0.32+Math.random()*0.14;this.j[i*2]=(Math.random()-.5)*0.004;this.j[i*2+1]=(Math.random()-.5)*0.004;this.spawnAcc--;}
  if(this.spawnAcc>5)this.spawnAcc=5;
  for(let i=0;i<this.N;i++){
   if(!this.alive[i]){this.pos[i*3]=1e4;continue;}
   let speed=this.v[i];
   if(air.mode==='burst'&&this.s[i]>closeAt-0.08)speed*=2.4+air.strength*0.9;
   const fric=air.mode==='friction'?closeAt:air.mode==='glottal'?M.glottal:-1;
   let jit=1;
   if(fric>=0&&Math.abs(this.s[i]-fric)<0.05){speed*=1.9;jit=3.2;}
   else if(fric>=0&&this.s[i]>fric)jit=2.2;
   this.s[i]+=speed*dt;
   if(this.s[i]>stopAt){this.s[i]=stopAt-Math.random()*0.035;}
   if(this.s[i]>=1){this.alive[i]=0;this.pos[i*3]=1e4;continue;}
   const k=Math.min(n,Math.max(0,Math.round(this.s[i]*n))),p=path[k];
   const wob=jit>1?(Math.random()-.5)*0.0016*jit:0;
   let x=p.x;
   if(air.path==='lateral'&&this.s[i]>M.alveolar-0.05&&this.s[i]<M.alveolar+0.08)x+=0.012;
   this.pos[i*3]=x;this.pos[i*3+1]=p.y+this.j[i*2]*jit*0.6+wob;this.pos[i*3+2]=p.z+this.j[i*2+1]*jit*0.6+wob;
  }
  this.points.geometry.attributes.position.needsUpdate=true;
 }
}

/** 혀의 기본 자리(쉬는 자세의 윗면)를 점선으로 그린다 */
export function makeTongueOutline(g:SpeechGeometry){
 const x=g.midX+0.003,pts=[...g.L.tongueTop].sort((a,b)=>a[1]-b[1]).map(([y,z])=>new T.Vector3(x,y,z));
 pts.push(new T.Vector3(x,g.L.tongueTip[0],g.L.tongueTip[1]));
 const flat=new T.CatmullRomCurve3(pts,false,'centripetal').getPoints(90).flatMap(p=>[p.x,p.y,p.z]);
 // 어두운 테두리 위에 흰 점선을 겹쳐, 어두운 입안과 밝은 혀 어디에서나 보이게 한다 (1px 선은 묻힘)
 const make=(color:number,width:number,opacity:number,order:number)=>{
  const geo=new LineGeometry();geo.setPositions(flat);
  const mat=new LineMaterial({color,linewidth:width,transparent:true,opacity,depthTest:false,dashed:true,dashSize:0.0026,gapSize:0.0017});
  const line=new Line2(geo,mat);line.computeLineDistances();line.renderOrder=order;line.frustumCulled=false;return line;
 };
 const group=new T.Group();group.add(make(0x263238,5,.55,21),make(0xffffff,2.6,.98,21.5));group.visible=false;
 return group;
}
/** 굵은 선(Line2)은 화면 크기를 알아야 두께를 맞출 수 있다 */
export function setLineResolution(o:T.Object3D,w:number,h:number){
 o.traverse(c=>{const m=(c as Line2).material;if(m instanceof LineMaterial)m.resolution.set(w,h);});
}
/** 닿는 자리 표시 점 */
export function makeContactMark(){
 const m=new T.Mesh(new T.SphereGeometry(0.0022,18,12),new T.MeshBasicMaterial({color:0xe53935,transparent:true,opacity:.95,depthTest:false}));
 m.renderOrder=22;m.visible=false;m.frustumCulled=false;return m;
}
/** 목청 표시 고리: 옆에서 본 목청을 둘러싼 납작한 타원 고리. 떨림(노랑)·긴장(주황)을 크게 보여 준다 */
export function makeGlottisRing(g:SpeechGeometry){
 const [gy,gz]=g.L.glottis,x=g.midX+0.004,a=0.0095,b=0.0058,t=0.0011,N=64,pos:number[]=[],idx:number[]=[];
 for(let i=0;i<=N;i++){const th=i/N*Math.PI*2,c=Math.cos(th),s=Math.sin(th);pos.push(x,gy+(b+t)*s,gz+(a+t)*c,x,gy+(b-t)*s,gz+(a-t)*c);}
 for(let i=0;i<N;i++){const o=i*2;idx.push(o,o+1,o+2,o+1,o+3,o+2);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);
 const m=new T.Mesh(geo,new T.MeshBasicMaterial({color:0xffb300,transparent:true,opacity:.95,depthTest:false,side:T.DoubleSide}));
 m.renderOrder=23;m.visible=false;m.frustumCulled=false;
 // 고리가 제자리에서 커졌다 작아지도록 중심을 원점으로 옮겨 둔다
 geo.translate(-x,-gy,-gz);m.position.set(x,gy,gz);
 return m;
}
