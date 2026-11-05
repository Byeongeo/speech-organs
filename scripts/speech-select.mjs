/**
 * 발음 기관 앱 부품 선별
 *
 * 국어 교과서의 발음 기관 그림에 나오는 구조와 그 둘레를 고른다.
 * 묶음(계통)은 펼치기 방향과 색을 정하는 단위다.
 */
import { readFileSync } from 'node:fs';

export const SRC = 'source-data/models';
export const loadAtlas = () => JSON.parse(readFileSync(`${SRC}/atlas.json`, 'utf8'));

// 피·신경 같은 다른 계통의 이름이 걸리지 않게, 이 계통들에서만 고른다
const SOURCE_SYSTEMS = new Set(['skeletal', 'muscular', 'respiratory', 'digestive', 'connective', 'integumentary']);

// 위에서부터 먼저 맞는 규칙을 쓴다
export const RULES = [
  ['skin', /^skin$/i],
  ['lip', /^lip$|gingiva/i],
  ['teeth', /tooth$/i],
  ['vocal', /vocal ligament|vocalis/i],
  ['palate', /veli palatini|uvular muscle|palatopharyngeus/i],
  ['larynx', /thyroid cartilage|cricoid cartilage|arytenoid|corniculate cartilage|cuneiform cartilage|epiglott|conus elasticus|thyrohyoid|cricothyroid|^trachea$/i],
  ['pharynx', /pharyngeal constrictor|salpingopharyngeus|stylopharyngeus|pharyngeal raphe|^esophagus$/i],
  ['tongue', /^tongue$|genioglossus|hyoglossus|mylohyoid|geniohyoid|^digastric$|^stylohyoid$|stylohyoid ligament|intermediate tendon/i],
  ['nose', /nasal cartilage|inferior nasal concha|nasal bone|^vomer$|^ethmoid$/i],
  ['jaw', /maxilla$|palatine bone|^mandible$|hyoid bone$/i],
];

export function classify(p) {
  if (!SOURCE_SYSTEMS.has(p.system)) return null;
  const base = p.name.replace(/\b(left|right)\s+/i, '').trim();
  for (const [sys, re] of RULES) if (re.test(base)) return sys;
  return null;
}

export function findLeftSign(atlas) {
  const h = atlas.parts.find(p => /^left humerus$/i.test(p.name));
  return Math.sign((h.bounds[0][0] + h.bounds[1][0]) / 2);
}

export function selectSpeech(atlas) {
  const leftSign = findLeftSign(atlas);
  const out = [];
  for (const p of atlas.parts) {
    const sys = classify(p);
    if (!sys) continue;
    const m = p.name.match(/\b(left|right)\b/i);
    let side = m ? m[1].toLowerCase() : '';
    const base = p.name.replace(/\b(left|right)\s+/i, '').replace(/\s+/g, ' ').trim();
    const center = [0, 1, 2].map(i => (p.bounds[0][i] + p.bounds[1][i]) / 2);
    out.push({ part: p, sys, side, base, key: base.toLowerCase(), center });
  }
  // 이름의 좌우가 위치와 반대면 위치를 따르고, 좌우 없는 쌍은 좌표로 나눈다
  for (const x of out) {
    if (x.sys === 'skin') { x.side = ''; continue; }
    if (x.side && Math.abs(x.center[0]) > 0.02) {
      const actual = Math.sign(x.center[0]) === leftSign ? 'left' : 'right';
      if (actual !== x.side) x.side = actual;
    }
  }
  const groups = new Map();
  for (const x of out) if (!x.side && x.sys !== 'skin') { const g = groups.get(x.key) ?? []; g.push(x); groups.set(x.key, g); }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    for (const x of g) if (Math.abs(x.center[0]) > 0.004) x.side = Math.sign(x.center[0]) === leftSign ? 'left' : 'right';
  }
  return { list: out, leftSign };
}
