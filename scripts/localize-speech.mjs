/**
 * 근골격계 앱 화면을 발음 기관 앱 화면으로 바꾼다 (app/page.tsx 에 한 번만 적용)
 * - 문구, 묶음 프리셋, 검색 추천을 발음 기관에 맞춘다
 * - "반으로 자르기" 단추와 상태를 넣는다
 */
import { readFileSync, writeFileSync } from 'node:fs';

const edits = [
  // 아이콘과 상태
  ["import {Activity,ArrowUpRight,ChevronRight,Focus,Info,Layers3,Pause,RotateCcw,RotateCw,Search,X} from 'lucide-react';",
   "import {Activity,ArrowUpRight,ChevronRight,Focus,Info,Layers3,Pause,RotateCcw,RotateCw,Scissors,Search,X} from 'lucide-react';"],
  ["view:'three-quarter',rotate:false,reset:0};", "view:'three-quarter',rotate:false,reset:0,cut:false};"],

  // 자료 경로와 오류
  ["'/models-msk/atlas.json'", "'/models-speech/atlas.json'"],
  ["throw new Error('뼈와 근육 자료를 불러오지 못했습니다.')", "throw new Error('발음 기관 자료를 불러오지 못했습니다.')"],

  // 머리말
  ["3D 근골격계 학습", "3D 발음 기관 학습"],
  ["<h1>뼈와 근육<Badge", "<h1>발음 기관<Badge"],
  ["{atlas?atlas.parts.length.toLocaleString():'678'}개 부품 <span>·</span> 보건 수업용",
   "{atlas?atlas.parts.length.toLocaleString():'130'}개 부품 <span>·</span> 국어 수업용"],

  // 프리셋: 전체 / 입과 혀 / 목
  ["state.visible.length===1&&state.visible[0]==='bone'",
   "state.visible.length===6&&['lip','teeth','jaw','tongue','palate','skin'].every(id=>state.visible.includes(id as SystemId))"],
  ["visible:['bone']", "visible:['lip','teeth','jaw','tongue','palate','skin']"],
  ["}))}>뼈만</Button>", "}))}>입과 혀</Button>"],
  ["state.visible.length===2&&['muscle','tendon'].every(id=>state.visible.includes(id as SystemId))",
   "state.visible.length===4&&['pharynx','larynx','vocal','skin'].every(id=>state.visible.includes(id as SystemId))"],
  ["visible:['muscle','tendon']", "visible:['pharynx','larynx','vocal','skin']"],
  ["}))}>근육만</Button>", "}))}>목</Button>"],

  // 검색
  ["['머리뼈 전체','척추 전체','가슴우리 전체','팔뼈 전체','다리뼈 전체','팔 근육 전체','다리 근육 전체','넙다리뼈']",
   "['입술','윗잇몸','센입천장','여린입천장','목젖','혀','목청','코']"],
  ['placeholder="넙다리뼈, 대퇴골, 위팔두갈래근…"', 'placeholder="센입천장, 목젖, 성대…"'],
  ["{query?'옛 이름으로 찾아도 됩니다. 예: 대퇴골, 상완이두근':'뼈나 근육 이름을 넣어 보세요.'}",
   "{query?'다른 이름으로 찾아도 됩니다. 예: 성대, 경구개':'발음 기관 이름을 넣어 보세요.'}"],

  // 화면 이름표와 펼치기
  ["'사람의 뼈와 근육'", "'사람의 발음 기관'"],
  ['<label id="explode-label">몸 펼치기</label>', '<label id="explode-label">펼치기</label>'],

  // 반으로 자르기 단추 (처음으로 단추 앞)
  ['<Button variant="ghost" className="dock-reset" onClick={reset} aria-label="처음 상태로"><RotateCcw size={18}/><span>처음으로</span></Button>',
   '<Button variant="ghost" className={`dock-reset dock-cut ${state.cut?\'active\':\'\'}`} aria-pressed={state.cut} aria-label="반으로 자르기" onClick={()=>setState(s=>({...s,cut:!s.cut,explode:0,isolate:false,view:!s.cut?\'side\':s.view,reset:s.reset+1,rotate:false}))}><Scissors size={18}/><span>{state.cut?\'단면 끄기\':\'반으로 자르기\'}</span></Button>' +
   '<Button variant="ghost" className="dock-reset" onClick={reset} aria-label="처음 상태로"><RotateCcw size={18}/><span>처음으로</span></Button>'],

  // 불러오기
  ["<strong>뼈와 근육 자료를 준비하고 있습니다</strong>", "<strong>발음 기관 자료를 준비하고 있습니다</strong>"],
  ["부품 {atlas?.parts.length.toLocaleString()??'678'}개 불러오는 중", "부품 {atlas?.parts.length.toLocaleString()??'130'}개 불러오는 중"],

  // 자료 안내
  ["<SheetTitle className=\"structure-title\">뼈와 근육 살펴보기</SheetTitle>", "<SheetTitle className=\"structure-title\">발음 기관 살펴보기</SheetTitle>"],
  ["<SheetDescription>보건 수업을 위해 만든 3차원 근골격계 자료입니다.</SheetDescription>",
   "<SheetDescription>국어 수업을 위해 만든 3차원 발음 기관 자료입니다.</SheetDescription>"],
  ["<p><strong>보건 수업용 근골격계 단원</strong><br/>성인 남성 표준 인체 자료에서 뼈, 근육, 힘줄과 인대, 치아 678개를 골라 담았습니다. 모든 이름과 설명은 한글이며, 옛 용어로도 찾을 수 있습니다.</p>",
   "<p><strong>국어 수업용 발음 기관 단원</strong><br/>성인 남성 표준 인체 자료에서 입술, 이, 잇몸, 입천장, 혀, 인두, 후두, 목청, 코의 부품 130개를 골라 담았습니다. 반으로 자르기를 누르면 교과서 그림처럼 옆에서 본 단면을 볼 수 있습니다.</p>"],
  ["<p>원본 자료에 없는 구조는 담지 못했습니다. 배곧은근, 넓은등근, 깨물근, 관자근, 얼굴 표정근과 무릎 관절 속 인대·반달연골이 빠져 있습니다. 사람마다 생김새가 조금씩 다릅니다.</p>",
   "<p>원본 자료에는 여린입천장의 겉 조직과 입안·코안의 빈 공간이 따로 없어, 여린입천장은 그 속 근육으로 보여 줍니다. 피부는 머리 윤곽을 보여 주려고 반투명하게 그렸습니다. 사람마다 생김새가 조금씩 다릅니다.</p>"],
  ["한국 보건 수업에 맞게 고쳤습니다.", "한국 국어 수업에 맞게 고쳤습니다."],
];

