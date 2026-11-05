/**
 * 3D 화면에 발음 시뮬레이션을 연결한다 (patch-scene-speech.mjs 다음에 한 번만 적용)
 *
 * - 부품마다 역할(partRole)을 꼭짓점 속성으로 넘기고, 셰이더에서 아래턱 회전, 혀 휘기,
 *   입술 닫기·오므리기, 피부 아래턱 따라가기, 여린입천장 근육 회전, 입 바닥 근육 따라가기를 한다
 * - 목청은 소리가 날 때 노랗게 깜빡인다
 * - 여린입천장 설명용 모형과 공기 입자를 장면에 넣는다
 * - page 에서 고른 소리(sim 상태)를 재생하고 단계·진행률을 onSim 으로 알려 준다
 */
import { readFileSync, writeFileSync } from 'node:fs';
const file = 'app/scene.tsx';
let src = readFileSync(file, 'utf8');
const edits = [];
const add = (a, b) => edits.push([a, b]);

add("import {SYSTEMS,explodeAngle,type Atlas,type SceneState} from './anatomy';",
  "import {SYSTEMS,explodeAngle,type Atlas,type SceneState} from './anatomy';\nimport {SOUNDS} from './sounds';\nimport {SpeechGeometry,SimPlayer,AirFlow,makeVelum,REST,type ArtParams} from './speech-sim';");
add("interface Props {atlas:Atlas;state:SceneState;onSelect:(id:string)=>void;onProgress:(n:number)=>void;onError:(s:string)=>void}",
  "export interface SimReport {step:number;progress:number;done:boolean}\ninterface Props {atlas:Atlas;state:SceneState;onSelect:(id:string)=>void;onProgress:(n:number)=>void;onError:(s:string)=>void;onSim?:(r:SimReport)=>void}");
add("export default function AnatomyScene({atlas,state,onSelect,onProgress,onError}:Props)",
  "export default function AnatomyScene({atlas,state,onSelect,onProgress,onError,onSim}:Props)");
add("latest.current=state;select.current=onSelect;",
  "const onSimRef=useRef(onSim);\n latest.current=state;select.current=onSelect;onSimRef.current=onSim;");

// 공유 uniform: 모든 재질이 같은 값을 본다
add("const materialFor=(system:string)=>{",
  "const art={uJaw:{value:0},uJawPivot:{value:new T.Vector2()},uTc:{value:[0,1,2,3,4,5].map(()=>new T.Vector3())},uTd:{value:[0,1,2,3,4,5].map(()=>new T.Vector2())},uTr:{value:.0105},uLipClose:{value:0},uLipRound:{value:0},uLip:{value:new T.Vector3()},uVelum:{value:0},uVelPivot:{value:new T.Vector2()},uMidX:{value:0},uHyoidY:{value:0},uVoice:{value:0},uTime:{value:0}};\n" +
  "  const materialFor=(system:string)=>{");
add("shader.uniforms.partState={value:partTexture};", "Object.assign(shader.uniforms,art);shader.uniforms.partState={value:partTexture};");

// 꼭짓점 셰이더: 선언과 회전 함수
add("shader.vertexShader='attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected;\\n'+shader.vertexShader;",
  "shader.vertexShader='attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected;\\n" +
  "attribute float partRole; uniform float uJaw; uniform vec2 uJawPivot; uniform vec3 uTc[6]; uniform vec2 uTd[6]; uniform float uTr; uniform float uLipClose; uniform float uLipRound; uniform vec3 uLip; uniform float uVelum; uniform vec2 uVelPivot; uniform float uMidX; uniform float uHyoidY; varying float vRole;\\n" +
  "vec3 rotX(vec3 p, vec2 piv, float a){ float c=cos(a), s=sin(a); vec2 r=p.yz-piv; return vec3(p.x, piv.x + r.x*c - r.y*s, piv.y + r.x*s + r.y*c); }\\n'+shader.vertexShader;");

