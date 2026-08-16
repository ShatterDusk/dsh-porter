/**
 * migrate 命令实现（SPEC §3.2 / §3.6 / §3.7 / §3.8）
 * 格式纪律（docs/format.md §6）：header 一帧恰一行 + 事件一帧；id 保持；自检行数一致
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { loadZstd } from './lib/zstd.js';
import { convertCwd, projectKey, detectDirection } from './lib/cwd.js';

function walkSessions(root) {
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.zstd') || e.name.endsWith('.jsonl')) files.push(p);
    }
  };
  walk(path.join(root, 'sessions'));
  return files;
}

async function migrateOne(z, file, opts) {
  const { targetRoot, direction, mapRules, copyUnchanged, dryRun, conflict = 'skip' } = opts;
  let newId = null; // conflict=new-id 时的新 id
  const id = path.basename(path.dirname(file));
  try {
    const buf = readFileSync(file);
    // 格式检测：非 zstd 且非明文 → failed
    const magic = buf.subarray(0, 4);
    const isZstd = magic[0] === 0x28 && magic[1] === 0xB5 && magic[2] === 0x2F && magic[3] === 0xFD;
    const isPlain = !isZstd && buf.subarray(0, 1).toString() === '{';
    if (!isZstd && !isPlain) {
      return { id, status: 'failed', error: 'E_NOT_ZSTD', targetPath: null };
    }
    // 解压
    const plain = isZstd ? z.decompress(buf) : buf;
    const first = plain.indexOf(0x0A);
    if (first < 0) return { id, status: 'failed', error: 'E_TORN', targetPath: null };
    const header = JSON.parse(plain.subarray(0, first).toString('utf8'));
    // 格式演进守卫：不认识的 version 拒绝操作（对齐 dsh 官方"宁拒不猜"）
    if (header.version > 0) {
      return { id, status: 'failed', error: 'E_UNSUPPORTED_VERSION', targetPath: null };
    }
    const srcCwd = header.cwd ?? '';
    const newCwd = convertCwd(srcCwd, direction, mapRules);
    if (newCwd === srcCwd) {
      // 无需转化：SKIP（spec：默认跳过；copyUnchanged 时原样复制）
      if (!copyUnchanged) return { id, status: 'skipped', from: srcCwd, to: null, targetPath: null, error: null };
      // 原样复制（明文保持明文；zstd 保持 zstd）
      const targetDir = path.join(targetRoot, 'sessions', projectKey(srcCwd), id);
      const targetPath = path.join(targetDir, path.basename(file));
      if (!dryRun) {
        mkdirSync(targetDir, { recursive: true });
        writeFileSync(targetPath, buf);
      }
      return { id, status: 'copied', from: srcCwd, to: srcCwd, targetPath, error: null };
    }
    header.cwd = newCwd;

    // conflict 策略：目标已有同 id 会话
    const conflictPath = path.join(targetRoot, 'sessions', projectKey(newCwd), header.id, 'session.jsonl.zstd');
    if (existsSync(conflictPath)) {
      if (conflict === 'abort') {
        const err = new Error('目标已存在同 id 会话: ' + header.id); err.code = 'E_CONFLICT'; err.exitCode = 1; throw err;
      }
      if (conflict === 'new-id') {
        header.id = 'session-' + randomUUID();
      } else {
        return { id, status: 'skipped', reason: 'conflict', from: srcCwd, to: newCwd, targetPath: null, error: null };
      }
    }

    const events = plain.subarray(first + 1);
    // 帧合规重写：header 一帧（恰一行）+ 事件一帧
    const frame1 = z.compress(Buffer.concat([Buffer.from(JSON.stringify(header)), Buffer.from([0x0A])]));
    const frame2 = z.compress(events);
    const out = Buffer.concat([frame1, frame2]);
    // 自检
    const verify = z.decompress(out);
    const lines = verify.toString('utf8').split('\n').length - 1;
    const srcLines = plain.toString('utf8').split('\n').length - 1;
    if (lines !== srcLines) return { id, status: 'failed', error: 'E_SELF_CHECK', targetPath: null };
    // 写入目标（dry-run 不写）
    const targetDir = path.join(targetRoot, 'sessions', projectKey(newCwd), id);
    const targetPath = path.join(targetDir, 'session.jsonl.zstd');
    if (!dryRun) {
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(targetPath, out);
    }
    return { id: header.id, status: 'migrated', from: srcCwd, to: newCwd, targetPath, error: null };
  } catch (e) {
    return { id, status: 'failed', error: e.code || 'E_UNKNOWN', targetPath: null };
  }
}

export async function migrate(opts) {
  const { srcRoot, targetRoot, direction, map, conflict = 'skip', copyUnchanged = false, dryRun = false } = opts;
  if (direction !== 'auto' && direction !== 'to-wsl' && direction !== 'to-win') {
    const err = new Error('--direction 必须是 to-wsl|to-win|auto'); err.code = 'E_USAGE'; err.exitCode = 2; throw err;
  }
  const z = await loadZstd();
  const mapRules = (map ?? '').split(',').filter(Boolean).map(r => r.split('='));
  const files = walkSessions(srcRoot);
  const items = [];
  for (const f of files) {
    const r = await migrateOne(z, f, { targetRoot, direction, mapRules, copyUnchanged, dryRun, conflict });
    if (dryRun && (r.status === 'migrated' || r.status === 'copied')) {
      r.targetPath = '[dry-run] ' + (r.targetPath ?? '');
    }
    items.push(r);
  }
  const summary = {
    total: items.length,
    migrated: items.filter(i => i.status === 'migrated').length,
    copied: items.filter(i => i.status === 'copied').length,
    skipped: items.filter(i => i.status === 'skipped').length,
    failed: items.filter(i => i.status === 'failed').length,
  };
  const exitCode = summary.failed > 0 ? 1 : 0;
  return { command: 'migrate', toolVersion: '0.1.0', dryRun, summary, items, exitCode };
}
