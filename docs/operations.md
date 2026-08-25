# 操作、授权与故障排查

## 日常流程

- 总览展示缓存状态，不持续轮询大型库存。
- 库存页选择资源类型后手动刷新，并显示快照时间。
- 合成、导入和导出先验证能力、限额与设备授权，再生成确认摘要。
- 浏览器确认后，命令进入单队列；成功或失败都写入审计。

“常用置顶”只改变展示顺序，不等于写权限。启用写入前应确认外围设备名称、用途和物理连接。

## 故障排查

- 代理离线：检查区块加载、HTTP 开关、域名允许列表和 `wss://.../agent/ws` 地址。
- `WebSocket disconnected without sending Close frame`：先查看 CC 终端的上一条错误。如果同时出现 `Cannot serialize table with repeated entries`，确认 Agent 已自动更新到 0.1.2 或更高版本并重启 CC 电脑；这不是 Cloudflare DNS 故障。
- 能力不可用：检查模组版本并运行 `peripheral.getMethods("外设名")`；不要伪造底层不支持的操作。
- 命令超时：Worker 最多等待 30 秒。重试前先核对 ME 与目标容器状态，避免重复转移。
- 撤销访问：轮换 Worker 的 `AGENT_TOKEN`，再更新 CC 电脑的 `mestatus.token`。
