import {useEffect,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createExplosionLayout} from './explosion-layout';
import {decodeModelResponse} from './model-download';
import {PointerTap} from './pointer-tap';
import {SYSTEMS,explodeAngle,type Atlas,type SceneState} from './anatomy';
import {SOUNDS} from './sounds';
import {SpeechGeometry,SimPlayer,AirFlow,makeVelum,makeTongueOutline,makeContactMark,makeGlottisRing,setLineResolution,type ArtParams} from './speech-sim';
export interface SimReport {step:number;progress:number;done:boolean}
interface Props {atlas:Atlas;state:SceneState;onSelect:(id:string)=>void;onProgress:(n:number)=>void;onError:(s:string)=>void;onSim?:(r:SimReport)=>void}
export default function AnatomyScene({atlas,state,onSelect,onProgress,onError,onSim}:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(state),select=useRef(onSelect);
 const onSimRef=useRef(onSim);
 latest.current=state;select.current=onSelect;onSimRef.current=onSim;
 useEffect(()=>{
  const el=host.current!;let disposed=false,frame=0,dirty=true,ready=false,lastView='',lastReset=-1,lastIsolate='',layoutKey='',amount=0;
  let lastState:SceneState|null=null;
  const abort=new AbortController();
  // 자료의 실제 크기(머리와 목)에 맞춰 화면을 잡는다
  const modelBox=new T.Box3();atlas.parts.forEach(p=>modelBox.union(new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1]))));
  const modelCenter=modelBox.getCenter(new T.Vector3()),modelSize=modelBox.getSize(new T.Vector3());
  const focusY=modelCenter.y,modelSpan=Math.max(modelSize.x,modelSize.y,modelSize.z);
  // 반으로 자르기: x 가 constant 이하인 쪽(몸의 오른쪽 절반)만 남긴다. 끌 때는 아주 멀리 둔다.
  const CUT_OFF=1e6,cutPlane=new T.Plane(new T.Vector3(-1,0,0),CUT_OFF);let cutX=CUT_OFF;
  const cutIdle=modelBox.max.x+.02,midX=atlas.midX??modelCenter.x;
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{onError('이 브라우저에서는 3D 화면을 열 수 없습니다. 크롬이나 엣지 최신 버전으로 열어 주세요.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<768?1.5:2));renderer.setClearColor('#f2f3f3');renderer.localClippingEnabled=true;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','3차원 뼈와 근육. 끌어서 돌리고, 휠이나 두 손가락으로 확대하고, 더블클릭으로 회전 중심을 옮기고, 눌러서 설명을 봅니다.');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.005,100),controls=new OrbitControls(camera,renderer.domElement);
  const baseDistance=modelSpan/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)));camera.position.set(modelCenter.x+baseDistance*.7,focusY+baseDistance*.3,modelCenter.z+baseDistance*1.8);controls.target.copy(modelCenter);controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=.03;controls.maxDistance=modelSpan*30;controls.minPolarAngle=0;controls.maxPolarAngle=Math.PI;controls.zoomToCursor=true;controls.addEventListener('change',()=>{dirty=true;});
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xffffff,0xa7acb2,1.05));
  const key=new T.DirectionalLight(0xfffaf4,2.3);key.position.set(-2,4,3);scene.add(key);
  const rim=new T.DirectionalLight(0xe9f0ff,1.8);rim.position.set(2,2,-3);scene.add(rim);
  const ground=new T.Mesh(new T.CircleGeometry(30,96),new T.MeshStandardMaterial({color:0xd5d9dc,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.019;scene.add(ground);
  const platform=new T.Mesh(new T.CylinderGeometry(.68,.7,.028,100),new T.MeshStandardMaterial({color:0xeeeeec,metalness:.12,roughness:.67}));platform.position.y=-.016;scene.add(platform);
  const ring=new T.Mesh(new T.RingGeometry(.63,.632,128),new T.MeshBasicMaterial({color:0x8c969f,transparent:true,opacity:.4,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.001;scene.add(ring);
  const innerRing=new T.Mesh(new T.RingGeometry(.55,.551,128),new T.MeshBasicMaterial({color:0xa4aeb8,transparent:true,opacity:.16,side:T.DoubleSide}));innerRing.rotation.x=-Math.PI/2;innerRing.position.y=.001;scene.add(innerRing);
  const width=T.MathUtils.ceilPowerOfTwo(atlas.parts.length),data=new Float32Array(width*4),partTexture=new T.DataTexture(data,width,1,T.RGBAFormat,T.FloatType);partTexture.needsUpdate=true;
  const selectedData=new Uint8Array(width*4),selectionTexture=new T.DataTexture(selectedData,width,1);selectionTexture.needsUpdate=true;
  const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[],pickers:(T.Mesh|undefined)[]=[],centers=atlas.parts.map(p=>new T.Vector3().fromArray(p.bounds[0]).add(new T.Vector3().fromArray(p.bounds[1])).multiplyScalar(.5));
  const offsets:T.Vector3[]=[],bounds=atlas.parts.map(p=>new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1])));
  let packingWidth=1,packingHeight=1;
  const markerPositions=new Float32Array(atlas.parts.length*3),markerGeometry=new T.BufferGeometry();markerGeometry.setAttribute('position',new T.BufferAttribute(markerPositions,3));
  const markerMaterial=new T.PointsMaterial({color:0x64748b,size:5,sizeAttenuation:false,transparent:true,opacity:.72,depthTest:false});
  markerMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;');};
  const markers=new T.Points(markerGeometry,markerMaterial);markers.frustumCulled=false;markers.renderOrder=10;markers.visible=false;scene.add(markers);
  const hover=document.createElement('div');hover.className='part-hover';hover.setAttribute('role','tooltip');hover.hidden=true;el.appendChild(hover);
  type Target={index:number;x:number;y:number;left:number;right:number;top:number;bottom:number};let targets:Target[]=[];
  const projected=new T.Vector3();
  const findTarget=(x:number,y:number,radius:number)=>{
   let best=-1,score=Infinity;
   for(const t of targets){const dx=Math.max(t.left-x,0,x-t.right),dy=Math.max(t.top-y,0,y-t.bottom),distance=Math.hypot(dx,dy);if(distance>radius)continue;const candidate=distance+Math.hypot(t.x-x,t.y-y)*.025;if(candidate<score){score=candidate;best=t.index;}}
   return best;
  };
  const art={uJaw:{value:0},uJawPivot:{value:new T.Vector2()},uTc:{value:[0,1,2,3,4,5].map(()=>new T.Vector3())},uTd:{value:[0,1,2,3,4,5].map(()=>new T.Vector2())},uTr:{value:.0105},uLipClose:{value:0},uLipRound:{value:0},uLip:{value:new T.Vector3()},uVelum:{value:0},uVelPivot:{value:new T.Vector2()},uMidX:{value:0},uHyoidY:{value:0},uVoice:{value:0},uTime:{value:0},uTense:{value:0},uFis:{value:new T.Vector3(0,0,1)}};
  const materialFor=(system:string)=>{
   const skin=system==='skin';const m=new T.MeshStandardMaterial({color:SYSTEMS.find(s=>s.id===system)?.color??'#aebbb8',metalness:.08,roughness:skin?.75:.53,side:T.DoubleSide,transparent:skin,opacity:skin?.12:1,depthWrite:!skin,clippingPlanes:[cutPlane]});
   m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,art);shader.uniforms.partState={value:partTexture};shader.uniforms.selectionState={value:selectionTexture};shader.uniforms.stateWidth={value:width};
    shader.vertexShader='attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected;\nattribute float partRole; uniform float uJaw; uniform vec2 uJawPivot; uniform vec3 uTc[6]; uniform vec2 uTd[6]; uniform float uTr; uniform float uLipClose; uniform float uLipRound; uniform vec3 uLip; uniform float uVelum; uniform vec2 uVelPivot; uniform float uMidX; uniform float uHyoidY; uniform vec3 uFis; varying float vRole;\nvec3 rotX(vec3 p, vec2 piv, float a){ float c=cos(a), s=sin(a); vec2 r=p.yz-piv; return vec3(p.x, piv.x + r.x*c - r.y*s, piv.y + r.x*s + r.y*c); }\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); transformed += state.xyz; partVisible = state.w; partSelected = texture2D(selectionState, stateUv).r;\nvRole = partRole; vec3 rp = position;\nif (partRole > 0.5) {\n if (partRole < 1.5) { transformed = rotX(transformed, uJawPivot, uJaw); }\n else if (partRole < 2.5) {\n  vec2 dsum = vec2(0.0); float mx = exp(-pow((rp.x - uMidX) / 0.028, 2.0));\n  for (int i = 0; i < 6; i++) { vec2 dd = rp.yz - uTc[i].yz; dsum += exp(-dot(dd, dd) / (uTr * uTr)) * uTd[i]; }\n  transformed.yz += dsum * (0.35 + 0.65 * mx); transformed = rotX(transformed, uJawPivot, uJaw * 0.5);\n }\n else if (partRole < 3.5) {\n  float ldx = abs(rp.x - uMidX); float lfy = uFis.x + uFis.y * pow(min(ldx, uFis.z), 2.0);\n  float lin = sqrt(max(0.0, 1.0 - pow(ldx / uFis.z, 2.0)));\n  float lower = step(rp.y, lfy) * mix(lin * (1.0 - uLipClose), 1.0, smoothstep(lfy - 0.002, lfy - 0.012, rp.y));\n  transformed = rotX(transformed, uJawPivot, uJaw * lower);\n  float fr = smoothstep(uLip.y - 0.008, uLip.y + 0.006, rp.z);\n  transformed.x = uMidX + (transformed.x - uMidX) * (1.0 - 0.36 * uLipRound);\n  transformed.z += 0.006 * uLipRound * fr;\n }\n else if (partRole < 4.5) {\n  float sdx = abs(rp.x - uMidX); float sfy = uFis.x + uFis.y * pow(min(sdx, uFis.z), 2.0);\n  float slin = sqrt(max(0.0, 1.0 - pow(sdx / uFis.z, 2.0)));\n  float inner = step(rp.y, sfy) * mix(slin * (1.0 - uLipClose), 1.0, smoothstep(sfy - 0.002, sfy - 0.015, rp.y));\n  float below = mix(smoothstep(sfy + 0.004, sfy - 0.008, rp.y), inner, smoothstep(1.1 * uFis.z, 0.9 * uFis.z, sdx)); float front = smoothstep(uJawPivot.y + 0.02, uJawPivot.y + 0.05, rp.z); float neck = smoothstep(uHyoidY - 0.004, uHyoidY + 0.018, rp.y);\n  transformed = rotX(transformed, uJawPivot, uJaw * below * front * neck);\n  vec2 lc = rp.yz - uLip.xy; float lw = exp(-dot(lc, lc) / (0.016 * 0.016)) * smoothstep(uLip.y - 0.012, uLip.y, rp.z);\n  transformed.x = uMidX + (transformed.x - uMidX) * (1.0 - 0.3 * uLipRound * lw); transformed.z += 0.005 * uLipRound * lw;\n }\n else if (partRole < 5.5) {\n  float w = smoothstep(uVelPivot.x + 0.004, uVelPivot.x - 0.004, rp.y) * smoothstep(uVelPivot.y + 0.004, uVelPivot.y - 0.004, rp.z);\n  transformed = rotX(transformed, uVelPivot, -uVelum * w);\n }\n else if (partRole < 6.5) { transformed = rotX(transformed, uJawPivot, uJaw * 0.6); }\n}');
    shader.fragmentShader='varying float partVisible; varying float partSelected; varying float vRole; uniform float uVoice; uniform float uTime; uniform float uTense;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (partVisible < 0.5) discard;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.85, 0.78), partSelected * 0.75);\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.74;\nif (vRole > 6.5) { diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.78, 0.22), uVoice * (0.5 + 0.45 * sin(uTime * 42.0))); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.49, 0.0), uTense * 0.8); }');
   };materials.push(m);return m;
  };
  const mats=new Map(SYSTEMS.map(s=>[s.id,materialFor(s.id)]));
  // ── 발음 시뮬레이션 ──
  const sg=atlas.landmarks?new SpeechGeometry(atlas.landmarks,midX):null,player=sg?new SimPlayer(sg):null,air=sg?new AirFlow(sg):null;
  if(air)scene.add(air.points);
  const velumMat=new T.MeshStandardMaterial({color:'#d77b86',roughness:.6,metalness:.05,side:T.DoubleSide,clippingPlanes:[cutPlane]});
  velumMat.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.74;');};materials.push(velumMat);
  const velum=sg?makeVelum(sg,velumMat):null;if(velum)scene.add(velum);
  const outline=sg?makeTongueOutline(sg):null,mark=sg?makeContactMark():null,glotRing=sg?makeGlottisRing(sg):null;if(outline)scene.add(outline);if(mark)scene.add(mark);if(glotRing)scene.add(glotRing);
  if(sg){const L=sg.L;art.uJawPivot.value.set(L.jawPivot[0],L.jawPivot[1]);sg.tongueRest.forEach((c,i)=>art.uTc.value[i].set(midX,c[0],c[1]));art.uTr.value=sg.radius;art.uLip.value.set(L.lip.center[0],L.lip.center[1],L.lip.halfWidth);art.uVelPivot.value.set(sg.pns[0],sg.pns[1]);art.uMidX.value=midX;art.uHyoidY.value=L.hyoid[0];const fis=L.lip.fissure;art.uFis.value.set(fis?fis[0]:L.lip.center[0],fis?fis[1]:0,fis?fis[2]:L.lip.halfWidth);}
  const applyArt=(p:ArtParams|null)=>{art.uJaw.value=p?p.jaw:0;art.uLipClose.value=p?p.lipClose:0;art.uLipRound.value=p?p.lipRound:0;art.uVelum.value=p&&sg?p.velum*sg.velumMax:0;art.uTd.value.forEach((v,i)=>v.set(p?p.tongue[i][0]:0,p?p.tongue[i][1]:0));if(velum&&sg)velum.rotation.x=p?-p.velum*sg.velumMax:0;art.uTense.value=p?p.tense:0;};
  let simKey='',simReportAt=0,simStep=-2,lastSimOpen=false;
  if((import.meta as any).env?.DEV)(window as any).__speechSim={seek:(t:number)=>{player?.seek(t);dirty=true;},warm:(sec:number)=>{if(!player||!air)return;const r=player.update(0);for(let k=0;k<sec*60;k++)air.update(1/60,r.air);dirty=true;},get t(){return player?.t??0;},objs:{outline,mark,glotRing,camera,controls}};
  let loaded=0;
  const loadChunk=async(ci:number)=>{
   const chunk=atlas.chunks[ci],compressed=!!chunk.gzip&&typeof DecompressionStream!=='undefined';const response=await fetch(compressed?chunk.gzip!:chunk.url,{signal:abort.signal});const buffer=await decodeModelResponse(response,chunk.bytes,compressed);if(disposed)return;
   const groups=new Map<string,T.BufferGeometry[]>();
   atlas.parts.forEach((p,i)=>{
    if(p.chunk!==ci)return;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,p.positions,p.vertexCount*3),3));
    // GPU normalized signed-short normals keep the complete atlas compact in memory.
    g.setAttribute('normal',new T.BufferAttribute(new Int16Array(buffer,p.normals,p.vertexCount*3),3,true));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,p.indices,p.indexCount),1));
    g.boundingBox=bounds[i].clone();g.computeBoundingSphere();const pick=new T.Mesh(g);pick.matrixAutoUpdate=false;pickers[i]=pick;geometries.push(g);
    g.setAttribute('partIndex',new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i),1));g.setAttribute('partRole',new T.BufferAttribute(new Float32Array(p.vertexCount).fill(p.role??0),1));
    const list=groups.get(p.system)??[];list.push(g);groups.set(p.system,list);
   });
   groups.forEach((gs,system)=>{const geometry=mergeGeometries(gs,false);if(!geometry)throw new Error('3D 모양을 조립하지 못했습니다.');geometries.push(geometry);const mesh=new T.Mesh(geometry,mats.get(system as never));mesh.frustumCulled=false;if(system==='skin')mesh.renderOrder=5;scene.add(mesh);});
   lastState=null;loaded++;onProgress(Math.round(loaded/atlas.chunks.length*100));dirty=true;
  };
  (async()=>{try{let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(cursor<atlas.chunks.length){const i=cursor++;await loadChunk(i);}}));if(!disposed){ready=true;dirty=true;}}catch(e){if(!disposed)onError(e instanceof Error?e.message:'뼈와 근육 자료를 불러오지 못했습니다.');}})();
  let simFramed=false;
  const rectOf=(sel:string)=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect(),o=el.getBoundingClientRect();return r.width&&r.height?{left:r.left-o.left,right:r.right-o.left,top:r.top-o.top,bottom:r.bottom-o.top,width:r.width,height:r.height}:null;};
  /** 소리 내 보기: 입술부터 후두까지(코안 포함)를 조작판과 아래 막대를 피한 빈자리 가운데에 크게 잡는다 */
  const frameSim=(view:string)=>{
   const L=atlas.landmarks!,w=el.clientWidth,h=el.clientHeight;
   // 화면 위 판·막대를 피해 3D가 보일 빈자리를 구한다. 세로로 긴 판은 옆을, 아래쪽 것은 아래를, 위쪽 것은 위를 깎는다
   let left=16,right=w-16,top=96,bottom=h-16;const stack=rectOf('.sim-dock');if(stack)bottom=stack.top-8;
   for(const sel of [...(stack?[]:['.sound-panel','.sound-caption']),'.bottom-dock','.view-controls','.identity','.top-actions','.layers-panel']){const r=rectOf(sel);if(!r)continue;
    if(r.height>h*.25&&r.width<w*.5){if(r.left>w*.5)right=Math.min(right,r.left-16);else left=Math.max(left,r.right+16);continue;}
    if(r.top>h*.4)bottom=Math.min(bottom,r.top-12);else if(r.bottom<h*.5)top=Math.max(top,r.bottom+8);}
   const aw=Math.max(120,right-left),ah=Math.max(80,bottom-top);
   const zs=[L.lip.front,L.nostril[1],L.pharynxWall.naso[1],L.pharynxWall.oro[1],L.pharynxWall.laryngo[1]],ys=[L.glottis[0]-.016,L.nasalCavity[0]+.014,L.chin[0]];
   const y0=Math.min(...ys),y1=Math.max(...ys),z0=Math.min(...zs)-.012,z1=Math.max(...zs)+.01,across=view==='side'?z1-z0:.11;
   const center=new T.Vector3(midX,(y0+y1)/2,(z0+z1)/2);
   const distance=Math.max((y1-y0)*h/ah,across*w/aw/camera.aspect)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*1.06;
   const direction=view==='front'?new T.Vector3(0,.02,1):view==='back'?new T.Vector3(0,.02,-1):view==='side'?new T.Vector3(1,.02,0):new T.Vector3(.35,.06,1).normalize();
   camera.setViewOffset(w,h,w/2-(left+right)/2,h/2-(top+bottom)/2,w,h);simFramed=true;
   controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance);controls.update();dirty=true;
  };
  const fit=(view:string,extent=0)=>{
   {const s=latest.current;if(sg&&atlas.landmarks&&s.sim?.open&&amount<=.03&&!s.isolate){frameSim(view);return;}if(simFramed){camera.clearViewOffset();simFramed=false;}}
   const aspect=camera.aspect,mobile=el.clientWidth<768,normalDistance=baseDistance*(mobile?2.5:1.75);
   const reservedHeight=mobile?350:270;const availableAspect=Math.max(.35,(el.clientWidth-(mobile?40:340))/Math.max(160,el.clientHeight-reservedHeight));const atlasDistance=Math.max(packingHeight,packingWidth/availableAspect)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*(el.clientHeight/Math.max(160,el.clientHeight-reservedHeight))*1.08;
   const distance=T.MathUtils.lerp(normalDistance,Math.max(.2,atlasDistance),extent);if(extent>.8)view='front';
   const direction=view==='front'?new T.Vector3(0,.02,1):view==='back'?new T.Vector3(0,.02,-1):view==='side'?new T.Vector3(1,.02,0):new T.Vector3(.35,.06,1).normalize();
   controls.target.set(extent>.1&&el.clientWidth>767?modelCenter.x-packingWidth*.12:modelCenter.x,focusY,modelCenter.z);camera.position.copy(controls.target).addScaledVector(direction,distance);controls.update();dirty=true;
  };
  const resize=()=>{layoutKey='';lastState=null;renderer.setPixelRatio(Math.min(devicePixelRatio,el.clientWidth<768||el.clientHeight<600?1.5:2));camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);if(outline)setLineResolution(outline,el.clientWidth,el.clientHeight);fit(latest.current.view,amount);};const observer=new ResizeObserver(resize);observer.observe(el);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),tap=new PointerTap(),worldBox=new T.Box3(),hitPoint=new T.Vector3();
  const down=(e:PointerEvent)=>{hover.hidden=true;tap.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?12:5);};
  const move=(e:PointerEvent)=>{tap.move(e.pointerId,e.clientX,e.clientY);if(e.buttons||amount<.5||e.pointerType==='touch'){hover.hidden=true;return;}const rect=el.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,index=findTarget(x,y,12);hover.hidden=index<0;renderer.domElement.style.cursor=index<0?'grab':'pointer';if(index>=0){hover.textContent=atlas.parts[index].name;hover.style.left=`${Math.max(8,Math.min(x+14,el.clientWidth-260))}px`;hover.style.top=`${Math.max(8,Math.min(y+18,el.clientHeight-55))}px`;}};
  const cancel=(e:PointerEvent)=>tap.cancel(e.pointerId);
  const up=(e:PointerEvent)=>{
   const validTap=tap.up(e.pointerId,e.clientX,e.clientY);if(!validTap||!ready)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
   let nearest=Infinity,found=-1;
   pickers.forEach((mesh,i)=>{if(!mesh||data[i*4+3]<.5)return;worldBox.copy(bounds[i]).translate(mesh.position);if(!raycaster.ray.intersectBox(worldBox,hitPoint))return;if(atlas.parts[i].system==='skin')return;const hits=raycaster.intersectObject(mesh,false).filter(h=>h.point.x<=cutPlane.constant+1e-4);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;found=i;}});
   if(found<0&&amount>.45)found=findTarget(e.clientX-rect.left,e.clientY-rect.top,e.pointerType==='touch'?24:16);if(found>=0){hover.hidden=true;select.current(atlas.parts[found].id);}
  };
  const pivot={active:false,t:0,fromT:new T.Vector3(),toT:new T.Vector3(),fromC:new T.Vector3(),toC:new T.Vector3()};
  const dbl=(e:MouseEvent)=>{if(!ready)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);let nearest=Infinity,found=false;const hit=new T.Vector3();pickers.forEach((mesh,i)=>{if(!mesh||data[i*4+3]<.5)return;worldBox.copy(bounds[i]).translate(mesh.position);if(!raycaster.ray.intersectBox(worldBox,hitPoint))return;if(atlas.parts[i].system==='skin')return;const hits=raycaster.intersectObject(mesh,false).filter(h=>h.point.x<=cutPlane.constant+1e-4);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;hit.copy(hits[0].point);found=true;}});if(!found)return;pivot.fromT.copy(controls.target);pivot.toT.copy(hit);pivot.fromC.copy(camera.position);pivot.toC.copy(camera.position).add(hit).sub(controls.target);pivot.t=0;pivot.active=true;dirty=true;};
  renderer.domElement.addEventListener('dblclick',dbl);
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);
  const clock=new T.Clock();let lastExtent=-1;
  const animate=()=>{
   if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),s=latest.current;
   const changed=lastState?.visible!==s.visible||lastState?.selected!==s.selected||lastState?.isolate!==s.isolate||(lastExtent<=.03)!==(amount<=.03);
   const moving=Math.abs(amount-s.explode)>.0001;
   if(moving){amount=T.MathUtils.damp(amount,s.explode,8,dt);dirty=true;}
   if(changed||moving||lastExtent<0){
    const visible=new Set(s.visible),selection=new Set(s.selected);
    const visibleParts=atlas.parts.filter(p=>p.system!=='skin'&&(s.isolate?selection.has(p.id):visible.has(p.system)||selection.has(p.id)));
    const nextLayoutKey=visibleParts.map(p=>p.id).join(',')+':'+camera.aspect.toFixed(3);
    if(nextLayoutKey!==layoutKey){const layout=createExplosionLayout(visibleParts,camera.aspect);packingWidth=layout.width;packingHeight=layout.height;atlas.parts.forEach((p,i)=>{const cell=layout.cells.get(p.id);offsets[i]=cell?new T.Vector3(cell.x+modelCenter.x,cell.y+focusY,modelCenter.z):centers[i].clone();});layoutKey=nextLayoutKey;if(amount>.05&&!s.isolate)fit(s.view,Math.max(0,(amount-.3)/.7));}

    atlas.parts.forEach((p,i)=>{
     const c=centers[i],destination=offsets[i];let dx=0,dy=0,dz=0;
     if(amount<=.45){const t=amount/.45;const angle=explodeAngle(p.system);dx=Math.sin(angle)*t*modelSpan*.7;dy=(c.y-focusY)*t*.28;dz=Math.cos(angle)*t*modelSpan*.7;}
     else {const t=(amount-.45)/.55,angle=explodeAngle(p.system);dx=T.MathUtils.lerp(Math.sin(angle)*modelSpan*.7,destination.x-c.x,t);dy=T.MathUtils.lerp((c.y-focusY)*.28,destination.y-c.y,t);dz=T.MathUtils.lerp(Math.cos(angle)*modelSpan*.7,destination.z-c.z,t);}
     const selected=selection.has(p.id);data.set([dx,dy,dz,(s.isolate?selected:visible.has(p.system)||selected)&&!(p.system==='skin'&&(amount>.03||s.isolate))?1:0],i*4);selectedData[i*4]=selected?255:0;
     markerPositions.set(data[i*4+3]>.5?[c.x+dx,c.y+dy,c.z+dz]:[10000,10000,10000],i*3);const mesh=pickers[i];if(mesh){mesh.position.set(dx,dy,dz);mesh.updateMatrix();mesh.updateMatrixWorld(true);}
    });partTexture.needsUpdate=true;selectionTexture.needsUpdate=true;markerGeometry.attributes.position.needsUpdate=true;lastState=s;lastExtent=amount;dirty=true;
   }
   if(s.cut!==lastState?.cut)dirty=true;
   if(s.view!==lastView||s.reset!==lastReset||!!s.sim?.open!==lastSimOpen){fit(s.view,amount);lastView=s.view;lastReset=s.reset;lastSimOpen=!!s.sim?.open;}
   if(moving&&!s.isolate)fit(amount>.5?'front':s.view,Math.max(0,(amount-.3)/.7));
   const isolateKey=s.isolate?s.selected.join(',')+':'+s.reset+':'+s.inspectorOpen+':'+camera.aspect:'';
   if(isolateKey!==lastIsolate||(s.isolate&&moving)){
    if(s.isolate){const box=new T.Box3();atlas.parts.forEach((p,i)=>{if(s.selected.includes(p.id))box.union(bounds[i].clone().translate(new T.Vector3(data[i*4],data[i*4+1],data[i*4+2])));});
     if(!box.isEmpty()){const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());const w=el.clientWidth,h=el.clientHeight,mobile=w<768,landscape=w>h&&h<=600;let left=20,right=w-20,top=mobile?175:110,bottom=h-170;if(s.inspectorOpen){if(landscape){right=w-335;top=100;bottom=h-125;}else if(mobile){const sheet=document.querySelector('.detail-sheet')?.getBoundingClientRect(),header=document.querySelector('.identity')?.getBoundingClientRect();top=(header?.bottom??94)+16;bottom=(sheet?.top??h*.58-139)-16;}else{right=w-370;left=w>1100?285:25;}}const availableWidth=Math.max(150,right-left),availableHeight=Math.max(40,bottom-top);camera.setViewOffset(w,h,w/2-(left+right)/2,h/2-(top+bottom)/2,w,h);const distance=Math.max(.07,Math.max(size.y*h/availableHeight,size.x*w/availableWidth/camera.aspect,size.z)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))*1.35);controls.maxDistance=Math.max(40,distance*2);controls.target.copy(center);camera.position.copy(center).add(new T.Vector3(.2,.1,1).normalize().multiplyScalar(distance));controls.update();dirty=true;}
    }else if(lastIsolate){camera.clearViewOffset();fit(s.view,amount);}
    lastIsolate=isolateKey;
   }
   if(pivot.active){pivot.t=Math.min(1,pivot.t+dt/.35);const k=1-Math.pow(1-pivot.t,3);controls.target.lerpVectors(pivot.fromT,pivot.toT,k);camera.position.lerpVectors(pivot.fromC,pivot.toC,k);dirty=true;if(pivot.t>=1)pivot.active=false;}
   {const want=s.cut&&amount<=.03?midX:cutIdle;if(cutX===CUT_OFF)cutX=cutIdle;cutX=T.MathUtils.damp(cutX,want,5,dt);if(Math.abs(cutX-want)<1e-4)cutX=want;cutPlane.constant=(!s.cut||amount>.03)&&cutX>=cutIdle-1e-4?CUT_OFF:cutX;if(Math.abs(cutX-want)>1e-4)dirty=true;}
   {const sim=s.sim,active=!!(sg&&player&&air&&sim&&sim.open&&sim.id&&SOUNDS[sim.id]);
    const key=active?`${sim!.id}:${sim!.nonce}:${sim!.speed}`:'';
    if(key!==simKey){simKey=key;if(active){player!.start(SOUNDS[sim!.id!],sim!.speed);air!.reset();}else{player?.stop();air?.reset();applyArt(null);art.uVoice.value=0;if(velum)velum.visible=false;if(air)air.points.visible=false;if(outline)outline.visible=false;if(mark)mark.visible=false;if(glotRing)glotRing.visible=false;dirty=true;}simStep=-2;}
    if(active){const ddt=sim!.paused?0:dt,r=player!.update(ddt);applyArt(r.params);air!.update(ddt,r.air);art.uVoice.value=r.params.voice;art.uTime.value+=ddt;velum!.visible=true;air!.points.visible=true;dirty=true;
     if(outline)outline.visible=SOUNDS[sim!.id!].kind==='vowel';if(mark){mark.visible=!!r.mark;if(r.mark)mark.position.set(midX+0.004,r.mark[0],r.mark[1]);}
     if(glotRing){const v=r.params.voice,tn=r.params.tense,rm=glotRing.material as T.MeshBasicMaterial;glotRing.visible=v>.05||tn>.05;if(tn>.05){rm.color.setHex(0xf57c00);rm.opacity=.95*Math.min(1,tn);glotRing.scale.setScalar(1-.1*tn);}else if(v>.05){rm.color.setHex(0xffb300);rm.opacity=.95*Math.min(1,v);glotRing.scale.setScalar(1+.12*Math.sin(art.uTime.value*Math.PI*2*5));}}
     const now=performance.now();if(r.step!==simStep||now-simReportAt>120){simStep=r.step;simReportAt=now;onSimRef.current?.({step:r.step,progress:r.progress,done:r.done});}}}
   controls.enableRotate=amount<.8;controls.mouseButtons.LEFT=amount<.8?T.MOUSE.ROTATE:T.MOUSE.PAN;controls.touches.ONE=amount<.8?T.TOUCH.ROTATE:T.TOUCH.PAN;ground.visible=platform.visible=ring.visible=innerRing.visible=false;markers.visible=amount>.75;controls.autoRotate=s.rotate&&!s.isolate&&amount<.4;controls.autoRotateSpeed=.65;controls.update();if(controls.autoRotate)dirty=true;
   if(dirty){renderer.render(scene,camera);targets=[];if(amount>.45){atlas.parts.forEach((p,i)=>{if(data[i*4+3]<.5)return;let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(let corner=0;corner<8;corner++){projected.set(p.bounds[(corner&1)?1:0][0]+data[i*4],p.bounds[(corner&2)?1:0][1]+data[i*4+1],p.bounds[(corner&4)?1:0][2]+data[i*4+2]).project(camera);const x=(projected.x+1)*el.clientWidth/2,y=(1-projected.y)*el.clientHeight/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}projected.copy(centers[i]).add(new T.Vector3(data[i*4],data[i*4+1],data[i*4+2])).project(camera);if(projected.z< -1||projected.z>1)return;targets.push({index:i,x:(projected.x+1)*el.clientWidth/2,y:(1-projected.y)*el.clientHeight/2,left,right,top,bottom});});}dirty=false;}

  };animate();
  const contextLost=(e:Event)=>{e.preventDefault();onError('기기에서 3D 화면이 멈췄습니다. 새로 고침해 주세요.');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  return()=>{disposed=true;abort.abort();cancelAnimationFrame(frame);observer.disconnect();controls.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.traverse(o=>{if(o instanceof T.Mesh&&!geometries.includes(o.geometry)){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});env.dispose();partTexture.dispose();selectionTexture.dispose();markerGeometry.dispose();markerMaterial.dispose();hover.remove();renderer.dispose();renderer.domElement.remove();};
 },[atlas]);
 return <div className="scene" ref={host}/>;
}
