/**
 * 原子写入：同目录临时文件 + rename 覆盖
 * 背景（2026-08-16 事故）：migrate 直接 writeFileSync 目标文件时，运行中的 dsh（如 EAC
 * 的 session-watcher 监控 sessions/**/session.jsonl.zstd）可能读到写入中的半成品 → 崩溃。
 * 原子写保证：读者只会看到旧完整文件或新完整文件，绝不看到半成品。
 */
import { writeFileSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function writeAtomic(targetPath, data) {
  const tmp = path.join(path.dirname(targetPath), '.' + path.basename(targetPath) + '.tmp-' + randomUUID().slice(0, 8));
  writeFileSync(tmp, data);
  try {
    renameSync(tmp, targetPath); // Windows: MoveFileEx 覆盖语义
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}
