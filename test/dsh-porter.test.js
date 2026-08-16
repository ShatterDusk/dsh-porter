import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { migrate } from '../src/migrate.js';
import { inspect } from '../src/inspect.js';
import { convertSession } from '../src/convert.js';
import { repairSession } from '../src/repair.js';
import { archiveSessions } from '../src/archive.js';
import { makeSession, makeRoot, makeCorruptSession } from './helpers/fixtures.js';

function cleanup(root) { if (root) rmSync(root, { recursive: true, force: true }); }
const WIN_CWD = 'F:\\PROJECTS';

test('migrate: cwd 转化 + 分组归位', async () => {
  const src = makeRoot(), dst = makeRoot();
  try {
    const a = await makeSession(src, { cwd: WIN_CWD });
    const r = await migrate({ srcRoot: src, targetRoot: dst, direction: 'to-wsl' });
    assert.equal(r.summary.migrated, 1);
    assert.equal(r.summary.failed, 0);
    const target = path.join(dst, 'sessions', '--mnt-f-PROJECTS--', a.id);
    assert.ok(existsSync(target), 'target group should be --mnt-f-PROJECTS--');
    // skip 场景：cwd 已是目标格式（WSL 路径）的会话
    await makeSession(src, { cwd: '/mnt/f/PROJECTS' });
    const r2 = await migrate({ srcRoot: src, targetRoot: dst, direction: 'to-wsl' });
    // skipped = 冲突(A) + 无需转化(B)；migrated = 0（重复迁移被冲突拦截）
    assert.equal(r2.summary.skipped, 2);
    assert.equal(r2.summary.migrated, 0);
  } finally { cleanup(src); cleanup(dst); }
});

test('migrate: dry-run 不写入', async () => {
  const src = makeRoot(), dst = makeRoot();
  try {
    await makeSession(src, { cwd: WIN_CWD });
    const r = await migrate({ srcRoot: src, targetRoot: dst, direction: 'to-wsl', dryRun: true });
    assert.equal(r.summary.migrated, 1);
    assert.equal(r.dryRun, true);
    assert.ok(!existsSync(path.join(dst, 'sessions')), 'dry-run should not write');
  } finally { cleanup(src); cleanup(dst); }
});

test('inspect: 健康/污染/截断三态', async () => {
  const root = makeRoot();
  try {
    const s = await makeSession(root, { cwd: WIN_CWD });
    const r = await inspect(s.sessionFile);
    assert.equal(r.items[0].status, 'ok');
    const polluted = await makeCorruptSession(root, { mode: 'polluted' });
    const r2 = await inspect(polluted.sessionFile);
    assert.equal(r2.items[0].status, 'unknown-format');
    const torn = await makeCorruptSession(root, { mode: 'truncated' });
    const r3 = await inspect(torn.sessionFile);
    assert.equal(r3.items[0].status, 'corrupt');
  } finally { cleanup(root); }
});

test('convert: zstd<->plain 往返一致', async () => {
  const root = makeRoot();
  try {
    const s = await makeSession(root, { cwd: WIN_CWD, lines: 3 });
    const r1 = await convertSession(s.sessionFile, { format: 'plain', outDir: root });
    const plainFile = r1.items[0].targetPath;
    assert.ok(plainFile.endsWith('.jsonl'));
    const r2 = await convertSession(plainFile, { format: 'zstd', outDir: root });
    const backFile = r2.items[0].targetPath;
    assert.ok(backFile.endsWith('.jsonl.zstd'));
    const ri = await inspect(backFile);
    assert.equal(ri.items[0].status, 'ok');
    assert.equal(ri.items[0].lines, 4);
  } finally { cleanup(root); }
});

test('repair: torn 截断修复 + 原文件隔离', async () => {
  const root = makeRoot();
  try {
    const s = await makeSession(root, { cwd: WIN_CWD, lines: 10 });
    const buf = readFileSync(s.sessionFile);
    writeFileSync(s.sessionFile, buf.subarray(0, buf.length - 20));
    const r = await repairSession(s.sessionFile, {});
    assert.equal(r.items[0].status, 'repaired');
    const ri = await inspect(s.sessionFile);
    assert.equal(ri.items[0].status, 'ok');
    assert.ok(existsSync(path.join(root, 'sessions', '.quarantine')), 'should have quarantine dir');
  } finally { cleanup(root); }
});

test('repair: 污染文件隔离', async () => {
  const root = makeRoot();
  try {
    const p = await makeCorruptSession(root, { mode: 'polluted' });
    const r = await repairSession(p.sessionFile, {});
    assert.equal(r.items[0].status, 'quarantined');
    assert.ok(!existsSync(p.sessionFile), 'polluted file should be moved');
  } finally { cleanup(root); }
});

test('migrate: --conflict 策略（skip/new-id/abort）', async () => {
  const src = makeRoot(), dst = makeRoot();
  try {
    const a = await makeSession(src, { cwd: WIN_CWD });
    await migrate({ srcRoot: src, targetRoot: dst, direction: 'to-wsl' });
    // 再迁移同源（目标已有同 id）→ 默认 skip
    const r = await migrate({ srcRoot: src, targetRoot: dst, direction: 'to-wsl' });
    assert.equal(r.summary.migrated, 0);
    assert.equal(r.items[0].status, 'skipped');
    // new-id：目标同 id → 新 UUID 迁移
    const src2 = makeRoot();
    try {
      await makeSession(src2, { cwd: WIN_CWD, id: a.id });
      const r2 = await migrate({ srcRoot: src2, targetRoot: dst, direction: 'to-wsl', conflict: 'new-id' });
      assert.equal(r2.summary.migrated, 1);
      assert.notEqual(r2.items[0].id, a.id, 'new-id 应生成新 UUID');
    } finally { cleanup(src2); }
  } finally { cleanup(src); cleanup(dst); }
});

test('migrate: --map 自定义映射 + auto 方向', async () => {
  const src = makeRoot(), dst = makeRoot();
  try {
    // cwd=D:\\work（非默认 X: 盘规则）
    await makeSession(src, { cwd: 'D:\\work' });
    const r = await migrate({ srcRoot: src, targetRoot: dst, direction: 'auto', map: 'D:\\work=/mnt/d/work' });
    assert.equal(r.summary.migrated, 1);
    const target = path.join(dst, 'sessions', '--mnt-d-work--', r.items[0].id);
    assert.ok(existsSync(target), '自定义映射目标分组');
  } finally { cleanup(src); cleanup(dst); }
});
test('archive: 两阶段协议（迁移->暂存->finalize）', async () => {
  const src = makeRoot(), dst = makeRoot();
  try {
    const a = await makeSession(src, { cwd: WIN_CWD });
    const r = await archiveSessions({ srcRoot: src, archiveRoot: dst, direction: 'to-wsl' });
    assert.equal(r.summary.migrated, 1);
    assert.equal(r.summary.pending, 1);
    assert.ok(!existsSync(path.join(src, 'sessions', '--F-PROJECTS--', a.id)), 'source session moved to pending');
    assert.ok(existsSync(path.join(src, '.archive-pending', a.id)), 'pending should hold session');
    const r2 = await archiveSessions({ srcRoot: src, finalize: true });
    assert.equal(r2.summary.removed, 1);
    assert.ok(!existsSync(path.join(src, '.archive-pending')), 'pending should be cleared');
  } finally { cleanup(src); cleanup(dst); }
});
