# dsh-porter 竞品分析（2026-08-16，简单版）

> 数据源：GitHub `dsh-plugin` topic（4716 仓库）+ 关键词搜索 + awesome-dsh-plugin 分类

## 1. 生态格局

- **dsh-plugin topic 4716 个仓库**（含大量泛 AI 项目挂标，真实 dsh 插件数百）
- 官方精选列表 `awesome-dsh-plugin` 分类：UI / 主题 / 模型 / **Sessions & Messages** / Memory / 工具 / Skills / 工作流 / 通知 / 开发运行时 / 插件市场 / 娱乐
- 桌面端封装竞争激烈：anywhere-labs/deepseek-harness-desktop(★7674)、EAC、dsh_desktop——**多封装共存是生态常态，数据整合需求客观存在**

## 2. 会话/数据类直接竞品

| 项目 | ★ | 能力 | 与 dsh-porter 的关系 |
|---|---|---|---|
| omdsh-dev/dsh-session-health | 8 | 多帧 zstd 会话**帧级扫描诊断**（torn/损坏/空会话），零依赖只读，注册 session_health 工具 | **部分重叠**（inspect 的只读体检）；它绑定 dsh UI/工具注册，porter 是独立 CLI；可互补 |
| Zephyr-vibe/dsh-archived-sessions | 11 | 会话管理：archive/restore/delete/打开记录文件夹 | 重叠 archive 概念；**同根内管理**，无跨根/cwd 转化 |
| lsz-asd/dsh-plugin-session-delete | 18 | UI 删除会话 | 单点功能 |
| cpj-dev/dsh-plugin-cc | 25 | bridge 到 Claude Code，session import | 导入方向不同（跨 harness 而非跨根） |
| dsh-automation / dsh-lark-bot 等 | - | 自动化/通知 | 无关 |

## 3. 市场空白（dsh-porter 的差异化）

| 能力 | 现有覆盖 | dsh-porter |
|---|---|---|
| **跨根迁移 + cwd 转化**（WSL↔Windows、多封装整合） | **无任何项目** | ★ 核心差异化 |
| 会话格式转换（zstd↔明文） | 无 | ★ |
| 会话健康检查（CLI 独立版） | 只有 UI 插件版（session-health） | 互补 |
| 批量运维（inspect+migrate+repair 一体化） | 无 | ★ |
| **会话格式公开文档**（帧结构/header schema） | 官方无公开文档 | ★ 生态稀缺品 |

## 4. 定位结论

dsh-porter 不与现有插件正面竞争：
- 它是**数据运维层**（CLI），现有竞品是 **UI/工具层**（插件）
- 可明确宣传的差异点：**首个跨根迁移 + 格式转换 CLI；零 dsh 依赖；发布格式文档**

## 5. 行动项（来自分析）

- [ ] README 中引用 awesome-dsh-plugin 的 Sessions & Messages 分类（发布时）
- [ ] 与 dsh-session-health 作者联动（互补定位，可互相引用）
- [ ] 发布后提交 `awesome-dsh-plugin` 收录 PR（新分类或 Sessions 分类）
