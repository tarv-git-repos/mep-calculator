import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/Button-BxVwVdnO.js
var import_jsx_runtime = require_jsx_runtime();
function TBtn({ children, primary, ...rest }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		...rest,
		className: `inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium border transition-colors cursor-pointer ${primary ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90" : "bg-background text-foreground border-border hover:bg-surface-2"} ${rest.className ?? ""}`,
		children
	});
}
//#endregion
export { TBtn as t };
