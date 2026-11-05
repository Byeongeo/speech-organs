/**
 * 근골격계 앱 자료 생성
 *
 * 1) 뼈·근육·힘줄·인대·치아 679개를 고른다 (msk-select.mjs)
 * 2) 한글 이름과 옛 이름을 붙인다 (규칙·표 → 서브에이전트 검수 결과로 덮어씀)
 * 3) 구조마다 개별 설명을 연결한다 (scripts/ko/out/*.json)
 * 4) 검색용 묶음을 만든다: 좌우 묶음, 부위 묶음, 대표 근육 묶음
 * 5) 형상을 여러 파일로 나눠 담고 압축한다
 *
 * 실행: node scripts/build-msk-atlas.mjs          (검수 결과가 없으면 임시 이름으로)
 *       node scripts/build-msk-atlas.mjs --strict (빠진 이름·설명이 있으면 실패)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { SRC, loadAtlas, selectMsk } from './msk-select.mjs';
import { ruleName, tableName, UNNAMED_DISC, SIDE_KO } from './msk-names.mjs';
import { REGION_DESC, GROUP_DEFS, GROUP_DESC } from './msk-groups.mjs';

const STRICT = process.argv.includes('--strict');
const OUT = 'public/models-msk';
const KO = 'scripts/ko/out';
const warn = [];

const atlas = loadAtlas();
const { list, leftSign } = selectMsk(atlas);

// ── 1. 검수 결과 읽기 ───────────────────────────────────────────────
const reviewed = new Map(); // en key → {ko, alt, desc, confidence, note}
for (const f of ['muscles-1', 'muscles-2', 'muscles-3', 'muscles-4', 'bones-tendons', 'axial', 'hands-feet-teeth']) {
  const p = join(KO, `${f}.json`);
  if (!existsSync(p)) { warn.push(`검수 결과 없음: ${f}`); continue; }
  for (const r of JSON.parse(readFileSync(p, 'utf8'))) {
    const key = r.en.toLowerCase().replace(' (between t12 and l1)', '');
    reviewed.set(key, r);
  }
}

// ── 2. 부품마다 한글 이름 정하기 ────────────────────────────────────
// 설명 속 낱말을 화면에 보이는 이름과 같은 표기로 맞춘다
const DESC_FIX = [
  [/넓적다리/g, '넙다리'],
];
const fixDesc = s => DESC_FIX.reduce((t, [re, to]) => t.replace(re, to), s);

// 앱 전체에서 같은 이름을 쓰도록 맞추는 최종 이름표
const OVERRIDE = {
  'levator palpebrae superioris': { ko: '위눈꺼풀올림근', alt: '상안검거근' },
  'tendon of levator palpebrae superioris': { ko: '위눈꺼풀올림근 힘줄', alt: '상안검거근건' },
  'intermediate tendon': { ko: '두힘살근 중간힘줄', alt: '악이복근 중간건' },
};

function koFor(x) {
  const r = OVERRIDE[x.key] ? { ...reviewed.get(x.key), ...OVERRIDE[x.key] } : reviewed.get(x.key);
  const base = x.key === 'intervertebral disk' ? UNNAMED_DISC : (ruleName(x.key) ?? tableName(x.key));
  // '발의 둘째벌레근' → '발의 둘째 벌레근' 처럼 띄어쓰기를 맞춘다
  const ko = (r?.ko ?? base?.ko ?? '').trim().replace(/^(손의|발의) (첫째|둘째|셋째|넷째)(?=[가-힣])/, '$1 $2 ');
  const alt = (r?.alt ?? base?.alt ?? '').trim();
  if (!ko) { warn.push(`한글 이름 없음: ${x.key}`); return { ko: x.base, alt: '', desc: '' }; }
  if (!r?.desc) warn.push(`설명 없음: ${x.key}`);
  return { ko, alt, desc: fixDesc(r?.desc?.trim() ?? '') };
}

const named = list.map(x => {
  const k = koFor(x);
  const side = SIDE_KO[x.side] ?? '';
  return { ...x, ko: k.ko, alt: k.alt, desc: k.desc, display: side ? `${side} ${k.ko}` : k.ko };
});

// 서로 다른 구조가 같은 한글 이름을 받았는지 점검
const byKo = new Map();
for (const x of named) { const s = byKo.get(x.ko) ?? new Set(); s.add(x.key); byKo.set(x.ko, s); }
for (const [ko, keys] of byKo) if (keys.size > 1) warn.push(`같은 한글 이름 '${ko}' ← ${[...keys].join(' / ')}`);

// ── 3. 부위 판정 (검색 묶음용) ──────────────────────────────────────
const yTop = key => Math.max(...named.filter(x => x.key === key).map(x => x.part.bounds[1][1]));
const cy = key => { const xs = named.filter(x => x.key === key); return xs.reduce((s, x) => s + x.center[1], 0) / xs.length; };
const HIP_Y = yTop('femur');                 // 넙다리뼈 꼭대기
const NECK_Y = cy('clavicle') + 0.02;        // 빗장뼈보다 조금 위
const RIB_X = Math.max(...named.filter(x => /\brib$/.test(x.key)).map(x => Math.max(Math.abs(x.part.bounds[0][0]), Math.abs(x.part.bounds[1][0]))));
const ARM_X = RIB_X + 0.02;                  // 가슴우리 바깥보다 바깥이면 팔
console.log(`기준선: 엉덩이 높이 ${HIP_Y.toFixed(3)} / 목 높이 ${NECK_Y.toFixed(3)} / 팔 경계 |x| ${ARM_X.toFixed(3)}`);

const BONE_REGION = [
  ['skull', /^(frontal bone|parietal bone|occipital bone|temporal bone|sphenoid bone|ethmoid|nasal bone|zygomatic bone|maxilla|mandible|palatine bone|vomer)$|tooth$/],
  ['spine', /vertebra$|^atlas$|^axis$|^intervertebral disk|^sacrum$/],
  ['thorax', /\brib$|costal cartilage$|^body of sternum$|^manubrium$|^xiphoid process$/],
  ['arm', /^(clavicle|scapula|humerus|radius|ulna|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate)$|metacarpal bone$|(thumb|finger)$/],
  ['leg', /^(hip bone|femur|patella|tibia|fibula|talus|calcaneus|navicular bone of foot|cuboid bone|medial cuneiform bone|intermediate cuneiform bone|lateral cuneiform bone|sesamoid bone of foot)$|metatarsal bone$|toe$/],
];
const SOFT_OVERRIDE = [
  ['arm', /deltoid|supraspinatus|infraspinatus|teres (major|minor)|subscapularis|coracobrachialis|interosseous membrane of forearm/],
  ['trunk', /trapezius|rhomboid|serratus|pectoralis|subclavius|intercostal|levatores costarum|transversus thoracis|diaphragm|linea alba|external oblique|coccygeus|iliococcygeus|pubococcygeus|puborectalis|anal sphincter|perineal|levator ani|iliocostalis (thoracis|lumborum)|longissimus thoracis|^spinalis|semispinalis thoracis|interspinal(is|es) (thoracis|lumborum)|lumbar|thoracic rotator/],
  ['leg', /psoas|iliacus|gluteus|piriformis|gemellus|obturator|quadratus femoris|tensor fasciae latae|iliotibial/],
];
function regionOf(x) {
  if (x.sys === 'bone') { for (const [r, re] of BONE_REGION) if (re.test(x.key)) return r; return ''; }
  for (const [r, re] of SOFT_OVERRIDE) if (re.test(x.key)) return r;
  const [px, py] = x.center, ax = Math.abs(px);
  if (py > NECK_Y && ax < ARM_X) return 'headneck';
  if (py < HIP_Y) return ax > ARM_X + 0.03 ? 'arm' : 'leg';
  return ax > ARM_X ? 'arm' : 'trunk';
}
for (const x of named) x.region = regionOf(x);

// ── 4. 형상을 여러 파일로 나눠 담기 (뼈 먼저 → 근육 → 힘줄) ────────
const ORDER = { bone: 0, muscle: 1, tendon: 2 };
named.sort((a, b) => ORDER[a.sys] - ORDER[b.sys] || a.center[1] - b.center[1] || a.part.id.localeCompare(b.part.id));
const srcBufs = new Map();
const srcOf = ci => { if (!srcBufs.has(ci)) srcBufs.set(ci, readFileSync(join(SRC, `body-${ci}.bin`))); return srcBufs.get(ci); };

const TARGET = 3.6 * 1048576;
const chunks = [];
let cur = null;
const newChunk = () => { cur = { blocks: [], size: 0 }; chunks.push(cur); };
const pad = () => { const p = (4 - (cur.size % 4)) % 4; if (p) { cur.blocks.push(Buffer.alloc(p)); cur.size += p; } };
const put = buf => { pad(); const at = cur.size; cur.blocks.push(buf); cur.size += buf.length; return at; };
newChunk();

const parts = named.map(x => {
  const p = x.part, b = srcOf(p.chunk);
  const bytes = p.vertexCount * 18 + p.indexCount * 4 + 12;
  if (cur.size > 0 && cur.size + bytes > TARGET) newChunk();
  const positions = put(b.subarray(p.positions, p.positions + p.vertexCount * 12));
  const normals = put(b.subarray(p.normals, p.normals + p.vertexCount * 6));
  const indices = put(b.subarray(p.indices, p.indices + p.indexCount * 4));
  return {
    id: p.id, name: x.display, alt: x.alt || undefined, dkey: x.ko, nameEn: p.name,
    conceptId: p.conceptId, system: x.sys, chunk: chunks.length - 1,
    positions, normals, indices, vertexCount: p.vertexCount, indexCount: p.indexCount, bounds: p.bounds,
  };
});

// ── 5. 설명 모음 ────────────────────────────────────────────────────
const descriptions = {};
for (const x of named) if (x.desc) descriptions[x.ko] = x.desc;
Object.assign(descriptions, REGION_DESC, GROUP_DESC);

// ── 6. 검색 묶음 ────────────────────────────────────────────────────
const concepts = [];
let n = 0;
const add = (name, elements, alt, dkey) => {
  if (!elements.length) return;
  if (concepts.some(c => c.name === name)) { warn.push(`검색 묶음 이름 겹침: ${name}`); return; }
  concepts.push({ id: `MSK${String(++n).padStart(4, '0')}`, name, alt: alt || undefined, dkey: dkey ?? name, elements });
};
const ids = pred => named.filter(pred).map(x => x.part.id);

// 계통 전체
add('뼈 전체', ids(x => x.sys === 'bone'), '골격');
add('근육 전체', ids(x => x.sys === 'muscle'), '근육계');
add('힘줄·인대 전체', ids(x => x.sys === 'tendon'), '건·인대');
// 부위 묶음
const R = (r, s) => x => x.region === r && (s === undefined || x.sys === s);
add('머리뼈 전체', ids(R('skull')), '두개골');
add('치아 전체', ids(x => /tooth$/.test(x.key)), '영구치');
add('척추 전체', ids(R('spine')), '척주');
add('가슴우리 전체', ids(R('thorax')), '흉곽');
add('골반', ids(x => x.key === 'hip bone' || x.key === 'sacrum'), '골반');
add('팔뼈 전체', ids(R('arm', 'bone')), '상지골');
add('다리뼈 전체', ids(R('leg', 'bone')), '하지골');
add('손뼈 전체', ids(x => /^(scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate)$|metacarpal bone$|(thumb|finger)$/.test(x.key)), '수골');
add('발뼈 전체', ids(x => /^(talus|calcaneus|navicular bone of foot|cuboid bone|medial cuneiform bone|intermediate cuneiform bone|lateral cuneiform bone|sesamoid bone of foot)$|metatarsal bone$|toe$/.test(x.key)), '족골');
for (const [sideEn, sideKo] of [['left', '왼쪽'], ['right', '오른쪽']]) {
  add(`${sideKo} 팔뼈`, ids(x => x.region === 'arm' && x.sys === 'bone' && x.side === sideEn), undefined, '팔뼈 전체');
  add(`${sideKo} 다리뼈`, ids(x => x.region === 'leg' && x.sys === 'bone' && x.side === sideEn), undefined, '다리뼈 전체');
}
const soft = x => x.sys !== 'bone';
add('머리·목 근육 전체', ids(x => soft(x) && x.region === 'headneck'), '두경부 근육');
add('몸통 근육 전체', ids(x => soft(x) && x.region === 'trunk'), '체간 근육');
add('팔 근육 전체', ids(x => soft(x) && x.region === 'arm'), '상지 근육');
add('다리 근육 전체', ids(x => soft(x) && x.region === 'leg'), '하지 근육');
for (const [sideEn, sideKo] of [['left', '왼쪽'], ['right', '오른쪽']]) {
  add(`${sideKo} 팔 근육`, ids(x => soft(x) && x.region === 'arm' && x.side === sideEn), undefined, '팔 근육 전체');
  add(`${sideKo} 다리 근육`, ids(x => soft(x) && x.region === 'leg' && x.side === sideEn), undefined, '다리 근육 전체');
}
// 대표 근육 묶음 (여러 갈래·부분을 하나로)
for (const g of GROUP_DEFS) {
  const els = ids(x => g.match.test(x.key));
  if (!els.length) { warn.push(`대표 묶음에 해당 부품 없음: ${g.name}`); continue; }
  add(g.name, els, g.alt);
}
// 좌우 한 쌍 묶음 (예: '넙다리뼈' → 왼쪽+오른쪽)
const byBase = new Map();
for (const x of named) { const g = byBase.get(x.ko) ?? []; g.push(x); byBase.set(x.ko, g); }
for (const [ko, xs] of byBase) {
  const sides = new Set(xs.map(x => x.side));
  if (xs.length > 1 && !concepts.some(c => c.name === ko)) add(ko, xs.map(x => x.part.id), xs[0].alt, ko);
  else if (xs.length === 1 && !sides.has('left') && !sides.has('right')) add(ko, [xs[0].part.id], xs[0].alt, ko);
}
// 낱개 부품 (같은 화면 이름이면 하나로)
const byDisplay = new Map();
for (const x of named) { const g = byDisplay.get(x.display) ?? []; g.push(x); byDisplay.set(x.display, g); }
for (const [display, xs] of byDisplay) if (!concepts.some(c => c.name === display)) add(display, xs.map(x => x.part.id), xs[0].alt, xs[0].ko);

// ── 7. 저장 ─────────────────────────────────────────────────────────
if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
let gzTotal = 0, rawTotal = 0;
const chunkMeta = chunks.map((c, i) => {
  const raw = Buffer.concat(c.blocks), gz = gzipSync(raw, { level: 9 });
  writeFileSync(join(OUT, `msk-${i}.bin`), raw);
  writeFileSync(join(OUT, `msk-${i}.bin.gz`), gz);
  rawTotal += raw.length; gzTotal += gz.length;
  return { url: `/models-msk/msk-${i}.bin`, bytes: raw.length, gzip: `/models-msk/msk-${i}.bin.gz`, gzipBytes: gz.length };
});
const out = {
  version: atlas.version, sex: atlas.sex, source: atlas.source,
  scope: '성인 남성 표준 인체 · 근골격계 단원',
  parts, concepts, descriptions, chunks: chunkMeta,
  triangles: parts.reduce((s, p) => s + p.indexCount / 3, 0),
};
writeFileSync(join(OUT, 'atlas.json'), JSON.stringify(out));
const metaKB = readFileSync(join(OUT, 'atlas.json')).length / 1024;

// ── 8. 보고 ─────────────────────────────────────────────────────────
const regionCount = {};
for (const x of named) { const k = `${x.sys}/${x.region || '-'}`; regionCount[k] = (regionCount[k] ?? 0) + 1; }
console.log(`부품 ${parts.length}개 · 삼각형 ${out.triangles.toLocaleString()}개 · 파일 ${chunks.length}개`);
console.log(`형상 ${(rawTotal / 1048576).toFixed(1)} MB → 압축 ${(gzTotal / 1048576).toFixed(1)} MB · 목록 ${metaKB.toFixed(0)} KB`);
console.log(`검색 묶음 ${concepts.length}개 · 설명 ${Object.keys(descriptions).length}개`);
console.log('부위별 부품:', Object.entries(regionCount).map(([k, v]) => `${k} ${v}`).join(', '));
const uniqWarn = [...new Set(warn)];
if (uniqWarn.length) {
  console.log(`\n확인 필요 ${uniqWarn.length}건:`);
  const shown = uniqWarn.filter(w => !/^(설명 없음|한글 이름 없음)/.test(w));
  shown.forEach(w => console.log('  · ' + w));
  const missD = uniqWarn.filter(w => w.startsWith('설명 없음')).length, missN = uniqWarn.filter(w => w.startsWith('한글 이름 없음')).length;
  if (missN) console.log(`  · 한글 이름 없는 구조 ${missN}종`);
  if (missD) console.log(`  · 설명 없는 구조 ${missD}종`);
}
if (STRICT && uniqWarn.length) process.exit(1);
