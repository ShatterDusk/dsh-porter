/**
 * dsh-porter 命令分发（SPEC §3.8 退出码语义）
 */
import { migrate } from './migrate.js';

export class Command {
  constructor(args) { this.args = args; }

  async run() {
    const [name, ...rest] = this.args;
    switch (name) {
      case 'migrate': return this.runMigrate(rest);
      case 'inspect': return this.notImplemented('inspect');
      case 'convert': return this.notImplemented('convert');
      case 'repair': return this.notImplemented('repair');
      case 'archive': return this.notImplemented('archive');
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

  notImplemented(name) {
    console.error(`[${name}] 未实现（SPEC 已定义，待实现）`);
    return { exitCode: 3 };
  }
}
