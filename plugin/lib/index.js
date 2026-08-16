// dsh-gold-monitor — host half
//
// Serves the gold-monitor dashboard same-origin on the dsh web server:
//   /gold-monitor/            the dashboard page (public/index.html)
//   /gold-monitor/api/history the NBP/goldprice.dev history proxy (with cache)
//
// The client half renders an overlay panel with an iframe to /gold-monitor/,
// so the page keeps its full functionality (canvas chart, notifications,
// alerts) with zero cross-origin issues.
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/* ---------- 历史数据代理（与独立 server.mjs 同源逻辑） ---------- */

const cache = new Map(); // key -> { at, data }
function cacheGet(key, ttlMs) {
  const c = cache.get(key);
  if (c && Date.now() - c.at < ttlMs) return c.data;
  return null;
}
function cacheSet(key, data) { cache.set(key, { at: Date.now(), data }); }

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

async function getJSON(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// NBP 单窗口拉取：周末/假日区间会 400，自动把开始日后移、结束日前收
async function nbpWindow(kind, start, end) {
  let s = new Date(start), e = new Date(end);
  for (let i = 0; i < 12; i++) {
    const path = kind === "gold"
      ? `https://api.nbp.pl/api/cenyzlota/${iso(s)}/${iso(e)}/?format=json`
      : `https://api.nbp.pl/api/exchangerates/rates/a/usd/${iso(s)}/${iso(e)}/?format=json`;
    try { return await getJSON(path); }
    catch { if (i < 6) s = addDays(s, 1); else e = addDays(e, -1); }
  }
  throw new Error("NBP window failed: " + kind);
}

// NBP 每日金价（PLN/克）÷ USD/PLN 汇率 → USD/盎司
async function nbpDaily(startDate, endDate) {
  const gold = [], fx = [];
  const windows = [];
  let s = new Date(startDate);
  const e = new Date(endDate);
  const win = 350; // NBP 单次请求最多 367 天
  while (s <= e) {
    const t = new Date(Math.min(s.getTime() + win * 86400000, e.getTime()));
    windows.push([new Date(s), new Date(t)]);
    s = new Date(t.getTime() + 86400000);
  }
  const CONC = 4;
  for (let i = 0; i < windows.length; i += CONC) {
    const chunk = windows.slice(i, i + CONC);
    const res = await Promise.all(chunk.map(([ws, we]) =>
      Promise.allSettled([nbpWindow("gold", ws, we), nbpWindow("fx", ws, we)])
    ));
    for (const [g, f] of res) {
      if (g.status === "fulfilled" && Array.isArray(g.value)) gold.push(...g.value);
      if (f.status === "fulfilled" && f.value && Array.isArray(f.value.rates)) fx.push(...f.value.rates);
    }
  }
  const fxMap = new Map(fx.map((r) => [r.effectiveDate, r.mid]));
  return gold
    .filter((g) => fxMap.has(g.data))
    .map((g) => ({
      t: g.data,
      close: Math.round(((g.cena * 31.1034768) / fxMap.get(g.data)) * 100) / 100,
    }))
    .sort((a, b) => (a.t < b.t ? -1 : 1));
}

// USD→CNY 历史日度参考汇率（ECB，经 frankfurter.dev），2013-01-02 起
const FX_START = "2013-01-02";
async function getFxRates() {
  const cached = cacheGet("fx:full", 6 * 3600 * 1000);
  if (cached) return cached;
  const j = await getJSON(
    `https://api.frankfurter.dev/v1/${FX_START}..${iso(new Date())}?base=USD&symbols=CNY`
  );
  const map = new Map();
  if (j && j.rates) for (const [d, r] of Object.entries(j.rates)) map.set(d, r.CNY);
  cacheSet("fx:full", map);
  return map;
}

// 给每个点附加人民币计价（元/克）；汇率缺失日顺延前值
function attachCny(points, fxMap) {
  let last = null;
  const out = [];
  for (const p of points) {
    const r = fxMap.get(p.t);
    if (r !== undefined) last = r;
    if (last !== null) {
      out.push({
        ...p,
        cnyGram: Math.round(((p.close * last) / 31.1034768) * 100) / 100,
      });
    } else {
      out.push(p);
    }
  }
  return out;
}

async function historyData(range) {
  const ttl = range === "1m" ? 10 * 60 * 1000 : 6 * 3600 * 1000;
  const cached = cacheGet("hist:" + range, ttl);
  if (cached) return cached;

  const today = new Date();
  let result;
  if (range === "1m") {
    // goldprice.dev 免费档仅开放近 1 个月历史
    const from = iso(addDays(today, -30)), to = iso(today);
    try {
      const j = await getJSON(
        `https://api.goldprice.dev/v1/bars?symbol=XAU-USD-SPOT&interval=1d&from=${from}&to=${to}&limit=40`
      );
      const bars = (j.bars || [])
        .map((b) => ({ t: b.bar_start.slice(0, 10), close: +b.close, high: +b.high, low: +b.low }))
        .sort((a, b) => (a.t < b.t ? -1 : 1));
      if (bars.length) result = { source: "goldprice.dev · 每日 OHLC", points: bars };
    } catch { /* 走 NBP 兜底 */ }
    if (!result) {
      const pts = await nbpDaily(addDays(today, -35), today);
      result = { source: "NBP 波兰央行 · 每日", points: pts };
    }
  } else {
    const days = { "6m": 180, "1y": 365, "5y": 1825, all: 0 }[range];
    const start = days ? addDays(today, -days) : new Date("2013-01-02");
    const pts = await nbpDaily(start, today);
    result = { source: "NBP 波兰央行 · 每日", points: pts };
  }

  // 附加人民币计价曲线（元/克）
  try {
    const fxMap = await getFxRates();
    result.points = attachCny(result.points, fxMap);
    result.fx = { source: "ECB 参考汇率（frankfurter.dev）", unit: "CNY per USD" };
  } catch { /* 汇率缺失时前端退化为仅美元曲线 */ }

  result.updated = iso(new Date());
  cacheSet("hist:" + range, result);
  return result;
}

/* ---------- HTTP 路由 ---------- */

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url ?? "/", "http://dsh.internal");
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === "/gold-monitor/api/history") {
      const range = url.searchParams.get("range") || "1y";
      const data = await historyData(range);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
      return;
    }

    let rel = pathname.slice("/gold-monitor".length); // "/gold-monitor/…" → "/…"
    if (rel === "" || rel === "/") {
      if (pathname !== "/gold-monitor/") {
        res.writeHead(302, { Location: "/gold-monitor/" });
        res.end();
        return;
      }
      rel = "/index.html";
    }

    const filePath = normalize(join(PUBLIC_ROOT, rel));
    if (!filePath.startsWith(PUBLIC_ROOT)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
}

export const name = "dsh-gold-monitor";

export const inject = ["webServer"];

export function apply(ctx) {
  const webServer = ctx.get("webServer");
  if (webServer === undefined) return;
  // register() 返回 disposer，交给 ctx.effect 管理生命周期
  ctx.effect(() => webServer.register({
    kind: "prefix",
    path: "/gold-monitor",
    handler: handleRequest,
  }), "dsh-gold-monitor: /gold-monitor routes");
}
