/**
 * 발음 기관 앱의 3D 화면 수정 (근골격계 앱 scene.tsx 위에 한 번만 적용)
 *
 * 1) 카메라와 펼치기를 머리 크기에 맞춘다 (자료 범위를 읽어 계산)
 * 2) 반으로 자르기: 몸 가운데 면으로 잘라 오른쪽 절반만 남긴다.
 *    왼쪽 옆에서 보면 교과서 그림처럼 얼굴이 화면 왼쪽을 향한다.
 *    자르는 면은 부드럽게 미끄러져 들어오고, 잘린 안쪽 면은 조금 어둡게 칠한다.
 * 3) 피부는 반투명으로 그리고, 클릭과 펼치기에서 뺀다.
 * 4) 클릭은 잘리고 남은 절반에만 반응한다.
 *
 * 실행: node scripts/patch-scene-speech.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'app/scene.tsx';
let src = readFileSync(file, 'utf8');
const edits = [];
const add = (a, b) => edits.push([a, b]);

// ── 1. 자료 범위 계산 ────────────────────────────────────────────────
add("const abort=new AbortController();",
  "const abort=new AbortController();\n" +
  "  // 자료의 실제 크기(머리와 목)에 맞춰 화면을 잡는다\n" +
  "  const modelBox=new T.Box3();atlas.parts.forEach(p=>modelBox.union(new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1]))));\n" +
  "  const modelCenter=modelBox.getCenter(new T.Vector3()),modelSize=modelBox.getSize(new T.Vector3());\n" +
  "  const focusY=modelCenter.y,modelSpan=Math.max(modelSize.x,modelSize.y,modelSize.z);\n" +
  "  // 반으로 자르기: x 가 constant 이하인 쪽(몸의 오른쪽 절반)만 남긴다. 끌 때는 아주 멀리 둔다.\n" +
  "  const CUT_OFF=1e6,cutPlane=new T.Plane(new T.Vector3(-1,0,0),CUT_OFF);let cutX=CUT_OFF;\n" +
  "  const cutIdle=modelBox.max.x+.02,midX=atlas.midX??modelCenter.x;");

// ── 2. 렌더러: 자르기 허용 ──────────────────────────────────────────
add("renderer.setClearColor('#f2f3f3');", "renderer.setClearColor('#f2f3f3');renderer.localClippingEnabled=true;");

// ── 3. 카메라 처음 위치와 거리 한계 ─────────────────────────────────
add("camera.position.set(1.4,1.05,3.6);controls.target.set(0,.85,0);",
  "const baseDistance=modelSpan/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)));camera.position.set(modelCenter.x+baseDistance*.7,focusY+baseDistance*.3,modelCenter.z+baseDistance*1.8);controls.target.copy(modelCenter);");
add("controls.maxDistance=40;", "controls.maxDistance=modelSpan*30;");

// ── 4. 재질: 자르는 면 적용, 피부는 반투명 ──────────────────────────
add("const m=new T.MeshStandardMaterial({color:SYSTEMS.find(s=>s.id===system)?.color??'#aebbb8',metalness:.08,roughness:.53,side:T.DoubleSide,transparent:false,opacity:1,depthWrite:true})",
  "const skin=system==='skin';const m=new T.MeshStandardMaterial({color:SYSTEMS.find(s=>s.id===system)?.color??'#aebbb8',metalness:.08,roughness:skin?.75:.53,side:T.DoubleSide,transparent:skin,opacity:skin?.16:1,depthWrite:!skin,clippingPlanes:[cutPlane]})");
// 잘린 안쪽 면(뒷면)을 조금 어둡게 칠해 단면처럼 보이게 한다
add("diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.85, 0.78), partSelected * 0.75);",
  "diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.85, 0.78), partSelected * 0.75);\\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.74;");
// 피부는 맨 나중에 그린다
add("const mesh=new T.Mesh(geometry,mats.get(system as never));mesh.frustumCulled=false;",
  "const mesh=new T.Mesh(geometry,mats.get(system as never));mesh.frustumCulled=false;if(system==='skin')mesh.renderOrder=5;");

// ── 5. 화면 맞춤 ────────────────────────────────────────────────────
add("normalDistance=mobile?Math.max(4.5,1.8*el.clientHeight/Math.max(160,el.clientHeight-350)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)))):4;",
  "normalDistance=baseDistance*(mobile?2.5:1.75);");
add("controls.target.set(extent>.1&&el.clientWidth>767?-packingWidth*.12:0,extent>.1||mobile?.85:.68,0);",
  "controls.target.set(extent>.1&&el.clientWidth>767?modelCenter.x-packingWidth*.12:modelCenter.x,focusY,modelCenter.z);");

// ── 6. 펼치기: 원본 동작 그대로, 거리만 머리 크기에 맞춘다 ──────────
add("offsets[i]=cell?new T.Vector3(cell.x,cell.y+.85,0):centers[i].clone();",
  "offsets[i]=cell?new T.Vector3(cell.x+modelCenter.x,cell.y+focusY,modelCenter.z):centers[i].clone();");
add("if(amount<=.45){const t=amount/.45;const angle=explodeAngle(p.system);dx=Math.sin(angle)*t*.48;dy=(c.y-.85)*t*.28;dz=Math.cos(angle)*t*.48;}",
  "if(amount<=.45){const t=amount/.45;const angle=explodeAngle(p.system);dx=Math.sin(angle)*t*modelSpan*.7;dy=(c.y-focusY)*t*.28;dz=Math.cos(angle)*t*modelSpan*.7;}");
add("else {const t=(amount-.45)/.55,angle=explodeAngle(p.system);dx=T.MathUtils.lerp(Math.sin(angle)*.48,destination.x-c.x,t);dy=T.MathUtils.lerp((c.y-.85)*.28,destination.y-c.y,t);dz=T.MathUtils.lerp(Math.cos(angle)*.48,-c.z,t);}",
  "else {const t=(amount-.45)/.55,angle=explodeAngle(p.system);dx=T.MathUtils.lerp(Math.sin(angle)*modelSpan*.7,destination.x-c.x,t);dy=T.MathUtils.lerp((c.y-focusY)*.28,destination.y-c.y,t);dz=T.MathUtils.lerp(Math.cos(angle)*modelSpan*.7,destination.z-c.z,t);}");
// 피부는 펼칠 때 숨기고, 격자 배치에서도 뺀다
add("data.set([dx,dy,dz,(s.isolate?selected:visible.has(p.system)||selected)?1:0],i*4);",
  "data.set([dx,dy,dz,(s.isolate?selected:visible.has(p.system)||selected)&&!(p.system==='skin'&&(amount>.03||s.isolate))?1:0],i*4);");
add("const visibleParts=atlas.parts.filter(p=>s.isolate?selection.has(p.id):visible.has(p.system)||selection.has(p.id));",
  "const visibleParts=atlas.parts.filter(p=>p.system!=='skin'&&(s.isolate?selection.has(p.id):visible.has(p.system)||selection.has(p.id)));");
// 피부 숨김 상태가 펼치기와 함께 바뀌므로, 피부 경계(.03)를 넘을 때도 다시 계산한다
add("const changed=lastState?.visible!==s.visible||lastState?.selected!==s.selected||lastState?.isolate!==s.isolate;",
  "const changed=lastState?.visible!==s.visible||lastState?.selected!==s.selected||lastState?.isolate!==s.isolate||(lastExtent<=.03)!==(amount<=.03);");

// ── 7. 클릭: 피부는 건너뛰고, 잘려 나간 쪽의 표면은 무시한다 ────────
add("const hits=raycaster.intersectObject(mesh,false);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;found=i;}",
  "if(atlas.parts[i].system==='skin')return;const hits=raycaster.intersectObject(mesh,false).filter(h=>h.point.x<=cutPlane.constant+1e-4);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;found=i;}");
add("const hits=raycaster.intersectObject(mesh,false);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;hit.copy(hits[0].point);found=true;}",
  "if(atlas.parts[i].system==='skin')return;const hits=raycaster.intersectObject(mesh,false).filter(h=>h.point.x<=cutPlane.constant+1e-4);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;hit.copy(hits[0].point);found=true;}");

// ── 8. 자르는 면 움직이기 (펼친 상태에서는 자르지 않는다) ──────────
add("controls.enableRotate=amount<.8;",
  "{const want=s.cut&&amount<=.03?midX:cutIdle;if(cutX===CUT_OFF)cutX=cutIdle;cutX=T.MathUtils.damp(cutX,want,5,dt);if(Math.abs(cutX-want)<1e-4)cutX=want;cutPlane.constant=(!s.cut||amount>.03)&&cutX>=cutIdle-1e-4?CUT_OFF:cutX;if(Math.abs(cutX-want)>1e-4)dirty=true;}\n   controls.enableRotate=amount<.8;");
// 자르기 상태가 바뀌면 한 번 다시 그린다
add("if(s.view!==lastView||s.reset!==lastReset){",
  "if(s.cut!==lastState?.cut)dirty=true;\n   if(s.view!==lastView||s.reset!==lastReset){");

let ok = 0;
const missed = [];
for (const [from, to] of edits) {
  if (!src.includes(from)) { missed.push(from.slice(0, 80)); continue; }
  src = src.split(from).join(to);
  ok++;
}
writeFileSync(file, src);
console.log(`${file}: ${ok}/${edits.length}개 적용`);
missed.forEach(m => console.log('  못 찾음 · ' + m));

// 격자 칸 크기를 작은 부품(이, 연골)에 맞춘다
const lf = 'app/explosion-layout.ts';
let l = readFileSync(lf, 'utf8');
l = l.replace('Math.max(.035,p.bounds[1][0]-p.bounds[0][0])+.04', 'Math.max(.008,p.bounds[1][0]-p.bounds[0][0])+.01')
     .replace('Math.max(.035,p.bounds[1][1]-p.bounds[0][1])+.04', 'Math.max(.008,p.bounds[1][1]-p.bounds[0][1])+.01')
     .replace('maxWidth=Math.max(.3,...cards.map(c=>c.width))', 'maxWidth=Math.max(.06,...cards.map(c=>c.width))');
writeFileSync(lf, l);
console.log(`${lf}: 격자 칸 크기 조정`);
process.exit(missed.length ? 1 : 0);
