/**
 * 발음 시뮬레이션의 소리 자료
 *
 * 자음 19개와 단모음 10개의 자질(조음 위치·방법·소리의 세기·울림, 혀의 높낮이·앞뒤·입술 모양)과
 * 단계별 자막 4개를 담는다. 3D 엔진은 자질을 읽어 움직임을 만들고, 조작판은 표와 자막을 그린다.
 *
 * 단계의 뜻(엔진이 이 순서로 움직인다)
 *  - 파열음  : 0 공기 올라옴 · 1 목청 상태 · 2 막음 · 3 터뜨림
 *  - 파찰음  : 0 공기 올라옴 · 1 목청 상태 · 2 막음 · 3 천천히 떼며 마찰
 *  - 마찰음  : 0 공기 올라옴 · 1 목청 상태 · 2 좁힘 · 3 마찰
 *  - ㅎ      : 0 공기 올라옴 · 1 목청 좁힘 · 2 목청에서 마찰 · 3 입 밖으로 나감
 *  - 비음    : 0 여린입천장 내림 · 1 입안 막음 · 2 목청 떨림 · 3 코로 나감
 *  - 유음    : 0 공기 올라옴 · 1 목청 떨림 · 2 혀끝 닿음 · 3 혀 양옆으로 흐름
 *  - 모음    : 0 혀 자리 · 1 입술 모양 · 2 목청 떨림 · 3 입 밖으로 나감
 */
export type Place='lips'|'alveolar'|'palatal'|'velar'|'glottal';
export type Manner='stop'|'affricate'|'fricative'|'nasal'|'liquid';
export type Phonation='lax'|'tense'|'aspirated';
export type Height='high'|'mid'|'low';

export interface Consonant {id:string;kind:'consonant';place:Place;manner:Manner;phonation?:Phonation;voiced:boolean;note?:string;steps:string[]}
export interface Vowel {id:string;kind:'vowel';height:Height;front:boolean;round:boolean;note?:string;steps:string[]}
export type Sound=Consonant|Vowel;

export const PLACE_KO:Record<Place,string>={lips:'입술소리',alveolar:'잇몸소리',palatal:'센입천장소리',velar:'여린입천장소리',glottal:'목청소리'};
export const MANNER_KO:Record<Manner,string>={stop:'파열음',affricate:'파찰음',fricative:'마찰음',nasal:'비음',liquid:'유음'};
export const PHONATION_KO:Record<Phonation,string>={lax:'예사소리',tense:'된소리',aspirated:'거센소리'};
export const HEIGHT_KO:Record<Height,string>={high:'고모음',mid:'중모음',low:'저모음'};

const PLACE_CLOSE:Record<Place,string>={
 lips:'두 입술을 닫아 공기를 막습니다.',
 alveolar:'혀끝을 윗잇몸에 붙여 공기를 막습니다.',
 palatal:'혓바닥을 센입천장에 붙여 공기를 막습니다.',
 velar:'혀의 뒷부분을 여린입천장에 붙여 공기를 막습니다.',
 glottal:'목청 사이를 좁힙니다.',
};
const NASAL_CLOSE:Record<Place,string>={
 lips:'두 입술을 닫아 입으로 가는 길을 막습니다.',
 alveolar:'혀끝을 윗잇몸에 붙여 입으로 가는 길을 막습니다.',
 palatal:'',
 velar:'혀의 뒷부분을 여린입천장에 붙여 입으로 가는 길을 막습니다.',
 glottal:'',
};
const RISE='허파에서 공기가 올라옵니다.';
const GLOTTIS:Record<Phonation,string>={
 lax:'목청은 떨리지 않습니다.',
 tense:'목청 둘레를 긴장시키며, 목청은 떨리지 않습니다.',
 aspirated:'목청은 떨리지 않습니다.',
};
const RELEASE:Record<Phonation,string>={
 lax:'막았던 곳을 떼며 공기를 터뜨립니다.',
 tense:'막았던 곳을 떼며 공기를 세고 짧게 터뜨립니다.',
 aspirated:'막았던 곳을 떼며 공기를 거센 바람과 함께 터뜨립니다.',
};
const AFFRICATE_RELEASE:Record<Phonation,string>={
 lax:'막았던 곳을 천천히 떼며 좁은 틈으로 공기를 마찰시킵니다.',
 tense:'막았던 곳을 천천히 떼며 좁은 틈으로 공기를 세게 마찰시킵니다.',
 aspirated:'막았던 곳을 천천히 떼며 거센 바람과 함께 공기를 마찰시킵니다.',
};

