/**
 * 발음 기관 앱 자료 생성
 *
 * 1) 발음 기관 130개를 고른다 (speech-select.mjs)
 * 2) 한글 이름: 근골격계 앱에서 검수한 이름을 재사용하고, 새 구조는 scripts/ko/out 의 검수 결과를 쓴다
 * 3) 피부·기관·식도는 목 아래를 잘라 낸다 (피부는 어깨도 잘라 머리 윤곽만 남긴다)
 * 4) 국어 교과서 용어로 검색 묶음을 만든다 (센입천장, 여린입천장, 목청 등)
 * 5) 형상을 압축해 저장한다
 *
 * 실행: node scripts/build-speech-atlas.mjs [--strict]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { SRC, loadAtlas, selectSpeech } from './speech-select.mjs';
import { ruleName } from './msk-names.mjs';

const STRICT = process.argv.includes('--strict');
const OUT = 'public/models-speech';
const warn = [];
const atlas = loadAtlas();
const { list } = selectSpeech(atlas);

// ── 1. 이름표: 근골격계 재사용 → 새 검수 결과 → 최종 이름표 ────────────
const named = new Map();
const load = dir => { if (!existsSync(dir)) return; for (const f of readdirSync(dir)) if (f.endsWith('.json')) for (const r of JSON.parse(readFileSync(join(dir, f), 'utf8'))) named.set(String(r.en).toLowerCase().replace(' (between t12 and l1)', ''), r); };
load('scripts/ko/reuse');
load('scripts/ko/out');
const OVERRIDE = {
  'levator palpebrae superioris': { ko: '위눈꺼풀올림근', alt: '상안검거근' },
  'intermediate tendon': { ko: '두힘살근 중간힘줄', alt: '악이복근 중간건' },
};
const SIDE = { left: '왼쪽', right: '오른쪽', '': '' };
const fixDesc = s => s.replace(/넓적다리/g, '넙다리');

for (const x of list) {
  const r = { ...(named.get(x.key) ?? {}), ...(OVERRIDE[x.key] ?? {}) };
  const rule = ruleName(x.key);
  x.ko = (r.ko ?? rule?.ko ?? '').trim();
  x.alt = (r.alt ?? rule?.alt ?? '').trim();
  x.desc = fixDesc((r.desc ?? '').trim());
  if (!x.ko) { warn.push(`한글 이름 없음: ${x.key}`); x.ko = x.base; }
  if (!x.desc && x.sys !== 'skin') warn.push(`설명 없음: ${x.key}`);
  if (x.alt === x.ko) x.alt = ''; // 옛 용어가 새 용어와 같으면 한 번만 보인다
  x.display = SIDE[x.side] ? `${SIDE[x.side]} ${x.ko}` : x.ko;
}

// ── 2. 목 아래 잘라 내기 ─────────────────────────────────────────────
const cricoid = list.find(x => x.key === 'cricoid cartilage');
const FLOOR_Y = cricoid.part.bounds[0][1] - 0.035;
const CROP = { skin: (x, y) => y >= FLOOR_Y && Math.abs(x) <= 0.11, trachea: (x, y) => y >= FLOOR_Y, esophagus: (x, y) => y >= FLOOR_Y };
console.log(`목 아래 자르는 높이 y=${FLOOR_Y.toFixed(3)}`);

const srcBufs = new Map();
const srcOf = ci => { if (!srcBufs.has(ci)) srcBufs.set(ci, readFileSync(join(SRC, `body-${ci}.bin`))); return srcBufs.get(ci); };
const ab = (b, off, len) => b.buffer.slice(b.byteOffset + off, b.byteOffset + off + len);

// 몸 한가운데 선: 좌우가 없는 구조들의 중심 평균
const midX = (() => { const mids = list.filter(x => x.sys !== 'skin' && !x.side); return mids.reduce((s, x) => s + x.center[0], 0) / mids.length; })();

// ── 2-1. 입술 사이 금 ────────────────────────────────────────────────
// 원본 입술은 윗입술과 아랫입술이 한 덩어리로 이어져 있어, 아래턱을 내리면 두 입술 사이가 막처럼 늘어난다.
// 두 입술이 맞닿는 금(정점이 가장 몰린 높이)을 x 구간마다 찾아 y = y0 + c2·(x − midX)² 로 맞추고,
// 입술과 피부 앞쪽을 이 곡선을 따라 잘라 위·아래 두 겹으로 나눈다. 잘린 자리의 정점은 위·아래로 0.02mm 띄워
// 화면 셰이더가 같은 곡선으로 어느 쪽인지 가를 수 있게 한다.
const FIS = (() => {
  const lip = list.find(x => x.key === 'lip').part, P = new Float32Array(ab(srcOf(lip.chunk), lip.positions, lip.vertexCount * 12));
  const V = []; for (let i = 0; i < lip.vertexCount; i++) V.push([P[i * 3] - midX, P[i * 3 + 1]]);
  const hw = (lip.bounds[1][0] - lip.bounds[0][0]) / 2, pts = [];
  for (let cx = -hw + 0.003; cx <= hw - 0.003; cx += 0.0025) {
    const s = V.filter(v => Math.abs(v[0] - cx) < 0.00125);
    if (s.length < 30) continue;
    const top = Math.max(...s.map(v => v[1])), bot = Math.min(...s.map(v => v[1])), h = new Map();
    for (const v of s) if (v[1] < top - 0.0012 && v[1] > bot + 0.0012) { const k = Math.round(v[1] * 4000); h.set(k, (h.get(k) || 0) + 1); }
    const [k, n] = [...h.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (n) pts.push([cx, k / 4000, n]);
  }
  // 가중 최소제곱: y = y0 + c2·u, u = x²
  let sw = 0, su = 0, sy = 0, suu = 0, suy = 0;
  for (const [cx, y, n] of pts) { const u = cx * cx; sw += n; su += n * u; sy += n * y; suu += n * u * u; suy += n * u * y; }
  const c2 = (sw * suy - su * sy) / (sw * suu - su * su), y0 = (sy - c2 * su) / sw;
  console.log(`입술 사이 금: y = ${y0.toFixed(5)} + ${c2.toFixed(3)}·x² (구간 ${pts.length}개, 반폭 ${hw.toFixed(4)})`);
  return { y0, c2, hw };
})();
// 입꼬리 바깥에서는 금 높이를 입꼬리 높이로 고정한다(화면 셰이더와 같은 식)
const fisY = x => FIS.y0 + FIS.c2 * Math.min(Math.abs(x - midX), FIS.hw) ** 2;
const CUT = {
  lip: () => true,
  // 피부는 입 앞쪽(입꼬리보다 조금 넓게)만 자른다. 뒤통수·목 뒤의 같은 높이는 건드리지 않는다
  skin: (cx, cy, cz) => Math.abs(cx - midX) < FIS.hw * 1.2 && cz > 0.05,
};
function cutAlongFissure(g, inZone, label) {
  const P = new Float32Array(g.pos.buffer.slice(g.pos.byteOffset, g.pos.byteOffset + g.pos.length));
  const N = new Int16Array(g.nrm.buffer.slice(g.nrm.byteOffset, g.nrm.byteOffset + g.nrm.length));
  const I = new Uint32Array(g.idx.buffer.slice(g.idx.byteOffset, g.idx.byteOffset + g.idx.length));
  const outP = Array.from(P), outN = Array.from(N), outI = [];
  const TAU = 3e-5, EPS = 2e-5, vc = g.vertexCount;
  const d = new Float64Array(vc), s = new Int8Array(vc);
  for (let v = 0; v < vc; v++) { d[v] = P[v * 3 + 1] - fisY(P[v * 3]); s[v] = d[v] > TAU ? 1 : d[v] < -TAU ? -1 : 0; }
  const addV = (x, y, z, nx, ny, nz) => {
    const i = outP.length / 3, l = Math.hypot(nx, ny, nz) || 1;
    outP.push(x, y, z); outN.push(Math.round(nx / l * 32767), Math.round(ny / l * 32767), Math.round(nz / l * 32767));
    return i;
  };
  const copies = new Map(), cuts = new Map();
  // 금 바로 위에 있던 정점: 위·아래 복사본
  const copyOf = (v, side) => {
    const k = v + ':' + side;
    if (!copies.has(k)) { const x = P[v * 3]; copies.set(k, addV(x, fisY(x) + side * EPS, P[v * 3 + 2], N[v * 3], N[v * 3 + 1], N[v * 3 + 2])); }
    return copies.get(k);
  };
  // 금을 가로지르는 모서리: 곡선 위의 새 정점 한 쌍 [위, 아래]
  const cutOf = (a, b) => {
    const k = a < b ? a + ':' + b : b + ':' + a;
    if (!cuts.has(k)) {
      const t = d[a] / (d[a] - d[b]), L = j => P[a * 3 + j] + (P[b * 3 + j] - P[a * 3 + j]) * t, M = j => N[a * 3 + j] + (N[b * 3 + j] - N[a * 3 + j]) * t;
      const x = L(0), y = fisY(x), z = L(2);
      cuts.set(k, [addV(x, y + EPS, z, M(0), M(1), M(2)), addV(x, y - EPS, z, M(0), M(1), M(2))]);
    }
    return cuts.get(k);
  };
  let split = 0;
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t], I[t + 1], I[t + 2]];
    const c = [0, 1, 2].map(j => (P[tri[0] * 3 + j] + P[tri[1] * 3 + j] + P[tri[2] * 3 + j]) / 3);
    if (!inZone(c[0], c[1], c[2])) { outI.push(...tri); continue; }
    const hasUp = tri.some(v => s[v] > 0), hasLo = tri.some(v => s[v] < 0);
    if (!hasLo) { outI.push(...tri.map(v => s[v] === 0 ? copyOf(v, 1) : v)); continue; }
    if (!hasUp) { outI.push(...tri.map(v => s[v] === 0 ? copyOf(v, -1) : v)); continue; }
    split++;
    const up = [], lo = [];
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3];
      if (s[a] > 0) up.push(a); else if (s[a] < 0) lo.push(a); else { up.push(copyOf(a, 1)); lo.push(copyOf(a, -1)); }
      if (s[a] * s[b] < 0) { const [cu, cl] = cutOf(a, b); up.push(cu); lo.push(cl); }
    }
    for (const poly of [up, lo]) for (let k = 1; k + 1 < poly.length; k++) outI.push(poly[0], poly[k], poly[k + 1]);
  }
  const lo3 = [Infinity, Infinity, Infinity], hi3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < outP.length; i += 3) for (let k = 0; k < 3; k++) { lo3[k] = Math.min(lo3[k], outP[i + k]); hi3[k] = Math.max(hi3[k], outP[i + k]); }
  console.log(`  ${label}: 입술 사이 금을 따라 삼각형 ${split}개를 나눔 (정점 ${vc} → ${outP.length / 3})`);
  return {
    pos: Buffer.from(new Float32Array(outP).buffer), nrm: Buffer.from(new Int16Array(outN).buffer), idx: Buffer.from(new Uint32Array(outI).buffer),
    vertexCount: outP.length / 3, indexCount: outI.length, bounds: [lo3, hi3],
  };
}

function geometryOf(x) {
  const g = croppedGeometryOf(x);
  return CUT[x.key] ? cutAlongFissure(g, CUT[x.key], x.ko) : g;
}
function croppedGeometryOf(x) {
  const p = x.part, b = srcOf(p.chunk);
  const pos = Buffer.from(ab(b, p.positions, p.vertexCount * 12));
  const nrm = Buffer.from(ab(b, p.normals, p.vertexCount * 6));
  const idx = Buffer.from(ab(b, p.indices, p.indexCount * 4));
  const keep = CROP[x.key];
  if (!keep) return { pos, nrm, idx, vertexCount: p.vertexCount, indexCount: p.indexCount, bounds: p.bounds };
  const P = new Float32Array(ab(b, p.positions, p.vertexCount * 12));
  const N = new Int16Array(ab(b, p.normals, p.vertexCount * 6));
  const I = new Uint32Array(ab(b, p.indices, p.indexCount * 4));
  const ok = v => keep(P[v * 3], P[v * 3 + 1]);
  const remap = new Int32Array(p.vertexCount).fill(-1);
  const outI = [], outP = [], outN = [];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], c = I[t + 1], d = I[t + 2];
    if (!(ok(a) && ok(c) && ok(d))) continue;
    for (const v of [a, c, d]) {
      if (remap[v] < 0) {
        remap[v] = outP.length / 3;
        for (let k = 0; k < 3; k++) { const q = P[v * 3 + k]; outP.push(q); outN.push(N[v * 3 + k]); lo[k] = Math.min(lo[k], q); hi[k] = Math.max(hi[k], q); }
      }
      outI.push(remap[v]);
    }
  }
  console.log(`  ${x.ko}: 삼각형 ${p.indexCount / 3} → ${outI.length / 3}`);
  return {
    pos: Buffer.from(new Float32Array(outP).buffer), nrm: Buffer.from(new Int16Array(outN).buffer), idx: Buffer.from(new Uint32Array(outI).buffer),
    vertexCount: outP.length / 3, indexCount: outI.length, bounds: [lo, hi],
  };
}

// ── 3. 형상 담기 (2개 파일) ─────────────────────────────────────────
const ORDER = ['skin', 'jaw', 'teeth', 'lip', 'nose', 'tongue', 'palate', 'pharynx', 'larynx', 'vocal'];
list.sort((a, b) => ORDER.indexOf(a.sys) - ORDER.indexOf(b.sys) || a.part.id.localeCompare(b.part.id));
const geos = list.map(geometryOf);
const total = geos.reduce((s, g) => s + g.pos.length + g.nrm.length + g.idx.length, 0);
const chunks = [];
let cur = null;
const newChunk = () => { cur = { blocks: [], size: 0 }; chunks.push(cur); };
const put = buf => { const pad = (4 - (cur.size % 4)) % 4; if (pad) { cur.blocks.push(Buffer.alloc(pad)); cur.size += pad; } const at = cur.size; cur.blocks.push(buf); cur.size += buf.length; return at; };
newChunk();
const ROLE = x => x.key === 'mandible' || /^lower .* tooth$/.test(x.key) || x.key === 'gingiva of lower jaw' ? 1
  : /^(tongue|genioglossus|hyoglossus)$/.test(x.key) ? 2 : x.key === 'lip' ? 3 : x.sys === 'skin' ? 4 : x.sys === 'palate' ? 5
  : /^(mylohyoid|geniohyoid|digastric|intermediate tendon)$/.test(x.key) ? 6 : x.sys === 'vocal' ? 7 : 0;
const parts = list.map((x, i) => {
  const g = geos[i];
  if (cur.size > total / 2 && chunks.length < 2) newChunk();
  const positions = put(g.pos), normals = put(g.nrm), indices = put(g.idx);
  return {
    id: x.part.id, name: x.display, alt: x.alt || undefined, dkey: x.ko, nameEn: x.part.name,
    conceptId: x.part.conceptId, system: x.sys, role: ROLE(x) || undefined, chunk: chunks.length - 1,
    positions, normals, indices, vertexCount: g.vertexCount, indexCount: g.indexCount, bounds: g.bounds,
  };
});

// ── 4. 설명과 검색 묶음 ─────────────────────────────────────────────
const descriptions = {};
for (const x of list) if (x.desc) descriptions[x.ko] = x.desc;

const GROUPS = [
  ['이', '치아', x => x.sys === 'teeth', '위아래 잇몸에 줄지어 박힌 단단한 이입니다. 이는 소리를 직접 만들지는 않지만, 혀와 입술이 닿는 자리를 잡아 주어 발음을 또렷하게 합니다. 앞니가 빠지면 ㅅ 소리가 새어 발음이 흐려지기 쉽습니다.'],
  ['윗니', '상악 치아', x => /^upper .* tooth$/.test(x.key), '위턱에 박힌 이입니다. 윗니 바로 뒤의 윗잇몸은 혀끝이 닿아 잇몸소리 ㄷ, ㄸ, ㅌ, ㅅ, ㅆ, ㄴ, ㄹ이 나는 자리입니다.'],
  ['아랫니', '하악 치아', x => /^lower .* tooth$/.test(x.key), '아래턱에 박힌 이로, 입을 벌리고 닫을 때 아래턱과 함께 움직입니다. 입을 크게 벌리는 ㅏ와 작게 벌리는 ㅣ를 소리 내며 윗니와 아랫니 사이가 얼마나 벌어지는지 비교해 볼 수 있습니다.'],
  ['센입천장', '경구개', x => /^(maxilla|palatine bone)$/.test(x.key), '입천장의 앞쪽 단단한 부분으로, 위턱뼈와 입천장뼈가 바탕을 이룹니다. 혓바닥을 센입천장에 대었다 떼며 센입천장소리 ㅈ, ㅉ, ㅊ을 냅니다. 혀로 입천장을 앞에서 뒤로 더듬으면 단단한 곳이 센입천장입니다.'],
  ['여린입천장', '연구개', x => x.sys === 'palate', '센입천장 뒤에 이어지는 부드러운 입천장으로, 이 자료에서는 그 속 근육으로 보여 줍니다. 혀의 뒷부분을 여기에 대었다 떼며 여린입천장소리 ㄱ, ㄲ, ㅋ, ㅇ을 냅니다. 여린입천장이 내려오면 공기가 코로 나가 콧소리 ㅁ, ㄴ, ㅇ이 납니다.'],
  ['목젖', '구개수', x => x.key === 'uvular muscle', '여린입천장 끝에 매달린 작은 살덩이로, 이 자료에서는 그 속의 목젖근을 보여 줍니다. 여린입천장이 올라가 코로 가는 길을 막을 때 목젖도 함께 올라갑니다. 거울 앞에서 입을 크게 벌리고 "아" 하면 볼 수 있습니다.'],
  ['혀 전체', '설', x => /^(tongue|genioglossus|hyoglossus)$/.test(x.key), '혀와 혀를 움직이는 근육을 함께 묶었습니다. 혀끝은 잇몸소리, 혓바닥은 센입천장소리, 혀의 뒷부분은 여린입천장소리를 만듭니다. 혀의 높낮이와 앞뒤 위치는 모음을 가르는 기준이 됩니다.'],
  ['입 바닥 근육', '구강저 근육', x => /^(mylohyoid|geniohyoid|digastric|stylohyoid|intermediate tendon|stylohyoid ligament)$/.test(x.key), '아래턱뼈와 목뿔뼈 사이를 메워 입안의 바닥을 이루는 근육들입니다. 혀를 아래에서 받치고 들어 올려 혀가 자유롭게 움직이도록 돕습니다.'],
  ['목청', '성대', x => x.sys === 'vocal', '후두 속에 있는 한 쌍의 주름으로 성대라고도 하며, 이 자료에서는 성대인대와 성대근으로 보여 줍니다. 목청이 떨리면 울림소리가 나는데, 모든 모음과 ㄴ, ㄹ, ㅁ, ㅇ이 울림소리입니다. 목청 사이를 좁혀 공기를 마찰시키면 목청소리 ㅎ이 납니다.'],
  ['후두', '', x => (x.sys === 'larynx' && x.key !== 'trachea') || x.sys === 'vocal', '목 앞쪽에서 목뿔뼈 아래에 있는 연골 상자로, 그 안에 목청이 들어 있습니다. 남자 목에 툭 튀어나온 울대뼈가 후두의 방패연골입니다. 숨을 쉬는 길이면서 목소리를 만드는 곳입니다.'],
  ['인두', '', x => x.sys === 'pharynx' && x.key !== 'esophagus', '코안과 입안 뒤쪽에서 아래로 이어지는 근육 관으로, 공기와 음식이 함께 지나갑니다. 목청에서 만들어진 소리가 입과 코로 나가기 전에 울리는 통로가 됩니다.'],
  ['코', '코안 · 비강', x => x.sys === 'nose', '코뼈와 코연골이 코의 모양을 만들고, 그 안쪽의 빈 곳을 코안이라고 합니다. 여린입천장이 내려와 공기가 코안으로 빠져나가면 콧소리 ㅁ, ㄴ, ㅇ이 납니다. 코를 막고 "마, 나"를 소리 내 보면 콧소리가 잘 나지 않는 것을 느낄 수 있습니다.'],
  ['아래턱', '하악', x => x.key === 'mandible', '입을 벌리고 닫게 하는 뼈로, 아래턱이 내려가는 정도에 따라 입이 벌어지는 크기가 달라집니다. 혀의 위치가 낮은 모음인 ㅏ, ㅐ를 낼 때 입이 가장 크게 벌어집니다.'],
];

const concepts = [];
let n = 0;
const add = (name, elements, alt, dkey) => {
  if (!elements.length) return;
  if (concepts.some(c => c.name === name)) { warn.push(`검색 묶음 이름 겹침: ${name}`); return; }
  concepts.push({ id: `SPK${String(++n).padStart(3, '0')}`, name, alt: alt || undefined, dkey: dkey ?? name, elements });
};
const ids = pred => list.filter(pred).map(x => x.part.id);
for (const [name, alt, pred, desc] of GROUPS) { add(name, ids(pred), alt); descriptions[name] = desc; }

const visible = list.filter(x => x.sys !== 'skin');
const byBase = new Map();
for (const x of visible) { const g = byBase.get(x.ko) ?? []; g.push(x); byBase.set(x.ko, g); }
for (const [ko, xs] of byBase) {
  if (concepts.some(c => c.name === ko)) continue;
  const sided = xs.some(x => x.side);
  if (xs.length > 1 || !sided) add(ko, xs.map(x => x.part.id), xs[0].alt, ko);
}
const byDisplay = new Map();
for (const x of visible) { const g = byDisplay.get(x.display) ?? []; g.push(x); byDisplay.set(x.display, g); }
for (const [display, xs] of byDisplay) if (!concepts.some(c => c.name === display)) add(display, xs.map(x => x.part.id), xs[0].alt, xs[0].ko);


// ── 4-1. 발음 시뮬레이션 기준점 ─────────────────────────────────────
// 모두 몸 한가운데 면(x=midX) 위의 [y, z] 로 계산한다. 얼굴은 +z 쪽을 향한다.
function vertsOf(pred, midOnly = 0) {
  const out = [];
  for (const x of list) {
    if (!pred(x)) continue;
    const p = x.part, b = srcOf(p.chunk);
    const P = new Float32Array(ab(b, p.positions, p.vertexCount * 12));
    for (let i = 0; i < p.vertexCount; i++) {
      const vx = P[i * 3], vy = P[i * 3 + 1], vz = P[i * 3 + 2];
      if (midOnly && Math.abs(vx - midX) > midOnly) continue;
      out.push([vx, vy, vz]);
    }
  }
  return out;
}
const avg = vs => [0, 1, 2].map(k => vs.reduce((s, v) => s + v[k], 0) / vs.length);
const by = (vs, k, dir) => vs.reduce((a, v) => (dir > 0 ? v[k] > a[k] : v[k] < a[k]) ? v : a, vs[0]);
/** z 구간을 n 등분해 각 구간의 y 최솟값(아랫면) 또는 최댓값(윗면)을 이은 곡선 */
function profile(vs, n, useMax) {
  const z0 = Math.min(...vs.map(v => v[2])), z1 = Math.max(...vs.map(v => v[2]));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = z0 + (z1 - z0) * i / n, c = z0 + (z1 - z0) * (i + 1) / n;
    const bin = vs.filter(v => v[2] >= a && v[2] <= c);
    if (!bin.length) continue;
    const y = useMax ? Math.max(...bin.map(v => v[1])) : Math.min(...bin.map(v => v[1]));
    pts.push([y, (a + c) / 2]);
  }
  return pts; // 뒤(작은 z)에서 앞(큰 z) 순서
}
const L = {};
const yz = v => [+v[1].toFixed(4), +v[2].toFixed(4)];

