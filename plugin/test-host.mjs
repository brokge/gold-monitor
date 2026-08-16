// Isolated host-half test: mock ctx.webServer, run apply(), then drive the
// registered route handler with fake req/res.
import { apply, name } from "./lib/index.js";

let registered = null;
const ctx = {
  get: (k) => (k === "webServer" ? fakeWebServer : undefined),
  effect: (fn) => {
    fn(); // register the effect; keep its disposer for real teardown
    return () => {};
  },
};
const fakeWebServer = {
  register: (route) => {
    registered = route;
    return () => { registered = null; };
  },
};

apply(ctx);
if (registered === null) throw new Error("route not registered");
if (registered.kind !== "prefix" || registered.path !== "/gold-monitor") {
  throw new Error("unexpected route: " + JSON.stringify(registered));
}
console.log("route registered:", registered.kind, registered.path);

function call(path, query = "") {
  return new Promise((resolve, reject) => {
    const res = {
      writeHead(status, headers) { this._status = status; this._headers = headers || {}; },
      end(body) { resolve({ status: this._status, headers: this._headers, body: body || "" }); },
    };
    const req = { url: path + (query ? "?" + query : "") };
    registered.handler(req, res).catch(reject);
  });
}

// 1. redirect /gold-monitor -> /gold-monitor/
const r1 = await call("/gold-monitor");
if (r1.status !== 302 || r1.headers.Location !== "/gold-monitor/") {
  throw new Error("redirect failed: " + JSON.stringify(r1));
}
console.log("redirect OK");

// 2. index served
const r2 = await call("/gold-monitor/");
if (r2.status !== 200 || !String(r2.body).includes("黄金实时监控")) {
  throw new Error("index failed: " + r2.status);
}
console.log("index OK");

// 3. traversal blocked (URL parser collapses .. and %2e%2e dot segments, so
//    exercise the post-decode path: %2f decodes to "/" after parsing)
const r3 = await call("/gold-monitor/..%2f..%2fetc/passwd");
if (r3.status !== 403 && r3.status !== 404) {
  throw new Error("traversal guard failed: " + r3.status);
}
console.log("traversal guard OK (" + r3.status + ")");

// 4. 404 unknown file
const r4 = await call("/gold-monitor/nope.txt");
if (r4.status !== 404) throw new Error("404 failed: " + r4.status);
console.log("404 OK");

// 5. live history proxy (1m — goldprice.dev, fastest path)
console.log("history proxy 1m (network)…");
const r5 = await call("/gold-monitor/api/history", "range=1m");
if (r5.status !== 200) throw new Error("history failed: " + r5.status);
const data = JSON.parse(r5.body);
if (!Array.isArray(data.points) || data.points.length === 0) throw new Error("history empty");
console.log("history OK —", data.points.length, "points, source:", data.source);

console.log("\nALL HOST TESTS PASSED");
