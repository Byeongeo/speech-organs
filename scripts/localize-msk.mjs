/**
 * 근골격계 앱 화면 한글화 (원본 app/page.tsx 에 한 번만 적용)
 *
 * 눈 앱에서 쓴 한글 문구를 바탕으로 하되,
 * 옛 용어 표시, 옛 용어로도 찾는 검색, 자료 파일의 개별 설명 연결을 더한다.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const edits = [
  // ── 가져오기 ──
  ["import {DEFAULT_VISIBLE,SYSTEMS,EXPLANATIONS,explanation,type Atlas,",
   "import {DEFAULT_VISIBLE,SYSTEMS,describe,type Atlas,"],

  // ── 자료 경로와 오류 ──
  ["'/models/atlas.json'", "'/models-msk/atlas.json'"],
  ["throw new Error('The anatomy catalogue could not be loaded.')", "throw new Error('뼈와 근육 자료를 불러오지 못했습니다.')"],

  // ── 검색: 띄어쓰기 무시, 옛 용어로도 찾기, 처음 추천 목록 ──
  ["const term=query.toLowerCase().trim();",
   "const norm=(s?:string)=>(s??'').toLowerCase().replace(/\\s+/g,'');const term=norm(query);"],
  ["['heart','brain','liver','stomach','spleen','pancreas','urinary bladder','trachea'].map(name=>atlas.concepts.find(c=>c.name.toLowerCase()===name))",
   "['머리뼈 전체','척추 전체','가슴우리 전체','팔뼈 전체','다리뼈 전체','팔 근육 전체','다리 근육 전체','넙다리뼈'].map(name=>atlas.concepts.find(c=>c.name===name))"],
  ["atlas.concepts.filter(c=>c.name.toLowerCase().includes(term)||c.id.toLowerCase().includes(term))",
   "atlas.concepts.filter(c=>norm(c.name).includes(term)||norm(c.alt).includes(term))"],

  // ── 부품을 직접 눌렀을 때도 옛 용어와 설명 열쇠를 넘긴다 ──
  ["setChosen({id:p.conceptId,name:p.name,elements:[id]});",
   "setChosen({id:p.conceptId,name:p.name,alt:p.alt,dkey:p.dkey,elements:[id]});"],

  // ── 머리말 ──
  ["INTERACTIVE ANATOMY", "3D 근골격계 학습"],
  ["<h1>Human Atlas<Badge", "<h1>뼈와 근육<Badge"],
  ["{atlas?atlas.parts.length.toLocaleString():'2,234'} modeled pieces <span>·</span> BodyParts3D",
   "{atlas?atlas.parts.length.toLocaleString():'679'}개 부품 <span>·</span> 보건 수업용"],

  // ── 묶음 프리셋: 전체 / 뼈만 / 근육만 ──
  ["state.visible.length===1&&state.visible[0]==='skeletal'", "state.visible.length===1&&state.visible[0]==='bone'"],
  ["visible:['skeletal']", "visible:['bone']"],
  ["}))}>Skeleton</Button>", "}))}>뼈만</Button>"],
  ["state.visible.length===6&&['cardiac','respiratory','digestive','urinary','endocrine','reproductive'].every(id=>state.visible.includes(id as SystemId))",
   "state.visible.length===2&&['muscle','tendon'].every(id=>state.visible.includes(id as SystemId))"],
  ["visible:['cardiac','respiratory','digestive','urinary','endocrine','reproductive']", "visible:['muscle','tendon']"],
  ["}))}>Organs</Button>", "}))}>근육만</Button>"],
  ["}))}>All</Button>", "}))}>전체</Button>"],

  // ── 위쪽 단추 ──
  ['aria-label="Explorer panels"', 'aria-label="찾기와 안내"'],
  ['aria-label="Search anatomy"', 'aria-label="구조 검색"'],
  ['aria-label="About this atlas"', 'aria-label="자료 안내"'],

  // ── 묶음 패널 (아래 막대의 묶음 단추를 먼저 바꾼다) ──
  ['aria-label="Open system layers"><Layers3 size={20}/><span>Systems</span>', 'aria-label="묶음 열기"><Layers3 size={20}/><span>묶음</span>'],
  ['aria-label="Anatomical layers"', 'aria-label="묶음"'],
  ["<span>Systems</span>", "<span>묶음</span>"],
  ['aria-label="Close systems"', 'aria-label="묶음 닫기"'],
  ["title={`Show only ${s.name.toLowerCase()}`}", "title={`${s.name}만 보기`}"],
  ["aria-label={`Show ${s.name.toLowerCase()}`}", "aria-label={`${s.name} 켜고 끄기`}"],
  ["<span>{visibleCount.toLocaleString()} pieces visible</span>", "<span>{visibleCount.toLocaleString()}개 보이는 중</span>"],
  ["}))}>Hide all</Button>", "}))}>모두 숨기기</Button>"],

  // ── 검색 패널 ──
  ['aria-label="Find anatomy"', 'aria-label="구조 찾기"'],
  ["<span>Find a structure</span>", "<span>구조 찾기</span>"],
  ['aria-label="Close search"', 'aria-label="검색 닫기"'],
  ['placeholder="Heart, femur, cranial nerve…"', 'placeholder="넙다리뼈, 대퇴골, 위팔두갈래근…"'],
  ['aria-label="Search named anatomical structures"', 'aria-label="구조 이름으로 검색"'],
  ["<ComboboxEmpty>No structures match your search.</ComboboxEmpty>", "<ComboboxEmpty>찾는 구조가 없습니다.</ComboboxEmpty>"],
  ["<span className=\"search-result-name\">{c.name}</span><span className=\"small-number\">{c.elements.length} {c.elements.length===1?'piece':'pieces'}</span>",
   "<span className=\"search-result-name\">{c.name}{c.alt?<em className=\"search-result-alt\">{c.alt}</em>:null}</span><span className=\"small-number\">{c.elements.length}개</span>"],
  ["{query?'Showing up to 80 matches. Refine your search to find smaller structures.':'Start with a major organ, or search every named structure.'}",
   "{query?'옛 이름으로 찾아도 됩니다. 예: 대퇴골, 상완이두근':'뼈나 근육 이름을 넣어 보세요.'}"],

  // ── 보기 조작 ──
  ['aria-label="Camera controls"', 'aria-label="보기 조작"'],
  ["['¾','F','S','B']", "['¾','앞','옆','뒤']"],
  ["title={`${v} view`} aria-label={`${v} view`}",
   "title={({'three-quarter':'비스듬히 보기',front:'앞에서 보기',side:'옆에서 보기',back:'뒤에서 보기'} as Record<string,string>)[v]} aria-label={({'three-quarter':'비스듬히 보기',front:'앞에서 보기',side:'옆에서 보기',back:'뒤에서 보기'} as Record<string,string>)[v]}"],
  ["aria-label={state.rotate?'Pause rotation':'Rotate body'} title=\"Auto rotate\"", "aria-label={state.rotate?'회전 멈추기':'자동 회전'} title=\"자동 회전\""],
  ['aria-label="Reset view and layers" title="Reset"', 'aria-label="처음 상태로" title="처음으로"'],

  // ── 화면 아래 이름표 ──
  ["'SELECTED STRUCTURE'", "'선택한 구조'"],
  ["'ANATOMICAL INVENTORY'", "'부품 목록'"],
  ["'SEPARATED STRUCTURES'", "'펼치는 중'"],
  ["'ADULT HUMAN · MALE'", "'사람의 뼈와 근육'"],

  // ── 펼치기 막대 ──
  ['<label id="explode-label">Explode anatomy</label>', '<label id="explode-label">몸 펼치기</label>'],
  ["<span>Assembled</span><span>Every piece</span>", "<span>합친 상태</span><span>모두 펼침</span>"],
  ['aria-label="Assemble and reset"><RotateCcw size={18}/><span>Reset</span>', 'aria-label="처음 상태로"><RotateCcw size={18}/><span>처음으로</span>'],

  // ── 바닥글 ──
  ["{state.explode>.8?'Drag to pan':'Drag to orbit'} <b>·</b> Pinch to zoom <b>·</b> Tap to inspect",
   "{state.explode>.8?'끌어서 이동':'끌어서 회전'} <b>·</b> 휠로 확대 <b>·</b> 더블클릭한 곳 중심으로 회전 <b>·</b> 눌러서 설명 보기"],
  ["Source & credits <ArrowUpRight", "자료 출처 <ArrowUpRight"],

  // ── 불러오는 중 / 오류 ──
  ["<strong>Preparing the anatomy</strong>", "<strong>뼈와 근육 자료를 준비하고 있습니다</strong>"],
  ["<span>{progress}% · Loading {atlas?.parts.length.toLocaleString()??'2,234'} pieces</span>",
   "<span>{progress}% · 부품 {atlas?.parts.length.toLocaleString()??'679'}개 불러오는 중</span>"],
  ["location.reload()}>Reload viewer</Button>", "location.reload()}>다시 불러오기</Button>"],

  // ── 설명 패널: 옛 용어 줄, 개별 설명 ──
  ["{system?.name??'ANATOMY'}", "{system?.name??'구조'}"],
  ["className=\"structure-title\">{chosen?.name}</SheetTitle></div>",
   "className=\"structure-title\">{chosen?.name}</SheetTitle>{chosen?.alt?<div className=\"structure-alt\">{chosen.alt}</div>:null}</div>"],
  ["{chosen&&selected?explanation(chosen.name,selected.system):''}",
   "{chosen&&selected?describe(atlas,chosen,selected.system).text:''}"],
  ["{chosen&&!EXPLANATIONS[chosen.name.toLowerCase()]&&<span className=\"context-note\">System overview · structure identified from source anatomy</span>}",
   "{chosen&&selected&&!describe(atlas,chosen,selected.system).own&&<span className=\"context-note\">묶음 전체 설명입니다</span>}"],
  ["<span>Atlas reference<strong>{chosen?.id}</strong></span>", "<span>자료 번호<strong>{chosen?.id}</strong></span>"],
  ["<span>Selected pieces<strong>{state.selected.length.toLocaleString()}</strong></span>", "<span>선택한 조각<strong>{state.selected.length.toLocaleString()}개</strong></span>"],
  ["<h3>Included structures</h3>", "<h3>포함된 구조</h3>"],
  ["<p>And {selectedParts.length-50} more modeled pieces.</p>", "<p>외 {selectedParts.length-50}개가 더 있습니다.</p>"],
  ["View anatomical source <ArrowUpRight", "원본 자료 보기 <ArrowUpRight"],
  ["{state.isolate?'Show surrounding anatomy':'Isolate structure'}", "{state.isolate?'주변 구조 함께 보기':'이 구조만 보기'}"],
  [">Clear selection</Button>", ">선택 해제</Button>"],

  // ── 자료 안내 ──
  ["<div className=\"eyebrow\">SOURCE & SCOPE</div>", "<div className=\"eyebrow\">자료 출처와 범위</div>"],
  ["<SheetTitle className=\"structure-title\">A body, revealed.</SheetTitle>", "<SheetTitle className=\"structure-title\">뼈와 근육 살펴보기</SheetTitle>"],
  ["<SheetDescription>Explore the adult male reference anatomy from BodyParts3D.</SheetDescription>",
   "<SheetDescription>보건 수업을 위해 만든 3차원 근골격계 자료입니다.</SheetDescription>"],
  ["<p><strong>Male · BodyParts3D</strong><br/>2,234 individual meshes and 3,432 named concepts from an adult male reference anatomy.</p>",
   "<p><strong>보건 수업용 근골격계 단원</strong><br/>성인 남성 표준 인체 자료에서 뼈, 근육, 힘줄과 인대, 치아 679개를 골라 담았습니다. 모든 이름과 설명은 한글이며, 옛 용어로도 찾을 수 있습니다.</p>"],
  ["<p>This reference does not contain every human structure or variation. Named concepts can contain multiple pieces; each source mesh is rendered once.</p>",
   "<p>원본 자료에 없는 구조는 담지 못했습니다. 배곧은근, 넓은등근, 깨물근, 관자근, 얼굴 표정근과 무릎 관절 속 인대·반달연골이 빠져 있습니다. 사람마다 생김새가 조금씩 다릅니다.</p>"],
  ["<p>Colors and system groupings are designed for exploration. The geometry is simplified for the web, and short explanations provide general educational context. This is an anatomical reference, not a diagnostic or surgical tool.</p>",
   "<p>색과 묶음은 학습을 돕기 위해 정한 것입니다. 학습용 자료이며 진단이나 치료에 쓰는 자료가 아닙니다. 용어와 설명은 수업 전에 담당 선생님께서 확인해 주시기 바랍니다.</p>"],
  ["<h3>Source</h3>", "<h3>원본 자료</h3>"],
  ["<p>BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.</p>",
   "<p>BodyParts3D, © The Database Center for Life Science. CC Attribution 4.0 International 조건에 따라 사용했습니다. 화면 프로그램은 Human Atlas(MIT)를 바탕으로 한국 보건 수업에 맞게 고쳤습니다.</p>"],
  [">Dataset license <ArrowUpRight", ">원본 자료 이용 조건 <ArrowUpRight"],
  [">Original geometry & metadata <ArrowUpRight", ">원본 형상과 목록 <ArrowUpRight"],
  [">Read the source publication <ArrowUpRight", ">원본 자료 논문 <ArrowUpRight"],
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

const left = [
  ...src.matchAll(/>([A-Z][A-Za-z][A-Za-z .,&'’-]{3,})</g),
  ...src.matchAll(/(?:aria-label|title|placeholder)="([A-Z][^"]*)"/g),
].map(m => m[1].trim());
if (left.length) { console.log('남은 영어 문구:'); [...new Set(left)].forEach(t => console.log('  · ' + t)); }
process.exit(missed.length ? 1 : 0);
