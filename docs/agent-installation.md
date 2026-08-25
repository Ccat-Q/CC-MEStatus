# Lua 代理安装与恢复

## 前置条件

- NeoForge 1.21.1、CC:Tweaked、Applied Energistics 2、Advanced Peripherals。
- 一台常驻高级电脑，通过有线调制解调器连接 `me_bridge` 和目标外围设备。
- CC:Tweaked 服务器配置允许访问目标 HTTPS/WSS 域名。

## 安装

```lua
wget run https://你的域名/agent/install.lua https://你的域名/agent/manifest.json
```

输入 `wss://你的域名/agent/ws` 和 Worker 的 Agent Token。Token 使用隐藏输入并保存在电脑 settings 中。安装后重启电脑，代理会自动发现 ME Bridge 和外围设备。

安装器写入独立的 `/startup/mestatus.lua`，不会覆盖已有 `/startup.lua`。

## 更新与回退

代理启动时读取 stable 清单。版本变化后下载所有文件，校验大小和 SHA-256，再替换当前版本；旧文件保存在 `.bak` 中。下载、哈希或替换失败时不启用不完整版本。

若新版本无法启动，先暂停启动项，再把 `/mestatus/*.bak` 恢复为原文件名后重启。

## 兼容性与故障排查

Agent 0.1.1 起同时探测 Advanced Peripherals 1.21.1-0.7+ 的 `getItems/getFluids/getChemicals` 和旧版 `listItems/listFluid/listGas` 接口。如库存刷新报错 `Capability is not available in this mod combination`，先确认网页显示的 Agent 版本至少为 0.1.1，然后重启 CC 电脑以重新执行自动更新。

1.21.1 的新 ME Bridge 使用 `getStoredEnergy/getEnergyCapacity`，不提供旧版 `getCraftingCPUs` 时，网页会明确显示 CPU 列表不可用，不再伪装为 0。

Agent 0.1.2 起会在 JSON 编码前复制外围设备返回表：共享子表会展开为独立值，真正的循环引用会替换为 `<circular>`，异常深或过大的组件数据会标记为截断。该处理用于避免 `Cannot serialize table with repeated entries` 使 WebSocket 在未发送 Close frame 时中断，不改变库存名称、注册名或数量。

Agent 0.1.3 起库存刷新只上报网页需要的摘要字段，并按最多 200 项分页。该限制避免完整物品组件展开后触发 CC:Tweaked 的 `Message is too large`，写操作的注册名、数量、权限和限额不受影响。

## 模拟测试

将 `agent/tests/me_spec.lua` 上传到 `/mestatus/tests/me_spec.lua` 后运行。该测试同时验证新旧 ME Bridge 接口适配，但不证明目标模组服的实际流体/气体方法存在。
