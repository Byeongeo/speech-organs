/**
 * Vercel Drop 용 압축 파일 만들기
 *
 * 빌드 결과(dist)를 그대로 끌어다 놓으면 바로 열리는 정적 사이트로 묶는다.
 * 안내 페이지(guide)와 내려받기 폴더(download)는 빼고, dist/download/speech-organs.zip 으로 저장한다.
 * 외부 패키지 없이 Node 기본 기능(zlib)만 쓴다. 이미 압축된 .gz 파일은 다시 압축하지 않고 그대로 담는다.
 *
 * 실행: npm run build (vite build 뒤에 자동 실행)
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { join, relative, sep } from 'node:path';

const DIST = 'dist';
const SKIP = new Set(['guide', 'download']);
const OUT_DIR = join(DIST, 'download');
const OUT = join(OUT_DIR, 'speech-organs.zip');

const CRC_TABLE = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (dir === DIST && SKIP.has(name)) continue;
    if (statSync(full).isDirectory()) out.push(...walk(full)); else out.push(full);
  }
  return out;
}

// 압축 파일 안 시각: 빌드할 때마다 같은 결과가 나오도록 고정(2026-01-01 00:00)
const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const files = walk(DIST), locals = [], centrals = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(relative(DIST, file).split(sep).join('/'), 'utf8');
  const data = readFileSync(file);
  const stored = /\.(gz|png|jpe?g|webp|zip)$/i.test(file);
  const body = stored ? data : deflateRawSync(data, { level: 9 });
  const method = stored ? 0 : 8, crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8);
  local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10); central.writeUInt16LE(DOS_TIME, 12); central.writeUInt16LE(DOS_DATE, 14); central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  locals.push(local, name, body); centrals.push(central, name);
  offset += local.length + name.length + body.length;
}
const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
mkdirSync(OUT_DIR, { recursive: true });
const zip = Buffer.concat([...locals, cd, end]);
writeFileSync(OUT, zip);
console.log(`Vercel Drop 용 압축 파일: ${OUT} (파일 ${files.length}개, ${(zip.length / 1048576).toFixed(1)} MB)`);
