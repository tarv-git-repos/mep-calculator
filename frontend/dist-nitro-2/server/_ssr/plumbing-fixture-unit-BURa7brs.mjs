import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/plumbing-fixture-unit-BURa7brs.js
var $$splitComponentImporter = () => import("./plumbing-fixture-unit-DZERvTb5.mjs");
var Route = createFileRoute("/plumbing-fixture-unit")({
	head: () => ({ meta: [{ title: "Fixture Unit Calculator — MEP Calc" }, {
		name: "description",
		content: "Water Supply Fixture Units (WSFU) sizing tool using Hunter's Curve Method."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var IP_FIXTURE_UNITS = {
	wc: {
		low: 1,
		med: 2,
		high: 5,
		"ipc-cold": 5,
		"ipc-hot": 5,
		"ipc-total": 5
	},
	urinal: {
		low: 1,
		med: 1,
		high: 1,
		"ipc-cold": 3,
		"ipc-hot": 3,
		"ipc-total": 3
	},
	basin: {
		low: 1,
		med: 2,
		high: 4,
		"ipc-cold": 1.5,
		"ipc-hot": 1.5,
		"ipc-total": 2
	},
	bidet: {
		low: 1,
		med: 1,
		high: 1,
		"ipc-cold": 1.5,
		"ipc-hot": 1.5,
		"ipc-total": 2
	},
	handspray: {
		low: 1,
		med: 1,
		high: 1,
		"ipc-cold": 1,
		"ipc-hot": 1,
		"ipc-total": 1.4
	},
	bath: {
		low: 4,
		med: 8,
		high: 16,
		"ipc-cold": 1,
		"ipc-hot": 1,
		"ipc-total": 1.4
	},
	shower: {
		low: 2,
		med: 3,
		high: 6,
		"ipc-cold": 3,
		"ipc-hot": 3,
		"ipc-total": 4
	},
	sink: {
		low: 2,
		med: 5,
		high: 10,
		"ipc-cold": 2.25,
		"ipc-hot": 2.25,
		"ipc-total": 3
	},
	bibtap: {
		low: 1,
		med: 1,
		high: 1,
		"ipc-cold": 1,
		"ipc-hot": 1,
		"ipc-total": 1.4
	},
	washingmachine: {
		low: 2,
		med: 2,
		high: 2,
		"ipc-cold": 1,
		"ipc-hot": 1,
		"ipc-total": 1.4
	},
	dishwasher: {
		low: 2,
		med: 2,
		high: 2,
		"ipc-cold": 1.4,
		"ipc-hot": 1.4,
		"ipc-total": 1.4
	}
};
var FU_FIXTURES_META = [
	{
		id: "wc",
		short: "WC"
	},
	{
		id: "urinal",
		short: "Urinal"
	},
	{
		id: "basin",
		short: "Basin"
	},
	{
		id: "bidet",
		short: "Bidet"
	},
	{
		id: "handspray",
		short: "Spray"
	},
	{
		id: "bath",
		short: "Bath"
	},
	{
		id: "shower",
		short: "Shower"
	},
	{
		id: "sink",
		short: "Sink"
	},
	{
		id: "bibtap",
		short: "BibTap"
	},
	{
		id: "washingmachine",
		short: "Washer"
	},
	{
		id: "dishwasher",
		short: "Dishwasher"
	}
];
//#endregion
export { IP_FIXTURE_UNITS as n, Route as r, FU_FIXTURES_META as t };
