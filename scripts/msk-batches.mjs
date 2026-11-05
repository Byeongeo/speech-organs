/** 서브에이전트 작업 목록을 만든다. */
import { writeFileSync } from 'node:fs';
import { loadAtlas, selectMsk } from './msk-select.mjs';
import { ruleName, tableName, UNNAMED_DISC } from './msk-names.mjs';

const atlas = loadAtlas();
const { list } = selectMsk(atlas);
const yOf = x => x.center[1];

// 1) 이름 없는 원반이 T12와 L1 사이에 있는지 확인
const disc = list.find(x => x.key === 'intervertebral disk');
const t12 = list.find(x => x.key === 'twelfth thoracic vertebra'), l1 = list.find(x => x.key === 'first lumbar vertebra');
console.log(`이름 없는 원반 높이 ${yOf(disc).toFixed(3)} / 열두째 등뼈 ${yOf(t12).toFixed(3)} / 첫째 허리뼈 ${yOf(l1).toFixed(3)} ->`,
  yOf(disc) < yOf(t12) && yOf(disc) > yOf(l1) ? '열두째 등뼈와 첫째 허리뼈 사이 맞음' : '** 위치 불일치 **');

// 2) 중간힘줄이 어느 근육 것인지 (두힘살근 / 어깨목뿔근) 거리로 판단
const it = list.find(x => x.key === 'intermediate tendon');
const dist = (a, b) => Math.hypot(...a.center.map((v, i) => v - b.center[i]));
for (const k of ['digastric', 'omohyoid']) {
  const ms = list.filter(x => x.key === k);
  console.log(`중간힘줄 ~ ${k}: 최소 거리 ${Math.min(...ms.map(m => dist(it, m))).toFixed(3)} m`);
}

// 3) 바깥항문조임근 세 조각 위치
list.filter(x => x.key === 'external anal sphincter').forEach(x => console.log(`바깥항문조임근 x=${x.center[0].toFixed(4)} 좌우=${x.side || '없음'}`));
console.log('');

// 묶음별 고유 기준명
const uniq = sys => {
  const m = new Map();
  for (const x of list.filter(x => x.sys === sys)) {
    const e = m.get(x.key) ?? { en: x.base, count: 0 }; e.count++; m.set(x.key, e);
  }
  return [...m.entries()].map(([key, v]) => ({ key, ...v }));
};

// 근육: 같은 근육의 부분·갈래가 한 묶음에 모이도록 정렬
const famKey = k => { const m = k.match(/^(.*) (part|head) of (.*)$/); return m ? `${m[3]} ${m[1]} ${m[2]}` : k; };
const muscles = uniq('muscle').sort((a, b) => famKey(a.key).localeCompare(famKey(b.key)));
const per = Math.ceil(muscles.length / 4);
for (let i = 0; i < 4; i++) {
  const part = muscles.slice(i * per, (i + 1) * per).map(m => ({ en: m.key, pieces: m.count }));
  writeFileSync(`scripts/ko/batches/muscles-${i + 1}.json`, JSON.stringify(part, null, 1));
  console.log(`근육 묶음 ${i + 1}: ${part.length}종 (${part[0].en} ~ ${part[part.length - 1].en})`);
}

// 뼈·힘줄 표 이름
const bt = [...uniq('bone'), ...uniq('tendon')].map(x => ({ x, t: tableName(x.key) })).filter(o => o.t)
  .map(({ x, t }) => ({ en: x.key, ko: t.ko, alt: t.alt, kind: t.family === 'tendon' ? '힘줄·인대' : '뼈' }));
writeFileSync('scripts/ko/batches/bones-tendons.json', JSON.stringify(bt, null, 1));
console.log(`뼈·힘줄 표: ${bt.length}종`);

// 규칙 이름
const rule = uniq('bone').map(x => {
  const r = x.key === 'intervertebral disk' ? UNNAMED_DISC : ruleName(x.key);
  return r ? { en: x.key === 'intervertebral disk' ? 'intervertebral disk (between T12 and L1)' : x.key, ko: r.ko, alt: r.alt, family: r.family } : null;
}).filter(Boolean);
const axial = rule.filter(r => ['vertebra', 'disc', 'rib', 'costal'].includes(r.family));
const appen = rule.filter(r => ['finger', 'toe', 'metacarpal', 'metatarsal', 'tooth'].includes(r.family));
writeFileSync('scripts/ko/batches/axial.json', JSON.stringify(axial, null, 1));
writeFileSync('scripts/ko/batches/hands-feet-teeth.json', JSON.stringify(appen, null, 1));
console.log(`몸통뼈대 규칙 이름: ${axial.length}종 / 손발·치아 규칙 이름: ${appen.length}종`);

// 누락 점검: 모든 고유 기준명이 어딘가에 배정되었는지
const assigned = new Set([...muscles.map(m => m.key), ...bt.map(b => b.en), 'intervertebral disk', ...rule.map(r => r.en)]);
const all = new Set(list.map(x => x.key));
const miss = [...all].filter(k => !assigned.has(k));
console.log(miss.length ? `** 배정 안 된 이름 ${miss.length}개: ${miss.join(', ')}` : `모든 고유 이름 ${all.size}종 배정 완료`);