// 꼭짓점 셰이더: 역할별 움직임
const ART = [
  "vRole = partRole; vec3 rp = position;",
  "if (partRole > 0.5) {",
  " if (partRole < 1.5) { transformed = rotX(transformed, uJawPivot, uJaw); }",
  " else if (partRole < 2.5) {",
  "  vec2 dsum = vec2(0.0); float mx = exp(-pow((rp.x - uMidX) / 0.028, 2.0));",
  "  for (int i = 0; i < 6; i++) { vec2 dd = rp.yz - uTc[i].yz; dsum += exp(-dot(dd, dd) / (uTr * uTr)) * uTd[i]; }",
  "  transformed.yz += dsum * (0.35 + 0.65 * mx); transformed = rotX(transformed, uJawPivot, uJaw * 0.5);",
  " }",
  " else if (partRole < 3.5) {",
  "  float lower = smoothstep(uLip.x + 0.0015, uLip.x - 0.0025, rp.y);",
  "  transformed = rotX(transformed, uJawPivot, uJaw * lower * (1.0 - uLipClose));",
  "  float fr = smoothstep(uLip.y - 0.008, uLip.y + 0.006, rp.z);",
  "  transformed.x = uMidX + (transformed.x - uMidX) * (1.0 - 0.36 * uLipRound);",
  "  transformed.z += 0.006 * uLipRound * fr; transformed.y += uLipClose * (lower * 0.0012 - (1.0 - lower) * 0.0006);",
  " }",
  " else if (partRole < 4.5) {",
  "  float below = smoothstep(uLip.x + 0.004, uLip.x - 0.008, rp.y); float front = smoothstep(uJawPivot.y + 0.02, uJawPivot.y + 0.05, rp.z); float neck = smoothstep(uHyoidY - 0.004, uHyoidY + 0.018, rp.y);",
  "  transformed = rotX(transformed, uJawPivot, uJaw * below * front * neck);",
  "  vec2 lc = rp.yz - uLip.xy; float lw = exp(-dot(lc, lc) / (0.016 * 0.016)) * smoothstep(uLip.y - 0.012, uLip.y, rp.z);",
  "  transformed.x = uMidX + (transformed.x - uMidX) * (1.0 - 0.3 * uLipRound * lw); transformed.z += 0.005 * uLipRound * lw;",
  " }",
  " else if (partRole < 5.5) {",
  "  float w = smoothstep(uVelPivot.x + 0.004, uVelPivot.x - 0.004, rp.y) * smoothstep(uVelPivot.y + 0.004, uVelPivot.y - 0.004, rp.z);",
  "  transformed = rotX(transformed, uVelPivot, -uVelum * w);",
  " }",
  " else if (partRole < 6.5) { transformed = rotX(transformed, uJawPivot, uJaw * 0.6); }",
  "}",
].join('\\n');
add("partSelected = texture2D(selectionState, stateUv).r;');", "partSelected = texture2D(selectionState, stateUv).r;\\n" + ART + "');");

// 조각 셰이더: 목청 깜빡임
add("shader.fragmentShader='varying float partVisible; varying float partSelected;", "shader.fragmentShader='varying float partVisible; varying float partSelected; varying float vRole; uniform float uVoice; uniform float uTime;");
add("if (!gl_FrontFacing) diffuseColor.rgb *= 0.74;');",
  "if (!gl_FrontFacing) diffuseColor.rgb *= 0.74;\\nif (vRole > 6.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.78, 0.22), uVoice * (0.5 + 0.45 * sin(uTime * 42.0)));');");

// 부품 역할을 꼭짓점 속성으로
add("g.setAttribute('partIndex',new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i),1));",
  "g.setAttribute('partIndex',new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i),1));g.setAttribute('partRole',new T.BufferAttribute(new Float32Array(p.vertexCount).fill(p.role??0),1));");