// 턱관절(아래턱뼈 관절머리): 아래턱뼈 뒤쪽 1/3 가운데 가장 높은 띠
{
  const m = vertsOf(x => x.key === 'mandible');
  const z0 = Math.min(...m.map(v => v[2])), z1 = Math.max(...m.map(v => v[2]));
  const back = m.filter(v => v[2] < z0 + (z1 - z0) * 0.3);
  const top = Math.max(...back.map(v => v[1]));
  L.jawPivot = yz(avg(back.filter(v => v[1] > top - 0.008)));
  L.chin = yz(by(m, 2, +1));
}
// 혀: 한가운데 면의 윗면 곡선, 혀끝, 혀뿌리
{
  const t = vertsOf(x => x.key === 'tongue', 0.006), tAll = vertsOf(x => x.key === 'tongue');
  L.tongueTip = yz(by(t, 2, +1));
  L.tongueTop = profile(tAll, 12, true).map(([y, z]) => [+y.toFixed(4), +z.toFixed(4)]);
  L.tongueBottom = profile(tAll, 12, false).map(([y, z]) => [+y.toFixed(4), +z.toFixed(4)]);
}
// 입천장: 위턱뼈·입천장뼈 한가운데의 아랫면 곡선, 뒤끝(여린입천장이 붙는 곳)
{
  const pal = vertsOf(x => /^(maxilla|palatine bone)$/.test(x.key), 0.006);
  const incisor = list.filter(x => x.key === 'upper central secondary incisor tooth');
  const incZ = Math.max(...incisor.map(x => x.part.bounds[1][2]));
  const incBottom = Math.min(...incisor.map(x => x.part.bounds[0][1]));
  const front = pal.filter(v => v[2] <= incZ - 0.012 && v[2] >= incZ - 0.035 && v[1] > incBottom + 0.004);
  const vaultY = front.length ? front.reduce((m, v) => Math.min(m, v[1]), Infinity) : incBottom + 0.022;
  const near = vertsOf(x => /^(maxilla|palatine bone)$/.test(x.key), 0.015).filter(v => Math.abs(v[1] - vaultY) < 0.008);
  const back = by(near, 2, -1);
  L.pns = [+vaultY.toFixed(4), +back[2].toFixed(4)];
  L.palateVaultY = +vaultY.toFixed(4);
  L.incisorEdge = [+incBottom.toFixed(4), +incZ.toFixed(4)];
  // 앞니 뒤쪽부터 입천장뼈 뒤끝까지의 아랫면
  const oral = pal.filter(v => v[2] <= incZ - 0.004 && v[2] >= back[2] && v[1] > incBottom + 0.004 && v[1] < vaultY + 0.008);
  L.palate = profile(oral, 12, false).map(([y, z]) => [+y.toFixed(4), +z.toFixed(4)]);
}
// 목젖 끝, 목청, 후두덮개 끝, 기관 아래끝, 목뿔뼈
{
  const uv = vertsOf(x => x.key === 'uvular muscle');
  L.uvulaTip = yz(by(uv, 1, -1));
  L.glottis = yz(avg(vertsOf(x => x.key === 'vocal ligament')));
  L.epiglottisTip = yz(by(vertsOf(x => x.key === 'epiglottis'), 1, +1));
  const tr = vertsOf(x => x.key === 'trachea', 0.012).filter(v => v[1] >= FLOOR_Y);
  L.tracheaBottom = yz(avg(tr.filter(v => v[1] < Math.min(...tr.map(q => q[1])) + 0.006)));
  L.hyoid = yz(avg(vertsOf(x => x.key === 'hyoid bone')));
}
// 인두 뒷벽: 인두수축근의 한가운데에서 각 높이의 가장 앞쪽 점(안쪽 면)
{
  const wall = vertsOf(x => /pharyngeal constrictor/.test(x.key), 0.01);
  const at = y => { const band = wall.filter(v => Math.abs(v[1] - y) < 0.005); return band.length ? Math.min(...band.map(v => v[2])) + 0.006 : null; };
  const levels = { naso: L.pns[0] + 0.008, oro: L.uvulaTip[0] - 0.006, laryngo: L.epiglottisTip[0] - 0.012 };
  L.pharynxWall = {};
  for (const [k, y] of Object.entries(levels)) { const z = at(y); L.pharynxWall[k] = [+y.toFixed(4), +(z ?? L.pns[1] - 0.02).toFixed(4)]; }
}
// 입술, 코
{
  const lip = vertsOf(x => x.key === 'lip');
  const c = avg(lip);
  L.lip = { center: yz(c), front: +Math.max(...lip.map(v => v[2])).toFixed(4), halfWidth: +((Math.max(...lip.map(v => v[0])) - Math.min(...lip.map(v => v[0]))) / 2).toFixed(4),
    fissure: [+FIS.y0.toFixed(6), +FIS.c2.toFixed(4), +FIS.hw.toFixed(5)] };
  const sept = vertsOf(x => x.key === 'septal nasal cartilage');
  const low = sept.filter(v => v[1] < Math.min(...sept.map(q => q[1])) + 0.006);
  L.nostril = yz(by(low, 2, +1));
  L.nasalCavity = yz(avg(vertsOf(x => x.key === 'inferior nasal concha')));
}
console.log('발음 시뮬레이션 기준점:');
for (const [k, v] of Object.entries(L)) console.log(`  ${k}: ${JSON.stringify(v)}`);

