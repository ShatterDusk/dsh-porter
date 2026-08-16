/**
 * zstd 依赖加载：优先项目 node_modules，fallback ops 原型 .migrate-tools（开发期）
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export async function loadZstd() {
  // 候选路径：项目 node_modules → ops 原型 .migrate-tools → 全局
  const candidates = [
    path.join(__dirname, '..', '..', 'node_modules'),
    path.join(__dirname, '..', '..', '..', '..', 'ops', 'scripts', 'wsl', '.migrate-tools', 'node_modules'),
  ];
  let fz, boku;
  for (const base of candidates) {
    if (!existsSync(base)) continue;
    try {
      fz = require(path.join(base, 'fzstd'));
      boku = require(path.join(base, '@bokuweb', 'zstd-wasm'));
      break;
    } catch { /* 尝试下一候选 */ }
  }
  if (!fz || !boku) {
    const err = new Error('依赖缺失：fzstd / @bokuweb/zstd-wasm（项目内 npm install，或 ops 原型 .migrate-tools）');
    err.code = 'E_NO_ZSTD_DEPS'; err.exitCode = 3;
    throw err;
  }
  await boku.init();
  return { decompress: (b) => { const p = fz.decompress(b); return Buffer.from(p.buffer || p); }, compress: (d, lvl = 3) => Buffer.from(boku.compress(d, lvl)) };
}
