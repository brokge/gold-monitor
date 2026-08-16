# dsh-gold-monitor

将 [gold-monitor](../README.md)（黄金实时监控看板）打包为 DSH Web 插件：在侧边栏底部增加一个「◎」按钮，点击后弹出悬浮面板，以同源 iframe 承载完整看板页面（实时价格 / 汇率拆解 / 会话走势 / 提醒 / 历史走势全部可用，历史数据走宿主端代理，无需额外启动服务器）。

## 结构

```
plugin/
  package.json        # dsh.bundle.patch + dsh.client(platform: web)
  cordis.patch.yml    # loader 挂载行（insert）
  lib/index.js        # 宿主端：webServer 路由 /gold-monitor（静态 + /api/history 代理）
  lib/client.js       # 客户端：sidebar.footer.action 开关 + shell.overlay 悬浮面板
  public/index.html   # 看板页面副本（相对路径 ./api/history 在 /gold-monitor/ 下直接可用）
```

## 安装

```bash
# 在插件包目录的上一级（本目录）执行；dsh 与 pnpm 需在 PATH 中
dsh plugin --profile web add /Users/brokge/workspace/dsh/gold-monitor/plugin
```

该命令会 `pnpm add` 该本地包，并因包内声明了 `dsh.bundle.patch` 自动把
`dsh-gold-monitor` 追加到 profile 的 `dsh.profile.bundles` 栈中。
**重启 `dsh web` 后生效**（loader 挂载行在启动时读取）。

## 路由

| 路径 | 说明 |
| --- | --- |
| `/gold-monitor/` | 看板页面（302 从 `/gold-monitor` 重定向，保证 `./api/history` 相对路径正确） |
| `/gold-monitor/api/history?range=` | 历史数据代理（NBP 每日 / goldprice.dev 1月 / ECB 汇率折算人民币，含缓存） |

## 卸载

```bash
dsh plugin --profile web remove dsh-gold-monitor   # 之后重启 dsh web
```
