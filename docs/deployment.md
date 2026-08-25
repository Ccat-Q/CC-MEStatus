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

## Cloudflare Workers Builds

Cloudflare 原生管理生产部署；GitHub Actions 仅作持续验证，绝不保存 Cloudflare 发布凭据。

在 **Workers & Pages → cc-mestatus → Settings → Builds** 中连接 `Ccat-Q/CC-MEStatus`，并配置：

- Production branch：`main`
- Root directory：`/`
- Build command：`npm ci && npm run build`
- Deploy command：`npx wrangler deploy --config apps/worker/wrangler.jsonc`
- Preview deploy command：`npx wrangler versions upload --config apps/worker/wrangler.jsonc`

Worker 名称必须继续是 `cc-mestatus`，且与 `apps/worker/wrangler.jsonc` 中的 `name` 完全一致。选择由 Cloudflare 创建并管理的部署令牌，不要使用 GitHub Secret。

**D1 迁移边界：** Workers Builds 不自动执行 D1 migration。每次有 `apps/worker/migrations/` 变动时，先在受控终端执行 `npx wrangler d1 migrations apply cc-mestatus --remote --config apps/worker/wrangler.jsonc`，确认成功后再推送 `main`。

## 发布验收

1. 未登录访问 `/api/status` 被 Access 拦截。
2. 错误 Agent Token 连接 `/agent/ws` 返回 401。
3. 正确代理上线后显示电脑 ID、版本和外围设备。
4. 新设备默认不可写。
5. 超限操作在生成确认令牌前被拒绝。

