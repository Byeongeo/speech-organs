/**
 * 서브에이전트가 쓴 한글 이름·설명 검수
 *
 * - 입력과 출력의 항목 수·순서가 맞는지
 * - 빈 이름, 영어가 남은 이름, 좌우 표기가 붙은 이름
 * - 서로 다른 구조가 같은 한글 이름을 받은 경우
 * - 같은 근육의 부분·갈래 이름이 같은 근육 이름으로 시작하는지
 * - 설명이 비었거나, 너무 짧거나 길거나, 같은 설명이 되풀이되는지
 * - confidence 가 medium·low 인 항목
 *
 * 실행: node scripts/review-ko.mjs
 */
import { readFileSync, existsSync } from 'node:fs';

const FILES = ['muscles-1', 'muscles-2', 'muscles-3', 'muscles-4', 'bones-tendons', 'axial', 'hands-feet-teeth'];
const issues = [];
const lowConf = [];
const all = [];

for (const f of FILES) {
  const inP = `scripts/ko/batches/${f}.json`, outP = `scripts/ko/out/${f}.json`;
  if (!existsSync(outP)) { issues.push(`[${f}] 결과 파일 없음`); continue; }
  let input, out;
  try { input = JSON.parse(readFileSync(inP, 'utf8')); out = JSON.parse(readFileSync(outP, 'utf8')); }
  catch (e) { issues.push(`[${f}] JSON 읽기 실패: ${e.message}`); continue; }
  const inKeys = input.map(x => x.en.toLowerCase());
  const outKeys = new Set(out.map(x => String(x.en).toLowerCase()));
  const missing = inKeys.filter(k => !outKeys.has(k));
  if (missing.length) issues.push(`[${f}] 빠진 항목 ${missing.length}개: ${missing.join(', ')}`);
  for (const r of out) {
    const tag = `[${f}] ${r.en}`;
    const ko = String(r.ko ?? '').trim(), desc = String(r.desc ?? '').trim();
    if (!ko) issues.push(`${tag}: 이름 없음`);
    if (/[A-Za-z]{3,}/.test(ko)) issues.push(`${tag}: 이름에 영어가 남음 → ${ko}`);
    if (/^(왼|오른)/.test(ko)) issues.push(`${tag}: 좌우 표기가 붙음 → ${ko}`);
    if (!desc) issues.push(`${tag}: 설명 없음`);
    else {
      const sentences = desc.split(/(?<=[.다요])\s+/).filter(Boolean);
      if (desc.length < 30) issues.push(`${tag}: 설명이 너무 짧음 (${desc.length}자)`);
      if (desc.length > 220) issues.push(`${tag}: 설명이 너무 김 (${desc.length}자)`);
      if (sentences.length > 4) issues.push(`${tag}: 문장 ${sentences.length}개`);
    }
    if (r.confidence && r.confidence !== 'high') lowConf.push(`${r.confidence.padEnd(6)} ${r.en} → ${ko}${r.note ? `  (${r.note})` : ''}`);
    all.push({ f, en: String(r.en).toLowerCase(), ko, desc });
  }
}

// 같은 한글 이름
const byKo = new Map();
for (const x of all) { const s = byKo.get(x.ko) ?? []; s.push(x.en); byKo.set(x.ko, s); }
for (const [ko, ens] of byKo) if (new Set(ens).size > 1) issues.push(`같은 한글 이름 '${ko}' ← ${[...new Set(ens)].join(' / ')}`);

// 같은 설명 되풀이
const byDesc = new Map();
for (const x of all) if (x.desc) { const s = byDesc.get(x.desc) ?? []; s.push(x.ko); byDesc.set(x.desc, s); }
for (const [, kos] of byDesc) if (kos.length > 1) issues.push(`같은 설명을 쓴 구조: ${kos.join(', ')}`);

// 부분·갈래 이름 일관성: 'X part of Y' / 'X head of Y' 는 Y의 한글 이름으로 시작해야 한다
const whole = new Map(all.map(x => [x.en, x.ko]));
const firstWord = s => s.split(/\s+/)[0];
const famGroups = new Map();
for (const x of all) {
  const m = x.en.match(/^(.*) (part|head) of (.*)$/);
  if (!m) continue;
  const g = famGroups.get(m[3]) ?? []; g.push(x); famGroups.set(m[3], g);
}
for (const [muscle, xs] of famGroups) {
  const heads = new Set(xs.map(x => firstWord(x.ko)));
  if (heads.size > 1) issues.push(`'${muscle}'의 부분·갈래 이름 첫 단어가 서로 다름: ${xs.map(x => x.ko).join(' / ')}`);
  if (whole.has(muscle) && !xs.every(x => x.ko.startsWith(firstWord(whole.get(muscle))))) issues.push(`'${muscle}' 전체 이름과 부분 이름이 다름`);
}

console.log(`검수한 항목 ${all.length}개`);
console.log(issues.length ? `\n고칠 것 ${issues.length}건:` : '\n고칠 것 없음');
issues.forEach(i => console.log('  · ' + i));
console.log(lowConf.length ? `\n확신 낮음 ${lowConf.length}건:` : '\n확신 낮음 없음');
lowConf.forEach(i => console.log('  · ' + i));
