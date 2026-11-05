/**
 * 근골격계 한글 이름표
 *
 * 1) 규칙으로 만드는 이름: 척추뼈, 척추 사이 원반, 갈비뼈, 갈비연골,
 *    손발가락뼈, 손발허리뼈, 치아
 * 2) 표로 정한 이름: 나머지 뼈 43종, 힘줄·인대 14종
 * 3) 근육 이름은 검수를 거친 scripts/ko/out/muscles-*.json 에서 읽는다.
 *
 * 각 항목은 { ko: 새 용어, alt: 옛 용어 } 이며 좌우 표기는 붙이지 않는다.
 */

const ORD = ['', '첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째', '열째', '열한째', '열두째'];
const EN = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };
const REGION = { cervical: { ko: '목뼈', old: '경추', code: 'C' }, thoracic: { ko: '등뼈', old: '흉추', code: 'T' }, lumbar: { ko: '허리뼈', old: '요추', code: 'L' } };

export const BONES = {
  'body of sternum': ['복장뼈몸통', '흉골체'],
  'manubrium': ['복장뼈자루', '흉골병'],
  'xiphoid process': ['칼돌기', '검상돌기'],
  'calcaneus': ['발꿈치뼈', '종골'],
  'capitate': ['알머리뼈', '유두골'],
  'clavicle': ['빗장뼈', '쇄골'],
  'cuboid bone': ['입방뼈', '입방골'],
  'ethmoid': ['벌집뼈', '사골'],
  'femur': ['넙다리뼈', '대퇴골'],
  'fibula': ['종아리뼈', '비골'],
  'frontal bone': ['이마뼈', '전두골'],
  'hamate': ['갈고리뼈', '유구골'],
  'hip bone': ['볼기뼈', '관골'],
  'humerus': ['위팔뼈', '상완골'],
  'hyoid bone': ['목뿔뼈', '설골'],
  'intermediate cuneiform bone': ['중간쐐기뼈', '중간설상골'],
  'lateral cuneiform bone': ['가쪽쐐기뼈', '외측설상골'],
  'lunate': ['반달뼈', '월상골'],
  'mandible': ['아래턱뼈', '하악골'],
  'maxilla': ['위턱뼈', '상악골'],
  'medial cuneiform bone': ['안쪽쐐기뼈', '내측설상골'],
  'nasal bone': ['코뼈', '비골'],
  'navicular bone of foot': ['발배뼈', '주상골'],
  'occipital bone': ['뒤통수뼈', '후두골'],
  'palatine bone': ['입천장뼈', '구개골'],
  'parietal bone': ['마루뼈', '두정골'],
  'patella': ['무릎뼈', '슬개골'],
  'pisiform': ['콩알뼈', '두상골'],
  'radius': ['노뼈', '요골'],
  'sacrum': ['엉치뼈', '천골'],
  'scaphoid': ['손배뼈', '주상골'],
  'scapula': ['어깨뼈', '견갑골'],
  'sesamoid bone of foot': ['발 종자뼈', '종자골'],
  'sphenoid bone': ['나비뼈', '접형골'],
  'talus': ['목말뼈', '거골'],
  'temporal bone': ['관자뼈', '측두골'],
  'tibia': ['정강뼈', '경골'],
  'trapezium': ['큰마름뼈', '대능형골'],
  'trapezoid': ['작은마름뼈', '소능형골'],
  'triquetral': ['세모뼈', '삼각골'],
  'ulna': ['자뼈', '척골'],
  'vomer': ['보습뼈', '서골'],
  'zygomatic bone': ['광대뼈', '협골'],
};

export const TENDONS = {
  'calcaneal tendon': ['발꿈치힘줄', '아킬레스힘줄'],
  'check ligament of lateral rectus': ['가쪽곧은근 제한인대', '외직근 억제인대'],
  'check ligament of medial rectus': ['안쪽곧은근 제한인대', '내직근 억제인대'],
  'iliotibial tract': ['엉덩정강띠', '장경인대'],
  'intermediate tendon': ['두힘살근 중간힘줄', '이복근 중간건'],
  'interosseous membrane of forearm': ['아래팔뼈사이막', '전완골간막'],
  'interosseous membrane of leg': ['종아리뼈사이막', '하퇴골간막'],
  'linea alba': ['백색선', '백선'],
  'long plantar ligament': ['긴발바닥인대', '장족저인대'],
  'pterygomandibular raphe': ['날개아래턱솔기', '익돌하악봉선'],
  'stylohyoid ligament': ['붓목뿔인대', '경돌설골인대'],
  'tendinous arch of levator ani': ['항문올림근 힘줄활', '항문거근건궁'],
  'tendon of levator palpebrae superioris': ['위눈꺼풀올림근 힘줄', '상안검거근건'],
  'trochlea of superior oblique': ['위빗근 도르래', '상사근 활차'],
};