const file = 'app/page.tsx';
let src = readFileSync(file, 'utf8');
let ok = 0;
const missed = [];
for (const [from, to] of edits) {
  if (!src.includes(from)) { missed.push(from.slice(0, 80)); continue; }
  src = src.split(from).join(to);
  ok++;
}
writeFileSync(file, src);
console.log(`${file}: ${ok}/${edits.length}개 교체`);
missed.forEach(m => console.log('  못 찾음 · ' + m));

// 아래 막대를 넓혀 자르기 단추 자리를 만든다
const css = 'app/globals.css';
let c = readFileSync(css, 'utf8');
c += `
/* 발음 기관 앱: 반으로 자르기 단추 */
.bottom-dock{width:560px}
.dock-cut.active{color:#1f3a4d;background:#e7eef2}
.dock-cut.active svg{color:#c0392b}
@media (max-width:767px){.bottom-dock{width:calc(100% - 24px)}}
`;
writeFileSync(css, c);
console.log(`${css}: 자르기 단추 모양 추가`);

// 페이지 제목
const html = 'web/index.html';
let h = readFileSync(html, 'utf8');
h = h.replace(/<title>[^<]*<\/title>/, '<title>발음 기관 · 국어 수업용 3D 자료</title>')
     .replace(/<meta name="description" content="[^"]*"/, '<meta name="description" content="국어 수업을 위한 3차원 발음 기관 자료. 입술, 혀, 입천장, 목청을 돌려 보고 반으로 잘라 단면을 확인합니다."');
writeFileSync(html, h);
console.log(`${html}: 제목 변경`);
process.exit(missed.length ? 1 : 0);
