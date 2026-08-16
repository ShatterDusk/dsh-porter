/**
 * zstd 依赖加载：优先项目 node_modules，fallback ops 原型 .migrate-tools（开发期）
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// 模块级初始化锁：并发调用（node:test 顶层测试并发）时串行化，避免 boku wasm 竞态
let zPromise = null;
let zLock = Promise.resolve();

export function loadZstd() {
  const run = zLock.then(async () => {
    if (zPromise) return zPromise;
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
    zPromise = { decompress: (b) => { const p = fz.decompress(b); return Buffer.from(p.buffer, p.byteOffset, p.byteLength); }, compress: (d, lvl = 3) => Buffer.from(boku.compress(d, lvl)) };
    return zPromise;
  });
  zLock = run.then(() => {}, () => {});
  return run;
}