// 시뮬레이션 객체 만들기
add("const mats=new Map(SYSTEMS.map(s=>[s.id,materialFor(s.id)]));",
  "const mats=new Map(SYSTEMS.map(s=>[s.id,materialFor(s.id)]));\n" +
  "  // ── 발음 시뮬레이션 ──\n" +
  "  const sg=atlas.landmarks?new SpeechGeometry(atlas.landmarks,midX):null,player=sg?new SimPlayer(sg):null,air=sg?new AirFlow(sg):null;\n" +
  "  if(air)scene.add(air.points);\n" +
  "  const velumMat=new T.MeshStandardMaterial({color:'#d77b86',roughness:.6,metalness:.05,side:T.DoubleSide,clippingPlanes:[cutPlane]});\n" +
  "  velumMat.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.74;');};materials.push(velumMat);\n" +
  "  const velum=sg?makeVelum(sg,velumMat):null;if(velum)scene.add(velum);\n" +
  "  if(sg){const L=sg.L;art.uJawPivot.value.set(L.jawPivot[0],L.jawPivot[1]);sg.tongueRest.forEach((c,i)=>art.uTc.value[i].set(midX,c[0],c[1]));art.uTr.value=sg.radius;art.uLip.value.set(L.lip.center[0],L.lip.center[1],L.lip.halfWidth);art.uVelPivot.value.set(sg.pns[0],sg.pns[1]);art.uMidX.value=midX;art.uHyoidY.value=L.hyoid[0];}\n" +
  "  const applyArt=(p:ArtParams|null)=>{art.uJaw.value=p?p.jaw:0;art.uLipClose.value=p?p.lipClose:0;art.uLipRound.value=p?p.lipRound:0;art.uVelum.value=p&&sg?p.velum*sg.velumMax:0;art.uTd.value.forEach((v,i)=>v.set(p?p.tongue[i][0]:0,p?p.tongue[i][1]:0));if(velum&&sg)velum.rotation.x=p?-p.velum*sg.velumMax:0;};\n" +
  "  let simKey='',simReportAt=0,simStep=-2;\n" +
  "  if(import.meta.env.DEV)(window as any).__speechSim={seek:(t:number)=>{player?.seek(t);dirty=true;},warm:(sec:number)=>{if(!player||!air)return;const r=player.update(0);for(let k=0;k<sec*60;k++)air.update(1/60,r.air);dirty=true;},get t(){return player?.t??0;}};");

// 매 장면: 고른 소리를 재생한다
add("controls.enableRotate=amount<.8;",
  "{const sim=s.sim,active=!!(sg&&player&&air&&sim&&sim.open&&sim.id&&SOUNDS[sim.id]);\n" +
  "    const key=active?`${sim!.id}:${sim!.nonce}:${sim!.speed}`:'';\n" +
  "    if(key!==simKey){simKey=key;if(active){player!.start(SOUNDS[sim!.id!],sim!.speed);air!.reset();}else{player?.stop();air?.reset();applyArt(null);art.uVoice.value=0;if(velum)velum.visible=false;if(air)air.points.visible=false;dirty=true;}simStep=-2;}\n" +
  "    if(active){const ddt=sim!.paused?0:dt,r=player!.update(ddt);applyArt(r.params);air!.update(ddt,r.air);art.uVoice.value=r.params.voice;art.uTime.value+=ddt;velum!.visible=true;air!.points.visible=true;dirty=true;\n" +
  "     const now=performance.now();if(r.step!==simStep||now-simReportAt>120){simStep=r.step;simReportAt=now;onSimRef.current?.({step:r.step,progress:r.progress,done:r.done});}}}\n" +
  "   controls.enableRotate=amount<.8;");

let ok = 0; const missed = [];
for (const [a, b] of edits) { if (!src.includes(a)) { missed.push(a.slice(0, 90)); continue; } src = src.split(a).join(b); ok++; }
writeFileSync(file, src);
console.log(`${file}: ${ok}/${edits.length}개 적용`);
missed.forEach(m => console.log('  못 찾음 · ' + m));

// 장면 상태에 시뮬레이션 항목 추가
const a = 'app/anatomy.ts';
let t = readFileSync(a, 'utf8');
t = t.replace("rotate:boolean;reset:number;cut:boolean}", "rotate:boolean;reset:number;cut:boolean;sim?:{open:boolean;id:string|null;nonce:number;paused:boolean;speed:'slow'|'normal'}}");
writeFileSync(a, t);
console.log('SceneState 에 sim 추가:', /sim\?:\{open:boolean/.test(t) ? '완료' : '실패');
process.exit(missed.length ? 1 : 0);
