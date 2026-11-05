/**
 * 근골격계 부품 선별 공통 모듈
 *
 * 전신 2,234개 중 뼈·근육·힘줄·인대와 치아를 고르고,
 * 각 부품의 좌우와 영어 기준명을 정리한다.
 * 목록 확인 스크립트와 자료 생성 스크립트가 함께 쓴다.
 */
import { readFileSync } from 'node:fs';

export const SRC = 'source-data/models';

export function loadAtlas() {
  return JSON.parse(readFileSync(`${SRC}/atlas.json`, 'utf8'));
}

// 근골격계에서 빼는 것
//  - 잇몸, 후두·코 연골, 후두·인두 인대 (조음기관 앱에서 쓸 재료)
//  - 후두·입천장·혀 근육 (조음기관 앱에서 쓸 재료)
//  - 심장 안쪽의 꼭지근 (심장 근육이라 근골격계가 아님)
const EXCLUDE = [
  /gingiva/i,
  /thyroid cartilage|cricoid cartilage|arytenoid cartilage|corniculate cartilage|cuneiform cartilage|alar cartilage|nasal cartilage/i,
  /hyo-?epiglottic|thyro-?epiglottic|conus elasticus|thyrohyoid membrane|thyrohyoid ligament|cricothyroid ligament|vocal ligament|pharyngeal raphe/i,
  /arytenoid|cricothyroid|vocalis|aryepiglott/i,
  /veli palatini|uvular muscle/i,
  /genioglossus|hyoglossus/i,
  /papillary muscle/i,
  // 바깥항문조임근 오른쪽 조각과 좌표·삼각형 수가 같은 중복 조각
  /^superficial perineal muscle$/i,
];

// 뼈 계통에 잘못 들어간 근육·힘줄
const MUSCLE_IN_SKELETAL = /fibularis|tibialis|subscapularis|levator scapulae/i;
const TENDON_IN_SKELETAL = /iliotibial tract/i;
// 결합조직 계통에 들어간 근육
const MUSCLE_IN_CONNECTIVE = /tensor fasciae latae/i;

/** 부품을 새 계통(bone / muscle / tendon)으로 분류한다. 빼야 하면 null. */
export function classify(p) {
  if (EXCLUDE.some(r => r.test(p.name))) return null;
  if (p.system === 'skeletal') {
    if (MUSCLE_IN_SKELETAL.test(p.name)) return 'muscle';
    if (TENDON_IN_SKELETAL.test(p.name)) return 'tendon';
    return 'bone'; // 뼈, 갈비연골, 척추 사이 원반, 치아
  }
  if (p.system === 'muscular') return 'muscle';
  if (p.system === 'connective') return MUSCLE_IN_CONNECTIVE.test(p.name) ? 'muscle' : 'tendon';
  return null;
}

/** 이름과 좌표로 좌우를 정하고 좌우 표기를 뗀 영어 기준명을 만든다. */
export function sideAndBase(p, leftSign) {
  let side = '';
  const m = p.name.match(/\b(left|right)\b/i);
  if (m) side = m[1].toLowerCase();
  const base = p.name.replace(/\b(left|right)\s+/i, '').replace(/\s+/g, ' ').trim();
  if (!side) {
    const cx = (p.bounds[0][0] + p.bounds[1][0]) / 2;
    if (Math.abs(cx) > 0.012) side = Math.sign(cx) === leftSign ? 'left' : 'right';
  }
  return { side, base };
}

/** 'Left humerus'의 좌표로 몸의 왼쪽이 +x인지 -x인지 정한다. */
export function findLeftSign(atlas) {
  const h = atlas.parts.find(p => /^left humerus$/i.test(p.name));
  const cx = (h.bounds[0][0] + h.bounds[1][0]) / 2;
  return Math.sign(cx);
}

export function selectMsk(atlas) {
  const leftSign = findLeftSign(atlas);
  const out = [];
  for (const p of atlas.parts) {
    const sys = classify(p);
    if (!sys) continue;
    const { side, base } = sideAndBase(p, leftSign);
    const c = [0, 1, 2].map(i => (p.bounds[0][i] + p.bounds[1][i]) / 2);
    out.push({ part: p, sys, side, base, key: base.toLowerCase(), center: c });
  }
  // 원본 이름의 좌우가 실제 위치와 반대인 조각(예: flexor pollicis brevis)은 위치를 따른다
  for (const x of out) {
    if (!x.side || Math.abs(x.center[0]) < 0.05) continue;
    const actual = Math.sign(x.center[0]) === leftSign ? 'left' : 'right';
    if (actual !== x.side) { x.side = actual; x.sideFixed = true; }
  }
  // 이름에 좌우가 없고 같은 이름이 여럿인 경우(예: spinalis 두 개)는 좌표로 좌우를 정한다.
  // 몸 한가운데(±4mm 안)에 걸친 것은 가운데 구조로 둔다.
  const groups = new Map();
  for (const x of out) if (!x.side) { const g = groups.get(x.key) ?? []; g.push(x); groups.set(x.key, g); }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    for (const x of g) if (Math.abs(x.center[0]) > 0.004) x.side = Math.sign(x.center[0]) === leftSign ? 'left' : 'right';
  }
  return { list: out, leftSign };
}
