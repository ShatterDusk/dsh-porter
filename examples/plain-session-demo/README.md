# 明文会话演示（dsh-porter convert 产物）

本目录是 dsh-porter 的 convert --format plain 产物示例：一个合成的合规会话（明文格式 session.jsonl，dsh 按文件后缀识别压缩方式——源码确认支持，未实测）。

## 验证方法（闭合 SPEC 开放问题 #2）

1. 把本目录整个复制到 EAC 数据根的 sessions 下（如 C:\Users\1\.dsh\sessions\--F-PROJECTS--\plain-demo\）
2. 重启 EAC（或刷新会话列表）
3. 期望：会话列表中可见 session-test-* 会话，可打开、header 完整（cwd=F:\PROJECTS）

> 演示用合成数据（8 行），验证完可删除；正式会话建议保持 zstd。
