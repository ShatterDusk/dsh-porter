# dsh-porter — SPEC v0.2

> DSH 会话数据的跨根迁移 / 格式转换 / 体检修复工具箱（独立 CLI，零 dsh 依赖）
> 状态：迭代中。每版以"用户故事情景验收"为准修订。

## 0. 变更记录

### v0.2（2026-08-16，US-1 情景验收驱动）
- **发现**：真实数据演练（64 会话 migrate dry-run）暴露——大部分会话 cwd 已是目标格式（从 WSL 复制的历史），原实现将其计为**失败**（exit 1），错误语义
- **决策**：migrate 对"cwd 无需转化"改为 **SKIP**（exit 0，报告中计数）；新增 `--copy-unchanged` 选项（原样复制，用于整根归档场景）
- **验收结果**：修复后 64 会话 0 失败（58 SKIP + 6 转化）

## 1. 定位

DSH（DeepSeek Harness）会话数据（`sessions/*/session.jsonl.zstd`）在**多封装、多平台**（EAC / dsh_desktop / 官方 CLI；WSL / Windows）并存场景下的**运维工具**：迁移（cwd 转化）、体检、修复、格式转换。

**为什么存在**：官方无迁移工具；会话格式无公开文档；多封装共存必然产生跨根会话（本项目作者亲历的坑：UNC 路径崩溃、单帧重压崩溃、污染文件拖垮整个 dsh web）。

## 2. 用户故事

| ID | 故事 | 验收情景（想象执行） |
|---|---|---|
| US-1 | 作为 EAC 用户，我希望把 Windows 根的会话归档回 WSL 根，且 cwd 自动转化（`F:\PROJECTS` ↔ `/mnt/f/PROJECTS`），分组正确 | 跑 `dsh-porter migrate C:\Users\1\.dsh ~/.dsh --direction to-wsl` → WSL dsh web 刷新后会话出现在 `--mnt-f-PROJECTS--`，可打开、可继续、不崩溃 |
| US-2 | 作为双环境用户，我希望迁移前能预览，确认无误再写 | `--dry-run` 输出每会话转化前后 cwd 与目标路径，零写入 |
| US-3 | 作为维护者，我希望批量体检数据根，知道哪些会话健康/损坏 | `dsh-porter inspect ~/.dsh` → 汇总表 + 退出码（0=健康 / 1=有损坏） |
| US-4 | 作为受害者，我希望损坏会话被隔离而不是拖垮整个 web | `repair` 检测非 zstd/帧结构错误 → 移入 `.quarantine/` + 报告，绝不中断全批 |
| US-5 | 作为脚本用户，我希望输出机器可读 | 所有命令支持 `--json`；退出码语义化 |
| US-6 | 作为归档者，我希望迁移后源端清理有明确流程 | `archive` 迁移+确认后删源，强制 `--dry-run` 预览 |

## 3. 功能规格

### 3.1 inspect（只读体检）
- 输入：会话文件 | 数据根 `sessions/` 目录
- 输出：id / cwd / version / 帧数 / 行数 / 大小 / 健康状态（ok | corrupt | unknown-format）；`--json`
- 退出码：0 健康 / 1 有损坏 / 2 用法错误
- 不写任何文件

### 3.2 migrate（迁移 + cwd 转化）
- 输入：`<源根> <目标根> --direction to-wsl|to-win|auto [--map 表] [--conflict ask|new-id|skip|abort] [--copy-unchanged] [--dry-run]`
- 处理：遍历源 `sessions/` → 解压（fzstd）→ header.cwd 按映射表转化 → **帧合规重写**（header 一帧恰一行 + 事件一帧）→ 写入 `<目标根>/sessions/<新projectKey>/<id>/session.jsonl.zstd` → 自检（重解码行数一致）
- **无需转化（cwd 已是目标格式）**：默认 **SKIP**（exit 0，计入报告）；`--copy-unchanged` 时原样复制（不重写）
- 输出：逐会话进度（转化/复制/跳过三类计数）+ 汇总；`--json`
- **不删源**（删源是 archive 的职责）；不碰 storages/manifest
- 格式纪律（事故教训）：**禁止整体单帧重压**；第一帧必须恰一行 header；id 必须 UUID；同根内同 id 冲突必须按 `--conflict` 策略处理

### 3.3 convert（格式转换）
- 输入：会话文件 + `--format zstd|plain`
- 输出：目标格式文件（.jsonl.zstd ↔ .jsonl，dsh 按后缀识别）；原文件不动

### 3.4 repair（修复）
- 输入：损坏会话 + `[--quarantine 目录]`（默认 `.quarantine/`）
- 处理：检测损坏类型（非 zstd 内容 / 帧结构错误 / header 损坏）→ 能救则帧重建 → 不能救移入 quarantine（不删除）→ 报告 + 建议（如"WSL 端有同 id 副本"）

### 3.5 archive（归档）
- 输入：`<源根> <归档根> [--by project|month]`
- 处理：migrate 复用 + **确认后删源**（唯一删源命令）
- 强制 `--dry-run` 先预览

## 4. 架构决策

| 决策点 | 结论 |
|---|---|
| 运行时 | 纯 Node CLI（零 dsh 依赖；不逆向 cordis 4） |
| 依赖 | `fzstd`（解压，实测支持 dsh 无 content-size 流式帧）+ `@bokuweb/zstd-wasm`（压缩，产物标准） |
| 语言 | Node >= 20（`import.meta.dirname` 需要 20.11+） |
| 包名 | `dsh-porter`（npm 已确认可用） |
| 许可 | MIT |
| 发布 | GitHub 公开仓 + npm publish + `dsh-plugin` topic 挂标 |

## 5. 非功能需求（安全纪律）

1. **读不破坏**：inspect/convert/migrate 默认不删源；唯一删源是 archive（强制预览）
2. **写必自检**：任何产物写前重解码验证（行数一致），失败中止报错
3. **机器可读**：全部命令 `--json` + 语义化退出码
4. **损坏隔离**：坏文件进 `.quarantine/`，不中断全批

## 6. 路线图

- **MVP（v0.1.0）**：inspect + migrate（含 dry-run/conflict/自检）+ CLI 骨架 + README
- **v0.2.0**：convert + repair + `--map` 多路径映射表 + 测试套件（真实会话 fixtures）
- **v0.3.0**：archive + 会话格式文档（docs/format.md，生态稀缺品）+ TUI 选择器（可选）

## 7. 开放问题

1. 迁移产物 + dsh 继续 append 的完整闭环（帧边界不影响追加——需实测验证）
2. 明文模式体积/性能取舍
3. 格式演进（dsh 改 version）的拒绝策略
4. 与 `dsh-switch.sh` 的关系：独立发布 + 本地保留集成