// ── 5. 저장 ─────────────────────────────────────────────────────────
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
let raw = 0, gzt = 0;
const chunkMeta = chunks.map((c, i) => {
  const r = Buffer.concat(c.blocks), g = gzipSync(r, { level: 9 });
  writeFileSync(join(OUT, `speech-${i}.bin`), r);
  writeFileSync(join(OUT, `speech-${i}.bin.gz`), g);
  raw += r.length; gzt += g.length;
  return { url: `/models-speech/speech-${i}.bin`, bytes: r.length, gzip: `/models-speech/speech-${i}.bin.gz`, gzipBytes: g.length };
});
const out = {
  version: atlas.version, sex: atlas.sex, source: atlas.source, scope: '성인 남성 표준 인체 · 발음 기관 단원',
  parts, concepts, descriptions, chunks: chunkMeta, triangles: parts.reduce((s, p) => s + p.indexCount / 3, 0), midX, landmarks: L,
};
writeFileSync(join(OUT, 'atlas.json'), JSON.stringify(out));
console.log(`부품 ${parts.length}개 · 삼각형 ${out.triangles.toLocaleString()}개 · 몸 한가운데 x=${midX.toFixed(4)}`);
console.log(`형상 ${(raw / 1048576).toFixed(2)} MB → 압축 ${(gzt / 1048576).toFixed(2)} MB · 검색 묶음 ${concepts.length}개 · 설명 ${Object.keys(descriptions).length}개`);
const uw = [...new Set(warn)];
if (uw.length) { console.log(`\n확인 필요 ${uw.length}건:`); uw.forEach(w => console.log('  · ' + w)); }
if (STRICT && uw.length) process.exit(1);
