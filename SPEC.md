# dsh-porter — SPEC v1.7

> DSH 会话数据的跨根迁移 / 格式转换 / 体检修复工具箱（独立 CLI，零 dsh 依赖）
> 状态：迭代中。每版以"用户故事情景验收"为准修订。

## 0. 变更记录

### v1.7（2026-08-16，CLI 层端到端测试，14/14 通过）
- **CLI 端到端测试**（test/cli.test.js，spawn 真实进程）：--version/--help、用法错误退出码 2（E_USAGE）、migrate dry-run 端到端、--json 输出 schema 解析验证
- 测试分层完成：模块层（10 测试）+ CLI 层（4 测试）双覆盖；npm test 脚本更新

### v1.6（2026-08-16，CLI/实现一致性 + convert 幂等）
- **CLI usage 对齐实现**：--conflict 三策略（ask 移除）、archive --finalize 用法（--by 移除）
- **convert 幂等**：同格式转换返回 noop（不写文件）——测试 10/10 通过
- 一致性纪律：usage 文本 = 实现事实源

### v1.5（2026-08-16，开放问题收敛 + 错误码清单）

### v1.4（2026-08-16，发布基础：依赖独立化 + npm test 标准化）
- **依赖版本修正**：fzstd ^0.1.1、@bokuweb/zstd-wasm ^0.0.27（初版写的 2.0.0/1.0.0 不存在）
- **npm install 成功**：依赖进项目 node_modules（不再依赖 ops 原型 .migrate-tools fallback；zstd.js 双候选保留为开发期兜底）
- **npm test 标准化**：scripts.test 修正为显式文件路径（node --test test/dsh-porter.test.js），9/9 通过
- package-lock.json 入仓；发布前置（GitHub 仓库/npm publish）待用户确认

### v1.3（2026-08-16，--conflict 实现 + 参数测试 + README）
- **--conflict 策略实现**（spec §3.2 补全）：skip（默认，目标同 id 会话跳过）/ new-id（冲突生成新 UUID）/ abort（E_CONFLICT 中止）
- **参数端到端测试**：--conflict 三策略、--map 自定义映射（D:\\work→/mnt/d/work）、--direction auto 自动判定——9/9 通过
- 实现修正：migrate 返回 header.id（new-id 场景）；测试断言修正（conflict skip 语义）
- **README 初稿**（发布准备：安装/命令表/格式纪律/测试/文档索引）

### v1.2（2026-08-16，测试套件落地，7/7 通过）
- **自动化测试套件**（test/，node:test + 合成 fixtures）：7 测试覆盖 5 命令
- **测试暴露并修复的 4 个真实 bug**（此前手动验收侥幸漏过）：
  1. migrate dry-run 不阻止写入（dry-run 实写文件）
  2. zstd decompress 忽略 fzstd 返回 byteOffset → 解压混入垃圾字节（影响所有命令）
  3. boku wasm 初始化竞态（node:test 并发顶层测试 → 压缩产物损坏）→ zstd.js 模块级锁
  4. repair quarantine 路径层级错误（隔离到分组而非 sessions 根）
- 测试方法论固化：合成 fixtures（与生产同 zstd lib）→ 每命令行为断言（dry-run 零写入/skip 语义/三态判定/往返一致/两阶段协议）

### v1.1（2026-08-16，archive 命令实现验收，5/5 命令闭环 🎉）
- **archive 命令实现**（src/archive.js），两阶段协议验收：
  - 阶段1+2a：迁移 2 会话 → 目标校验 → 源端移入 `.archive-pending/`（源剩余 0，暂存 2，归档 2）→ 提示"运行 --finalize 清空暂存"
  - 阶段2b：`archive --finalize <源根>` → pending 清空（真删除）
  - 安全属性：阶段1 失败即中止（源不动）；暂存可回滚；finalize 前可反悔
  - 实现修正：pending 目录预建（rename 目标父目录 ENOENT bug）、finalize 参数透传
- **里程碑：inspect/migrate/convert/repair/archive 五命令全部实现并验收**（SPEC §3 全章节落地）

