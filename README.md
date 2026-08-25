# CC-MEStatus

面向单个 ME 网络的私有远程管理台。浏览器通过 Cloudflare 查看库存、能耗、合成 CPU 和设备，并可在授权、限额和二次确认保护下发起合成及导入/导出操作。

**在线入口：** [https://me.opencat.cc.cd](https://me.opencat.cc.cd) （Cloudflare Access 登录后访问）

## 架构与安全边界

```text
浏览器 ── HTTPS / Cloudflare Access ──▶ Worker + Durable Object ──▶ D1
                                              ▲
CC:Tweaked + ME Bridge ── WSS / Agent Token ──┘
```

- Minecraft 服务器不开放入站端口；Lua 代理主动建立出站 `wss://` 连接。
- 网页和 `/api/*` 只允许 Cloudflare Access 中配置的单一身份。
- `/agent/*` 用于安装和更新；`/agent/ws` 仍必须通过独立 `AGENT_TOKEN` 鉴权。Token 不保存在 Git 中。
- Durable Object 维护唯一代理连接并串行执行写命令；D1 保存授权、限额、审计和能力状态。

## 功能

- 按需加载 ME 库存、存储容量、能量、耗能和合成 CPU
- 发起合成请求并跟踪合成状态
- 自动发现有线网络外设，分别展示“可见”和“已授权”
- 物品、流体、气体能力运行时探测；不支持时明确降级，不伪造成功
- 写操作二次确认、设备/方向授权、默认限额与全量审计
- Lua stable 清单、SHA-256 校验、自动更新和上一版回退

## 游戏内安装

需要 NeoForge 1.21.1、Applied Energistics 2、CC:Tweaked、Advanced Peripherals，以及一台专用的有线 CC 电脑。先在 Cloudflare Worker 中设置一个高强度 Agent Token：

```powershell
Set-Location apps/worker
npx wrangler secret put AGENT_TOKEN
```

然后在 CC:Tweaked 电脑中运行：

```lua
wget run https://me.opencat.cc.cd/agent/install.lua https://me.opencat.cc.cd/agent/manifest.json
```

安装器会询问 WebSocket 地址和 Agent Token。输入与 Worker secret 完全相同的 Token。完整安装、恢复和 HTTP 白名单说明见 [游戏内安装](docs/agent-installation.md)。

## 本地开发

需要 Node.js 20+。

```powershell
npm install
Copy-Item apps/worker/.dev.vars.example apps/worker/.dev.vars
npm run build
```

启动 Worker：

```powershell
npm run dev
```

另开一个终端启动前端：

```powershell
npm run dev -w @cc-mestatus/web
```

打开 `http://localhost:5173`。Vite 会将 `/api` 代理到 `http://localhost:8787`。只在本地开发时可于 `.dev.vars` 设置 `DEV_BYPASS_ACCESS=true`；不要直接双击构建后的 `index.html`。

## 测试与构建

```powershell
npm test
npm run typecheck
npm run build
npx wrangler deploy --dry-run --config apps/worker/wrangler.jsonc
```

## Cloudflare 原生自动部署

当前 `wrangler.jsonc` 已绑定 `me.opencat.cc.cd`、Durable Object 和 D1。手动部署前请先设置 `AGENT_TOKEN`，再执行：

```powershell
npm run build
Set-Location apps/worker
npx wrangler d1 migrations apply cc-mestatus --remote
npm run deploy
```

GitHub Actions 只执行测试、类型检查与构建，不持有 Cloudflare 发布密钥。生产发布由 Cloudflare Workers Builds 在 `main` 推送时完成。

在 Cloudflare Dashboard 的 **Workers & Pages → cc-mestatus → Settings → Builds** 中完成一次连接：

- Git repository：`Ccat-Q/CC-MEStatus`
- Production branch：`main`
- Root directory：`/`
- Build command：`npm ci && npm run build`
- Deploy command：`npx wrangler deploy --config apps/worker/wrangler.jsonc`

连接时让 Cloudflare 创建和保管部署令牌；不要把 `CLOUDFLARE_API_TOKEN` 或 `CLOUDFLARE_ACCOUNT_ID` 放回 GitHub Secrets。D1 架构变更仍须在发布前由管理员显式执行远程迁移，以免自动部署意外修改数据。

详见 [Cloudflare 部署](docs/deployment.md)、[架构与信任边界](docs/architecture.md) 和 [运维指南](docs/operations.md)。

## 验证边界

TypeScript 测试覆盖协议校验、权限/限额、队列、审计和能力降级；构建与 Wrangler dry-run 验证可部署产物。Lua 模拟测试需在 CC:Tweaked 中执行 `/mestatus/tests/me_spec.lua`。真实 NeoForge 1.21.1、ME Bridge 及流体/气体兼容性仍必须在目标模组服验收；CI 通过不等于游戏内互操作已验证。

## License

[MIT](LICENSE)

