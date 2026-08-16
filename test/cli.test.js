import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { makeSession, makeRoot, cleanup, makeCorruptSession } from './helpers/fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'src', 'cli.js');
const NODE = process.execPath;

function runCli(...args) {
  return spawnSync(NODE, [CLI, ...args], { encoding: 'utf8' });
}

test('CLI: --version / --help', () => {
  const v = runCli('--version');
  assert.equal(v.status, 0);
  assert.ok(/^\d+\.\d+\.\d+$/.test(v.stdout.trim()), '版本格式 x.y.z');
  const pkgVersion = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
  assert.equal(v.stdout.trim(), pkgVersion, '版本应与 package.json 一致');
  const h = runCli('--help');
  assert.equal(h.status, 0);
  assert.ok(h.stdout.includes('dsh-porter'));
});

test('CLI: 用法错误 → 退出码 2（E_USAGE）', () => {
  const r = runCli('bogus-command');
  assert.equal(r.status, 2);
  assert.ok(r.stderr.includes('E_USAGE'));
  const r2 = runCli('migrate');
  assert.equal(r2.status, 2);
  const r3 = runCli('convert', 'x.jsonl');
  assert.equal(r3.status, 2);
});

test('CLI: migrate dry-run 端到端（合成数据）', async () => {
  const src = makeRoot(), dst = makeRoot();
  try {
    await makeSession(src, { cwd: 'F:\\PROJECTS' });
    const r = runCli('migrate', src, dst, '--direction', 'to-wsl', '--dry-run');
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes('汇总'));
  } finally { cleanup(src); cleanup(dst); }
});

test('CLI: inspect --json 输出符合 schema', async () => {
  const root = makeRoot();
  try {
    const s = await makeSession(root, { cwd: 'F:\\PROJECTS' });
    const r = runCli('inspect', s.sessionFile, '--json');
    assert.equal(r.status, 0);
    const obj = JSON.parse(r.stdout);
    assert.equal(obj.command, 'inspect');
    const item = obj.items[0];
    assert.equal(item.status, 'ok');
    assert.equal(item.cwd, 'F:\\PROJECTS');
    assert.equal(typeof item.frames, 'number');
    assert.equal(typeof item.lines, 'number');
    assert.equal(typeof item.size, 'number');
  } finally { cleanup(root); }
});

test('CLI: repair 污染隔离端到端', async () => {
  const root = makeRoot();
  try {
    const p = await makeCorruptSession(root, { mode: 'polluted' });
    const r = runCli('repair', p.sessionFile);
    assert.equal(r.status, 1);
    assert.ok(r.stdout.includes('quarantined'));
    assert.ok(!existsSync(p.sessionFile), '污染文件应移出原位');
  } finally { cleanup(root); }
});

test('CLI: archive --finalize 端到端', async () => {
  const src = makeRoot(), dst = makeRoot();
  try {
    await makeSession(src, { cwd: 'F:\\PROJECTS' });
    const r1 = runCli('archive', src, dst, '--direction', 'to-wsl');
    assert.equal(r1.status, 0);
    assert.ok(existsSync(path.join(src, '.archive-pending')), '暂存区应存在');
    const r2 = runCli('archive', '--finalize', src);
    assert.equal(r2.status, 0);
    assert.ok(!existsSync(path.join(src, '.archive-pending')), '暂存区应清空');
  } finally { cleanup(src); cleanup(dst); }
});

test('CLI: migrate --json 输出可解析且符合 schema', async () => {
  const src = makeRoot(), dst = makeRoot();
  try {
    await makeSession(src, { cwd: 'F:\\PROJECTS' });
    const r = runCli('migrate', src, dst, '--direction', 'to-wsl', '--dry-run', '--json');
    assert.equal(r.status, 0);
    const obj = JSON.parse(r.stdout);
    assert.equal(obj.command, 'migrate');
    assert.equal(obj.dryRun, true);
    assert.ok(Array.isArray(obj.items));
    assert.ok(obj.summary.total >= 1);
  } finally { cleanup(src); cleanup(dst); }
});