### v1.0（2026-08-16，repair 命令实现验收，4/5 命令闭环）
- **repair 命令实现**（src/repair.js），验收结果：
  - **torn/corrupt 截断修复**：500KB 截断样本 → 帧级扫描保留最大可解前缀（1096 帧/1658 行）→ 重建写回 → inspect 验证 ok（cwd/version 保留）；原损坏文件移入 `.quarantine/`（可回滚）
  - **unknown-format 隔离**：污染样本 → 移入 quarantine + 副本恢复建议
  - 安全：修复前原文件必先隔离备份，修复版写回原位
- 实现备注：帧级扫描"最大可解前缀"算法（魔数切帧 + 逐帧解码至首个失败帧）
- 剩余未实现：archive（US-6 两阶段删源协议）

### v0.9（2026-08-16，convert 命令实现验收）
- **convert 命令实现**（src/convert.js），验收结果：
  - zstd→plain：`session.jsonl.zstd` → `session.jsonl`（13.5MB 明文，首行 header 完整）
  - plain→zstd：帧合规重写（header 一帧 + 事件一帧）→ 2.1MB
  - 往返一致性：inspect 验证 ok、21819 行完整、cwd/version 保留
  - 实现修正：文件名后缀处理（.jsonl.zstd/.jsonl 双向去后缀，初版产生 `session.jsonl.jsonl` 的 bug 已修）
- 剩余未实现：repair / archive（spec 已定义，含 US-4/US-6 协议）

### v0.8（2026-08-16，inspect 实现验收：torn 判定实测修正）
- **inspect 命令实现**（src/inspect.js），验收结果：
  - 单会话/全量/构造样本（污染→unknown-format ✓、截断→corrupt ✓）均正确
  - **torn 判定实测修正**：fzstd.decompress 对任何尾部残缺（实测去 10B/100B/500B/2000B 均失败）**严格报 corrupt**——"整体解码通过+尾帧残缺"场景在 fzstd 语义下不出现
  - 修订健康分级：**ok / corrupt（含 torn tail，报告注明"dsh 可截断修复"）/ unknown-format**；帧级扫描保留为防御性检查（帧数统计 + 未来解码器行为变化防护）
- 实现备注：inspect 目录语义 = 数据根（含 sessions/）；帧数/行数/大小/header 字段全部输出；--json 符合 §3.7

### v0.7（2026-08-16，migrate 首个命令实现验收）
- **migrate 命令完整实现**（src/migrate.js + lib/zstd.js + lib/cwd.js），真实数据验收：
  - dry-run：64 会话 迁移 6 / 跳过 58 / 失败 0（与 ops 原型一致）
  - --json：输出符合 §3.7 schema（command/dryRun/summary/items 完整）
  - 真实迁移：6 会话写入目标根正确分组（--mnt-f-PROJECTS--），产物生成成功
  - 错误分级生效：E_NO_ZSTD_DEPS（依赖缺失）→ 退出码 3；E_USAGE → 2
- 实现备注：依赖加载支持"项目 node_modules → ops 原型 .migrate-tools"双候选（开发期 fallback）；`--copy-unchanged` 对明文/压缩保持原格式复制

### v0.6（2026-08-16，实现前定义补全）
- 新增 §3.6 `--map` 多路径映射表格式（不止 PROJECTS 一个映射）
- 新增 §3.7 `--json` 输出 schema（US-5 落地，脚本消费契约）
- 新增 §3.8 错误分级与退出码（4 级语义）
- 验收方法：均为实现前置定义，实现时按 schema 验收

### v0.5（2026-08-16，US-6 验收驱动：archive 删源安全）
- **US-6 验收**（两阶段删除协议模拟走查）：三个安全属性实测成立——① 迁移失败 → 源未动；② 误删可恢复（暂存阶段）；③ 断电可重入（幂等）
- **决策**：archive 采用**两阶段删除协议**：阶段 1 = 迁移 + 目标端校验（失败即中止，源不动）；阶段 2a = 源端会话移入 `.archive-pending/`（暂存可回滚）；阶段 2b = 用户确认后清空暂存（真删除）。`--dry-run` 强制预览
- **附**：`docs/format.md` 会话格式文档（实测知识系统化，生态稀缺品）