function stop(id:string,place:Place,phonation:Phonation):Consonant{
 return {id,kind:'consonant',place,manner:'stop',phonation,voiced:false,steps:[RISE,GLOTTIS[phonation],PLACE_CLOSE[place],RELEASE[phonation]]};
}
function affricate(id:string,phonation:Phonation):Consonant{
 return {id,kind:'consonant',place:'palatal',manner:'affricate',phonation,voiced:false,steps:[RISE,GLOTTIS[phonation],PLACE_CLOSE.palatal,AFFRICATE_RELEASE[phonation]]};
}
function nasal(id:string,place:Place,note?:string):Consonant{
 return {id,kind:'consonant',place,manner:'nasal',voiced:true,note,steps:['여린입천장을 내려 코로 가는 길을 엽니다.',NASAL_CLOSE[place],'허파에서 올라온 공기에 목청이 떨립니다.','공기가 코로 빠져나가며 울립니다.']};
}

export const SOUNDS:Record<string,Sound>={
 'ㅂ':stop('ㅂ','lips','lax'),'ㅃ':stop('ㅃ','lips','tense'),'ㅍ':stop('ㅍ','lips','aspirated'),
 'ㄷ':stop('ㄷ','alveolar','lax'),'ㄸ':stop('ㄸ','alveolar','tense'),'ㅌ':stop('ㅌ','alveolar','aspirated'),
 'ㄱ':stop('ㄱ','velar','lax'),'ㄲ':stop('ㄲ','velar','tense'),'ㅋ':stop('ㅋ','velar','aspirated'),
 'ㅈ':affricate('ㅈ','lax'),'ㅉ':affricate('ㅉ','tense'),'ㅊ':affricate('ㅊ','aspirated'),
 'ㅅ':{id:'ㅅ',kind:'consonant',place:'alveolar',manner:'fricative',phonation:'lax',voiced:false,steps:[RISE,GLOTTIS.lax,'혀끝을 윗잇몸에 가까이 대어 좁은 틈을 만듭니다.','좁은 틈으로 공기를 내보내며 마찰시킵니다.']},
 'ㅆ':{id:'ㅆ',kind:'consonant',place:'alveolar',manner:'fricative',phonation:'tense',voiced:false,steps:[RISE,GLOTTIS.tense,'혀끝을 윗잇몸에 가까이 대어 좁은 틈을 만듭니다.','좁은 틈으로 공기를 내보내며 더 세게 마찰시킵니다.']},
 'ㅎ':{id:'ㅎ',kind:'consonant',place:'glottal',manner:'fricative',voiced:false,steps:[RISE,'목청 사이를 좁힙니다.','좁아진 목청 사이로 공기가 지나가며 마찰합니다.','입안은 열린 채로 공기가 밖으로 나갑니다.']},
 'ㅁ':nasal('ㅁ','lips'),'ㄴ':nasal('ㄴ','alveolar'),
 'ㅇ':nasal('ㅇ','velar','받침으로 쓰일 때의 소리입니다. 첫소리에 오는 ㅇ은 소리가 없습니다.'),
 'ㄹ':{id:'ㄹ',kind:'consonant',place:'alveolar',manner:'liquid',voiced:true,note:'받침 ㄹ의 소리입니다. 첫소리 ㄹ은 혀끝으로 윗잇몸을 한 번 가볍게 튀기듯 냅니다.',steps:[RISE,'허파에서 올라온 공기에 목청이 떨립니다.','혀끝을 윗잇몸에 가볍게 댑니다.','공기를 혀의 양옆으로 흘려보냅니다.']},
};

