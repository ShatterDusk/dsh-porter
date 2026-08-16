# dsh-porter

[![npm version](https://img.shields.io/npm/v/dsh-porter)](https://www.npmjs.com/package/dsh-porter)
[![license](https://img.shields.io/npm/l/dsh-porter)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20.11-blue)](package.json)

DSH 会话数据运维 CLI：跨根迁移（含 workspace 归属同步）、体检、修复、格式转换。零 dsh 依赖。

DSH 会话文件不能直接复制迁移（cwd 路径编码写在数据里、格式严格、归属状态分离）——dsh-porter 处理这些。详见 [docs/format.md](docs/format.md)。

## Install

```bash
npm install -g dsh-porter
```

Requires Node >= 20.11.

## Quick Start

```bash
# 体检数据根
dsh-porter inspect ~/.dsh

# 迁移预览 → 执行（Windows 根 → WSL 根）
dsh-porter migrate /mnt/c/Users/1/.dsh ~/.dsh --direction to-wsl --dry-run
dsh-porter migrate /mnt/c/Users/1/.dsh ~/.dsh --direction to-wsl
```

## Commands

| Command | Description |
|---|---|
| `migrate <src> <dst> --direction to-wsl|to-win|auto` | 跨根迁移会话：cwd 转化 + 格式合规重写 + workspace 归属同步 |
| `inspect <session|root>` | 体检：健康状态/帧数/行数/版本 |
| `convert <file> --format zstd|plain` | zstd ↔ 明文互转 |
| `repair <file>` | 修复损坏会话（torn 截断/污染隔离） |
| `archive <src> <dst>` | 归档：迁移 + 两阶段删源 |

所有命令支持 `--json` 与语义化退出码（0 成功 / 1 部分失败 / 2 用法 / 3 环境）。

## Research

- [docs/format.md](docs/format.md) — DSH 会话格式研究（帧结构 / header schema / 兼容约束；生态内首份公开文档）

## Test

```bash
npm test
```

## License

MIT
