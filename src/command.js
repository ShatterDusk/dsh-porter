/**
 * dsh-porter 命令分发（SPEC §3.8 退出码语义）
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { migrate } from './migrate.js';
import { inspect } from './inspect.js';
import { convertSession } from './convert.js';
import { repairSession } from './repair.js';
import { archiveSessions } from './archive.js';

export class Command {
  constructor(args) { this.args = args; }

  async run() {
    const [name, ...rest] = this.args;
    switch (name) {
      case 'migrate': return this.runMigrate(rest);
      case 'inspect': return this.runInspect(rest);
      case 'convert': return this.runConvert(rest);
      case 'repair': return this.runRepair(rest);
      case 'archive': return this.runArchive(rest);
      default: {
        const err = new Error(`未知命令: ${name}`);
        err.code = 'E_USAGE'; err.exitCode = 2;
        throw err;
      }
    }
  }

  // migrate <源根> <目标根> --direction X [--map 表] [--conflict 策略] [--copy-unchanged] [--dry-run] [--json]
  async runMigrate(args) {
    if (args.length < 2) { const e = new Error('migrate 需要 <源根> <目标根>'); e.code = 'E_USAGE'; e.exitCode = 2; throw e; }
    const srcRoot = args[0], targetRoot = args[1];
    const opts = { srcRoot, targetRoot };
    for (let i = 2; i < args.length; i++) {
      const a = args[i];
      if (a === '--direction') opts.direction = args[++i];
      else if (a === '--map') opts.map = args[++i];
      else if (a === '--conflict') opts.conflict = args[++i];
      else if (a === '--copy-unchanged') opts.copyUnchanged = true;
      else if (a === '--dry-run') opts.dryRun = true;
      else if (a === '--json') opts.json = true;
      else { const e = new Error(`未知参数: ${a}`); e.code = 'E_USAGE'; e.exitCode = 2; throw e; }
    }
    if (!opts.direction) { const e = new Error('migrate 需要 --direction to-wsl|to-win|auto'); e.code = 'E_USAGE'; e.exitCode = 2; throw e; }
    const result = await migrate(opts);
    if (opts.json) {
      const { exitCode, ...json } = result;
      return { json, exitCode };
    }
    // 人类可读输出
    for (const item of result.items) {
      const arrow = item.from && item.to ? item.from + ' -> ' + item.to : '';
      console.log(`[${item.status}] ${item.id.slice(0, 24)} ${arrow}`);
    }
    console.log(`汇总: 共 ${result.summary.total} | 迁移 ${result.summary.migrated} | 复制 ${result.summary.copied} | 跳过 ${result.summary.skipped} | 失败 ${result.summary.failed}`);
    return { exitCode: result.exitCode };
  }

  // inspect <会话文件|数据根> [--json]
  async runInspect(args) {
    if (args.length < 1) { const e = new Error('inspect 需要 <会话文件|数据根>'); e.code = 'E_USAGE'; e.exitCode = 2; throw e; }
    const target = args[0];
    const json = args.includes('--json');
    const result = await inspect(target);
    if (json) { const { exitCode, ...j } = result; return { json: j, exitCode }; }
    for (const item of result.items) {
      console.log(`[${item.status.padEnd(13)}] ${(item.id ?? '').slice(0, 30).padEnd(32)} cwd=${item.cwd ?? '-'} v${item.version ?? '-'} 帧=${item.frames ?? '-'} 行=${item.lines ?? '-'} ${item.size}B`);
    }
    console.log(`汇总: 共 ${result.summary.total} | ok ${result.summary.ok} | torn ${result.summary.torn} | corrupt ${result.summary.corrupt} | unknown ${result.summary.unknown}`);
    return { exitCode: result.exitCode };
  }

  // convert <会话文件> --format zstd|plain [--out 目录] [--json]
  async runConvert(args) {
    if (args.length < 1) { const e = new Error('convert 需要 <会话文件>'); e.code = 'E_USAGE'; e.exitCode = 2; throw e; }
    const file = args[0];
    const opts = { outDir: null, json: false };
    for (let i = 1; i < args.length; i++) {
      const a = args[i];
      if (a === '--format') opts.format = args[++i];
      else if (a === '--out') opts.outDir = args[++i];
      else if (a === '--json') opts.json = true;
      else { const e = new Error(`未知参数: ${a}`); e.code = 'E_USAGE'; e.exitCode = 2; throw e; }
    }
    if (!opts.format || (opts.format !== 'zstd' && opts.format !== 'plain')) {
      const e = new Error('convert 需要 --format zstd|plain'); e.code = 'E_USAGE'; e.exitCode = 2; throw e;
    }
    if (opts.outDir) mkdirSync(opts.outDir, { recursive: true });
    const result = await convertSession(file, opts);
    if (opts.json) { const { exitCode, ...j } = result; return { json: j, exitCode }; }
    console.log(`[converted] ${path.basename(file)} -> ${result.items[0].to}`);
    return { exitCode: 0 };
  }

  // repair <会话文件> [--quarantine 目录] [--json]
  async runRepair(args) {
    if (args.length < 1) { const e = new Error('repair 需要 <会话文件>'); e.code = 'E_USAGE'; e.exitCode = 2; throw e; }
    const file = args[0];
    const opts = { json: false };
    for (let i = 1; i < args.length; i++) {
      const a = args[i];
      if (a === '--quarantine') opts.quarantineDir = args[++i];
      else if (a === '--json') opts.json = true;
      else { const e = new Error(`未知参数: ${a}`); e.code = 'E_USAGE'; e.exitCode = 2; throw e; }
    }
    const result = await repairSession(file, opts);
    if (opts.json) { const { exitCode, ...j } = result; return { json: j, exitCode }; }
    const item = result.items[0];
    console.log(`[${item.status}] ${item.id.slice(0, 24)} ${item.reason ?? ''} ${item.note ?? ''}`);
    if (item.quarantinePath) console.log(`  -> 隔离: ${item.quarantinePath}`);
    if (item.lines !== undefined) console.log(`  -> 保留 ${item.framesKept} 帧 / ${item.lines} 行`);
    return { exitCode: result.exitCode };
  }

  // archive <源根> <归档根> [--direction X] [--dry-run] [--json] | archive --finalize <源根>
  async runArchive(args) {
    const finalize = args.includes('--finalize');
    const opts = { json: args.includes('--json'), dryRun: args.includes('--dry-run'), direction: 'to-wsl', finalize: args.includes('--finalize') };
    const positional = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '--direction') opts.direction = args[++i];
      else if (a === '--json' || a === '--dry-run' || a === '--finalize') { /* flag */ }
      else positional.push(a);
    }
    if (finalize) {
      if (positional.length < 1) { const e = new Error('archive --finalize 需要 <源根>'); e.code = 'E_USAGE'; e.exitCode = 2; throw e; }
      opts.srcRoot = positional[0];
    } else {
      if (positional.length < 2) { const e = new Error('archive 需要 <源根> <归档根>'); e.code = 'E_USAGE'; e.exitCode = 2; throw e; }
      opts.srcRoot = positional[0]; opts.archiveRoot = positional[1];
    }
    const result = await archiveSessions(opts);
    if (opts.json) { const { exitCode, ...j } = result; return { json: j, exitCode }; }
    if (result.note) console.log(result.note);
    if (result.summary) console.log(`汇总: 迁移 ${result.summary.migrated ?? '-'} | 复制 ${result.summary.copied ?? '-'} | 跳过 ${result.summary.skipped ?? '-'} | 失败 ${result.summary.failed ?? '-'} | 暂存 ${result.summary.pending ?? '-'}`);
    return { exitCode: result.exitCode };
  }

  notImplemented(name) {
    console.error(`[${name}] 未实现（SPEC 已定义，待实现）`);
    return { exitCode: 3 };
  }
}