### v0.4（2026-08-16，US-4 验收驱动：repair 损坏处理）
- **US-4 验收**（构造样本走查）：
  - 污染文件（非 zstd）→ inspect 正确识别 unknown-format ✓；流式解码拒绝（invalid zstd data）✓
  - **截断文件（torn tail）→ fzstd 整体解码与流式解码均静默"通过"**（实测）——torn 检测必须**帧级扫描**，不能用 fzstd 单次解码判定
  - **关键认知**：dsh 官方对 torn 是"容忍 + 截断修复"（SessionLogScanner/commitRepair 语义）——torn 属"可修复"级别，不属灾难
- **决策**：
  - inspect 健康分级：ok / torn（帧级扫描确认，提示可 repair）/ corrupt / unknown-format
  - repair 的 torn 修复 = **截断尾部残缺帧**（保留完整前缀，对齐 dsh 官方语义）；repair 的 unknown-format 处理 = 隔离 quarantine + 报告（含"WSL 端是否有同 id 副本"建议）
  - 帧级扫描实现方案：魔数切帧 + 逐帧流式解码验证尾帧（标注：fzstd 单次解码不可靠，需帧级；备选：zstd CLI -t 校验）

### v0.3（2026-08-16，技术实测 + US-3 验收驱动）
- **开放问题 #1 关闭（实测 PASS）**："迁移产物 + dsh 继续 append"——在迁移产物（2 帧）末尾模拟追加新事件帧，整体重解码验证：1903 → 1904 行、末行为新事件、帧拼接兼容 → **决策：迁移产物可安全追加，无需特殊处理**
- **US-3 验收**（真实数据模拟 inspect）：64 会话全部健康（解码级验证），退出码 0；确认输出语义满足"知道哪些健康/损坏"
- **补充**：inspect 增加**帧级 torn 检测**要求（对齐竞品 dsh-session-health；整体解码可能放过尾部残缺帧，需逐帧验证才算完整体检）

### v0.2（2026-08-16，US-1 情景验收驱动）
- **发现**：真实数据演练（64 会话 migrate dry-run）暴露——大部分会话 cwd 已是目标格式（从 WSL 复制的历史），原实现将其计为**失败**（exit 1），错误语义
- **决策**：migrate 对"cwd 无需转化"改为 **SKIP**（exit 0，报告中计数）；新增 `--copy-unchanged` 选项（原样复制，用于整根归档场景）
- **验收结果**：修复后 64 会话 0 失败（58 SKIP + 6 转化）

## 1. 定位

> 竞品分析：见 docs/competitor-analysis.md（dsh-plugin topic 4716 仓库盘点；核心差异化 = 跨根迁移 + cwd 转化 + 格式转换，无直接竞品；最近似 = dsh-session-health（只读体检，UI 插件）与 dsh-archived-sessions（同根归档））

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
- 输出：id / cwd / version / 帧数 / 行数 / 大小 / 健康状态（ok | corrupt | torn | unknown-format）；`--json`
- **健康判定（两级）**：① 整体解码（fzstd）成功与否；② **逐帧扫描**（torn tail / 帧内非整行检测——对齐 dsh-session-health 能力，整体解码可能放过尾部残缺帧）
- 退出码：0 健康 / 1 有损坏或 torn / 2 用法错误
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
- 处理（按损坏类型）：
  - **torn**（帧级扫描确认）：截断尾部残缺帧 → 写回（对齐 dsh 官方 commitRepair 语义；保留完整前缀）
  - **corrupt**（帧结构错误/header 损坏）：能救则帧重建，不能救移入 quarantine（不删除）
  - **unknown-format**（非 zstd）：移入 quarantine + 报告（含"WSL 端是否有同 id 副本可恢复"建议）
- **帧级扫描**（torn 检测实现）：魔数切帧 + 逐帧解码验证尾帧完整性（fzstd 单次/流式解码对 torn 静默，实测不可靠；备选 zstd CLI -t）

### 3.5 archive（归档）
- 输入：`<源根> <归档根> [--by project|month] [--dry-run]`
- 处理：**两阶段删除协议**（唯一删源命令）：
  - 阶段 1：migrate 复用 + 目标端校验（自检 + 存在性确认）；**失败即中止，源不动**
  - 阶段 2a：源端会话移入 `<源根>/.archive-pending/`（暂存，可回滚）
  - 阶段 2b：用户确认后清空暂存（真删除）
- 强制 `--dry-run` 先预览（列出将迁移+删除的会话）
- 安全属性：迁移失败源未动 / 误删可恢复 / 断电可重入（幂等）

