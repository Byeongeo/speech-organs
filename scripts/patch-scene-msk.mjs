/**
 * 근골격계 앱의 3D 화면 수정
 *
 * - 발밑 원판, 받침대, 테두리 고리를 없앤다.
 * - 아래쪽 회전 제한을 풀어 발바닥 밑에서도 볼 수 있게 한다.
 * - 휠 확대가 마우스가 가리키는 곳으로 다가가게 한다.
 * - 더블클릭한 곳을 회전 중심으로 옮긴다.
 * - 펼치기는 원본 동작 그대로 두되, 뼈는 왼쪽·근육은 오른쪽으로 갈라지게 순서만 정한다.
 * - 화면 안 영어 문구를 한글로 바꾼다.
 *
 * 실행: node scripts/patch-scene-msk.mjs   (원본 scene.tsx 에 한 번만 적용)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'app/scene.tsx';
let src = readFileSync(file, 'utf8');
const edits = [
  // ── 가져오기: 펼치기 방향 함수 ──
  ["import {SYSTEMS,type Atlas,type SceneState} from './anatomy';",
   "import {SYSTEMS,explodeAngle,type Atlas,type SceneState} from './anatomy';"],

  // ── 회전·확대 설정 ──
  ["controls.minDistance=.07;controls.maxDistance=40;controls.maxPolarAngle=Math.PI*.96;",
   "controls.minDistance=.03;controls.maxDistance=40;controls.minPolarAngle=0;controls.maxPolarAngle=Math.PI;controls.zoomToCursor=true;"],

  // ── 바닥 원판·받침대·고리: 항상 숨김 ──
  ["ground.visible=platform.visible=ring.visible=innerRing.visible=amount<.5&&!s.isolate;",
   "ground.visible=platform.visible=ring.visible=innerRing.visible=false;"],

  // ── 펼치기 방향 (원본 공식 그대로, 묶음 순서만 지정) ──
  ["const group=SYSTEMS.findIndex(sys=>sys.id===p.system);const angle=group/SYSTEMS.length*Math.PI*2;",
   "const angle=explodeAngle(p.system);"],
  ["group=SYSTEMS.findIndex(sys=>sys.id===p.system),angle=group/SYSTEMS.length*Math.PI*2;",
   "angle=explodeAngle(p.system);"],

  // ── 피부 표면 전용 처리 제거 (이 앱에는 피부가 없다) ──
  ["transparent:system==='integumentary',opacity:system==='integumentary'?.1:1,depthWrite:system!=='integumentary'",
   "transparent:false,opacity:1,depthWrite:true"],
  ["const hasSolid=atlas.parts.some((p,i)=>p.system!=='integumentary'&&data[i*4+3]>.5);", ""],
  ["||(hasSolid&&atlas.parts[i].system==='integumentary')", ""],
  ["||(hasSolid&&p.system==='integumentary')", ""],

  // ── 더블클릭한 곳을 회전 중심으로 ──
  ["renderer.domElement.addEventListener('pointerdown',down);",
   "const pivot={active:false,t:0,fromT:new T.Vector3(),toT:new T.Vector3(),fromC:new T.Vector3(),toC:new T.Vector3()};\n" +
   "  const dbl=(e:MouseEvent)=>{if(!ready)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);let nearest=Infinity,found=false;const hit=new T.Vector3();pickers.forEach((mesh,i)=>{if(!mesh||data[i*4+3]<.5)return;worldBox.copy(bounds[i]).translate(mesh.position);if(!raycaster.ray.intersectBox(worldBox,hitPoint))return;const hits=raycaster.intersectObject(mesh,false);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;hit.copy(hits[0].point);found=true;}});if(!found)return;pivot.fromT.copy(controls.target);pivot.toT.copy(hit);pivot.fromC.copy(camera.position);pivot.toC.copy(camera.position).add(hit).sub(controls.target);pivot.t=0;pivot.active=true;dirty=true;};\n" +
   "  renderer.domElement.addEventListener('dblclick',dbl);\n" +
   "  renderer.domElement.addEventListener('pointerdown',down);"],
  // 회전 중심 이동을 부드럽게 (0.35초)
  ["controls.enableRotate=amount<.8;",
   "if(pivot.active){pivot.t=Math.min(1,pivot.t+dt/.35);const k=1-Math.pow(1-pivot.t,3);controls.target.lerpVectors(pivot.fromT,pivot.toT,k);camera.position.lerpVectors(pivot.fromC,pivot.toC,k);dirty=true;if(pivot.t>=1)pivot.active=false;}\n   controls.enableRotate=amount<.8;"],

  // ── 한글 문구 ──
  ["'Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.'",
   "'3차원 뼈와 근육. 끌어서 돌리고, 휠이나 두 손가락으로 확대하고, 더블클릭으로 회전 중심을 옮기고, 눌러서 설명을 봅니다.'"],
  ["'This browser could not start the 3D viewer. Please try a browser with WebGL enabled.'",
   "'이 브라우저에서는 3D 화면을 열 수 없습니다. 크롬이나 엣지 최신 버전으로 열어 주세요.'"],
  ["'Could not assemble anatomy geometry.'", "'3D 모양을 조립하지 못했습니다.'"],
  ["'Could not load the anatomy.'", "'뼈와 근육 자료를 불러오지 못했습니다.'"],
  ["'The 3D session was paused by your device. Reload to continue.'", "'기기에서 3D 화면이 멈췄습니다. 새로 고침해 주세요.'"],
];

let ok = 0;
const missed = [];
for (const [from, to] of edits) {
  if (!src.includes(from)) { missed.push(from.slice(0, 70)); continue; }
  src = src.split(from).join(to);
  ok++;
}
writeFileSync(file, src);
console.log(`${file}: ${ok}/${edits.length}개 적용`);
missed.forEach(m => console.log('  못 찾음 · ' + m));

// 불러오기 오류 문구
const md = 'app/model-download.ts';
let m = readFileSync(md, 'utf8');
m = m.replace("'An anatomy file could not be loaded.'", "'자료 파일을 불러오지 못했습니다.'")
     .replace("'An anatomy file was incomplete. Please reload the viewer.'", "'자료 파일이 덜 받아졌습니다. 새로 고침해 주세요.'");
writeFileSync(md, m);
console.log(`${md}: 오류 문구 한글화`);
process.exit(missed.length ? 1 : 0);
