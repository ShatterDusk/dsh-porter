/**
 * archive 命令实现（SPEC §3.5 两阶段删除协议）
 * 阶段1: migrate + 目标端校验（失败即中止，源不动）
 * 阶段2a: 源端成功会话移入 .archive-pending/（暂存可回滚）
 * 阶段2b: --finalize 清空暂存（真删除）
 */
import { renameSync, rmSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { migrate } from './migrate.js';
import { VERSION } from './version.js';

export async function archiveSessions(opts) {
  const { srcRoot, archiveRoot, direction, finalize = false, dryRun = false } = opts;
  const pendingDir = path.join(srcRoot, '.archive-pending');

  if (finalize) {
    if (!existsSync(pendingDir)) return { command: 'archive', toolVersion: VERSION, summary: { pending: 0, removed: 0 }, items: [], exitCode: 0 };
    const entries = readdirSync(pendingDir);
    if (!dryRun) rmSync(pendingDir, { recursive: true, force: true });
    return { command: 'archive', toolVersion: VERSION, summary: { pending: entries.length, removed: dryRun ? 0 : entries.length }, items: [{ id: '.archive-pending', status: dryRun ? 'pending' : 'removed', reason: 'finalize' }], exitCode: 0 };
  }

  // 阶段1: migrate（dry-run 透传——子代理审核发现硬编码 dryRun:false 导致 --dry-run 真实写归档根）
  const result = await migrate({ srcRoot, targetRoot: archiveRoot, direction, dryRun });
  if (result.summary.failed > 0) {
    // 有失败：中止，源不动（协议保证）
    return { command: 'archive', toolVersion: VERSION, summary: { ...result.summary, pending: 0 }, items: result.items, exitCode: 1, note: '阶段1有失败，源未动（两阶段协议）' };
  }
  if (dryRun) {
    return { command: 'archive', toolVersion: VERSION, summary: { ...result.summary, pending: result.summary.migrated + result.summary.copied }, items: result.items, exitCode: 0 };
  }
  // 阶段2a: 成功会话（migrated/copied）移入 pending
  mkdirSync(pendingDir, { recursive: true });
  let pending = 0;
  for (const item of result.items) {
    if (item.status !== 'migrated' && item.status !== 'copied') continue;
    if (!item.targetPath || !existsSync(item.targetPath)) continue; // 目标端校验
    // 找源目录：sessions/<group>/<id>
    const srcDir = path.join(srcRoot, 'sessions', path.basename(path.dirname(item.targetPath)).startsWith('--') ? '' : '');
    // 源目录 = sessions 下 id 匹配的目录（migrate 保持 id）
    const srcMatch = findSessionDir(srcRoot, item.id);
    if (!srcMatch) continue;
    const dest = path.join(pendingDir, item.id);
    renameSync(srcMatch, dest);
    pending++;
  }
  return { command: 'archive', toolVersion: VERSION, summary: { ...result.summary, pending }, items: result.items, exitCode: 0, note: pending > 0 ? '暂存完成：运行 archive --finalize <源根> 清空暂存' : '无可暂存项' };
}

function findSessionDir(srcRoot, id) {
  const base = path.join(srcRoot, 'sessions');
  if (!existsSync(base)) return null;
  for (const group of readdirSync(base, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    const candidate = path.join(base, group.name, id);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}
