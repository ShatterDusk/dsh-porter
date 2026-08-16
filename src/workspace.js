/**
 * workspace 状态同步（v0.2.0）
 * 背景：dsh 会话"归组" = storages/workspace.json 的归属记录（sessionIds），不是目录名。
 *       migrate 只搬会话文件会导致目标端"未分组"（2026-08-16 实战事故）。
 * 本模块：migrate 后把被迁移会话按新 cwd 加入目标端对应 workspace 的 sessionIds。
 * 纪律：archivedSessionIds / workspaceIds / 其他字段绝不改动；无 BOM 写回；容忍读入 BOM。
 */
import { readFileSync, writeFileSync } from 'node:fs';

export function loadWorkspace(file) {
  try {
    let raw = readFileSync(file, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // 容忍 BOM
    return JSON.parse(raw);
  } catch (e) {
    const err = new Error('workspace.json 解析失败: ' + e.message); err.code = 'E_WORKSPACE_PARSE'; err.exitCode = 1;
    throw err;
  }
}

export function saveWorkspace(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8'); // 无 BOM（writeFileSync utf8 无 BOM）
}

/**
 * 同步迁移会话归属。
 * @param workspaceData workspace.json 解析对象
 * @param items [{id, newCwd}] 被迁移（migrated/copied）会话
 * @returns {preview: [{workspacePath, added: [id]}]}
 */
export function syncWorkspace(workspaceData, items) {
  const workspaces = workspaceData.tables?.workspaces ?? {};
  const preview = [];
  const byPath = {};
  for (const [wid, rec] of Object.entries(workspaces)) byPath[rec.path] = { wid, rec };
  for (const item of items) {
    if (!item.id || !item.newCwd) continue;
    const target = byPath[item.newCwd];
    if (!target) continue; // 目标端无对应 workspace（cwd 不匹配）→ 保持未分组，不臆造
    if (!target.rec.sessionIds.includes(item.id)) {
      target.rec.sessionIds.push(item.id);
      const p = preview.find(x => x.workspacePath === item.newCwd);
      if (p) p.added.push(item.id);
      else preview.push({ workspacePath: item.newCwd, added: [item.id] });
    }
  }
  return preview;
}
