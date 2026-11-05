/**
 * page.tsx 에 발음 시뮬레이션 상태를 연결한다 (한 번만 적용)
 * - 장면 상태에 sim 추가, 아래 막대에 "소리 내 보기" 단추
 * - 장면이 알려 주는 단계·진행률을 simInfo 에 담는다
 * - 조작판이 열려 있으면 부위를 눌러도 설명 판을 열지 않는다
 */
import { readFileSync, writeFileSync } from 'node:fs';
const file = 'app/page.tsx';
let src = readFileSync(file, 'utf8');
const edits = [
  ["view:'three-quarter',rotate:false,reset:0,cut:false};",
   "view:'three-quarter',rotate:false,reset:0,cut:false,sim:{open:false,id:null,nonce:0,paused:false,speed:'slow'}};"],
  ["RotateCw,Scissors,Search,X} from 'lucide-react';", "RotateCw,Scissors,Search,X,AudioLines} from 'lucide-react';"],
  ["export default function Home(){",
   "export default function Home(){\n const [simInfo,setSimInfo]=useState({step:-1,progress:0,done:true});"],
  ["onError={setError}/>}", "onError={setError} onSim={setSimInfo}/>}"],
  ["setState(s=>({...s,selected:[id],isolate:false,rotate:false}));setDetails(true);setPanel(null);};",
   "setState(s=>({...s,selected:[id],isolate:false,rotate:false}));setDetails(!state.sim?.open);setPanel(null);};"],
  ['<Button variant="ghost" className={`dock-reset dock-cut ${state.cut?\'active\':\'\'}`}',
   '<Button variant="ghost" className={`dock-reset dock-cut ${state.sim?.open?\'active\':\'\'}`} aria-pressed={!!state.sim?.open} aria-label="소리 내 보기" onClick={toggleSim}><AudioLines size={18}/><span>소리 내 보기</span></Button>' +
   '<Button variant="ghost" className={`dock-reset dock-cut ${state.cut?\'active\':\'\'}`}'],
  ["const openPanel=(next:'layers'|'search')=>{",
   "const toggleSim=()=>{setDetails(false);setPanel(null);setState(s=>{const open=!s.sim?.open;return {...s,sim:{...(s.sim??initial.sim!),open,id:null,paused:false},...(open?{cut:true,explode:0,isolate:false,selected:[],view:'side' as View,reset:s.reset+1,rotate:false}:{})};});};\n" +
   " const playSound=(id:string)=>setState(s=>({...s,cut:true,explode:0,isolate:false,sim:{...(s.sim??initial.sim!),open:true,id,nonce:(s.sim?.nonce??0)+1,paused:false}}));\n" +
   " useEffect(()=>{if((import.meta as any).env?.DEV)(window as any).__speechPlay=playSound;});\n" +
   " const openPanel=(next:'layers'|'search')=>{"],
];
let ok = 0; const missed = [];
for (const [a, b] of edits) { if (!src.includes(a)) { missed.push(a.slice(0, 90)); continue; } src = src.split(a).join(b); ok++; }
writeFileSync(file, src);
console.log(`${file}: ${ok}/${edits.length}개 적용`);
missed.forEach(m => console.log('  못 찾음 · ' + m));
const css = 'app/globals.css';
writeFileSync(css, readFileSync(css, 'utf8') + "\n/* 발음 기관 앱: 아래 막대 단추 셋 */\n.bottom-dock{width:660px}\n@media (max-width:767px){.bottom-dock{width:calc(100% - 24px)}}\n");
console.log('아래 막대 폭 조정');
process.exit(missed.length ? 1 : 0);
