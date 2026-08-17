import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calculators-BIIcXCuh.js
var $$splitComponentImporter = () => import("./calculators-B1tKCh6q.mjs");
var Route = createFileRoute("/calculators")({
	validateSearch: (search) => {
		return { name: typeof search.name === "string" ? search.name : "Cooling Load" };
	},
	head: (ctx) => ({ meta: [{ title: `${ctx?.search?.name || "Calculator"} — MEP Calc` }, {
		name: "description",
		content: "Interactive engineering calculator with real-time updates."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