### 3.6 `--map` 多路径映射表

```
--map "源前缀=目标前缀,源前缀=目标前缀,..."    （逗号分隔多规则；方向由 --direction 决定）
例: --map "D:\work=/mnt/d/work,E:\data=/mnt/e/data"
```

- 匹配：**最长前缀匹配**（cwd 以源前缀开头即命中）；未命中映射的 cwd 保持原样（计入 SKIP）
- `--direction auto`：按 cwd 形态自动判定——`/mnt/x/` 开头 → to-win（需 `--map` 提供盘符目标，缺省盘符按 `/mnt/<x>` → `<X>:\` 规则）；`X:\` 开头 → to-wsl
- 内置默认规则：`X:\` ↔ `/mnt/x/`（大小写不敏感匹配盘符）

### 3.7 `--json` 输出 schema（US-5）

所有命令 `--json` 输出单一 JSON 对象到 stdout（人类输出走 stderr 或 `--verbose`）：

```json
{
  "command": "migrate",
  "toolVersion": "0.1.0",
  "dryRun": true,
  "summary": { "total": 64, "migrated": 6, "copied": 0, "skipped": 58, "failed": 0 },
  "items": [
    { "id": "session-xxx", "status": "migrated|copied|skipped|failed|ok|torn|corrupt|unknown",
      "from": "/mnt/f/PROJECTS", "to": "F:\\PROJECTS",
      "targetPath": "C:/.../session.jsonl.zstd", "error": null }
  ]
}
```

- `status` 枚举按命令域：migrate/archive 用 migrated/copied/skipped/failed；inspect 用 ok/torn/corrupt/unknown
- `error`：失败时的机器可读错误码 + 人类消息（`"E_NO_ZSTD_DEPS" / "E_NOT_ZSTD" / "E_TORN" / "E_CONFLICT" / "E_SELF_CHECK"`）

### 3.8 错误分级与退出码

| 码 | 含义 | 触发 |
|---|---|---|
| 0 | 全部成功（含 skipped） | — |
| 1 | 部分失败（有 failed 项） | 单会话失败但命令完成 |
| 2 | 用法错误 | 参数缺失/非法、路径不存在 |
| 3 | 环境错误 | 依赖缺失（.migrate-tools 未装）、目标不可写 |

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

## 7. 开放问题（v1.5 收敛：3/4 关闭）

1. ~~迁移产物 + dsh 继续 append 的完整闭环~~ → **已实测关闭（v0.3）**：追加新帧后整体解码验证通过
2. **明文模式体积/性能取舍** → **已决策（v1.5）**：实测 13.5MB 明文 vs 2.1MB zstd（≈6.4x 体积差）；明文定位 = 调试/脚本分析/备份可读性，不用于日常存储；convert 明确此用途
3. **格式演进（dsh 改 version）拒绝策略** → **已设计（v1.5）**：工具按 header.version 感知——读到高于工具已知版本的 version 时：inspect 报告 unknown-version、migrate/repair/convert **拒绝操作**（E_UNSUPPORTED_VERSION，退出码 1），提示"升级 dsh-porter"；策略对齐 dsh 官方"宁拒不猜"
4. **与 `dsh-switch.sh` 的关系** → **已定案（v1.5）**：dsh-porter 独立发布（生态贡献）；本地保留 dsh-switch.sh 集成（migrate 子命令调 dsh-porter 或原型，作为自用快捷入口）

## 8. 错误码清单（§3.7 引用全表）

| 错误码 | 含义 | 场景 |
|---|---|---|
| E_USAGE | 参数/用法错误 | 未知命令、缺参、非法值（退出码 2） |
| E_NO_ZSTD_DEPS | 依赖缺失 | fzstd/zstd-wasm 未安装（退出码 3） |
| E_NOT_ZSTD | 非 zstd 非明文 | migrate 源文件格式未知 |
| E_TORN | 损坏/截断 | 文件无完整行、解码失败 |
| E_SELF_CHECK | 自检失败 | 重写后行数不一致（防写坏） |
| E_CONFLICT | 同 id 冲突 | migrate --conflict abort |
| E_UNSUPPORTED_VERSION | 格式版本不识别 | header.version 高于工具已知（防误写） |
| E_UNKNOWN | 未分类错误 | 兜底 |
