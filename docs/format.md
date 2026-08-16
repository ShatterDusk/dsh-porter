# DSH 会话格式文档（reverse-engineered，2026-08-16）

> 来源：源码阅读（deepseek-harness session-persistence-jsonl）+ 实测验证（帧扫描/解码/重写/append）。
> 用途：dsh-porter 工具实现的依据；生态内首个公开的会话格式文档。

## 1. 文件布局

```
<DSH_HOME>/sessions/<projectKey>/<sessionId>/session.jsonl[.zstd]
```

| 部分 | 规则 |
|---|---|
| `projectKey` | cwd 的目录名编码：分隔符(`/` `\` `:`) → `-`，连续分隔符合并，特殊字符 `~XXXX` 转义，前缀 `--` 后缀 `--`；`F:\PROJECTS` → `--F-PROJECTS--`，`/mnt/f/PROJECTS` → `--mnt-f-PROJECTS--` |
| `sessionId` | `session-` + UUID（格式校验要求 UUID） |
| 文件后缀 | `.jsonl.zstd`（压缩）/ `.jsonl`（明文），dsh 按后缀识别压缩方式 |

## 2. 文件结构：多帧 zstd

- 会话文件 = **多个 zstd frame 顺序拼接**（实测：5.4MB 文件含 14519 帧 / 18884 行，平均每帧 1.3 行——事件按批打包成帧）
- **第一帧必须恰好是一行 header**（dsh 启动扫描时 `assertZstdHeaderFrame` 强制校验，违规导致整个 dsh web 拒绝启动）
- **追加语义**：新事件 = 在文件末尾 append 新帧（不修改旧帧）——append-only 设计
- **torn tail**：尾部不完整帧 → dsh 容忍并截断修复（commitRepair 语义），不拒绝加载

## 3. 压缩细节

- 标准 zstd（魔数 `28 B5 2F FD`）——**非私有格式**（外部工具可解）
- 帧**无 content size 字段**（流式写，未知大小）——`ZSTD_getFrameContentSize` 返回 UNKNOWN；解码需支持流式/未知大小的实现（fzstd 实测可用；zstd-wasm/zstddec 实测失败）
- 压缩级别：默认 3 级可互操作

## 4. Header 行（第一行，JSON）

```json
{ "type": "session", "version": 0, "id": "session-<uuid>", "createdAt": 1786803186537,
  "cwd": "/mnt/f/PROJECTS", "delegationDepth": 0 }
```

| 字段 | 说明 |
|---|---|
| `type` | 恒为 `session` |
| `version` | 格式版本（实测当前为 0；不匹配时 dsh 拒绝读取并提示升级） |
| `id` | 会话 id（session- + UUID） |
| `createdAt` | 创建时间戳（ms） |
| `cwd` | 可选；会话工作目录（决定 projectKey 分组） |
| `parentSession` | 可选；子代理会话的父会话 id |
| `delegationDepth` | 委派深度（默认 0） |
| `agentPreset` | 可选；agent 预设 |

## 5. 事件行（后续行，JSONL）

- 每行一个 JSON 记录（或 packChunks 打包的存储行：`text-chunks` / `reasoning-chunks` / `tool-call-chunks`）
- 事件类型：`user/message`、`assistant/message`、`tool/result`、`turn/start`、`turn/end` 等
- **seq 连续性**：每个事件带 `seq` 序号（从 0 连续），dsh 校验缺口（损坏检测）
- 追加时新事件 seq 递增

## 6. 兼容约束（工具实现必读）

1. **禁止整体单帧重压**——第一帧必须恰一行 header（事故教训：单帧 18702 行导致 dsh 崩溃）
2. id 必须 UUID 格式
3. version 保持源值（不擅自改）
4. 重写格式：frame1 = header 行（恰一行）；frame2..N = 事件行（帧粒度不影响 dsh 读取——扫描器按行切分，帧边界不敏感）
5. 迁移产物可安全继续 append（实测 PASS）
6. cwd 转化后必须同步移动目录（projectKey 由 cwd 决定）
