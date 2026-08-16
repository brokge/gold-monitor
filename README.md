# 黄金实时监控 · Gold Live Monitor

[![License](https://img.shields.io/badge/license-MIT-blue)](#license)
[![Platform](https://img.shields.io/badge/platform-Web%20%7C%20DSH%20Plugin-0b0e13)](#-作为-dsh-web-插件使用)
[![Language](https://img.shields.io/badge/language-HTML%20%2F%20JS%20%2F%20Node.js-e8b64c)](#)

![Gold Live Monitor preview](preview.jpg)

国际现货黄金（XAU/USD）与人民币折算价格（元/克）的实时监控看板。
单文件页面即可运行，同时内置 DSH Web 插件（`dsh-gold-monitor`），可嵌入 DeepSeek Harness 的浏览器界面。


## 功能特性

- **实时价格**：XAU/USD（美元/盎司）+ XAU/CNY 折合人民币（元/克），数据源 `api.gold-api.com`（免费，约 20 秒缓存）
- **汇率面板**：实时 USD/CNY 汇率 + 会话汇率迷你走势 + **汇率影响拆分**（人民币计价涨跌 ≈ 美元金价涨跌 × 汇率涨跌）
- **自动刷新**：默认 20 秒，可在 10 / 20 / 30 / 60 秒间切换；支持暂停 / 继续 / 手动刷新
- **会话走势图**：Canvas 绘制的本次会话价格曲线，含网格、区间、末点标注
- **会话统计**：本次会话开盘 / 最高 / 最低价、数据滞后检测
- **价格提醒**：设置"高于 / 低于"阈值（美元/盎司），突破时弹出浏览器系统通知 + 页内横幅 + 提示音
- **历史走势**：1 月 / 6 月 / 1 年 / 5 年 / 全部五档时间范围，**双曲线叠加**（金色 = 美元/盎司，蓝色 = 人民币/克，可勾选显隐，双 Y 轴刻度）

## 快速开始

### 方式一：直接打开文件

双击 `index.html` 用浏览器打开即可。实时价格与长期历史走免费跨域源，无需服务器；
历史图表会降级为 freegoldapi 静态数据（更新至 2026-02-20，月度 / 日度混合）。

### 方式二：本地服务器（推荐，历史数据最全最新）

```bash
node server.mjs              # 默认端口 5177，也可 node server.mjs <port> 指定
# 然后访问 http://127.0.0.1:5177/
```

## 作为 DSH Web 插件使用

`plugin/` 是一个可直接安装到 DSH Web profile 的 Cordis 插件包（`dsh-gold-monitor`）：
侧边栏底部出现「◎」按钮，点击弹出悬浮面板，以同源 iframe 承载完整看板；
历史数据走宿主端代理（NBP / goldprice.dev + 缓存），无需单独启动 `server.mjs`。

```bash
dsh plugin --profile web add /path/to/gold-monitor/plugin   # 安装（自动追加到 bundles 层）
# 重启 dsh web 后生效
```

| 路由 | 说明 |
| --- | --- |
| `/gold-monitor/` | 看板页面（自 `/gold-monitor` 302 重定向，保证相对路径正确） |
| `/gold-monitor/api/history?range=` | 历史数据代理（NBP 每日 / goldprice.dev 1 月 / ECB 汇率折算人民币，含缓存） |

卸载：`dsh plugin --profile web remove dsh-gold-monitor`，然后重启 `dsh web`。
更多细节见 [`plugin/README.md`](plugin/README.md)。

## 历史数据与汇率

| 档位 | 数据源 |
| --- | --- |
| 1 月 | goldprice.dev 每日 OHLC（含最高 / 最低） |
| 6 月 / 1 年 / 5 年 / 全部 | NBP 波兰央行每日金价（PLN/克），按当日 USD/PLN 汇率折算为美元/盎司，可回溯至 2013 年 |
| 人民币/克曲线 | 按当日 USD/CNY 参考汇率（ECB，frankfurter.dev）折算 |
| 无服务器时 | 降级为 freegoldapi.com 静态数据（跨域直连，仅美元曲线） |

- 换算关系：1 盎司 = 31.1034768 克
- 服务器端缓存：1 月档 10 分钟、其余档 6 小时；浏览器每 10 分钟静默刷新一次
- 汇率说明：实时面板用 gold-api 内置汇率（与页面人民币价同源自洽）；历史曲线用 ECB 参考汇率，两者略有差异属正常

## 目录结构

```
gold-monitor/
├── index.html          # 看板页面（单文件，内联样式与脚本）
├── server.mjs          # 可选本地服务器 + 历史数据代理（默认端口 5177）
├── preview.jpg         # 界面预览截图（1440×900）
└── plugin/             # DSH Web 插件（dsh-gold-monitor）
    ├── lib/index.js      # 宿主端：/gold-monitor 路由（静态页面 + 历史代理）
    ├── lib/client.js     # 客户端：侧边栏「◎」开关 + 悬浮面板（iframe）
    ├── public/index.html # 看板页面副本（相对路径 ./api/history 直接可用）
    └── cordis.patch.yml  # loader 挂载行
```

## 开发与测试

插件宿主端逻辑（路由、历史代理、缓存）可用 Node 直接测试：

```bash
cd plugin && node test-host.mjs
```

## 注意事项

- 所有数据保存在浏览器内存中，刷新页面后会话曲线从零开始
- 实时数据源：<https://api.gold-api.com>
- 历史数据源：<https://api.nbp.pl>、<https://goldprice.dev>、<https://freegoldapi.com>
- 汇率数据源：<https://frankfurter.dev>（ECB 参考汇率）

## License

[MIT](LICENSE) © 2026 brokge
