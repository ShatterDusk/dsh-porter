# dsh-porter

> DSH 会话数据跨端迁移的正确方式——**告别"直接 copy 数据文件"**。

DSH（DeepSeek Harness）的会话数据无法通过简单复制文件夹完成迁移。`dsh-porter` 是为此而生的运维 CLI：**迁移、体检、修复、格式转换、归档**，零 dsh 依赖。

## 为什么需要它

### 背景：DSH 数据是什么样

DSH 的会话存在数据根的 `sessions/` 下，按工作目录编码分组：

```
<数据根>/sessions/
├── --F-PROJECTS--/       ← cwd = F:\\PROJECTS（Windows 视角）
└── --mnt-f-PROJECTS--/   ← cwd = /mnt/f/PROJECTS（WSL 视角）
    └── session-xxx/session.jsonl.zstd   ← 一个会话（多帧 zstd 压缩的 JSONL）
```

同一台机器的同一个目录，在 Windows 和 WSL 里是**两条路径**——这就是跨端问题的根源。

### 三个"直接 copy 不行"的原因

| # | 原因 | 直接 copy 的后果 |
|---|---|---|
| 1 | **cwd 路径编码不匹配**：会话 header 里的 `cwd` 决定它在哪个分组、属于哪个工作区 | 搬过去后会话出现在错误分组/全部"未分组" |
| 2 | **会话格式严格**：文件是多帧 zstd，**第一帧必须恰一行 header**，事件逐帧追加；整体重新压缩（哪怕内容不变）就违反格式 | 最轻：历史打不开；最重：**整个 dsh web 崩溃**（本项目作者亲历，详见 docs/format.md） |
| 3 | **workspace 归属不跟着文件走**：会话属于哪个工作区、是否归档，记录在 `storages/workspace.json` | 迁移后"未分组"、归档状态错乱 |

### 谁需要它

- **多封装用户**：EAC / dsh_desktop / 官方 CLI 并存，需要在数据根之间搬运会话
- **跨平台用户**：WSL ↔ Windows 双环境切换，想让两边会话统一
- **运维/备份党**：批量体检数据根、修复损坏会话、整理归档

### 它解决什么、不解决什么

**解决**：跨根搬运会话的正确姿势（cwd 转化 + 格式合规重写 + workspace 归属同步）；会话健康体检与损坏修复；zstd ↔ 明文转换。

**不解决**：模型配置、插件安装、凭据管理（那些用 DSH 自己的机制）；多数据根之间的实时同步（它是迁移工具，不是同步服务）。

## 安装

```bash
npm install -g dsh-porter
```

需要 Node >= 20.11。包大小 ~25kB，零运行时依赖。

## 快速上手（30 秒）

```bash
# 1. 体检：你的数据根健康吗
dsh-porter inspect ~/.dsh

# 2. 迁移预览（不写入）
dsh-porter migrate /mnt/c/Users/1/.dsh ~/.dsh --direction to-wsl --dry-run

# 3. 执行迁移（自动同步 workspace 归属）
dsh-porter migrate /mnt/c/Users/1/.dsh ~/.dsh --direction to-wsl
```

## 命令

| 命令 | 一句话 |
|---|---|
| `migrate` | 跨根搬运会话：cwd 转化 + 格式合规重写 + **workspace 归属同步**（归档原样保留） |
| `inspect` | 体检：id/cwd/version/帧数/行数/健康状态 |
| `convert` | zstd ↔ 明文互转（调试/分析用） |
| `repair` | 修复损坏会话：torn 截断修复 / 污染隔离 |
| `archive` | 归档：迁移 + 两阶段删源（暂存 → 确认 → 清空） |

所有命令支持 `--json`（机器可读）与语义化退出码（0 成功 / 1 部分失败 / 2 用法 / 3 环境）。完整参数见 `dsh-porter --help`。

## 场景指南

| 场景 | 用什么 |
|---|---|
| EAC 会话归档回 WSL 根 | `migrate ... --direction to-wsl`（先 --dry-run） |
| WSL 会话搬到 Windows 根 | `migrate ... --direction to-win` |
| 数据根体检（健康/损坏） | `inspect <数据根>` |
| 会话打不开/历史损坏 | `repair <会话文件>` |
| 调试会话内容（grep/分析） | `convert --format plain` |
| 迁移后删源（确认制） | `archive ...` 然后 `archive --finalize` |

## 格式纪律（重要，作者用崩溃换来的）

- 会话是**多帧 zstd**，**禁止整体单帧重压**——dsh web 会直接崩
- 第一帧必须恰一行 header；id 必须 UUID
- **不要用手/记事本改 storages/*.json**（UTF-8 BOM + CRLF 会让 dsh 拒绝解析）
- 迁移/修复大会话前，建议先停掉正在运行的 dsh（EAC/CLI）

详见 docs/format.md——生态内首份 DSH 会话格式文档。

## 测试

```bash
npm test
```

20+ 测试覆盖全部命令（合成 fixtures，不依赖真实数据）。

## 文档

- SPEC.md — 规格与验收记录（含踩坑史）
- docs/format.md — DSH 会话格式（reverse-engineered）
- docs/competitor-analysis.md — 生态与竞品
- docs/RELEASE.md — 发布清单（维护者）
- examples/plain-session-demo — 明文会话演示

## License

MIT
