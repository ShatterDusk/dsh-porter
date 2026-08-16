/**
 * dsh-porter 命令分发（骨架：命令解析 + JSON schema 占位）
 * 功能实现待迁移：原型在 ops/scripts/wsl/dsh-migrate-session.mjs
 */
export class Command {
  constructor(args) { this.args = args; }

  async run() {
    const [name, ...rest] = this.args;
    switch (name) {
      case 'inspect': return this.notImplemented('inspect');
      case 'migrate': return this.notImplemented('migrate');
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

  notImplemented(name) {
    // 骨架占位：实现时按 SPEC §3.x + §3.7 schema 返回
    console.error(`[${name}] 未实现（SPEC v0.6 已定义，待实现）`);
    return { exitCode: 3 };
  }
}
