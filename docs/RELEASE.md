# dsh-porter 发布清单（RELEASE）

> 维护者使用。npm 账号已启用 2FA（auth-and-writes），每次 publish 需要 OTP。

## 发布新版本流程

### 1. 版本准备（沙箱/开发环境完成）

- [ ] SPEC.md 变更记录更新（版本号 + 变更）
- [ ] README.md 同步（功能/命令表/特性）
- [ ] package.json version bump（`npm version patch|minor|major` 或手改）
- [ ] `npm test` 全绿（20/20）
- [ ] `npm pack --dry-run` 确认包内容（files 字段生效、依赖排除）

### 2. 推送 GitHub

```bash
git add -A && git commit -m "chore: vX.Y.Z"
git push origin main
```

### 3. npm 发布（用户终端，交互式 OTP）

```powershell
cd F:\PROJECTS\NodeProjects\dsh-porter
npm publish
# 提示 One-time password 时输入认证器的 6 位码
```

> 若非交互环境 403（2FA 拦截），用显式 OTP：
> ```powershell
> npm publish --otp=123456   # 换成当前码（30 秒有效）
> ```

### 4. 发布后验证

```bash
npm view dsh-porter version          # 应显示新版本
npm install -g dsh-porter && dsh-porter --version   # 全局安装冒烟
```

### 5. 版本标签（可选）

```bash
git tag v0.2.0 && git push origin v0.2.0
```

## 2FA 长期优化（可选）

npm 账号设置 → Access Tokens → 创建 Granular Access Token（Read and write + **Bypass 2FA**）→
`npm publish` 无需 OTP（token 配在 ~/.npmrc 或 CI 环境变量）。
