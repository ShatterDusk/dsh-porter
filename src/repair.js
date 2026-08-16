/**
 * repair 命令实现（SPEC §3.4）
 * 按损坏类型：unknown-format -> quarantine + 副本建议；corrupt/torn -> 帧级截断修复（保留可解前缀）
 * 安全：修复前原文件移入 quarantine（可回滚），修复版写回原位
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { loadZstd } from './lib/zstd.js';
import { VERSION } from './version.js';

function findFrames(buf) {
  const starts = [];
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf[i] === 0x28 && buf[i+1] === 0xB5 && buf[i+2] === 0x2F && buf[i+3] === 0xFD) starts.push(i);
  }
  return starts;
}

export async function repairSession(file, opts) {
  const { quarantineDir } = opts;
  const z = await loadZstd();
  const id = path.basename(path.dirname(file));
  const buf = readFileSync(file);
  const isZstd = buf[0] === 0x28 && buf[1] === 0xB5 && buf[2] === 0x2F && buf[3] === 0xFD;

  // unknown-format：隔离 + 报告（含副本建议）
  if (!isZstd) {
    const q = quarantineDir ?? path.join(path.dirname(path.dirname(path.dirname(file))), '.quarantine');
    const qPath = path.join(q, id, path.basename(file));
    mkdirSync(path.dirname(qPath), { recursive: true });
    renameSync(file, qPath);
    return { command: 'repair', toolVersion: VERSION, items: [{ id, status: 'quarantined', reason: 'unknown-format', quarantinePath: qPath, note: '检查源端是否有同 id 副本可恢复' }], exitCode: 1 };
  }

  // 整体解码
  let plain;
  try { plain = z.decompress(buf); } catch {}
  if (plain) {
    return { command: 'repair', toolVersion: VERSION, items: [{ id, status: 'ok', reason: 'healthy', note: '无需修复' }], exitCode: 0 };
  }

  // corrupt/torn：帧级扫描找最大可解前缀
  const starts = findFrames(buf);
  const recovered = []; // 可解帧的明文
  let lastGood = 0;
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : buf.length;
    try {
      recovered.push(z.decompress(buf.subarray(starts[i], end)));
      lastGood = i + 1;
    } catch { break; }
  }
  if (recovered.length === 0) {
    // 一个帧都解不了：隔离
    const q = quarantineDir ?? path.join(path.dirname(path.dirname(path.dirname(file))), '.quarantine');
    const qPath = path.join(q, id, path.basename(file));
    mkdirSync(path.dirname(qPath), { recursive: true });
    renameSync(file, qPath);
    return { command: 'repair', toolVersion: VERSION, items: [{ id, status: 'quarantined', reason: 'corrupt-unrecoverable', quarantinePath: qPath }], exitCode: 1 };
  }
  // 重建：header 帧 + 事件帧（用解出的完整前缀）
  const plainAll = Buffer.concat(recovered);
  const first = plainAll.indexOf(0x0A);
  if (first < 0) {
    const q = quarantineDir ?? path.join(path.dirname(path.dirname(path.dirname(file))), '.quarantine');
    const qPath = path.join(q, id, path.basename(file));
    mkdirSync(path.dirname(qPath), { recursive: true });
    renameSync(file, qPath);
    return { command: 'repair', toolVersion: VERSION, items: [{ id, status: 'quarantined', reason: 'header-loss', quarantinePath: qPath }], exitCode: 1 };
  }
  const headerLine = plainAll.subarray(0, first);
  const events = plainAll.subarray(first + 1);
  const frame1 = z.compress(Buffer.concat([headerLine, Buffer.from([0x0A])]));
  // 空事件（只有 header 被恢复）：仅 header 帧即可（dsh 格式允许 0 事件会话）
  const frame2 = events.length > 0 ? z.compress(events) : null;
  // 原文件移入 quarantine（备份），修复版写回
  const q = quarantineDir ?? path.join(path.dirname(path.dirname(path.dirname(file))), '.quarantine');
  const qPath = path.join(q, id + '.corrupt-original', path.basename(file));
  mkdirSync(path.dirname(qPath), { recursive: true });
  renameSync(file, qPath);
  writeFileSync(file, frame2 ? Buffer.concat([frame1, frame2]) : frame1);
  const lines = plainAll.toString('utf8').split('\n').length - 1;
  return { command: 'repair', toolVersion: VERSION, items: [{ id, status: 'repaired', reason: 'torn-truncated', framesKept: lastGood, lines, quarantinePath: qPath }], exitCode: 0 };
}
