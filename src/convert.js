/**
 * convert 命令实现（SPEC §3.3）
 * zstd <-> plain(.jsonl) 互转；dsh 按文件后缀识别压缩方式（docs/format.md §1）
 * 格式纪律：plain->zstd 必须帧合规重写（header 一帧恰一行 + 事件一帧）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadZstd } from './lib/zstd.js';
import { VERSION } from './version.js';

export async function convertSession(file, opts) {
  const { format, outDir } = opts;
  const z = await loadZstd();
  const buf = readFileSync(file);
  const isZstd = buf[0] === 0x28 && buf[1] === 0xB5 && buf[2] === 0x2F && buf[3] === 0xFD;

  let targetPath;
  let name = path.basename(file);
  if (name.endsWith('.zstd')) name = name.slice(0, -5);
  if (name.endsWith('.jsonl')) name = name.slice(0, -6);
  const baseName = name;

  // 幂等：目标格式与源格式相同 → 无操作
  const srcIsZstd = name.endsWith('.jsonl.zstd') || (isZstd && file.endsWith('.zstd'));
  if ((format === 'zstd' && isZstd) || (format === 'plain' && !isZstd)) {
    return { command: 'convert', toolVersion: VERSION, items: [{ id: path.basename(path.dirname(file)), status: 'noop', from: path.basename(file), to: path.basename(file), targetPath: file }], exitCode: 0 };
  }

  if (format === 'plain') {
    // zstd/plain -> plain
    const plain = isZstd ? z.decompress(buf) : buf;
    targetPath = path.join(outDir ?? path.dirname(file), baseName + '.jsonl');
    writeFileSync(targetPath, plain);
  } else {
    // plain -> zstd（帧合规重写）
    const plain = buf;
    const first = plain.indexOf(0x0A);
    if (first < 0) { const e = new Error('文件无换行（非 JSONL?）'); e.code = 'E_TORN'; e.exitCode = 1; throw e; }
    const headerLine = plain.subarray(0, first);
    const events = plain.subarray(first + 1);
    const frame1 = z.compress(Buffer.concat([headerLine, Buffer.from([0x0A])]));
    const frame2 = z.compress(events);
    targetPath = path.join(outDir ?? path.dirname(file), baseName + '.jsonl.zstd');
    writeFileSync(targetPath, Buffer.concat([frame1, frame2]));
  }
  return { command: 'convert', toolVersion: VERSION, items: [{ id: path.basename(path.dirname(file)), status: 'converted', from: path.basename(file), to: path.basename(targetPath), targetPath }], exitCode: 0 };
}