const FINGER = {
  'thumb': ['엄지손가락', '무지'], 'index finger': ['집게손가락', '시지'], 'middle finger': ['가운데손가락', '중지'],
  'ring finger': ['반지손가락', '환지'], 'little finger': ['새끼손가락', '소지'],
  'big toe': ['엄지발가락', '무지'], 'second toe': ['둘째발가락', '제2지'], 'third toe': ['셋째발가락', '제3지'],
  'fourth toe': ['넷째발가락', '제4지'], 'little toe': ['새끼발가락', '소지'],
};
const PHALANX = { proximal: ['첫마디뼈', '기절골'], middle: ['중간마디뼈', '중절골'], distal: ['끝마디뼈', '말절골'] };
const TOOTH = {
  'central secondary incisor': ['가운데앞니', '중절치'], 'lateral secondary incisor': ['가쪽앞니', '측절치'],
  'secondary canine': ['송곳니', '견치'], 'first secondary premolar': ['첫째 작은어금니', '제1소구치'],
  'second secondary premolar': ['둘째 작은어금니', '제2소구치'], 'first secondary molar': ['첫째 큰어금니', '제1대구치'],
  'second secondary molar': ['둘째 큰어금니', '제2대구치'],
};

/** 척추 순서 목록: C1..C7, T1..T12, L1..L5, S */
const SPINE = [
  ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ r: 'cervical', n })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => ({ r: 'thoracic', n })),
  ...[1, 2, 3, 4, 5].map(n => ({ r: 'lumbar', n })),
  { r: 'sacrum', n: 0 },
];
const spineIndex = (r, n) => SPINE.findIndex(s => s.r === r && s.n === n);
const vertKo = s => s.r === 'sacrum' ? '엉치뼈' : `${ORD[s.n]} ${REGION[s.r].ko}`;
const vertCode = s => s.r === 'sacrum' ? 'S1' : `${REGION[s.r].code}${s.n}`;

/** 척추 사이 원반: 'X 아래의 원반' → 'X와 그 아래 척추 사이 원반' */
export function discName(upper) {
  const i = spineIndex(upper.r, upper.n), lower = SPINE[i + 1];
  const same = upper.r === lower.r;
  const ko = same ? `${ORD[upper.n]}·${ORD[lower.n]} ${REGION[upper.r].ko} 사이 원반` : `${vertKo(upper)}와 ${vertKo(lower)} 사이 원반`;
  return { ko, alt: `추간판 ${vertCode(upper)}–${vertCode(lower)}`, family: 'disc' };
}

/** 영어 기준명(좌우 없음, 소문자) → { ko, alt, family } 또는 null */
export function ruleName(key) {
  let m;
  if (key === 'atlas') return { ko: '고리뼈', alt: '첫째 목뼈 · 환추', family: 'vertebra' };
  if (key === 'axis') return { ko: '중쇠뼈', alt: '둘째 목뼈 · 축추', family: 'vertebra' };
  if ((m = key.match(/^intervertebral disk of axis$/))) return discName({ r: 'cervical', n: 2 });
  if ((m = key.match(/^intervertebral disk of (\w+) (cervical|thoracic|lumbar) vertebra$/))) return discName({ r: m[2], n: EN[m[1]] });
  if ((m = key.match(/^(\w+) (cervical|thoracic|lumbar) vertebra$/))) {
    const n = EN[m[1]], R = REGION[m[2]];
    return { ko: `${ORD[n]} ${R.ko}`, alt: `제${n}${R.old}`, family: 'vertebra' };
  }
  if ((m = key.match(/^(\w+) rib$/))) return { ko: `${ORD[EN[m[1]]]} 갈비뼈`, alt: `제${EN[m[1]]}늑골`, family: 'rib' };
  if ((m = key.match(/^(\w+) costal cartilage$/))) return { ko: `${ORD[EN[m[1]]]} 갈비연골`, alt: `제${EN[m[1]]}늑연골`, family: 'costal' };
  if ((m = key.match(/^(proximal|middle|distal) phalanx of (.+)$/))) {
    const d = FINGER[m[2]], t = PHALANX[m[1]];
    if (d) return { ko: `${d[0]} ${t[0]}`, alt: `${d[1]} ${t[1]}`, family: m[2].includes('toe') ? 'toe' : 'finger' };
  }
  if ((m = key.match(/^(\w+) metacarpal bone$/))) return { ko: `${ORD[EN[m[1]]]} 손허리뼈`, alt: `제${EN[m[1]]}중수골`, family: 'metacarpal' };
  if ((m = key.match(/^(\w+) metatarsal bone$/))) return { ko: `${ORD[EN[m[1]]]} 발허리뼈`, alt: `제${EN[m[1]]}중족골`, family: 'metatarsal' };
  if ((m = key.match(/^(upper|lower) (.+) tooth$/))) {
    const t = TOOTH[m[2]];
    if (t) return { ko: `${m[1] === 'upper' ? '위' : '아래'} ${t[0]}`, alt: `${m[1] === 'upper' ? '상악' : '하악'} ${t[1]}`, family: 'tooth' };
  }
  return null;
}

/** 이름이 'Intervertebral disk' 하나뿐인 원반은 위치로 판단해 열두째 등뼈 아래 원반으로 지정한다. */
export const UNNAMED_DISC = discName({ r: 'thoracic', n: 12 });

export function tableName(key) {
  if (BONES[key]) return { ko: BONES[key][0], alt: BONES[key][1], family: 'bone' };
  if (TENDONS[key]) return { ko: TENDONS[key][0], alt: TENDONS[key][1], family: 'tendon' };
  return null;
}

export const SIDE_KO = { left: '왼쪽', right: '오른쪽', '': '' };
