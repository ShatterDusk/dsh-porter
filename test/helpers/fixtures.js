/**
 * 合成会话 fixture 生成器（测试用，不依赖真实数据）
 * 用与生产相同的 zstd lib 生成合规会话（header 帧恰一行 + 事件帧）
 */
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { loadZstd } from '../../src/lib/zstd.js';

// 初始化锁：node:test 顶层测试并发执行，串行化 loadZstd 避免 boku wasm 竞态
let zPromise = null;
let zLock = Promise.resolve();
const z = () => {
  const run = zLock.then(async () => {
    if (!zPromise) zPromise = await loadZstd();
    return zPromise;
  });
  zLock = run.then(() => {}, () => {});
  return run;
};

export async function makeSession(dir, { id = 'session-test-' + Math.random().toString(16).slice(2), cwd = 'F:\\PROJECTS', lines = 5 } = {}) {
  const zstd = await z();
  const header = { type: 'session', version: 0, id, createdAt: Date.now(), cwd, delegationDepth: 0 };
  const headerLine = Buffer.from(JSON.stringify(header) + '\n');
  const events = [];
  for (let i = 0; i < lines; i++) {
    events.push(JSON.stringify({ type: 'user/message', seq: i, data: { id: 'm' + i, role: 'user', content: [{ type: 'text', text: 'line ' + i }] } }));
  }
  const eventsBuf = Buffer.from(events.join('\n') + '\n');
  const frame1 = zstd.compress(headerLine);
  const frame2 = zstd.compress(eventsBuf);
  const sessionDir = path.join(dir, 'sessions', cwd.startsWith('/') ? '--mnt-f-PROJECTS--' : '--F-PROJECTS--', id);
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(path.join(sessionDir, 'session.jsonl.zstd'), Buffer.concat([frame1, frame2]));
  return { id, sessionDir, sessionFile: path.join(sessionDir, 'session.jsonl.zstd'), header };
}

export function makeRoot() { return mkdtempSync(path.join(tmpdir(), 'dsh-porter-test-')); }

export async function makeCorruptSession(dir, { mode = 'polluted' } = {}) {
  const d = path.join(dir, 'sessions', 'bad-sess');
  mkdirSync(d, { recursive: true });
  const f = path.join(d, 'session.jsonl.zstd');
  if (mode === 'polluted') writeFileSync(f, 'import x; // polluted');
  else writeFileSync(f, Buffer.from([0x28, 0xB5, 0x2F, 0xFD, 0, 1, 2, 3]));
  return { sessionFile: f };
}
