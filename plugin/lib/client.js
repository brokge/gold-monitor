// dsh-gold-monitor — client half (browser bundle)
//
// Registers two pieces of UI:
//   - sidebar.footer.action (list slot): a gold "◎" toggle button
//   - shell.overlay (list slot): a floating panel hosting the gold-monitor
//     dashboard in a same-origin iframe served by the host half at /gold-monitor/
//
// This file is a plain JS bundle in the client module format:
//   window.__ModuleLoader__.load({ id, factory })
// The factory is materialized lazily; it receives a synchronous `require`
// that resolves shell-provided modules (react, …). No build step is needed —
// the web shell serves this file verbatim as the package's ./client export.
window.__ModuleLoader__.load({
	id: "dsh-gold-monitor",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");

		// ---- styles ------------------------------------------------------
		var CSS_TAG = "dsh-gold-monitor/styles";
		if (typeof document !== "undefined" &&
			document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG) + "]") === null) {
			var tag = document.createElement("style");
			tag.setAttribute("data-plugin-css", CSS_TAG);
			tag.textContent = [
				/* 侧边栏底部按钮 */
				".dsh-gold-toggle{",
				"  display:inline-flex;align-items:center;justify-content:center;",
				"  width:28px;height:28px;border-radius:8px;border:1px solid transparent;",
				"  background:transparent;color:var(--dsw-alias-label-secondary,#8b94a7);",
				"  cursor:pointer;font-size:15px;line-height:1;padding:0;",
				"  transition:background .15s ease,color .15s ease,border-color .15s ease;",
				"}",
				".dsh-gold-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));color:var(--dsw-alias-label-primary,#e8ecf4);}",
				".dsh-gold-toggle--active{color:#e8b64c;border-color:rgba(232,182,76,.35);background:rgba(232,182,76,.10);}",
				/* 悬浮面板 */
				".dsh-gold-panel{",
				"  position:absolute;top:16px;right:16px;",
				"  width:min(1120px,calc(100vw - 32px));height:calc(100vh - 32px);",
				"  display:flex;flex-direction:column;overflow:hidden;",
				"  background:var(--dsw-alias-bg-overlay,#12161f);",
				"  border:1px solid var(--dsw-alias-border-l2,#232a3a);border-radius:12px;",
				"  box-shadow:0 18px 60px rgba(0,0,0,.45);",
				"}",
				".dsh-gold-panel-bar{",
				"  display:flex;align-items:center;gap:10px;flex:none;",
				"  padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,#232a3a);",
				"  background:var(--dsw-alias-bg-layer-1,#171c28);",
				"}",
				".dsh-gold-panel-title{",
				"  flex:1;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#e8ecf4);",
				"  letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;",
				"}",
				".dsh-gold-panel-title b{color:#e8b64c;font-weight:700;}",
				".dsh-gold-panel-link{",
				"  flex:none;font-size:12px;color:var(--dsw-alias-label-secondary,#8b94a7);",
				"  text-decoration:none;padding:3px 8px;border-radius:6px;",
				"  border:1px solid var(--dsw-alias-border-l1,#232a3a);",
				"  transition:color .15s ease,border-color .15s ease;",
				"}",
				".dsh-gold-panel-link:hover{color:#e8b64c;border-color:rgba(232,182,76,.4);}",
				".dsh-gold-panel-close{",
				"  flex:none;width:26px;height:26px;border-radius:7px;border:none;",
				"  background:transparent;color:var(--dsw-alias-label-secondary,#8b94a7);",
				"  font-size:17px;line-height:1;cursor:pointer;padding:0;",
				"  transition:background .15s ease,color .15s ease;",
				"}",
				".dsh-gold-panel-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#e8ecf4);}",
				".dsh-gold-frame{flex:1;width:100%;border:none;background:#0b0e13;}",
			].join("");
			document.head.append(tag);
		}

		// ---- 开合状态（模块级共享，跨两个插槽注册） ------------------------
		var listeners = new Set();
		var open = false;
		var store = {
			getOpen: function () { return open; },
			setOpen: function (v) {
				if (open === v) return;
				open = v;
				listeners.forEach(function (l) { l(); });
			},
			subscribe: function (l) {
				listeners.add(l);
				return function () { listeners.delete(l); };
			},
		};

		function useOpen() {
			return react.useSyncExternalStore(store.subscribe, store.getOpen);
		}

		// ---- 侧边栏底部开关按钮 ------------------------------------------
		function GoldMonitorToggle() {
			var isOpen = useOpen();
			return react.createElement(
				"button",
				{
					className: "dsh-gold-toggle" + (isOpen ? " dsh-gold-toggle--active" : ""),
					title: "黄金实时监控 · Gold Live Monitor" + (isOpen ? "（点击关闭）" : ""),
					"aria-label": "黄金实时监控",
					"aria-pressed": isOpen,
					onClick: function () { store.setOpen(!isOpen); },
				},
				"\u25ce"
			);
		}

		// ---- 悬浮面板（iframe 承载完整看板页） -----------------------------
		function GoldMonitorPanel() {
			var isOpen = useOpen();
			if (!isOpen) return null;
			return react.createElement(
				"div",
				{ className: "dsh-gold-panel" },
				react.createElement(
					"div",
					{ className: "dsh-gold-panel-bar" },
					react.createElement(
						"span",
						{ className: "dsh-gold-panel-title" },
						"\u9ec4\u91d1\u5b9e\u65f6\u76d1\u63a7 ",
						react.createElement("b", null, "Gold Live Monitor")
					),
					react.createElement(
						"a",
						{ className: "dsh-gold-panel-link", href: "/gold-monitor/", target: "_blank", rel: "noopener noreferrer" },
						"\u65b0\u7a97\u53e3\u6253\u5f00"
					),
					react.createElement(
						"button",
						{ className: "dsh-gold-panel-close", title: "关闭", "aria-label": "关闭", onClick: function () { store.setOpen(false); } },
						"\u00d7"
					)
				),
				react.createElement("iframe", {
					className: "dsh-gold-frame",
					src: "/gold-monitor/",
					title: "黄金实时监控 · Gold Live Monitor",
				})
			);
		}

		// ---- 插件主体 ------------------------------------------------------
		var inject = ["slots"];

		function apply(ctx) {
			ctx.slots.inject("sidebar.footer.action", function () {
				return ctx.slots.register(
					{ name: "sidebar.footer.action", id: "gold-monitor", label: function () { return "\u9ec4\u91d1\u76d1\u63a7"; } },
					GoldMonitorToggle
				);
			});
			ctx.slots.inject("shell.overlay", function () {
				return ctx.slots.register(
					{ name: "shell.overlay", id: "gold-monitor" },
					GoldMonitorPanel
				);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
