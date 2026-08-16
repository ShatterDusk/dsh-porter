#!/usr/bin/env node
/**
 * dsh-porter CLI 骨架（SPEC v0.6）
 * 命令: inspect | migrate | convert | repair | archive
 * 约定: --json 输出 schema、退出码分级（见 SPEC §3.7/3.8）
 */
import { Command } from './command.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 版本单一事实源：package.json（避免与包版本打架）
const VERSION = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')).version;

const usage = `dsh-porter v${VERSION}
DSH session data ops: migrate / inspect / repair / convert / archive

用法:
  dsh-porter inspect <会话|数据根> [--json]
  dsh-porter migrate <源根> <目标根> --direction to-wsl|to-win|auto [--map 表] [--conflict skip|new-id|abort] [--copy-unchanged] [--no-sync-workspace] [--dry-run] [--json]
  dsh-porter convert <会话文件> --format zstd|plain [--out 目录]
  dsh-porter repair <会话文件> [--quarantine 目录]
  dsh-porter archive <源根> <归档根> [--direction X] [--dry-run] [--json]
  dsh-porter archive --finalize <源根>
  dsh-porter --version | --help

退出码: 0 成功 / 1 部分失败 / 2 用法错误 / 3 环境错误（SPEC §3.8）
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') { console.log(usage); process.exit(0); }
  if (args[0] === '--version' || args[0] === '-V') { console.log(VERSION); process.exit(0); }

  const cmd = new Command(args);
  try {
    const result = await cmd.run();
    if (result.json) console.log(JSON.stringify(result.json, null, 2));
    process.exit(result.exitCode ?? 0);
  } catch (e) {
    // 用法错误(2) / 环境错误(3) 分级
    console.error(`错误[${e.code ?? 'E_UNKNOWN'}]: ${e.message}`);
    process.exit(e.exitCode ?? 2);
  }
}

main();
