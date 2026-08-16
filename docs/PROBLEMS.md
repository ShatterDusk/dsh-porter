# dsh-porter 挂起问题清单

> 状态：**记录挂起，暂不解决**（2026-08-16 用户决定先挂起，之后再处理）。
> 来源：子代理专业度审核（dev 用户挑刺）+ 用户反馈（"项目不专业、塑料味"）。

## A. 已修复（历史，供追溯）

- 原子写入防 watcher 崩溃（v2.0）
- workspace 归属同步 + 归档保留（v2.0）
- 版本三处打架 → package.json 单一事实源（src/version.js）
- package.json BOM / 幽灵 main / 缺元数据（repository/bugs/homepage/author）
- archive --dry-run 硬编码真实写 → 透传
- --no-sync-workspace 未接线 → 已接线
- README 三轮重写（自嗨 → 专业模板）
- SPEC 移入 docs/；发布包排除内部文档
- 测试计数统一（21）

## B. 挂起待解决

### B1. 代码/工程（"不专业"硬伤）

- [ ] **README 示例路径本机化**：Quick Start 里 /mnt/c/Users/1/.dsh 是作者本机路径，应用中性路径
- [ ] **死代码残余**（子代理 #8）：archive.js 无用 srcDir 计算、convert.js 无用且逻辑错的 srcIsZstd、migrate.js import 位置（夹在函数中）
- [ ] **SPEC 内部矛盾**（子代理 #9）：§3.1 健康状态 4 态 vs §3.7 的 torn 并入 corrupt；--conflict 仍列已移除的 ask；§3.7 说人类输出走 stderr 实际走 stdout；§4 用 import.meta.dirname 理由但代码未用该 API
- [ ] **无 CI**：GitHub Actions（lint + test）未配
- [ ] **无 CHANGELOG.md**：版本变更混在 SPEC 变更记录里
- [ ] **LICENSE copyright 占位**："dsh-porter contributors" 是占位式，应写实际持有者
- [ ] **badge 与 npm 实际版本不一致**：npm 发布 0.1.0，本地 0.2.0

### B2. 文档/门面（"塑料味"来源）

- [ ] **Quick Start 无真实输出**：只有命令，没有"跑起来长什么样"
- [ ] **无 CONTRIBUTING.md / 行为准则**：开源项目缺贡献入口
- [ ] **中英混杂**：README 英文主体但命令描述含中文
- [ ] **docs 命名大小写不一**：RELEASE.md vs format.md（子代理 #13）
- [ ] **examples/plain-session-demo 未实测**（开放问题 #2）
- [ ] **体积口径不一**：~25kB vs 22.7kB（子代理 #16）
- [ ] **SPEC "0.5 状态快照"编号诡异** + 两版快照叠放（子代理 #14）
- [ ] **无项目状态标注**：alpha/beta/稳定未声明

### B3. 功能/边界

- [ ] **inspect 全量根扫描仍慢**（65 会话累计耗时）——批量/采样可优化
- [ ] **archive --by project|month**：SPEC 曾列，实现未做（待查 SPEC 残留）
- [ ] **--map 多路径 CLI 层端到端测试**未全覆盖
- [ ] **明文会话 dsh 实际读取**（开放问题 #2）：验证包待 EAC 实测

### B4. 流程/治理

- [ ] **npm publish v0.2.0**：代码就绪（RELEASE.md 流程），待用户执行
- [ ] **GitHub Releases/tag**：v0.2.0 未打 tag、无 Releases
- [ ] **记忆更新**：dsh-porter 状态未同步到 MEMORY/PROJECTS.md

## C. 用户定性（2026-08-16）

"项目不专业、塑料味"——门面工程（版本/元数据/文档一致性/死代码/flag 接线）全线失守；
内核（zstd 帧格式理解、workspace 同步、两阶段删源、测试覆盖）是真功夫。
