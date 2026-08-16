# dsh-porter

DSH（DeepSeek Harness）会话数据运维工具：跨根迁移（cwd 转化）、体检、修复、格式转换、归档。**零 dsh 依赖**，纯 Node CLI。

> 背景：DSH 生态多封装共存（EAC / dsh_desktop / 官方 CLI）、跨平台（WSL / Windows），会话数据（`sessions/*/session.jsonl.zstd`）在根之间搬运时需要 **cwd 路径转化 + 格式合规重写**——官方无此工具，本项目填补空白。

## 安装

```bash
npm install -g dsh-porter
```

需要 Node >= 20.11。

## 命令

| 命令 | 用途 |
|---|---|
| `dsh-porter migrate <源根> <目标根> --direction to-wsl|to-win|auto [--map 表] [--conflict 策略] [--copy-unchanged] [--dry-run]` | 批量迁移会话（cwd 转化 + 帧合规重写；无需转化默认 SKIP） |
| `dsh-porter inspect <会话文件|数据根> [--json]` | 体检：id/cwd/version/帧数/行数/健康状态（ok/corrupt/unknown-format） |
| `dsh-porter convert <会话文件> --format zstd|plain [--out 目录]` | 格式互转（zstd ↔ 明文 .jsonl；同格式返回 noop） |
| `dsh-porter repair <会话文件> [--quarantine 目录]` | 修复：torn 截断修复（帧级最大可解前缀）/ 污染隔离 |
| `dsh-porter archive <源根> <归档根> [--direction X] [--dry-run]` | 归档（两阶段删源协议：迁移校验 → 暂存 → `--finalize` 清空） |

所有命令支持 `--json`（机器可读）与语义化退出码（0 成功 / 1 部分失败 / 2 用法 / 3 环境）。

## 格式纪律（重要）

DSH 会话是**多帧 zstd**（第一帧必须恰一行 header，事件逐帧追加）。**禁止整体单帧重压**（会导致 dsh web 崩溃——本项目作者亲历）。详见 [docs/format.md](docs/format.md)（生态内首份会话格式文档）。

## 测试

```bash
npm test
```

9 个测试覆盖全部命令（合成 fixtures，不依赖真实数据）。

## 文档

- [SPEC.md](SPEC.md) — 规格与验收记录
- [docs/format.md](docs/format.md) — DSH 会话格式文档（reverse-engineered）
- [docs/competitor-analysis.md](docs/competitor-analysis.md) — 竞品分析
- [examples/plain-session-demo](examples/plain-session-demo/) — 明文会话验证包（convert 产物 + EAC 验证步骤）

## License

MIT
