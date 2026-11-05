/**
 * 자음·모음 시뮬레이션 조작판 ("소리 내 보기")
 *
 * 교과서 자음 체계표·단모음 체계표에서 소리를 고르고, 단계 자막·진행 막대·재생 조작·목청 그림을 보여 준다.
 * 화면만 그린다. 재생 상태(step, progress 등)는 부모가 3D 엔진과 맞추어 넘겨준다.
 */
import {memo,useId,useRef,type CSSProperties,type JSX,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {Pause,Play,RotateCcw,X} from 'lucide-react';
import {CONSONANT_TABLE,HEIGHT_KO,MANNER_KO,PHONATION_KO,PLACE_KO,SOUNDS,VOWEL_TABLE,glottisAt,soundLabel,type GlottisState,type Manner,type Sound} from './sounds';
import './sound-panel.css';

export interface SoundPanelProps {
  tab: 'consonant' | 'vowel';
  onTab: (t: 'consonant' | 'vowel') => void;
  current: string | null;        // 지금 고른 소리 (예: 'ㄱ', 'ㅏ')
  onPick: (id: string) => void;  // 표의 글자를 누르면 호출
  playing: boolean;              // 재생 중인지
  paused: boolean;               // 일시정지 상태인지
  onReplay: () => void;          // 처음부터 다시
  onPause: () => void;           // 멈춤과 이어 보기 전환
  speed: 'slow' | 'normal';
  onSpeed: (s: 'slow' | 'normal') => void;
  step: number;                  // -1 시작 전, 0~3 진행 중인 단계, 4 끝남
  progress: number;              // 0~1 전체 진행률
  onClose: () => void;
}

type Tab=SoundPanelProps['tab'];
type Speed=SoundPanelProps['speed'];
type ConsonantRow=(typeof CONSONANT_TABLE.rows)[number];
interface TableProps {current:string|null;onPick:(id:string)=>void}

const ALL=Object.values(SOUNDS);
const TABS:{id:Tab;name:string;count:number}[]=[
 {id:'consonant',name:'자음',count:ALL.filter(s=>s.kind==='consonant').length},
 {id:'vowel',name:'모음',count:ALL.filter(s=>s.kind==='vowel').length},
];
const SPEEDS:{id:Speed;name:string}[]=[{id:'slow',name:'천천히'},{id:'normal',name:'보통'}];
const GLOTTIS_KO:Record<GlottisState,string>={open:'열림',vibrate:'떨림',narrow:'좁힘',tense:'긴장'};

/** 표 자료의 '^' 칸은 "바로 위 칸이 이어져 덮는 자리"다. 그리지 않고 위 칸에 그만큼 rowSpan 을 준다. */
const COVERED='^';
/** 울림 여부 묶음은 조음 방법으로 정한다. 비음·유음은 울림소리, 파열음·파찰음·마찰음은 안울림소리. */
const VOICED_MANNERS:Manner[]=['nasal','liquid'];

/**
 * 자음표의 행을 울림 여부로 크게 묶고(tbody 하나), 그 안에서 이웃한 같은 조음 방법끼리 다시 묶는다.
 * 묶음마다 행 머리 하나를 여러 행에 걸쳐 그린다. 행 번호(start, end)는 CONSONANT_TABLE.rows 기준이다.
 */
interface MannerGroup {manner:Manner;start:number;rows:ConsonantRow[]}
interface VoiceGroup {voiced:boolean;start:number;end:number;manners:MannerGroup[]}
const CONSONANT_GROUPS=CONSONANT_TABLE.rows.reduce<VoiceGroup[]>((groups,row,i)=>{
 const voiced=VOICED_MANNERS.includes(row.manner);
 let voice=groups[groups.length-1];
 if(!voice||voice.voiced!==voiced)groups.push(voice={voiced,start:i,end:i,manners:[]});
 let manner=voice.manners[voice.manners.length-1];
 if(!manner||manner.manner!==row.manner)voice.manners.push(manner={manner:row.manner,start:i,rows:[]});
 manner.rows.push(row);
 voice.end=i+1;
 return groups;
},[]);

/** r행 c열 칸이 아래의 '^' 칸까지 몇 줄을 덮는지 센다. rowSpan 은 tbody 를 넘지 못하므로 end 앞에서 멈춘다. */
function spanAt(r:number,c:number,end:number){
 let n=1;
 while(r+n<end&&CONSONANT_TABLE.rows[r+n].cells[c]===COVERED)n++;
 return n;
}

/** 표에서 글자의 자리(행, 열)를 찾는다. 고른 글자의 행 머리와 열 머리를 함께 진하게 보여 준다. */
function findCell(rows:{cells:(string|null)[]}[],id:string|null){
 if(!id)return null;
 for(let row=0;row<rows.length;row++){const col=rows[row].cells.indexOf(id);if(col>=0)return {row,col};}
 return null;
}

/** 묶음의 첫 줄 위에 구분선을, 마지막 줄 아래에 여백을 둔다. */
function rowClass(first:boolean,last:boolean){
 return [first&&'sp-first',last&&'sp-last'].filter(Boolean).join(' ')||undefined;
}

function Cell({id,span=1,current,onPick}:{id:string|null;span?:number}&TableProps){
 if(!id)return <td/>;
 const on=id===current,tall=span>1;
 return <td rowSpan={tall?span:undefined} className={tall?'sp-tall':undefined}>
  <button type="button" className={on?'sp-cell is-on':'sp-cell'} style={tall?{'--span':span} as CSSProperties:undefined} aria-label={`${id} 소리 보기`} aria-pressed={on} onClick={()=>onPick(id)}>{id}</button>
 </td>;
}

/** "여린입천장소리"를 "여린입천장 / 소리" 두 줄로 쓴다. 아주 좁은 화면에서는 "입천장" 앞에서도 줄을 바꾼다. */
function PlaceHead({label}:{label:string}){
 const base=label.endsWith('소리')?label.slice(0,-2):label,cut=base.indexOf('입천장');
 return <>
  <span className="sp-col-line">{cut>0?<>{base.slice(0,cut)}<wbr/>{base.slice(cut)}</>:base}</span>
  {base!==label&&<span className="sp-col-line">소리</span>}
 </>;
}

const ConsonantTable=memo(function ConsonantTable({current,onPick}:TableProps){
 const hit=findCell(CONSONANT_TABLE.rows,current);
 const within=(start:number,end:number)=>!!hit&&hit.row>=start&&hit.row<end;
 // 세기 행 머리는 고른 소리의 세기와 같을 때만 켠다. ㅎ처럼 세기가 없는 소리는 켜지 않는다.
 const sound=current?SOUNDS[current]:undefined;
 const phonation=sound?.kind==='consonant'?sound.phonation:undefined;
 return <table className="sp-table">
  <caption className="sp-sr">자음 체계표. 열은 조음 위치, 행은 울림 여부와 조음 방법, 소리의 세기입니다.</caption>
  <thead><tr>
   <td className="sp-corner" colSpan={3}><span className="sp-corner-top">조음 위치</span><span className="sp-corner-bottom">조음 방법</span></td>
   {CONSONANT_TABLE.columns.map((place,col)=><th key={place} scope="col" className={hit?.col===col?'sp-col is-on':'sp-col'}><PlaceHead label={PLACE_KO[place]}/></th>)}
  </tr></thead>
  {CONSONANT_GROUPS.map(voice=><tbody key={voice.start} className="sp-group">
   {voice.manners.flatMap(group=>{
    const graded=group.rows.some(r=>r.phonation),end=group.start+group.rows.length;
    return group.rows.map((row,i)=>{
     const r=group.start+i;
     return <tr key={r} className={rowClass(i===0,r===end-1)}>
      {r===voice.start&&<th scope="rowgroup" rowSpan={voice.end-voice.start} className={within(voice.start,voice.end)?'sp-voice is-on':'sp-voice'}><span>{voice.voiced?'울림소리':'안울림소리'}</span></th>}
      {i===0&&<th scope="row" rowSpan={group.rows.length} colSpan={graded?1:2} className={within(group.start,end)?'sp-manner is-on':'sp-manner'}>{MANNER_KO[group.manner]}</th>}
      {graded&&<th scope="row" className={hit?.row===r&&row.phonation===phonation?'sp-phon is-on':'sp-phon'}>{row.phonation?PHONATION_KO[row.phonation]:''}</th>}
      {row.cells.map((id,col)=>id===COVERED?null:<Cell key={col} id={id} span={id?spanAt(r,col,voice.end):1} current={current} onPick={onPick}/>)}
     </tr>;
    });
   })}
  </tbody>)}
 </table>;
});

const VowelTable=memo(function VowelTable({current,onPick}:TableProps){
 const hit=findCell(VOWEL_TABLE.rows,current);
 return <table className="sp-table sp-table-vowel">
  <caption className="sp-sr">단모음 체계표. 열은 혀의 앞뒤와 입술 모양, 행은 혀의 높낮이입니다.</caption>
  <thead><tr>
   <td/>
   {VOWEL_TABLE.columns.map((c,col)=><th key={col} scope="col" className={hit?.col===col?'sp-col is-on':'sp-col'}>{c.front?'전설':'후설'}&nbsp;· {c.round?'원순':'평순'}</th>)}
  </tr></thead>
  <tbody className="sp-group">{VOWEL_TABLE.rows.map((row,i,rows)=><tr key={row.height} className={rowClass(i===0,i===rows.length-1)}>
   <th scope="row" className={hit?.row===i?'sp-manner is-on':'sp-manner'}>{HEIGHT_KO[row.height]}</th>
   {row.cells.map((id,col)=><Cell key={col} id={id} current={current} onPick={onPick}/>)}
  </tr>)}</tbody>
 </table>;
});

/** 위에서 내려다본 왼쪽 목청 반쪽: 둘레 살, 성대 주름, 뒤쪽의 작은 연골. 오른쪽은 거울로 뒤집어 다시 쓴다. */
const HALF=<>
 <path className="sp-g-tissue" d="M44 60V-12H-30V100H44Z"/>
 <path className="sp-g-fold" d="M44 60C41 52 36.4 40 36.6 30C36.7 23 38.4 18.5 40.6 17H44Z"/>
 <ellipse className="sp-g-ary" cx="39.4" cy="15" rx="4.4" ry="3.8"/>
</>;

/** 두 반쪽은 앞쪽 끝(아래 꼭짓점)을 축으로 돌며 V자 틈을 연다. 상태별 각도와 떨림은 CSS가 맡는다. */
function GlottisFigure({clipId}:{clipId:string}){
 return <svg className="sp-g" viewBox="0 0 88 72" width="88" height="72" aria-hidden="true" focusable="false">
  <defs><clipPath id={clipId}><ellipse cx="44" cy="37" rx="22" ry="27"/></clipPath></defs>
  <g className="sp-g-vib"><path d="M8 26Q2.5 37 8 48"/><path d="M12.5 29.5Q8.5 37 12.5 44.5"/><path d="M75.5 29.5Q79.5 37 75.5 44.5"/><path d="M80 26Q85.5 37 80 48"/></g>
  <ellipse className="sp-g-ring" cx="44" cy="37" rx="28" ry="32"/>
  <g clipPath={`url(#${clipId})`}>
   <rect className="sp-g-air" width="88" height="72"/>
   <g className="sp-g-side sp-g-left">{HALF}</g>
   <g className="sp-g-side sp-g-right"><g transform="matrix(-1 0 0 1 88 0)">{HALF}</g></g>
   <path className="sp-g-back" d="M0 0H88V12Q44 17 0 12Z"/>
  </g>
  <ellipse className="sp-g-rim" cx="44" cy="37" rx="22" ry="27"/>
 </svg>;
}

/**
 * 화면은 두 덩이다.
 * - 자막 막대(sound-caption): 지금 소리, 네 단계 자막, 진행 막대, 다시 보기·멈춤, 목청 그림. 넓은 화면에서는 3D 아래쪽, 좁은 화면에서는 표 바로 위.
 * - 조작판(sound-panel): 자음·모음 표와 속도. 넓은 화면에서는 오른쪽, 좁은 화면에서는 맨 아래.
 * 표를 누른 뒤 자막을 보려고 판을 내려 볼 필요가 없게 둘을 나누었다.
 */
export default function SoundPanel(props: SoundPanelProps): JSX.Element {
 const {tab,onTab,current,onPick,playing,paused,onReplay,onPause,speed,onSpeed,step,progress,onClose}=props;
 const uid='sp'+useId().replace(/[^w-]/g,'');
 const tabButtons=useRef<Partial<Record<Tab,HTMLButtonElement|null>>>({});
 const sound:Sound|undefined=current?SOUNDS[current]:undefined;
 const total=sound?.steps.length??0;
 const glottis:GlottisState=sound&&step>=0?glottisAt(sound,Math.min(step,total-1)):'open';
 const running=!!sound&&playing&&!paused&&step>=0&&step<total;
 const idle=!!sound&&!playing&&!paused;
 const ratio=Number.isFinite(progress)?Math.min(1,Math.max(0,progress)):0;
 const shown=step<0?0:Math.min(step,total-1);
 const spoken=sound&&step>=0&&step<total?`${step+1}단계. ${sound.steps[step]}`:'';
 const keyTabs=(e:ReactKeyboardEvent<HTMLDivElement>)=>{
  const next:Tab|null=e.key==='Home'?'consonant':e.key==='End'?'vowel':e.key==='ArrowLeft'||e.key==='ArrowRight'?(tab==='consonant'?'vowel':'consonant'):null;
  if(!next)return;
  e.preventDefault();
  if(next!==tab)onTab(next);
  tabButtons.current[next]?.focus();
 };
 return <div className="sim-dock">
  <section className={sound?'sound-caption glass':'sound-caption glass is-empty'} aria-label="소리 나는 과정">
   {sound?<div className="sc-grid">
    <span className="sc-glyph" aria-hidden="true">{sound.id}</span>
    <div className="sc-label"><b>{soundLabel(sound)}</b><span className="sc-gl">목청: <b>{GLOTTIS_KO[glottis]}</b></span></div>
    <ol className="sc-steps" aria-label="소리 나는 차례">
     {sound.steps.map((text,i)=><li key={i} className={`sc-step ${i===step?'is-now':i<step?'is-past':'is-next'}${i===shown?' is-shown':''}`} aria-current={i===step?'step':undefined}>
      <span className="sp-step-num">{i+1}</span><span className="sc-step-text">{text}</span>
     </li>)}
    </ol>
    <div className="sc-actions">
     <button type="button" className={idle?'sc-btn is-primary':'sc-btn'} onClick={onReplay} aria-label="처음부터 다시 보기"><RotateCcw size={15}/><span className="sc-btn-text">다시 보기</span></button>
     <button type="button" className={paused?'sc-btn is-primary':'sc-btn'} onClick={onPause} disabled={!playing&&!paused} aria-label={paused?'이어 보기':'멈춤'}>{paused?<Play size={15}/>:<Pause size={15}/>}<span className="sc-btn-text">{paused?'이어 보기':'멈춤'}</span></button>
    </div>
    <div className="sc-track" role="progressbar" aria-label="진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio*100)}><i style={{transform:`scaleX(${ratio})`}}/></div>
    <div className="sp-glottis sc-glottis" data-state={glottis} data-run={running?'on':'off'} data-speed={speed}>
     <GlottisFigure clipId={`${uid}-clip`}/>
     <span className="sp-glottis-label">목청: <b>{GLOTTIS_KO[glottis]}</b></span>
    </div>
   </div>:<p className="sc-empty">표에서 글자를 누르면 소리 나는 과정이 여기에 차례로 나옵니다.</p>}
   <p className="sp-sr" aria-live="polite">{spoken}</p>
  </section>

  <section className="sound-panel glass" aria-labelledby={`${uid}-title`}>
   <header className="sp-head">
    <h2 id={`${uid}-title`} className="sp-title">소리 내 보기</h2>
    <div className="sp-seg" role="group" aria-label="속도">{SPEEDS.map(s=><button key={s.id} type="button" aria-pressed={speed===s.id} onClick={()=>onSpeed(s.id)}>{s.name}</button>)}</div>
    <button type="button" className="sp-close" onClick={onClose} aria-label="소리 내 보기 닫기"><X size={18}/></button>
   </header>

   <div className="sp-tabs" role="tablist" aria-label="자음과 모음" onKeyDown={keyTabs}>
    {TABS.map(t=><button key={t.id} ref={el=>{tabButtons.current[t.id]=el;}} type="button" role="tab" id={`${uid}-tab-${t.id}`} aria-selected={tab===t.id} aria-controls={`${uid}-table`} tabIndex={tab===t.id?0:-1} className="sp-tab" onClick={()=>onTab(t.id)}>{t.name}<span className="sp-tab-count">{t.count}</span></button>)}
   </div>
   <div className="sp-table-wrap" role="tabpanel" id={`${uid}-table`} aria-labelledby={`${uid}-tab-${tab}`}>
    {tab==='consonant'?<ConsonantTable current={current} onPick={onPick}/>:<VowelTable current={current} onPick={onPick}/>}
   </div>
   {sound?.note&&<p className="sp-note"><b>{sound.id}</b> {sound.note}</p>}
  </section>
 </div>;
}
