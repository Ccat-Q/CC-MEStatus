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

## 模拟测试

将 `agent/tests/me_spec.lua` 上传到 `/mestatus/tests/me_spec.lua` 后运行。该测试只验证 Lua 适配层，不证明目标模组服的实际流体/气体方法存在。

