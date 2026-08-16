/**
 * inspect 命令实现（SPEC §3.1 / §3.7 / §3.8）
 * 健康判定两级：① 整体解码 ② 帧级扫描（torn 检测——fzstd 单次解码对 torn 静默，实测）
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { loadZstd } from './lib/zstd.js';

const ZSTD_MAGIC = [0x28, 0xB5, 0x2F, 0xFD];

function findFrames(buf) {
  const starts = [];
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf[i] === ZSTD_MAGIC[0] && buf[i+1] === ZSTD_MAGIC[1] && buf[i+2] === ZSTD_MAGIC[2] && buf[i+3] === ZSTD_MAGIC[3]) starts.push(i);
  }
  return starts;
}

function scanSession(z, file) {
  const stat = { size: 0, id: null, cwd: null, version: null, frames: 0, lines: 0, status: 'unknown' };
  const buf = readFileSync(file);
  stat.size = buf.length;
  if (buf.length === 0) { stat.status = 'torn'; return stat; }
  const isZstd = buf[0] === ZSTD_MAGIC[0] && buf[1] === ZSTD_MAGIC[1] && buf[2] === ZSTD_MAGIC[2] && buf[3] === ZSTD_MAGIC[3];
  if (!isZstd) {
    // 明文 .jsonl？
    if (buf[0] === 0x7B /* { */) { stat.status = 'ok'; stat.lines = buf.toString('utf8').split('\n').length - 1; try { const h = JSON.parse(buf.subarray(0, buf.indexOf(0x0A)).toString('utf8')); stat.id = h.id; stat.cwd = h.cwd; stat.version = h.version; } catch {} }
    else stat.status = 'unknown-format';
    return stat;
  }
  // ① 整体解码
  let plain;
  try { plain = z.decompress(buf); } catch { stat.status = 'corrupt'; return stat; }
  // header 解析
  const first = plain.indexOf(0x0A);
  if (first < 0) { stat.status = 'corrupt'; return stat; }
  try {
    const h = JSON.parse(plain.subarray(0, first).toString('utf8'));
    stat.id = h.id; stat.cwd = h.cwd; stat.version = h.version;
  } catch { stat.status = 'corrupt'; return stat; }
  stat.lines = plain.toString('utf8').split('\n').length - 1;
  // ② 帧级扫描：切帧 + 逐帧解码（尾部不完整帧 = torn）
  const starts = findFrames(buf);
  stat.frames = starts.length;
  let torn = false;
  for (let i = 0; i < starts.length; i++) {
    const frameEnd = i + 1 < starts.length ? starts[i + 1] : buf.length;
    try { z.decompress(buf.subarray(starts[i], frameEnd)); }
    catch { torn = true; break; }
  }
  stat.status = torn ? 'torn' : 'ok'; // torn 罕见（fzstd 严格），防御性保留；dsh 对 torn 可截断修复
  return stat;
}

function walkFiles(root) {
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.zstd') || e.name.endsWith('.jsonl')) files.push(p);
    }
  };
  walk(root);
  return files;
}

export async function inspect(target) {
  const z = await loadZstd();
  const isDir = (() => { try { return readdirSync(target).length >= 0; } catch { return false; } })();
  const files = isDir ? walkFiles(path.join(target, 'sessions')) : [target];
  const items = [];
  for (const f of files) {
    const s = scanSession(z, f);
    items.push({ id: s.id ?? path.basename(path.dirname(f)), status: s.status, cwd: s.cwd, version: s.version, frames: s.frames, lines: s.lines, size: s.size, file: f });
  }
  const summary = { total: items.length, ok: items.filter(i => i.status === 'ok').length, torn: items.filter(i => i.status === 'torn').length, corrupt: items.filter(i => i.status === 'corrupt').length, unknown: items.filter(i => i.status === 'unknown-format').length };
  const exitCode = summary.torn + summary.corrupt + summary.unknown > 0 ? 1 : 0;
  return { command: 'inspect', toolVersion: '0.1.0', summary, items, exitCode };
}