function vowel(id:string,height:Height,front:boolean,round:boolean):Vowel{
 const where=front?'입안 앞쪽':'입안 뒤쪽';
 const how=height==='high'?'높이 올라갑니다.':height==='mid'?'중간 높이에 놓입니다.':'낮게 내려갑니다.';
 const lips=round?'입술을 둥글게 오므립니다.':height==='low'?'입술은 평평하게 두고 입을 크게 벌립니다.':'입술은 평평하게 둡니다.';
 return {id,kind:'vowel',height,front,round,steps:[`혀가 ${where}에서 ${how}`,lips,'허파에서 올라온 공기에 목청이 떨립니다.','공기가 막힘 없이 입 밖으로 나갑니다.']};
}
Object.assign(SOUNDS,{
 'ㅣ':vowel('ㅣ','high',true,false),'ㅟ':vowel('ㅟ','high',true,true),'ㅡ':vowel('ㅡ','high',false,false),'ㅜ':vowel('ㅜ','high',false,true),
 'ㅔ':vowel('ㅔ','mid',true,false),'ㅚ':vowel('ㅚ','mid',true,true),'ㅓ':vowel('ㅓ','mid',false,false),'ㅗ':vowel('ㅗ','mid',false,true),
 'ㅐ':vowel('ㅐ','low',true,false),'ㅏ':vowel('ㅏ','low',false,false),
});


/** 교과서 검수 결과 (scripts/ko/sim/review.json) 로 자막과 참고 문장을 바로잡는다 */
const REVIEWED_STEPS:Record<string,string[]>={
 "ㅃ": [
  "허파에서 공기가 올라옵니다.",
  "목청을 긴장시키지만, 목청은 떨리지 않습니다.",
  "두 입술을 닫아 공기를 막습니다.",
  "막았던 곳을 떼며 공기를 짧고 단단하게 터뜨립니다."
 ],
 "ㄸ": [
  "허파에서 공기가 올라옵니다.",
  "목청을 긴장시키지만, 목청은 떨리지 않습니다.",
  "혀끝을 윗잇몸에 붙여 공기를 막습니다.",
  "막았던 곳을 떼며 공기를 짧고 단단하게 터뜨립니다."
 ],
 "ㄲ": [
  "허파에서 공기가 올라옵니다.",
  "목청을 긴장시키지만, 목청은 떨리지 않습니다.",
  "혀의 뒷부분을 여린입천장에 붙여 공기를 막습니다.",
  "막았던 곳을 떼며 공기를 짧고 단단하게 터뜨립니다."
 ],
 "ㅍ": [
  "허파에서 공기가 올라옵니다.",
  "목청은 떨리지 않습니다.",
  "두 입술을 닫아 공기를 막습니다.",
  "막았던 곳을 떼며 공기를 거세게 터뜨립니다."
 ],
 "ㅌ": [
  "허파에서 공기가 올라옵니다.",
  "목청은 떨리지 않습니다.",
  "혀끝을 윗잇몸에 붙여 공기를 막습니다.",
  "막았던 곳을 떼며 공기를 거세게 터뜨립니다."
 ],
 "ㅋ": [
  "허파에서 공기가 올라옵니다.",
  "목청은 떨리지 않습니다.",
  "혀의 뒷부분을 여린입천장에 붙여 공기를 막습니다.",
  "막았던 곳을 떼며 공기를 거세게 터뜨립니다."
 ],
 "ㅉ": [
  "허파에서 공기가 올라옵니다.",
  "목청을 긴장시키지만, 목청은 떨리지 않습니다.",
  "혓바닥을 센입천장에 붙여 공기를 막습니다.",
  "막았던 곳을 천천히 떼며 좁은 틈으로 공기를 단단하게 마찰시킵니다."
 ],
 "ㅊ": [
  "허파에서 공기가 올라옵니다.",
  "목청은 떨리지 않습니다.",
  "혓바닥을 센입천장에 붙여 공기를 막습니다.",
  "막았던 곳을 천천히 떼며 좁은 틈으로 공기를 거세게 마찰시킵니다."
 ],
 "ㅆ": [
  "허파에서 공기가 올라옵니다.",
  "목청을 긴장시키지만, 목청은 떨리지 않습니다.",
  "혀끝을 윗잇몸에 가까이 대어 좁은 틈을 만듭니다.",
  "좁은 틈으로 공기를 내보내며 단단하게 마찰시킵니다."
 ],
 "ㄹ": [
  "허파에서 공기가 올라옵니다.",
  "올라온 공기에 목청이 떨립니다.",
  "혀끝을 윗잇몸에 대어 가운데 길만 막습니다.",
  "공기를 혀의 양옆으로 흘려보냅니다."
 ]
};
const REVIEWED_NOTES:Record<string,string>={
 "ㄹ": "받침 ㄹ(예: 달)의 소리입니다. 모음 사이의 ㄹ(예: 나라)은 혀끝으로 윗잇몸을 한 번 가볍게 튀기듯 냅니다.",
 "ㅎ": "ㅎ은 짝이 되는 된소리·거센소리가 없어, 교과서에 따라 예사소리나 거센소리로 보거나 소리의 세기를 나누지 않습니다.",
 "ㅚ": "단모음으로 발음하는 것이 원칙이지만, ㅞ처럼 이중 모음으로 발음해도 표준 발음입니다(표준 발음법 제4항 붙임). 예: 회[회/훼]",
 "ㅟ": "단모음으로 발음하는 것이 원칙이지만, 반모음 ㅜ에 ㅣ를 이어 내는 이중 모음으로 발음해도 표준 발음입니다(표준 발음법 제4항 붙임)."
};
for(const [id,steps] of Object.entries(REVIEWED_STEPS))if(SOUNDS[id]&&steps.length===4)SOUNDS[id].steps=steps;
for(const [id,note] of Object.entries(REVIEWED_NOTES))if(SOUNDS[id])SOUNDS[id].note=note;

