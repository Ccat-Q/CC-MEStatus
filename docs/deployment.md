# Cloudflare 部署

## 创建资源

```powershell
npx wrangler login
Set-Location apps/worker
npx wrangler d1 create cc-mestatus
npx wrangler d1 migrations apply cc-mestatus --remote
npx wrangler secret put AGENT_TOKEN
```

将 D1 创建命令输出的 `database_id` 替换到 `wrangler.jsonc`。代理密钥应至少包含 32 个随机字符，不得写入仓库。可设置 `ACCESS_ALLOWED_EMAIL` 让 Worker 再检查唯一邮箱；生产环境必须保持 `DEV_BYPASS_ACCESS=false`。

## 域名与 Access

将专用子域名路由到 Worker。在 Cloudflare Zero Trust 创建 Self-hosted Application：

- 网页及 `/api/*`：仅允许你的登录身份。
- `/agent/ws`：绕过交互登录，由 Worker 的 Agent Token 验证。
- `/agent/*`：允许读取版本化安装文件；文件不含密钥。

不要为整个域名配置无条件 Bypass。应使用更具体的 Agent 路径规则，并用未登录浏览器验证 `/api/status` 无法访问。

## GitHub Actions

配置 `CLOUDFLARE_ACCOUNT_ID` 与最小权限的 `CLOUDFLARE_API_TOKEN`。`main` push 会先测试和构建，再应用 D1 迁移并部署。建议给 GitHub Environment `production` 配置人工审批。

## 发布验收

1. 未登录访问 `/api/status` 被 Access 拦截。
2. 错误 Agent Token 连接 `/agent/ws` 返回 401。
3. 正确代理上线后显示电脑 ID、版本和外围设备。
4. 新设备默认不可写。
5. 超限操作在生成确认令牌前被拒绝。

