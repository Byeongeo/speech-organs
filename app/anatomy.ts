export type SystemId='lip'|'teeth'|'jaw'|'nose'|'tongue'|'palate'|'pharynx'|'larynx'|'vocal'|'skin';
export const SYSTEMS:{id:SystemId;name:string;color:string;description:string}[]=[
 {id:'lip',name:'입술·잇몸',color:'#d98a8a',description:'입의 가장 바깥에 있는 입술과 이를 감싸는 잇몸입니다. 두 입술로 입술소리 ㅂ, ㅃ, ㅍ, ㅁ을 내고, 윗잇몸에 혀끝을 대어 잇몸소리를 냅니다.'},
 {id:'teeth',name:'이',color:'#f0e8d6',description:'위아래 잇몸에 줄지어 박힌 단단한 이입니다. 혀와 입술이 소리를 만들 때 기준이 되는 벽 역할을 합니다.'},
 {id:'jaw',name:'턱뼈·입천장뼈',color:'#e2d9ba',description:'위턱뼈와 입천장뼈는 입천장의 단단한 바탕인 센입천장을 이루고, 아래턱뼈는 입을 벌리고 닫습니다. 목뿔뼈는 혀와 후두를 붙잡아 줍니다.'},
 {id:'nose',name:'코',color:'#cdbfa6',description:'코뼈와 코연골이 코의 모양을 만들고, 그 안쪽의 빈 곳을 코안이라고 합니다. 공기가 코안으로 빠져나가면 콧소리 ㅁ, ㄴ, ㅇ이 납니다.'},
 {id:'tongue',name:'혀와 입 바닥',color:'#c86b6e',description:'혀는 입안에서 가장 많이 움직이는 근육 덩어리입니다. 혀가 입천장의 어디에 닿느냐에 따라 자음이, 혀의 높낮이와 앞뒤 위치에 따라 모음이 달라집니다.'},
 {id:'palate',name:'여린입천장·목젖',color:'#b65d6a',description:'센입천장 뒤에 이어지는 부드러운 입천장과 그 끝의 목젖을 움직이는 근육입니다. 여린입천장이 올라가면 코로 가는 길이 막히고, 내려오면 콧소리가 납니다.'},
 {id:'pharynx',name:'인두·식도',color:'#a85b50',description:'인두는 코안과 입안 뒤에서 아래로 이어지는 근육 관입니다. 공기와 음식이 함께 지나가며, 아래에서 앞쪽의 후두와 뒤쪽의 식도로 갈라집니다.'},
 {id:'larynx',name:'후두',color:'#b7c6cf',description:'후두는 목 앞쪽의 연골 상자로, 그 안에 목청이 들어 있습니다. 숨 쉬는 길이면서 목소리를 만드는 곳입니다.'},
 {id:'vocal',name:'목청(성대)',color:'#e3b448',description:'목청은 후두 속의 한 쌍의 주름으로 성대라고도 합니다. 목청이 떨리면 울림소리가 나고, 목청 사이를 좁혀 공기를 마찰시키면 목청소리 ㅎ이 납니다.'},
 {id:'skin',name:'피부(윤곽)',color:'#e7c3ad',description:'머리와 목의 윤곽을 보여 주려고 피부를 반투명하게 그렸습니다. 끄면 속 구조만 볼 수 있습니다.'},
];
export interface Part {id:string;name:string;alt?:string;dkey?:string;role?:number;nameEn?:string;conceptId:string;system:SystemId;chunk:number;positions:number;normals:number;indices:number;vertexCount:number;indexCount:number;bounds:[number[],number[]]}
export interface Concept {id:string;name:string;alt?:string;dkey?:string;elements:string[]}
export interface Atlas {version:string;sex?:'male';source?:string;scope?:string;parts:Part[];concepts:Concept[];descriptions?:Record<string,string>;chunks:{url:string;bytes:number;gzip?:string;gzipBytes?:number}[];triangles:number;midX?:number;landmarks?:import('./speech-sim').Landmarks}
export type View='three-quarter'|'front'|'back'|'side';
export interface SceneState {inspectorOpen?:boolean;explode:number;visible:SystemId[];selected:string[];isolate:boolean;view:View;rotate:boolean;reset:number;cut:boolean;sim?:{open:boolean;id:string|null;nonce:number;paused:boolean;speed:'slow'|'normal'}}
export const DEFAULT_VISIBLE:SystemId[]=['lip','teeth','jaw','nose','tongue','palate','pharynx','larynx','vocal','skin'];

/** 펼치기 방향: 원본처럼 묶음마다 둘레의 한 방향으로 벌어진다. 피부는 펼칠 때 숨기므로 빼고 나눈다. */
const SPREAD=SYSTEMS.filter(s=>s.id!=='skin').map(s=>s.id);
export function explodeAngle(id:SystemId){const i=SPREAD.indexOf(id);return (i<0?0:i)/SPREAD.length*Math.PI*2;}

/** 구조 설명: 자료 파일의 개별 설명을 먼저 쓰고, 없으면 묶음 설명을 쓴다. */
export function describe(atlas:Atlas|null,item:{dkey?:string}|null|undefined,system:SystemId|undefined){
 const own=item?.dkey?atlas?.descriptions?.[item.dkey]:undefined;
 return {text:own??SYSTEMS.find(s=>s.id===system)?.description??'',own:!!own};
}