/** 교과서 자음 체계표: 열은 조음 위치, 행은 조음 방법과 소리의 세기 */
export const CONSONANT_TABLE:{columns:Place[];rows:{manner:Manner;phonation?:Phonation;cells:(string|null)[]}[]}={
 columns:['lips','alveolar','palatal','velar','glottal'],
 rows:[
  {manner:'stop',phonation:'lax',cells:['ㅂ','ㄷ',null,'ㄱ',null]},
  {manner:'stop',phonation:'tense',cells:['ㅃ','ㄸ',null,'ㄲ',null]},
  {manner:'stop',phonation:'aspirated',cells:['ㅍ','ㅌ',null,'ㅋ',null]},
  {manner:'affricate',phonation:'lax',cells:[null,null,'ㅈ',null,null]},
  {manner:'affricate',phonation:'tense',cells:[null,null,'ㅉ',null,null]},
  {manner:'affricate',phonation:'aspirated',cells:[null,null,'ㅊ',null,null]},
  {manner:'fricative',phonation:'lax',cells:[null,'ㅅ',null,null,'ㅎ']},
  {manner:'fricative',phonation:'tense',cells:[null,'ㅆ',null,null,'^']}, // '^': 위 칸(ㅎ)이 이어져 덮는 자리
  {manner:'nasal',cells:['ㅁ','ㄴ',null,'ㅇ',null]},
  {manner:'liquid',cells:[null,'ㄹ',null,null,null]},
 ],
};

/** 교과서 단모음 체계표: 열은 혀의 앞뒤와 입술 모양, 행은 혀의 높낮이 */
export const VOWEL_TABLE:{columns:{front:boolean;round:boolean}[];rows:{height:Height;cells:(string|null)[]}[]}={
 columns:[{front:true,round:false},{front:true,round:true},{front:false,round:false},{front:false,round:true}],
 rows:[
  {height:'high',cells:['ㅣ','ㅟ','ㅡ','ㅜ']},
  {height:'mid',cells:['ㅔ','ㅚ','ㅓ','ㅗ']},
  {height:'low',cells:['ㅐ',null,'ㅏ',null]},
 ],
};

/** 화면에 보여 줄 분류 이름. 예: "여린입천장소리 · 파열음 · 예사소리 · 안울림소리" */
export function soundLabel(s:Sound){
 if(s.kind==='vowel') return [s.front?'전설 모음':'후설 모음',HEIGHT_KO[s.height],s.round?'원순 모음':'평순 모음'].join(' · ');
 return [PLACE_KO[s.place],MANNER_KO[s.manner],s.phonation?PHONATION_KO[s.phonation]:null,s.voiced?'울림소리':'안울림소리'].filter(Boolean).join(' · ');
}

/** 각 단계에서 목청이 어떤 상태인지 (조작판의 목청 그림에 쓴다) */
export type GlottisState='open'|'vibrate'|'narrow'|'tense';
export function glottisAt(s:Sound,step:number):GlottisState{
 if(s.kind==='vowel') return step>=2?'vibrate':'open';
 if(s.manner==='nasal') return step>=2?'vibrate':'open';
 if(s.manner==='liquid') return step>=1?'vibrate':'open';
 if(s.place==='glottal') return step>=1?'narrow':'open';
 if(s.phonation==='tense') return step>=1?'tense':'open';
 return 'open';
}
