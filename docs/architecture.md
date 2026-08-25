# 架构与信任边界

## 数据流

```text
浏览器 -- Cloudflare Access --> Worker/API --> Durable Object
                                               |
                                               | wss + Agent Token
                                               v
                                CC:Tweaked Lua Agent --> ME Bridge
```

CC:Tweaked 只建立出站 WebSocket，Minecraft 服务器不开放控制端口。Durable Object 固定使用名为 `primary` 的单实例，确保同一时间只有一个游戏代理连接，并把所有状态变更命令放入单队列。

库存读取使用摘要分页协议：Worker 传递非负 `offset` 和 1–200 的 `limit`，Lua 代理只返回注册名、显示名、数量、合成状态和稳定指纹等必要字段，同时返回 `total/offset/limit/hasMore`。详细组件不会跨 WebSocket 上报。

## 信任边界

- Cloudflare Access 保护网页和 `/api/*`，并将已认证邮箱传给 Worker。
- `/agent/ws` 不使用浏览器身份，而使用至少 32 个随机字符的独立密钥。
- `/agent/*` 中的安装文件可公开读取，不包含凭据。代理代码通过 HTTPS 获取并使用清单中的 SHA-256 校验。
- 发现设备不授予写权限。导入和导出只允许 D1 中显式启用的设备。
- 写操作分两阶段：准备接口生成 60 秒有效的一次性令牌，浏览器再次确认后执行。令牌过期或重复使用均被拒绝。
- 全局默认上限为 64 件物品、1,000 mB 流体和 1,000 mB 气体；设备策略可覆盖。

## 能力降级

不同 Advanced Peripherals/附属模组暴露的方法可能不同。Lua 代理通过 `peripheral.getMethods` 构建能力表。代理执行时会再次检查方法。底层不存在流体或气体转移方法时返回明确错误，不模拟成功。

