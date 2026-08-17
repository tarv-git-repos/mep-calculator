import { o as __toESM, r as __exportAll } from "../_runtime.mjs";
import { n as api, t as __exportAll$1 } from "./api-BcQvT-mW.mjs";
import { t as supabase } from "./supabase-CCCDNKe9.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/workspace-store-Ct3ePlL1.js
var workspace_store_Ct3ePlL1_exports = /* @__PURE__ */ __exportAll({
	a: () => logCalculatorUpdate,
	c: () => predictSpacePressure,
	d: () => getOccupancyCategories,
	f: () => getOccupancyData,
	i: () => getCalculatorTitleFromPath,
	l: () => calculateVentilation,
	n: () => workspaceStore,
	o: () => logCalculatorView,
	r: () => workspace_store_exports,
	s: () => predictOccupancyCategory,
	t: () => useWorkspace,
	u: () => getCategoryDisplayName
});
var import_react = /* @__PURE__ */ __toESM(require_react());
var ASHRAE_OCCUPANCY_DATA = [
	{
		category: "EX. Arenas",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 2.5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Art classroom",
		peopleOA: 5,
		areaOA: .9,
		defaultDensity: 20,
		exhaustPerUnit: 0,
		exhaustPerArea: 3.5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Auditorium seating area",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 150,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Auto repair rooms",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 150,
		exhaustPerUnit: 0,
		exhaustPerArea: 7.5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Bank vault / safe deposit",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 5,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Banks or bank lobbies",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 15,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Barbershop",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 2.5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Barracks sleeping areas",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 20,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Bars / cocktail lounges",
		peopleOA: 3.8,
		areaOA: .9,
		defaultDensity: 100,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Beauty and nail salon",
		peopleOA: 10,
		areaOA: .6,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 3,
		ach: 0,
		airClass: 2
	},
	{
		category: "Bedroom",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 10,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Living room",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 10,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Booking / waiting",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 50,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Bowling alley (seating)",
		peopleOA: 5,
		areaOA: .6,
		defaultDensity: 40,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Break rooms (general)",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Breakrooms (office buildings)",
		peopleOA: 2.5,
		areaOA: .6,
		defaultDensity: 50,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Cafeteria / fast food dining",
		peopleOA: 3.8,
		areaOA: .9,
		defaultDensity: 100,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Cell",
		peopleOA: 2.5,
		areaOA: .6,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Cell with toilet",
		peopleOA: 2.5,
		areaOA: .6,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Classrooms (age 9 plus)",
		peopleOA: 5,
		areaOA: .6,
		defaultDensity: 35,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Classrooms (ages 5-8)",
		peopleOA: 5,
		areaOA: .6,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Coffee stations",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 20,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Coin-operated laundries",
		peopleOA: 3.8,
		areaOA: .6,
		defaultDensity: 20,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Elevator",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 555.5,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Computer (not printing)",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 4,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Computer lab",
		peopleOA: 5,
		areaOA: .6,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Conference / meeting",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 50,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "EX. Copy, printing rooms",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 2.5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Corridors",
		peopleOA: 0,
		areaOA: .3,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Courtrooms",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 70,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "EX. Chemical storage rooms",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 7.5,
		ach: 0,
		airClass: 4
	},
	{
		category: "EX. Darkrooms",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Day room",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 30,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Daycare (through age 4)",
		peopleOA: 5,
		areaOA: .9,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Daycare sickroom",
		peopleOA: 5,
		areaOA: .9,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 3
	},
	{
		category: "Disco / dance floors",
		peopleOA: 10,
		areaOA: .3,
		defaultDensity: 100,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Dwelling unit",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Electrical equipment rooms",
		peopleOA: 0,
		areaOA: .3,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Elevator machine rooms",
		peopleOA: 0,
		areaOA: .6,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Freezer and refrigerated spaces <50 deg F",
		peopleOA: 5,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 3
	},
	{
		category: "Gambling casinos",
		peopleOA: 3.8,
		areaOA: .9,
		defaultDensity: 120,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Game arcades",
		peopleOA: 3.8,
		areaOA: .9,
		defaultDensity: 20,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "General manufacturing",
		peopleOA: 5,
		areaOA: .9,
		defaultDensity: 7,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Guard stations",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 15,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Gym, sports arena (play area)",
		peopleOA: 10,
		areaOA: .9,
		defaultDensity: 7,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Health club / aerobics",
		peopleOA: 10,
		areaOA: .3,
		defaultDensity: 40,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Health club / weight",
		peopleOA: 10,
		areaOA: .3,
		defaultDensity: 10,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "EX. Janitor closets, trash rooms, recycling",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 5,
		ach: 0,
		airClass: 3
	},
	{
		category: "Kitchenettes",
		peopleOA: 3.8,
		areaOA: .6,
		defaultDensity: 20,
		exhaustPerUnit: 0,
		exhaustPerArea: 1.5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Kitchen - Commercial",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 20,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 60,
		airClass: 2
	},
	{
		category: "Kitchen - Residential",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 20,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 5,
		airClass: 2
	},
	{
		category: "Laundry rooms - dwelling units",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 1.5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Laundry rooms - public",
		peopleOA: 2.5,
		areaOA: .6,
		defaultDensity: 10,
		exhaustPerUnit: 0,
		exhaustPerArea: 1.5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Lecture classroom",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 65,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Lecture hall (fixed seats)",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 150,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Legislative chambers",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 50,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Libraries",
		peopleOA: 2.5,
		areaOA: .6,
		defaultDensity: 10,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Lobbies",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 150,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Lobbies / prefunction",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 30,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "EX. Locker rooms",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 1.25,
		ach: 0,
		airClass: 2
	},
	{
		category: "Main entry lobbies",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 10,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Mall common areas",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 40,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Media center",
		peopleOA: 5,
		areaOA: .6,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Multi-purpose assembly",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 120,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Multi-use assembly",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 100,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Museums (children's)",
		peopleOA: 3.8,
		areaOA: .6,
		defaultDensity: 40,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Museums / galleries",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 40,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Music / theater/ dance",
		peopleOA: 5,
		areaOA: .3,
		defaultDensity: 35,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Occupiable storage rooms for dry materials",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 2,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Occupiable storage rooms for liquids or gels",
		peopleOA: 2.5,
		areaOA: .6,
		defaultDensity: 2,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Office space",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 5,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Ex. Parking garages",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 3.7,
		ach: 0,
		airClass: 2
	},
	{
		category: "Pet shops (animal areas)",
		peopleOA: 3.8,
		areaOA: .9,
		defaultDensity: 10,
		exhaustPerUnit: 0,
		exhaustPerArea: 4.5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Pharmacy (prep, area)",
		peopleOA: 2.5,
		areaOA: .9,
		defaultDensity: 10,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Photo studios",
		peopleOA: 2.5,
		areaOA: .6,
		defaultDensity: 10,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Places of religious worship",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 120,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Reception areas",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 30,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Restaurant dining rooms",
		peopleOA: 3.8,
		areaOA: .9,
		defaultDensity: 70,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Sales",
		peopleOA: 3.8,
		areaOA: .6,
		defaultDensity: 15,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Science laboratories",
		peopleOA: 5,
		areaOA: .9,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 5,
		ach: 0,
		airClass: 2
	},
	{
		category: "Shipping / receiving",
		peopleOA: 5,
		areaOA: .6,
		defaultDensity: 2,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "EX. Shower rooms (continuous)",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 10,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "EX. Shower rooms (discontinuous)",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 25,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "EX. Soiled laundry storage rooms",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 5,
		ach: 0,
		airClass: 3
	},
	{
		category: "Sorting, packing, light assembly",
		peopleOA: 3.8,
		areaOA: .6,
		defaultDensity: 7,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Spectator areas",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 150,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Sports arena (play area)",
		peopleOA: 0,
		areaOA: 1.5,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Stages, studios",
		peopleOA: 5,
		areaOA: .3,
		defaultDensity: 70,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Storage rooms",
		peopleOA: 0,
		areaOA: .6,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Supermarket",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 8,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Swimming (pool & deck)",
		peopleOA: 0,
		areaOA: 2.4,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Telephone / data entry",
		peopleOA: 2.5,
		areaOA: .3,
		defaultDensity: 60,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "Telephone closets",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "EX. Toilet - private (continuous)",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 12.5,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "EX. Toilet - private (discontinuous)",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 25,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "EX. Toilet - public (continuous)",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 25,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "EX. Toilet - public (discontinuous)",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 35,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Transportation waiting",
		peopleOA: 3.8,
		areaOA: .3,
		defaultDensity: 100,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 1
	},
	{
		category: "University / college laboratories",
		peopleOA: 5,
		areaOA: .9,
		defaultDensity: 25,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Warehouses",
		peopleOA: 5,
		areaOA: .3,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	},
	{
		category: "Wood / metal shop",
		peopleOA: 5,
		areaOA: .9,
		defaultDensity: 20,
		exhaustPerUnit: 0,
		exhaustPerArea: 2.5,
		ach: 0,
		airClass: 2
	}
];
function toTitleCase(str) {
	if (!str) return str;
	return str.replace(/\b([a-z])([a-z]*)\b/gi, (match, p1, p2) => {
		const upper = match.toUpperCase();
		if (upper === "EX" || upper === "WC" || upper === "OA" || upper === "ACH" || upper === "HVAC" || upper === "L" || upper === "S") return upper;
		return p1.toUpperCase() + p2.toLowerCase();
	});
}
ASHRAE_OCCUPANCY_DATA.forEach((d) => {
	d.category = toTitleCase(d.category);
});
function getOccupancyCategories() {
	const cats = ASHRAE_OCCUPANCY_DATA.map((d) => d.category);
	cats.push("Rest Room / Changing Room");
	const excluded = [
		"EX. Shower rooms (continuous)",
		"EX. Shower rooms (discontinuous)",
		"EX. Toilet - private (continuous)",
		"EX. Toilet - private (discontinuous)",
		"EX. Toilet - public (continuous)",
		"EX. Toilet - public (discontinuous)"
	].map((s) => s.toLowerCase());
	return cats.filter((c) => !excluded.includes(c.toLowerCase())).sort((a, b) => getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b)));
}
function getOccupancyData(category) {
	const normalized = toTitleCase(category);
	if (normalized === "Rest Room / Changing Room" || category === "Rest Room / Changing Room") return {
		category: "Rest Room / Changing Room",
		peopleOA: 0,
		areaOA: 0,
		defaultDensity: 0,
		exhaustPerUnit: 0,
		exhaustPerArea: 0,
		ach: 0,
		airClass: 2
	};
	return ASHRAE_OCCUPANCY_DATA.find((d) => d.category === normalized || d.category === category) || null;
}
function getCategoryDisplayName(c) {
	return c || "";
}
var activeRoundOffPreset = 5;
function setGlobalRoundOffPreset(value) {
	activeRoundOffPreset = value;
}
function RoundToCEC(val) {
	if (val <= 0) return 0;
	return Math.ceil(val / activeRoundOffPreset) * activeRoundOffPreset;
}
function distributeFlow(spaces, totalTarget, getMinFlow, getWeight) {
	if (spaces.length === 0) return [];
	const flows = spaces.map((s) => {
		const minFlow = getMinFlow(s);
		return Math.floor(minFlow / activeRoundOffPreset) * activeRoundOffPreset;
	});
	let currentSum = flows.reduce((sum, f) => sum + f, 0);
	if (currentSum >= totalTarget) return flows;
	let remaining = totalTarget - currentSum;
	const totalWeight = spaces.reduce((sum, s) => sum + getWeight(s), 0);
	if (totalWeight === 0) {
		let idx = 0;
		while (remaining > 0) {
			flows[idx % spaces.length] += activeRoundOffPreset;
			remaining -= activeRoundOffPreset;
			idx++;
		}
		return flows;
	}
	const idealShares = spaces.map((s) => getWeight(s) / totalWeight * totalTarget);
	while (remaining > 0) {
		let maxDiff = -Infinity;
		let targetIdx = 0;
		for (let i = 0; i < spaces.length; i++) {
			const diff = idealShares[i] - flows[i];
			if (diff > maxDiff) {
				maxDiff = diff;
				targetIdx = i;
			}
		}
		flows[targetIdx] += activeRoundOffPreset;
		remaining -= activeRoundOffPreset;
	}
	return flows;
}
/**
* Ported ventilation balancing engine.
* Takes current lists of spaces, zones, and equipment and runs the Revit balancing logic.
* Returns the recalculated clones of these objects.
*/
function calculateVentilation(currentSpaces, currentZones, currentEquipment) {
	const spaces = JSON.parse(JSON.stringify(currentSpaces));
	const zones = JSON.parse(JSON.stringify(currentZones));
	const equipment = JSON.parse(JSON.stringify(currentEquipment));
	spaces.forEach((z) => {
		const mult = parseFloat(String(z.multiplier || 1)) || 1;
		if (z.isManualAirflow) {
			z.minOA = Math.ceil(parseFloat(String(z.manualFreshGiven || 0))) * mult;
			z.minExt = Math.ceil(parseFloat(String(z.manualExtTaken || 0))) * mult;
			z.freshAir = z.minOA;
			z.extractAir = z.minExt;
		} else if (z.category && z.category.endsWith(" (Custom)")) if (z.customWorkflow === "direct") {
			z.minOA = Math.ceil(parseFloat(String(z.customFreshGiven || 0))) * mult;
			z.minExt = Math.ceil(parseFloat(String(z.customExtTaken || 0))) * mult;
			z.freshAir = z.minOA;
			z.extractAir = z.minExt;
		} else {
			const areaOA = parseFloat(String(z.customAreaOA || 0)) || 0;
			const peopleOA = parseFloat(String(z.customPeopleOA || 0)) || 0;
			const exhaustPerArea = parseFloat(String(z.customExhaustPerArea || 0)) || 0;
			const exhaustPerUnit = parseFloat(String(z.customExhaustPerUnit || 0)) || 0;
			const effectiveOcc = z.fixtures !== "" && z.fixtures !== null && z.fixtures !== void 0 && !isNaN(parseFloat(String(z.fixtures))) ? parseFloat(String(z.fixtures)) : parseFloat(String(z.occupancy || 0)) || 0;
			const minOA_base = parseFloat(String(z.area || 0)) * areaOA + effectiveOcc * peopleOA;
			z.minOA = Math.ceil(minOA_base) * mult;
			const areaVal = parseFloat(String(z.area || 0)) || 0;
			const heightVal = parseFloat(String(z.height || 0)) || 0;
			const achVal = parseFloat(String(z.customAch || 0)) || 0;
			const minExt_base = exhaustPerUnit * effectiveOcc + exhaustPerArea * areaVal + achVal * areaVal * heightVal / 3.6;
			z.minExt = Math.ceil(minExt_base) * mult;
			z.freshAir = z.minOA;
			z.extractAir = z.minExt;
		}
		else if (z.category === "Rest Room / Changing Room") {
			let totalExhaust = 0;
			const sub = z.restroomSubCategories || {};
			const areaVal = parseFloat(String(z.area || 0)) || 0;
			totalExhaust += (sub.toiletPrivateContinuous || 0) * 12.5;
			totalExhaust += (sub.toiletPublicContinuous || 0) * 25;
			totalExhaust += (sub.toiletPrivateDiscontinuous || 0) * 25;
			totalExhaust += (sub.toiletPublicDiscontinuous || 0) * 35;
			totalExhaust += (sub.showerContinuous || 0) * 10;
			totalExhaust += (sub.showerDiscontinuous || 0) * 25;
			totalExhaust += (sub.janitorCloset || 0) * areaVal * 5;
			totalExhaust += (sub.lockerRoom || 0) * areaVal * 1.25;
			z.minOA = 0;
			z.minExt = Math.ceil(totalExhaust) * mult;
		} else {
			const data = getOccupancyData(z.category);
			const areaOA = data ? parseFloat(String(data.areaOA || 0)) || 0 : 0;
			const peopleOA = data ? parseFloat(String(data.peopleOA || 0)) || 0 : 0;
			const exhaustPerArea = data ? parseFloat(String(data.exhaustPerArea || 0)) || 0 : 0;
			const exhaustPerUnit = data ? parseFloat(String(data.exhaustPerUnit || 0)) || 0 : 0;
			if (data && !z.isOccupancyCustomized) z.occupancy = data.exhaustPerUnit > 0 && data.defaultDensity === 0 ? 1 : Math.ceil((parseFloat(String(z.area || 0)) || 0) * data.defaultDensity / 100);
			const hasFixtures = z.fixtures !== "" && z.fixtures !== null && z.fixtures !== void 0 && !isNaN(parseFloat(String(z.fixtures)));
			const hasOccupancy = z.occupancy !== void 0 && z.occupancy !== null && z.occupancy !== "" && !isNaN(parseFloat(String(z.occupancy)));
			const effectiveOcc = hasFixtures ? parseFloat(String(z.fixtures)) : hasOccupancy ? parseFloat(String(z.occupancy)) : 8;
			const minOA_base = parseFloat(String(z.area || 0)) * areaOA + effectiveOcc * peopleOA;
			z.minOA = Math.ceil(minOA_base) * mult;
			const areaVal = parseFloat(String(z.area || 0)) || 0;
			const heightVal = parseFloat(String(z.height || 0)) || 0;
			const achVal = data ? parseFloat(String(data.ach || 0)) || 0 : 0;
			const minExt_base = exhaustPerUnit * effectiveOcc + exhaustPerArea * areaVal + achVal * areaVal * heightVal / 3.6;
			z.minExt = Math.ceil(minExt_base) * mult;
		}
	});
	spaces.filter((s) => {
		const zoneStr = (s.zone || "").trim().toLowerCase();
		if (!zoneStr || zoneStr === "default" || zoneStr === "unzoned") return true;
		return !zones.some((g) => g.id === s.zone || g.name === s.zone);
	}).forEach((z) => {
		if (z.isManualAirflow) return;
		if (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") return;
		const req = Math.max(z.minExt || 0, z.minOA || 0);
		z.freshAir = RoundToCEC(req);
		z.extractAir = RoundToCEC(req);
	});
	zones.forEach((g) => {
		if (g.name.toLowerCase() === "default" || g.name.toLowerCase() === "unzoned") {
			g.spaceCount = 0;
			g.area = 0;
			g.freshAir = 0;
			g.extractAir = 0;
			g.pressure = 0;
			g.pressureType = "neutral";
			return;
		}
		const zoneSpaces = spaces.filter((z) => z.zone === g.id || z.zone === g.name);
		if (zoneSpaces.length === 0) {
			g.spaceCount = 0;
			g.area = 0;
			g.freshAir = 0;
			g.extractAir = 0;
			g.pressure = 0;
			g.pressureType = "neutral";
			return;
		}
		const neutralSpaces = zoneSpaces.filter((z) => z.pressure === "Neutral" || !z.pressure);
		const positiveSpaces = zoneSpaces.filter((z) => z.pressure === "Positive");
		const negativeSpaces = zoneSpaces.filter((z) => z.pressure === "Negative");
		const critNegSpaces = zoneSpaces.filter((z) => z.pressure === "Critical");
		neutralSpaces.forEach((z) => {
			if (z.isManualAirflow) return;
			if (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") return;
			const req = Math.max(z.minExt || 0, z.minOA || 0);
			z.freshAir = RoundToCEC(req);
			z.extractAir = RoundToCEC(req);
		});
		negativeSpaces.forEach((z) => {
			if (z.isManualAirflow) return;
			if (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") return;
			const minExt = z.minExt || 0;
			const minOA = z.minOA || 0;
			let rawExt = 0;
			let rawFA = 0;
			if (minExt <= minOA) {
				rawExt = Math.min(minOA + 25, 1.1 * minOA);
				rawFA = minOA;
			} else if (minExt > minOA + 25) {
				rawExt = minExt;
				rawFA = minExt - 25;
			} else {
				rawExt = minExt;
				rawFA = minOA;
			}
			z.extractAir = RoundToCEC(rawExt);
			z.freshAir = RoundToCEC(rawFA);
		});
		critNegSpaces.forEach((z) => {
			if (z.isManualAirflow) return;
			if (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") return;
			const minExt = z.minExt || 0;
			const minOA = z.minOA || 0;
			let rawExt = 0;
			let rawFA = 0;
			if (minExt - minOA <= 5) {
				rawExt = minOA + 5;
				rawFA = minOA;
			} else {
				rawExt = minExt;
				rawFA = minOA;
			}
			z.extractAir = RoundToCEC(rawExt);
			z.freshAir = RoundToCEC(rawFA);
		});
		const positiveSpacesToBalance = positiveSpaces.filter((z) => !z.isManualAirflow && !(z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct"));
		if (positiveSpaces.length > 0) {
			let FA_other = 0;
			let EA_other = 0;
			neutralSpaces.forEach((z) => {
				FA_other += z.freshAir || 0;
				EA_other += z.extractAir || 0;
			});
			negativeSpaces.forEach((z) => {
				FA_other += z.freshAir || 0;
				EA_other += z.extractAir || 0;
			});
			critNegSpaces.forEach((z) => {
				FA_other += z.freshAir || 0;
				EA_other += z.extractAir || 0;
			});
			positiveSpaces.forEach((z) => {
				if (z.isManualAirflow || z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") {
					FA_other += z.freshAir || 0;
					EA_other += z.extractAir || 0;
				}
			});
			const FA_pos_min = positiveSpacesToBalance.reduce((sum, z) => sum + (z.minOA || 0), 0);
			const EA_pos_min = positiveSpacesToBalance.reduce((sum, z) => sum + (z.minExt || 0), 0);
			const FA_min_zone = FA_other + FA_pos_min;
			const EA_min_zone = EA_other + EA_pos_min;
			let Total_FA_target = 0;
			let Total_EA_target = 0;
			const FA_candidate = RoundToCEC(FA_min_zone);
			const EA_candidate = Math.floor(FA_candidate / 1.1 / activeRoundOffPreset) * activeRoundOffPreset;
			if (EA_candidate >= EA_min_zone) {
				Total_FA_target = FA_candidate;
				Total_EA_target = EA_candidate;
			} else {
				Total_EA_target = RoundToCEC(EA_min_zone);
				Total_FA_target = Math.ceil(Total_EA_target * 1.1 / activeRoundOffPreset) * activeRoundOffPreset;
			}
			const FA_pos_target = Math.max(0, Total_FA_target - FA_other);
			const EA_pos_target = Math.max(0, Total_EA_target - EA_other);
			const faFlows = distributeFlow(positiveSpacesToBalance, FA_pos_target, (z) => z.minOA || 0, (z) => parseFloat(String(z.area || 0)) * (parseFloat(String(z.multiplier || 1)) || 1));
			const totalMinOA = positiveSpacesToBalance.reduce((sum, z) => sum + (z.minOA || 0), 0);
			const eaFlows = distributeFlow(positiveSpacesToBalance, EA_pos_target, (z) => z.minExt || 0, (z) => totalMinOA > 0 ? z.minOA || 0 : parseFloat(String(z.area || 0)) * (parseFloat(String(z.multiplier || 1)) || 1));
			positiveSpacesToBalance.forEach((z, idx) => {
				z.freshAir = faFlows[idx];
				z.extractAir = eaFlows[idx];
			});
			positiveSpaces.forEach((z) => {
				if (z.isManualAirflow || z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") {
					z.freshAir = z.minOA || 0;
					z.extractAir = z.minExt || 0;
				}
			});
		}
		zoneSpaces.forEach((z) => {
			if (z.isManualAirflow) return;
			if (z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct") return;
			z.freshAir = RoundToCEC(z.freshAir || 0);
			z.extractAir = RoundToCEC(z.extractAir || 0);
		});
		let Total_FA = 0;
		let Total_EA = 0;
		zoneSpaces.forEach((z) => {
			Total_FA += z.freshAir || 0;
			Total_EA += z.extractAir || 0;
		});
		if (Total_FA < Total_EA * 1.1) {
			const FA_deficit = Total_EA * 1.1 - Total_FA;
			let targetSpaces = zoneSpaces.filter((z) => z.pressure === "Positive");
			if (targetSpaces.length === 0) targetSpaces = zoneSpaces.filter((z) => z.pressure === "Neutral" || !z.pressure);
			if (targetSpaces.length === 0) targetSpaces = zoneSpaces.filter((z) => z.pressure === "Negative");
			if (targetSpaces.length === 0) targetSpaces = zoneSpaces.filter((z) => z.pressure === "Critical");
			targetSpaces = targetSpaces.filter((z) => !z.isManualAirflow && !(z.category && z.category.endsWith(" (Custom)") && z.customWorkflow === "direct"));
			if (targetSpaces.length > 0) {
				const totalArea = targetSpaces.reduce((sum, z) => sum + parseFloat(String(z.area || 0)) * (parseFloat(String(z.multiplier || 1)) || 1), 0);
				if (totalArea > 0) targetSpaces.forEach((z) => {
					const areaShare = parseFloat(String(z.area || 0)) * (parseFloat(String(z.multiplier || 1)) || 1) / totalArea;
					z.freshAir = (z.freshAir || 0) + FA_deficit * areaShare;
					z.freshAir = RoundToCEC(z.freshAir);
				});
				else {
					const share = FA_deficit / targetSpaces.length;
					targetSpaces.forEach((z) => {
						z.freshAir = (z.freshAir || 0) + share;
						z.freshAir = RoundToCEC(z.freshAir);
					});
				}
			}
		}
		let finalFA = 0;
		let finalEA = 0;
		let finalArea = 0;
		const finalEquipSet = /* @__PURE__ */ new Set();
		zoneSpaces.forEach((z) => {
			finalFA += z.freshAir || 0;
			finalEA += z.extractAir || 0;
			finalArea += (z.area || 0) * (z.multiplier || 1);
			if (z.equipment) finalEquipSet.add(z.equipment);
		});
		g.spaceCount = zoneSpaces.length;
		g.area = parseFloat(finalArea.toFixed(1));
		g.freshAir = finalFA;
		g.extractAir = finalEA;
		g.pressure = Math.round(finalFA - finalEA);
		g.pressureType = g.pressure > 50 ? "positive" : g.pressure < -50 ? "negative" : "neutral";
		g.equipment = Array.from(finalEquipSet);
		g.flagged = finalFA === 0 && finalEA === 0;
	});
	equipment.forEach((e) => {
		e.zoneIds = zones.filter((g) => {
			const hasFA = g.faAssignment === e.id || g.faAssignments && e.id in g.faAssignments;
			const hasEA = g.eaAssignment === e.id || g.eaAssignments && e.id in g.eaAssignments;
			return hasFA || hasEA;
		}).map((g) => g.id);
		let totalFA = 0;
		let totalEA = 0;
		let spacesCount = 0;
		zones.forEach((g) => {
			const zoneSpaces = spaces.filter((s) => s.zone === g.id || s.zone === g.name);
			const zoneMult = parseFloat(String(g.multiplier || 1)) || 1;
			let faQty = 0;
			if (g.faAssignments && e.id in g.faAssignments) faQty = g.faAssignments[e.id];
			else if (g.faAssignment === e.id) faQty = parseFloat(String(g.faAssignedQty || 1)) || 1;
			faQty = Math.min(zoneMult, faQty);
			let eaQty = 0;
			if (g.eaAssignments && e.id in g.eaAssignments) eaQty = g.eaAssignments[e.id];
			else if (g.eaAssignment === e.id) eaQty = parseFloat(String(g.eaAssignedQty || 1)) || 1;
			eaQty = Math.min(zoneMult, eaQty);
			if (faQty > 0) {
				if (e.type === "MAHU" || e.type === "Air Handling Unit" || e.type === "FAHU" && (e.mode === "Fresh Air Only" || e.mode === "Fresh Air + Extract Air")) {
					totalFA += g.freshAir * faQty;
					spacesCount += zoneSpaces.length * faQty;
				}
			}
			if (eaQty > 0) {
				if (e.type === "Ecology" || e.type === "FAHU" && (e.mode === "Extract Air Only" || e.mode === "Fresh Air + Extract Air")) {
					totalEA += g.extractAir * eaQty;
					if (faQty === 0) spacesCount += zoneSpaces.length * eaQty;
				}
			}
		});
		e.totalFA = totalFA;
		e.totalEA = totalEA;
		e.totalAirflow = totalFA + totalEA;
		e.zones = e.zoneIds.length;
		e.spaces = spacesCount;
		e.utilization = e.capacity > 0 ? Math.min(100, Math.round(e.totalAirflow / e.capacity * 100)) : 0;
		e.status = e.utilization > 92 ? "warning" : e.utilization > 0 ? "operational" : "design";
	});
	spaces.forEach((s) => {
		const isWarning = !s.isManualAirflow && !(s.category && s.category.endsWith(" (Custom)") && s.customWorkflow === "direct") && ((s.freshAir || 0) < (s.minOA || 0) || (s.extractAir || 0) < (s.minExt || 0));
		const lacksCategory = !s.category || s.category.trim() === "" || s.category.toLowerCase().includes("select category");
		const lacksArea = !s.area || parseFloat(String(s.area)) === 0;
		if (isWarning) s.status = "warning";
		else if (lacksCategory || lacksArea) s.status = "draft";
		else s.status = "complete";
	});
	return {
		spaces,
		zones: zones.filter((g) => {
			return !(g.name.toLowerCase() === "default" || g.name.toLowerCase() === "unzoned") || g.spaceCount > 0;
		}),
		equipment
	};
}
/**
* AI OCCUPANCY DETECTION ENGINE
* Client-side token/keyword classifier that maps space names
* to ASHRAE 62.1 occupancy categories with confidence scores.
*/
/**
* Mapped lookup dictionary of phrases/synonyms for Stage 2
*/
var SYNONYM_DICTIONARY = {
	"computer room": "Computer lab",
	"computer lab": "Computer lab",
	"it lab": "Computer lab",
	"ict lab": "Computer lab",
	"training lab": "Computer lab",
	"meeting room": "Conference / meeting",
	"conference room": "Conference / meeting",
	"board room": "Conference / meeting",
	"boardroom": "Conference / meeting",
	"huddle room": "Conference / meeting",
	"huddle": "Conference / meeting",
	"wc": "Rest Room / Changing Room",
	"toilet": "Rest Room / Changing Room",
	"restroom": "Rest Room / Changing Room",
	"washroom": "Rest Room / Changing Room",
	"water closet": "Rest Room / Changing Room",
	"lavatory": "Rest Room / Changing Room",
	"bathroom": "Rest Room / Changing Room",
	"powder room": "Rest Room / Changing Room",
	"powderroom": "Rest Room / Changing Room",
	"server room": "Electrical equipment rooms",
	"data room": "Electrical equipment rooms",
	"data center": "Electrical equipment rooms",
	"data centre": "Electrical equipment rooms",
	"comms room": "Electrical equipment rooms",
	"it closet": "Electrical equipment rooms",
	"office": "Office space",
	"desk": "Office space",
	"workstation": "Office space",
	"open plan": "Office space",
	"executive office": "Office space",
	"workspace": "Office space",
	"bedroom": "Bedroom",
	"master bedroom": "Bedroom",
	"living room": "Living room",
	"living": "Living room",
	"bed room": "Bedroom",
	"kitchen": "Kitchen - Residential",
	"commercial kitchen": "Kitchen - Commercial",
	"cooking kitchen": "Kitchen - Commercial",
	"catering kitchen": "Kitchen - Commercial",
	"locker room": "EX. Locker rooms",
	"locker rooms": "EX. Locker rooms",
	"locker": "EX. Locker rooms",
	"dressing room": "EX. Locker rooms",
	"dressing rooms": "EX. Locker rooms"
};
/**
* Keyword → Category mapping matrix for Stage 3 Phrase Matching.
*/
var KEYWORD_RULES = [
	{
		keywords: [
			"bedroom",
			"living room",
			"living",
			"bed room",
			"bed"
		],
		category: "Bedroom / living room",
		weight: .95
	},
	{
		keywords: [
			"office",
			"desk",
			"workstation",
			"open plan",
			"workspace",
			"open-plan",
			"cowork"
		],
		category: "Office space",
		weight: .92
	},
	{
		keywords: [
			"private office",
			"exec office",
			"manager office"
		],
		category: "Office space",
		weight: .95
	},
	{
		keywords: [
			"telephone",
			"call center",
			"data entry",
			"hotdesk"
		],
		category: "Telephone / data entry",
		weight: .88
	},
	{
		keywords: [
			"meeting",
			"conference",
			"boardroom",
			"huddle",
			"seminar",
			"training room",
			"breakout"
		],
		category: "Conference / meeting",
		weight: .95
	},
	{
		keywords: [
			"corridor",
			"hallway",
			"passage",
			"walkway",
			"gallery",
			"aisle",
			"circulation"
		],
		category: "Corridors",
		weight: .95
	},
	{
		keywords: [
			"lobby",
			"foyer",
			"atrium",
			"entrance hall",
			"welcome",
			"entry hall"
		],
		category: "Lobbies",
		weight: .93
	},
	{
		keywords: [
			"reception",
			"front desk",
			"waiting",
			"concierge"
		],
		category: "Reception areas",
		weight: .93
	},
	{
		keywords: [
			"main entry",
			"main lobby",
			"main entrance"
		],
		category: "Main entry lobbies",
		weight: .95
	},
	{
		keywords: [
			"toilet",
			"washroom",
			"restroom",
			"wc",
			"water closet",
			"lavatory",
			"bathroom",
			"cloakroom",
			"powder room",
			"shower",
			"changing room",
			"change room"
		],
		category: "Rest Room / Changing Room",
		weight: .97
	},
	{
		keywords: ["locker", "dressing"],
		category: "EX. Locker rooms",
		weight: .93
	},
	{
		keywords: [
			"electrical room",
			"elec room",
			"mv room",
			"lv room",
			"switchroom",
			"switchgear",
			"transformer"
		],
		category: "Electrical equipment rooms",
		weight: .93
	},
	{
		keywords: [
			"mechanical",
			"plant room",
			"plant",
			"ahu",
			"ahu room",
			"fan room",
			"pump room"
		],
		category: "Electrical equipment rooms",
		weight: .9
	},
	{
		keywords: [
			"server",
			"data center",
			"data centre",
			"ict room",
			"comms room",
			"network room",
			"ups room",
			"ups",
			"it room",
			"it closet"
		],
		category: "Electrical equipment rooms",
		weight: .9
	},
	{
		keywords: [
			"telephone closet",
			"telecoms",
			"patch room",
			"dp room",
			"mdf",
			"idf"
		],
		category: "Telephone closets",
		weight: .9
	},
	{
		keywords: [
			"kitchen",
			"cooking",
			"catering"
		],
		category: "Kitchen (cooking) - commercial",
		weight: .92
	},
	{
		keywords: [
			"kitchenette",
			"pantry",
			"tea point",
			"break room",
			"snack"
		],
		category: "Kitchenettes",
		weight: .9
	},
	{
		keywords: [
			"canteen",
			"cafeteria",
			"dining",
			"restaurant",
			"food court",
			"mess"
		],
		category: "Cafeteria / fast food dining",
		weight: .9
	},
	{
		keywords: [
			"storage",
			"store room",
			"storeroom",
			"store",
			"archive",
			"record room",
			"filing"
		],
		category: "Storage rooms",
		weight: .88
	},
	{
		keywords: ["warehouse", "goods"],
		category: "Warehouses",
		weight: .9
	},
	{
		keywords: [
			"janitor",
			"cleaner",
			"broom",
			"utility closet",
			"trash",
			"refuse",
			"bin room",
			"recycling"
		],
		category: "EX. Janitor closets, trash rooms, recycling",
		weight: .92
	},
	{
		keywords: ["dry store", "dry storage"],
		category: "Occupiable storage rooms for dry materials",
		weight: .88
	},
	{
		keywords: [
			"gym",
			"gymnasium",
			"fitness",
			"exercise",
			"aerobic",
			"sports hall",
			"sport hall"
		],
		category: "Gym, sports arena (play area)",
		weight: .9
	},
	{
		keywords: [
			"health club",
			"weight room",
			"weight training",
			"cardio"
		],
		category: "Health club / weight",
		weight: .88
	},
	{
		keywords: [
			"swimming",
			"pool",
			"aquatic"
		],
		category: "Swimming (pool & deck)",
		weight: .93
	},
	{
		keywords: [
			"classroom",
			"class room",
			"tutorial",
			"teaching room"
		],
		category: "Classrooms (age 9 plus)",
		weight: .92
	},
	{
		keywords: ["lecture classroom"],
		category: "Lecture classroom",
		weight: .92
	},
	{
		keywords: [
			"lecture hall",
			"lecture hall (fixed seats)",
			"fixed seats"
		],
		category: "Lecture hall (fixed seats)",
		weight: .95
	},
	{
		keywords: ["lecture", "auditorium"],
		category: "Lecture classroom",
		weight: .9
	},
	{
		keywords: [
			"science lab",
			"laboratory",
			"lab room",
			"chem lab",
			"bio lab"
		],
		category: "Science laboratories",
		weight: .9
	},
	{
		keywords: ["library"],
		category: "Libraries",
		weight: .95
	},
	{
		keywords: [
			"art",
			"art room",
			"art class",
			"arts",
			"craft",
			"art classroom"
		],
		category: "Art classroom",
		weight: .95
	},
	{
		keywords: [
			"assembly hall",
			"assembly room",
			"multipurpose",
			"multi purpose",
			"hall"
		],
		category: "Multi-purpose assembly",
		weight: .85
	},
	{
		keywords: [
			"theater",
			"theatre",
			"cinema",
			"auditorium",
			"screening"
		],
		category: "Auditorium seating area",
		weight: .92
	},
	{
		keywords: [
			"museum",
			"gallery",
			"exhibition"
		],
		category: "Museums / galleries",
		weight: .9
	},
	{
		keywords: [
			"retail",
			"shop",
			"store floor",
			"showroom",
			"display area",
			"boutique"
		],
		category: "Sales",
		weight: .88
	},
	{
		keywords: ["supermarket", "grocery"],
		category: "Supermarket",
		weight: .93
	},
	{
		keywords: [
			"mall",
			"shopping centre",
			"shopping center"
		],
		category: "Mall common areas",
		weight: .88
	},
	{
		keywords: [
			"laundry",
			"linen",
			"laundrette"
		],
		category: "Laundry rooms, central",
		weight: .9
	},
	{
		keywords: [
			"guard",
			"security room",
			"security post",
			"guard post",
			"security station"
		],
		category: "Guard stations",
		weight: .9
	},
	{
		keywords: [
			"parking",
			"car park",
			"garage",
			"basement parking",
			"multi-storey"
		],
		category: "Ex. Parking garages",
		weight: .95
	},
	{
		keywords: [
			"loading",
			"dispatch",
			"shipping",
			"receiving",
			"loading bay",
			"dock"
		],
		category: "Shipping / receiving",
		weight: .88
	}
];
/**
* Normalize string: lowercase, replace separators, collapse spaces.
*/
function normalize(str) {
	return (str || "").toLowerCase().replace(/[_\-\/\\]+/g, " ").replace(/\s+/g, " ").trim();
}
/**
* Clean floor prefixes from space name.
*/
function cleanSpaceName(name) {
	if (!name) return "";
	return normalize(name.replace(/^([0-9]{1,3}|b[0-9]?|g|lg|ug|sf|rf|m|p)[f]?\s*[-:]\s*/i, ""));
}
/**
* Check if a keyword/phrase matches as a whole word in the text.
*/
function isWordMatch(text, phrase) {
	const escaped = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
	return new RegExp("(?:^|\\b)" + escaped + "(?:\\b|$)", "i").test(text);
}
/**
* Jaccard Similarity on word sets
*/
function getJaccardSimilarity(str1, str2) {
	const set1 = new Set(str1.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
	const set2 = new Set(str2.toLowerCase().split(/\s+/).filter((w) => w.length > 1));
	if (set1.size === 0 && set2.size === 0) return 1;
	if (set1.size === 0 || set2.size === 0) return 0;
	let intersection = 0;
	set1.forEach((item) => {
		if (set2.has(item)) intersection++;
	});
	const union = set1.size + set2.size - intersection;
	return intersection / union;
}
/**
* Levenshtein Distance for typo matching
*/
function getLevenshteinDistance(a, b) {
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;
	const matrix = [];
	for (let i = 0; i <= b.length; i++) matrix[i] = [i];
	for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
	for (let i = 1; i <= b.length; i++) for (let j = 1; j <= a.length; j++) if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
	else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
	return matrix[b.length][a.length];
}
function getFuzzyScore(str1, str2) {
	const dist = getLevenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
	const maxLen = Math.max(str1.length, str2.length);
	if (maxLen === 0) return 1;
	return 1 - dist / maxLen;
}
/**
* Save/Load learned rules
*/
function getLearnedRules() {
	try {
		const saved = localStorage.getItem("mep_vent_ai_learned");
		return saved ? JSON.parse(saved) : {};
	} catch (e) {
		return {};
	}
}
/**
* Prediction Engine with strict Matching Stages
*/
function predictOccupancyCategory(spaceName) {
	if (!spaceName || spaceName.trim().length < 2) return {
		category: "",
		confidence: 0
	};
	const cleaned = cleanSpaceName(spaceName);
	const categories = getOccupancyCategories();
	const learned = getLearnedRules();
	if (learned[cleaned]) {
		const exactDB = categories.find((c) => c.toLowerCase() === learned[cleaned].toLowerCase());
		if (exactDB) return {
			category: exactDB,
			confidence: 1
		};
	}
	const exactDB = categories.find((c) => c.toLowerCase() === cleaned.toLowerCase());
	if (exactDB) return {
		category: exactDB,
		confidence: 1
	};
	const dictMapped = SYNONYM_DICTIONARY[cleaned];
	if (dictMapped) {
		const exactDB = categories.find((c) => c.toLowerCase() === dictMapped.toLowerCase());
		if (exactDB) return {
			category: exactDB,
			confidence: .95
		};
	}
	let bestScore = 0;
	let bestCategory = null;
	for (const rule of KEYWORD_RULES) for (const kw of rule.keywords) {
		const kwClean = kw.toLowerCase().trim();
		if (isWordMatch(cleaned, kwClean)) {
			const kwWords = kwClean.split(" ").length;
			const inputWords = cleaned.split(" ").length;
			let score = rule.weight;
			score += kwWords * .05;
			score += kwWords / inputWords * .05;
			if (kwClean === cleaned) score += .15;
			if (score > bestScore) {
				bestScore = score;
				bestCategory = rule.category;
			}
		}
	}
	if (bestCategory && bestScore >= .7) {
		const exactDB = categories.find((c) => c.toLowerCase() === bestCategory.toLowerCase());
		if (exactDB) return {
			category: exactDB,
			confidence: Math.min(bestScore, .99)
		};
	}
	let bestFuzzyCat = null;
	let bestFuzzyScore = 0;
	for (const cat of categories) {
		const score = (getJaccardSimilarity(cleaned, cat) + getFuzzyScore(cleaned, cat)) / 2;
		if (score > bestFuzzyScore) {
			bestFuzzyScore = score;
			bestFuzzyCat = cat;
		}
	}
	if (bestFuzzyCat && bestFuzzyScore >= .5) {
		const confidence = Math.min(bestFuzzyScore * .75, .78);
		return {
			category: bestFuzzyCat,
			confidence
		};
	}
	return {
		category: "",
		confidence: 0
	};
}
/**
* Automatically predict pressure based on category keywords
*/
function predictSpacePressure(category) {
	if (!category) return {
		pressure: "Positive",
		autoDetected: false
	};
	const cat = category.toLowerCase().trim();
	const negativeKeywords = [
		"garbage",
		"refuse",
		"trash",
		"bathroom",
		"toilet",
		"rest room",
		"changing room",
		"washroom",
		"ablution",
		"wc",
		"janitor",
		"jan",
		"kitchen",
		"pantry",
		"exhaust",
		"ecology",
		"art class",
		"art room",
		"changing",
		"locker",
		"shower",
		"storage",
		"store",
		"chemical",
		"waste",
		"parking",
		"garage"
	];
	const positiveKeywords = [
		"bedroom",
		"bed",
		"master bed",
		"maid",
		"corridor",
		"passage",
		"hallway",
		"living room",
		"living",
		"lobby",
		"foyer",
		"reception",
		"waiting",
		"classroom",
		"class room",
		"class",
		"library",
		"liabrary",
		"computer lab",
		"computer room",
		"labs",
		"dining",
		"cafe",
		"cafeteria",
		"prefunction",
		"pre-function",
		"entrance",
		"enterance",
		"office",
		"meeting",
		"conference"
	];
	for (const kw of negativeKeywords) if (cat.includes(kw)) return {
		pressure: "Negative",
		autoDetected: true
	};
	for (const kw of positiveKeywords) if (cat.includes(kw)) return {
		pressure: "Positive",
		autoDetected: true
	};
	return {
		pressure: "Positive",
		autoDetected: false
	};
}
var lastLoggedView = {
	path: "",
	timestamp: 0
};
function getCalculatorTitleFromPath(pathname) {
	if (!pathname || pathname === "/login" || pathname === "/privacy" || pathname.includes("admin")) return "";
	if (pathname === "/" || pathname === "/ventilation") return "Ventilation";
	return pathname.replace("/", "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Calculator";
}
var logActivity = async (userId, action, details = {}) => {
	try {
		const projectName = workspaceStore.getState().project?.name || "Unknown Project";
		const path = window.location.pathname;
		const calcTitle = getCalculatorTitleFromPath(path) || "GENERAL";
		let storedUserData = null;
		try {
			const raw = localStorage.getItem("mep_user_data") || localStorage.getItem("mep_profile");
			if (raw) storedUserData = JSON.parse(raw);
		} catch (e) {}
		const enrichedDetails = {
			project_name: projectName,
			calculator: calcTitle.toUpperCase(),
			calculator_name: calcTitle,
			path,
			timestamp: (/* @__PURE__ */ new Date()).toISOString(),
			user_email: storedUserData?.email || "",
			user_name: storedUserData?.name || storedUserData?.email || "",
			...details
		};
		await api.logActivity(action, enrichedDetails);
	} catch (error) {
		console.error("Failed to log activity:", error);
	}
};
var logCalculatorView = async (calculatorTitle, pathName) => {
	const currentPath = pathName || window.location.pathname;
	const now = Date.now();
	if (lastLoggedView.path === currentPath && now - lastLoggedView.timestamp < 3e3) return;
	lastLoggedView = {
		path: currentPath,
		timestamp: now
	};
	const calcTitle = getCalculatorTitleFromPath(currentPath) || calculatorTitle;
	await logActivity(void 0, "UPDATED", {
		calculator_name: calcTitle,
		message: `Updated ${calcTitle}`
	});
};
var logCalculatorUpdate = async (calculatorTitle, details) => {
	const currentPath = window.location.pathname;
	const calcTitle = getCalculatorTitleFromPath(currentPath) || calculatorTitle;
	const detailPayload = typeof details === "string" ? { summary: details } : details || {};
	return await logActivity(void 0, "UPDATED", {
		calculator_name: calcTitle,
		message: `Changes occurred in ${calcTitle}`,
		...detailPayload
	});
};
var workspace_store_exports = /* @__PURE__ */ __exportAll$1({
	checkIfSpaceMissingData: () => checkIfSpaceMissingData,
	isInitializing: () => isInitializing,
	sanitizeWorkspaceState: () => sanitizeWorkspaceState,
	useWorkspace: () => useWorkspace,
	workspaceStore: () => workspaceStore
});
function checkIfSpaceMissingData(s) {
	const isNoArea = !s.area || parseFloat(String(s.area)) === 0 || isNaN(parseFloat(String(s.area)));
	const isNoCategory = !s.category || s.category.trim() === "" || s.category.toLowerCase().includes("select category");
	if (isNoArea || isNoCategory) return true;
	if (s.category === "Rest Room / Changing Room") {
		const sub = s.restroomSubCategories || {};
		if ((sub.toiletPrivateContinuous || 0) + (sub.toiletPublicContinuous || 0) + (sub.toiletPrivateDiscontinuous || 0) + (sub.toiletPublicDiscontinuous || 0) + (sub.showerContinuous || 0) + (sub.showerDiscontinuous || 0) + (sub.janitorCloset || 0) + (sub.lockerRoom || 0) === 0) return true;
	}
	return false;
}
function sanitizeWorkspaceState(state) {
	if (!state || !Array.isArray(state.zones)) return state;
	const seenIds = /* @__PURE__ */ new Set();
	const idMap = /* @__PURE__ */ new Map();
	const zoneNameMap = /* @__PURE__ */ new Map();
	state.zones = state.zones.map((z) => {
		if (!z.id || seenIds.has(z.id)) {
			const newId = `zone-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
			idMap.set(z.id || "empty", newId);
			z.id = newId;
		}
		seenIds.add(z.id);
		if (z.name) {
			zoneNameMap.set(z.id, z.name);
			zoneNameMap.set(z.name.toLowerCase(), z.name);
		}
		return z;
	});
	if (Array.isArray(state.spaces)) state.spaces = state.spaces.map((s) => {
		if (s.zone) {
			const cleanName = zoneNameMap.get(s.zone) || zoneNameMap.get(s.zone.toLowerCase());
			if (cleanName) s.zone = cleanName;
			else if (s.zone.startsWith("zone-")) s.zone = "Default";
		}
		return s;
	});
	return state;
}
var IS_SERVER = typeof window === "undefined";
var projects = [];
var activeProjectId = "";
var currentProject = void 0;
var currentWorkspaceState = {
	spaces: [],
	zones: [],
	equipment: [],
	roundOffPreset: 5,
	isReadOnly: false
};
var cloudInitDone = false;
var isInitializing = true;
var listeners = /* @__PURE__ */ new Set();
var undoStack = [];
var redoStack = [];
var MAX_HISTORY_LIMIT = 50;
function pushHistory() {
	undoStack.push(JSON.stringify(currentWorkspaceState));
	if (undoStack.length > MAX_HISTORY_LIMIT) undoStack.shift();
	redoStack = [];
}
function clearHistory() {
	undoStack = [];
	redoStack = [];
}
var copiedSpaces = [];
if (typeof window !== "undefined") try {
	const saved = localStorage.getItem("mep_clipboard_spaces");
	copiedSpaces = saved ? JSON.parse(saved) : [];
} catch (e) {
	console.error("Failed to load clipboard:", e);
}
function notify() {
	listeners.forEach((l) => l());
}
var saveTimeout = null;
function saveState() {
	if (IS_SERVER) return;
	currentWorkspaceState = sanitizeWorkspaceState(currentWorkspaceState);
	if (typeof localStorage !== "undefined" && activeProjectId) {
		localStorage.setItem("mep_active_project_id", activeProjectId);
		localStorage.setItem("mep_last_worked_project_id", activeProjectId);
	}
	if (typeof window !== "undefined" && window.location.pathname) {
		const path = window.location.pathname;
		const calcTitle = getCalculatorTitleFromPath(path);
		if (calcTitle) logCalculatorUpdate(calcTitle, `Changes occurred in ${calcTitle}`);
	}
	if (saveTimeout) clearTimeout(saveTimeout);
	saveTimeout = setTimeout(() => {
		if (activeProjectId) {
			const lsState = {};
			const knownPrefixes = [
				"mep",
				"drainage",
				"fireTank",
				"gasTank",
				"sewagePump",
				"sumpPump",
				"tankSizing",
				"pcl",
				"bs_",
				"chw_",
				"customCableCatalog",
				"customBusbarRatings"
			];
			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i);
				if (key && knownPrefixes.some((p) => key.startsWith(p)) && !key.includes("clipboard")) lsState[key] = localStorage.getItem(key) || "";
			}
			const nowIso = (/* @__PURE__ */ new Date()).toISOString();
			const payload = {
				...currentWorkspaceState,
				localStorageCache: lsState
			};
			if (currentProject) {
				currentProject.workspace_data = payload;
				currentProject.updated_at = nowIso;
				currentProject.last_modified = nowIso;
				currentProject.lastModified = nowIso;
			}
			const targetProj = projects.find((proj) => proj.id === activeProjectId);
			if (targetProj) {
				targetProj.workspace_data = payload;
				targetProj.updated_at = nowIso;
				targetProj.last_modified = nowIso;
				targetProj.lastModified = nowIso;
			}
			api.saveWorkspace(activeProjectId, payload);
			notify();
		}
	}, 1e3);
}
function injectLocalStorageCache(wdata) {
	if (typeof localStorage === "undefined") return;
	const knownPrefixes = [
		"mep",
		"drainage",
		"fireTank",
		"gasTank",
		"sewagePump",
		"sumpPump",
		"tankSizing",
		"pcl",
		"bs_",
		"chw_",
		"customCableCatalog",
		"customBusbarRatings"
	];
	const keysToRemove = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key && knownPrefixes.some((p) => key.startsWith(p)) && !key.includes("clipboard")) keysToRemove.push(key);
	}
	keysToRemove.forEach((k) => localStorage.removeItem(k));
	if (wdata && wdata.localStorageCache) Object.entries(wdata.localStorageCache).forEach(([key, val]) => {
		localStorage.setItem(key, val);
	});
}
var workspaceStore = {
	forceSaveToCloud() {
		saveState();
	},
	async syncFromCloud() {
		const cloudProjects = await api.getProjects();
		if (cloudProjects && cloudProjects.length > 0) {
			projects = cloudProjects;
			const lastActive = typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") || localStorage.getItem("mep_last_worked_project_id") || activeProjectId : activeProjectId;
			let target = projects.find((p) => p.id === lastActive || p.id === activeProjectId) || projects[0];
			activeProjectId = target.id;
			currentProject = target;
			if (typeof localStorage !== "undefined") {
				localStorage.setItem("mep_active_project_id", target.id);
				localStorage.setItem("mep_last_worked_project_id", target.id);
			}
			const wdata = currentProject.workspace_data || {};
			injectLocalStorageCache(wdata);
			currentWorkspaceState = sanitizeWorkspaceState({
				spaces: wdata.spaces || [],
				zones: wdata.zones || [],
				equipment: wdata.equipment || [],
				roundOffPreset: wdata.roundOffPreset ?? 5,
				isReadOnly: false
			});
			setGlobalRoundOffPreset(currentWorkspaceState.roundOffPreset);
			notify();
		}
	},
	async refreshProjects() {
		try {
			const cloudProjects = await api.getProjects();
			if (cloudProjects) {
				projects = cloudProjects;
				if (activeProjectId) {
					const updatedActive = projects.find((p) => p.id === activeProjectId);
					if (updatedActive) currentProject = updatedActive;
				}
				notify();
			}
		} catch (err) {
			console.error("Failed to refresh projects list:", err);
		}
	},
	async initCloud() {
		if (cloudInitDone) return;
		cloudInitDone = true;
		try {
			supabase.channel("public:projects").on("postgres_changes", {
				event: "*",
				schema: "public",
				table: "projects"
			}, () => {
				workspaceStore.refreshProjects();
			}).subscribe();
			projects = await api.getProjects() || [];
			if (projects.length > 0) {
				let lastActive = typeof localStorage !== "undefined" ? localStorage.getItem("mep_active_project_id") || localStorage.getItem("mep_last_worked_project_id") : null;
				let target = projects[0];
				if (lastActive) {
					const found = projects.find((p) => p.id === lastActive || p.code === lastActive);
					if (found) target = found;
				}
				activeProjectId = target.id;
				currentProject = target;
				if (typeof localStorage !== "undefined") {
					localStorage.setItem("mep_active_project_id", target.id);
					localStorage.setItem("mep_last_worked_project_id", target.id);
				}
				const wdata = currentProject.workspace_data || {};
				injectLocalStorageCache(wdata);
				currentWorkspaceState = sanitizeWorkspaceState({
					spaces: wdata.spaces || [],
					zones: wdata.zones || [],
					equipment: wdata.equipment || [],
					roundOffPreset: wdata.roundOffPreset ?? 5,
					isReadOnly: false
				});
			} else {
				activeProjectId = "";
				currentProject = void 0;
				currentWorkspaceState = {
					spaces: [],
					zones: [],
					equipment: [],
					roundOffPreset: 5,
					isReadOnly: false
				};
			}
			setGlobalRoundOffPreset(currentWorkspaceState.roundOffPreset);
		} catch (err) {
			console.error("Workspace init failed:", err);
		} finally {
			isInitializing = false;
			notify();
		}
	},
	getState() {
		return {
			project: currentProject || {
				id: "",
				name: "No Workspace Selected",
				code: "---",
				client: "N/A"
			},
			projects,
			activeProjectId,
			isInitializing,
			spaces: currentWorkspaceState.spaces,
			zones: currentWorkspaceState.zones,
			equipment: currentWorkspaceState.equipment,
			roundOffPreset: currentWorkspaceState.roundOffPreset ?? 5,
			isReadOnly: currentWorkspaceState.isReadOnly ?? false
		};
	},
	setReadOnly(val) {
		currentWorkspaceState.isReadOnly = val;
		saveState();
		notify();
	},
	setState(newState) {
		pushHistory();
		if (newState.project) {
			const proj = newState.project;
			currentProject = proj;
			projects = projects.map((p) => p.id === proj.id ? proj : p);
		}
		currentWorkspaceState = {
			spaces: (newState.spaces || []).map((s) => {
				return checkIfSpaceMissingData(s) ? {
					...s,
					flagged: true
				} : s;
			}),
			zones: newState.zones,
			equipment: newState.equipment,
			roundOffPreset: currentWorkspaceState.roundOffPreset,
			isReadOnly: newState.isReadOnly ?? currentWorkspaceState.isReadOnly
		};
		saveState();
		notify();
	},
	selectProject(id) {
		const target = projects.find((p) => p.id === id);
		if (!target) return;
		saveState();
		clearHistory();
		currentProject = target;
		activeProjectId = id;
		if (typeof localStorage !== "undefined") localStorage.setItem("mep_active_project_id", id);
		const wdata = target.workspace_data || {};
		injectLocalStorageCache(wdata);
		let nextState = sanitizeWorkspaceState({
			spaces: wdata.spaces || [],
			zones: wdata.zones || [],
			equipment: wdata.equipment || [],
			roundOffPreset: wdata.roundOffPreset ?? 5,
			isReadOnly: false
		});
		setGlobalRoundOffPreset(nextState.roundOffPreset);
		currentWorkspaceState = nextState;
		notify();
	},
	async createNewProject(projData, assigned_users = [], assigned_teams = []) {
		const res = await api.createProject({
			...projData,
			workspace_data: {
				spaces: [],
				zones: [],
				equipment: [],
				roundOffPreset: 5
			}
		}, assigned_users, assigned_teams);
		if (res.success) {
			const newProj = res.project;
			projects.unshift(newProj);
			saveState();
			clearHistory();
			currentProject = newProj;
			activeProjectId = newProj.id;
			if (typeof localStorage !== "undefined") {
				localStorage.setItem("mep_active_project_id", newProj.id);
				localStorage.setItem("mep_last_worked_project_id", newProj.id);
			}
			currentWorkspaceState = {
				spaces: [],
				zones: [],
				equipment: [],
				roundOffPreset: 5,
				isReadOnly: false
			};
			notify();
		}
		return res;
	},
	async duplicateProject(id) {
		const target = projects.find((p) => p.id === id);
		if (!target) return null;
		const res = await api.createProject({
			...target,
			name: `${target.name} (Copy)`,
			code: `${target.code}-COPY`,
			workspace_data: target.workspace_data || {
				spaces: [],
				zones: [],
				equipment: [],
				roundOffPreset: 5
			}
		}, [], []);
		if (res.success) {
			projects.unshift(res.project);
			notify();
			return res.project;
		}
		return null;
	},
	saveAsRevision(versionName) {
		if (!currentProject) return null;
		const newId = `proj_${Date.now()}_${versionName}`;
		const newProj = {
			...currentProject,
			id: newId,
			name: `${currentProject.name} (${versionName})`,
			createdDate: (/* @__PURE__ */ new Date()).toISOString(),
			lastModified: (/* @__PURE__ */ new Date()).toISOString()
		};
		projects.unshift(newProj);
		if (!IS_SERVER) localStorage.setItem(`mep_project_workspace_${newId}`, JSON.stringify({
			...currentWorkspaceState,
			isReadOnly: true
		}));
		saveState();
		notify();
		return newProj;
	},
	async deleteProject(id) {
		const res = await api.deleteProject(id);
		if (res.success) {
			projects = projects.filter((p) => p.id !== id);
			if (activeProjectId === id) if (projects.length > 0) {
				activeProjectId = projects[0].id;
				currentProject = projects[0];
				const wdata = currentProject.workspace_data || {};
				currentWorkspaceState = sanitizeWorkspaceState({
					spaces: wdata.spaces || [],
					zones: wdata.zones || [],
					equipment: wdata.equipment || [],
					roundOffPreset: wdata.roundOffPreset ?? 5,
					isReadOnly: false
				});
				setGlobalRoundOffPreset(currentWorkspaceState.roundOffPreset);
			} else {
				activeProjectId = "";
				currentProject = void 0;
				setGlobalRoundOffPreset(5);
				currentWorkspaceState = {
					spaces: [],
					zones: [],
					equipment: [],
					roundOffPreset: 5,
					isReadOnly: false
				};
			}
			notify();
		}
		return res;
	},
	clearWorkspace() {
		pushHistory();
		currentWorkspaceState = {
			spaces: [],
			zones: [],
			equipment: []
		};
		saveState();
		notify();
	},
	updateProject(updated) {
		projects = projects.map((p) => p.id === updated.id ? updated : p);
		if (activeProjectId === updated.id) currentProject = updated;
		saveState();
		notify();
	},
	updateSpaces(updatedSpaces) {
		pushHistory();
		const spaceMap = new Map(updatedSpaces.map((s) => [s.id, s]));
		currentWorkspaceState = calculateVentilation(currentWorkspaceState.spaces.map((s) => {
			const updated = spaceMap.get(s.id);
			if (updated) {
				const wasMissing = checkIfSpaceMissingData(s);
				const isMissing = checkIfSpaceMissingData(updated);
				let flagged = updated.flagged;
				if (isMissing) flagged = true;
				else if (wasMissing && !isMissing) flagged = false;
				return {
					...updated,
					flagged
				};
			}
			return s;
		}), currentWorkspaceState.zones, currentWorkspaceState.equipment);
		saveState();
		logCalculatorUpdate("Ventilation", "Updated spaces in Ventilation");
		notify();
	},
	updateZones(updatedZones) {
		pushHistory();
		const zoneMap = new Map(updatedZones.map((z) => [z.id, z]));
		const nextZones = currentWorkspaceState.zones.map((z) => {
			const updated = zoneMap.get(z.id);
			if (updated) {
				const mult = updated.multiplier ?? 1;
				return {
					...updated,
					faAssignedQty: Math.min(mult, updated.faAssignedQty ?? 1),
					eaAssignedQty: Math.min(mult, updated.eaAssignedQty ?? 1)
				};
			}
			return z;
		});
		currentWorkspaceState = calculateVentilation(currentWorkspaceState.spaces, nextZones, currentWorkspaceState.equipment);
		saveState();
		logCalculatorUpdate("Ventilation", "Updated zones in Ventilation");
		notify();
	},
	updateEquipment(updatedEquip) {
		pushHistory();
		currentWorkspaceState = calculateVentilation(currentWorkspaceState.spaces, currentWorkspaceState.zones, updatedEquip);
		saveState();
		logCalculatorUpdate("Ventilation", "Updated equipment in Ventilation");
		notify();
	},
	addSpace(newSpace) {
		pushHistory();
		const nextSpace = { ...newSpace };
		if (!nextSpace.category && nextSpace.name) {
			const pred = predictOccupancyCategory(nextSpace.name.trim());
			let predCategory = "";
			if (pred && pred.category) {
				nextSpace.category = pred.category;
				nextSpace.aiDetected = true;
				predCategory = pred.category;
				const data = getOccupancyData(pred.category);
				if (data) {
					const density = data.defaultDensity || 0;
					const hasFixtures = nextSpace.fixtures !== "" && nextSpace.fixtures !== void 0;
					nextSpace.occupancy = hasFixtures ? parseFloat(String(nextSpace.fixtures)) || 0 : Math.ceil(nextSpace.area * density / 100);
					nextSpace.isOccupancyCustomized = false;
					if (data.exhaustPerUnit > 0) nextSpace.fixtures = nextSpace.occupancy.toString();
					else if (!hasFixtures) nextSpace.fixtures = "";
				}
			}
			const predPress = predictSpacePressure(predCategory);
			if (predPress && predPress.autoDetected) {
				nextSpace.pressure = predPress.pressure;
				nextSpace.pressureAutoDetected = true;
			}
		}
		if (checkIfSpaceMissingData(nextSpace)) nextSpace.flagged = true;
		currentWorkspaceState = calculateVentilation([...currentWorkspaceState.spaces, nextSpace], currentWorkspaceState.zones, currentWorkspaceState.equipment);
		saveState();
		notify();
	},
	addSpacesBulk(newSpaces) {
		pushHistory();
		const existingZoneNames = new Set(currentWorkspaceState.zones.map((z) => z.name.toLowerCase()));
		const existingZoneIds = new Set(currentWorkspaceState.zones.map((z) => z.id.toLowerCase()));
		const zonesToAdd = [];
		newSpaces.forEach((s) => {
			if (s.zone) {
				const zoneLower = s.zone.toLowerCase();
				if (!existingZoneNames.has(zoneLower) && !existingZoneIds.has(zoneLower)) {
					const zoneId = `zone-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
					zonesToAdd.push({
						id: zoneId,
						name: s.zone,
						building: s.building || "Tower A",
						floor: s.floor || "L01",
						spaceCount: 0,
						area: 0,
						freshAir: 0,
						extractAir: 0,
						pressure: 0,
						equipment: [],
						pressureType: "neutral",
						faAssignment: null,
						eaAssignment: null,
						multiplier: 1,
						faAssignedQty: 1,
						eaAssignedQty: 1
					});
					existingZoneNames.add(zoneLower);
				}
			}
		});
		const processedSpaces = newSpaces.map((s) => {
			return checkIfSpaceMissingData(s) ? {
				...s,
				flagged: true
			} : s;
		});
		const nextZones = [...currentWorkspaceState.zones, ...zonesToAdd];
		currentWorkspaceState = calculateVentilation([...currentWorkspaceState.spaces, ...processedSpaces], nextZones, currentWorkspaceState.equipment);
		saveState();
		notify();
	},
	deleteSpaces(idsToDelete) {
		pushHistory();
		const spacesToDelete = currentWorkspaceState.spaces.filter((s) => idsToDelete.includes(s.id));
		const zonesToCheck = /* @__PURE__ */ new Set();
		spacesToDelete.forEach((s) => {
			if (s.zone) zonesToCheck.add(s.zone.toLowerCase());
		});
		const nextSpaces = currentWorkspaceState.spaces.filter((s) => !idsToDelete.includes(s.id));
		currentWorkspaceState = calculateVentilation(nextSpaces, currentWorkspaceState.zones.filter((g) => {
			if (g.name.toLowerCase() === "default" || g.name.toLowerCase() === "unzoned") return true;
			if (!(zonesToCheck.has(g.id.toLowerCase()) || zonesToCheck.has(g.name.toLowerCase()))) return true;
			return nextSpaces.some((s) => s.zone && (s.zone.toLowerCase() === g.id.toLowerCase() || s.zone.toLowerCase() === g.name.toLowerCase()));
		}), currentWorkspaceState.equipment);
		saveState();
		notify();
	},
	bulkUpdateSpaces(ids, updates) {
		pushHistory();
		currentWorkspaceState = calculateVentilation(currentWorkspaceState.spaces.map((s) => {
			if (ids.includes(s.id)) {
				const next = {
					...s,
					...updates
				};
				if (updates.zone !== void 0 && updates.zone !== "") {
					const matchingZone = currentWorkspaceState.zones.find((z) => z.id === updates.zone || z.name === updates.zone);
					if (matchingZone) next.zone = matchingZone.name;
				}
				if (updates.name !== void 0) {
					const nameVal = updates.name.trim();
					if (!s.category || s.aiDetected) {
						const pred = predictOccupancyCategory(nameVal);
						if (pred && pred.category) {
							next.category = pred.category;
							next.aiDetected = true;
							const data = getOccupancyData(pred.category);
							if (data) {
								const density = data.defaultDensity || 0;
								const hasFixtures = next.fixtures !== "" && next.fixtures !== void 0;
								if (!s.isOccupancyCustomized) {
									next.occupancy = hasFixtures ? parseFloat(String(next.fixtures)) || 0 : Math.ceil(next.area * density / 100);
									next.isOccupancyCustomized = false;
								}
								if (data.exhaustPerUnit > 0) next.fixtures = next.occupancy.toString();
								else if (!hasFixtures) next.fixtures = "";
							}
						} else if (s.aiDetected) {
							next.category = "";
							next.aiDetected = false;
						}
					}
					const predPress = predictSpacePressure(next.category);
					if (predPress && predPress.autoDetected) {
						next.pressure = predPress.pressure;
						next.pressureAutoDetected = true;
					} else if (s.pressureAutoDetected) {
						next.pressure = "Positive";
						next.pressureAutoDetected = false;
					}
				}
				if (updates.category !== void 0 && updates.name === void 0) {
					const predPress = predictSpacePressure(updates.category);
					if (predPress && predPress.autoDetected) {
						next.pressure = predPress.pressure;
						next.pressureAutoDetected = true;
					}
				}
				if ((updates.area !== void 0 || updates.category !== void 0) && !next.isOccupancyCustomized) {
					const cat = next.category;
					if (cat && !cat.endsWith(" (Custom)") && cat !== "OTHER") {
						const data = getOccupancyData(cat);
						if (data) {
							const density = data.defaultDensity || 0;
							next.occupancy = next.fixtures !== "" && next.fixtures !== void 0 ? parseFloat(String(next.fixtures)) || 0 : Math.ceil(next.area * density / 100);
							next.isOccupancyCustomized = false;
						}
					}
				}
				if (checkIfSpaceMissingData(next)) next.flagged = true;
				else if (updates.area !== void 0 || updates.category !== void 0) next.flagged = false;
				return next;
			}
			return s;
		}), currentWorkspaceState.zones, currentWorkspaceState.equipment);
		saveState();
		notify();
	},
	mergeSpaces(ids, primaryId, mergedName) {
		pushHistory();
		const selectedSpaces = currentWorkspaceState.spaces.filter((s) => ids.includes(s.id));
		if (selectedSpaces.length < 2) return;
		const primarySpace = selectedSpaces.find((s) => s.id === primaryId) || selectedSpaces[0];
		let combinedArea = 0;
		let combinedFixtures = 0;
		let hasAnyFixturesVal = false;
		selectedSpaces.forEach((s) => {
			const mult = parseFloat(String(s.multiplier || 1)) || 1;
			combinedArea += (parseFloat(String(s.area || 0)) || 0) * mult;
			if (s.fixtures !== "" && s.fixtures !== void 0 && s.fixtures !== null) {
				combinedFixtures += (parseFloat(String(s.fixtures || 0)) || 0) * mult;
				hasAnyFixturesVal = true;
			}
		});
		const mergedSpace = {
			...primarySpace,
			id: `merged-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
			name: mergedName,
			area: combinedArea,
			fixtures: hasAnyFixturesVal ? combinedFixtures : "",
			multiplier: 1,
			status: "complete"
		};
		const firstIndex = currentWorkspaceState.spaces.findIndex((s) => ids.includes(s.id));
		const filteredSpaces = currentWorkspaceState.spaces.filter((s) => !ids.includes(s.id));
		filteredSpaces.splice(firstIndex === -1 ? 0 : firstIndex, 0, mergedSpace);
		currentWorkspaceState = calculateVentilation(filteredSpaces, currentWorkspaceState.zones, currentWorkspaceState.equipment);
		saveState();
		notify();
	},
	addZone(newZone) {
		pushHistory();
		const nextZones = [...currentWorkspaceState.zones, newZone];
		currentWorkspaceState = calculateVentilation(currentWorkspaceState.spaces, nextZones, currentWorkspaceState.equipment);
		saveState();
		notify();
	},
	deleteZone(zoneId) {
		pushHistory();
		const nextZones = currentWorkspaceState.zones.filter((z) => z.id !== zoneId);
		currentWorkspaceState = calculateVentilation(currentWorkspaceState.spaces.map((s) => s.zone === zoneId || s.zone === nextZones.find((z) => z.id === zoneId)?.name ? {
			...s,
			zone: ""
		} : s), nextZones, currentWorkspaceState.equipment);
		saveState();
		notify();
	},
	autoZoneSpaces(selectedProposals) {
		pushHistory();
		const nextZones = [...currentWorkspaceState.zones];
		const nextSpaces = [...currentWorkspaceState.spaces];
		selectedProposals.forEach((p) => {
			const newZone = {
				id: `zone-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
				name: p.name + " Zone",
				building: p.spaces[0]?.building || "Tower A",
				floor: p.floor,
				spaceCount: p.spaces.length,
				area: p.spaces.reduce((sum, s) => sum + s.area, 0),
				freshAir: 0,
				extractAir: 0,
				pressure: 0,
				equipment: [],
				pressureType: "neutral",
				faAssignment: null,
				eaAssignment: null,
				multiplier: 1,
				faAssignedQty: 1,
				eaAssignedQty: 1
			};
			nextZones.push(newZone);
			const spaceIds = p.spaces.map((s) => s.id);
			nextSpaces.forEach((s, idx) => {
				if (spaceIds.includes(s.id)) nextSpaces[idx] = {
					...s,
					zone: newZone.name
				};
			});
		});
		currentWorkspaceState = calculateVentilation(nextSpaces, nextZones, currentWorkspaceState.equipment);
		saveState();
		notify();
	},
	assignZoneToEquipment(zoneId, equipId, stream, quantity) {
		pushHistory();
		const nextZones = currentWorkspaceState.zones.map((g) => {
			if (g.id === zoneId) {
				const qty = quantity ?? 1;
				if (stream === "FA") {
					const currentFA = { ...g.faAssignments || {} };
					currentFA[equipId] = qty;
					if (qty <= 0) delete currentFA[equipId];
					const firstKey = Object.keys(currentFA)[0] || null;
					return {
						...g,
						faAssignments: currentFA,
						faAssignment: firstKey,
						faAssignedQty: firstKey ? currentFA[firstKey] : 1
					};
				} else {
					const currentEA = { ...g.eaAssignments || {} };
					currentEA[equipId] = qty;
					if (qty <= 0) delete currentEA[equipId];
					const firstKey = Object.keys(currentEA)[0] || null;
					return {
						...g,
						eaAssignments: currentEA,
						eaAssignment: firstKey,
						eaAssignedQty: firstKey ? currentEA[firstKey] : 1
					};
				}
			}
			return g;
		});
		currentWorkspaceState = calculateVentilation(currentWorkspaceState.spaces, nextZones, currentWorkspaceState.equipment);
		saveState();
		notify();
	},
	removeZoneFromEquipment(zoneId, equipId, stream) {
		pushHistory();
		const nextZones = currentWorkspaceState.zones.map((g) => {
			if (g.id === zoneId) if (stream === "FA") {
				const currentFA = { ...g.faAssignments || {} };
				delete currentFA[equipId];
				const firstKey = Object.keys(currentFA)[0] || null;
				return {
					...g,
					faAssignments: currentFA,
					faAssignment: firstKey,
					faAssignedQty: firstKey ? currentFA[firstKey] : 1
				};
			} else {
				const currentEA = { ...g.eaAssignments || {} };
				delete currentEA[equipId];
				const firstKey = Object.keys(currentEA)[0] || null;
				return {
					...g,
					eaAssignments: currentEA,
					eaAssignment: firstKey,
					eaAssignedQty: firstKey ? currentEA[firstKey] : 1
				};
			}
			return g;
		});
		currentWorkspaceState = calculateVentilation(currentWorkspaceState.spaces, nextZones, currentWorkspaceState.equipment);
		saveState();
		notify();
	},
	updateZoneInstances(zoneId, instances) {
		pushHistory();
		const nextZones = currentWorkspaceState.zones.map((g) => {
			if (g.id !== zoneId) return g;
			const faMap = {};
			const eaMap = {};
			for (const inst of instances) {
				if (inst.faEquipId) faMap[inst.faEquipId] = (faMap[inst.faEquipId] || 0) + 1;
				if (inst.eaEquipId) eaMap[inst.eaEquipId] = (eaMap[inst.eaEquipId] || 0) + 1;
			}
			const firstFA = Object.keys(faMap)[0] || null;
			const firstEA = Object.keys(eaMap)[0] || null;
			return {
				...g,
				instances,
				faAssignments: faMap,
				eaAssignments: eaMap,
				faAssignment: firstFA,
				eaAssignment: firstEA,
				faAssignedQty: firstFA ? faMap[firstFA] : 1,
				eaAssignedQty: firstEA ? eaMap[firstEA] : 1
			};
		});
		currentWorkspaceState = calculateVentilation(currentWorkspaceState.spaces, nextZones, currentWorkspaceState.equipment);
		saveState();
		notify();
	},
	addEquipment(newEquip) {
		pushHistory();
		const nextEquip = [...currentWorkspaceState.equipment, newEquip];
		currentWorkspaceState = calculateVentilation(currentWorkspaceState.spaces, currentWorkspaceState.zones, nextEquip);
		saveState();
		notify();
	},
	deleteEquipment(equipId) {
		pushHistory();
		const nextEquip = currentWorkspaceState.equipment.filter((e) => e.id !== equipId);
		const nextZones = currentWorkspaceState.zones.map((g) => {
			const currentFA = { ...g.faAssignments || {} };
			delete currentFA[equipId];
			const firstFA = Object.keys(currentFA)[0] || null;
			const currentEA = { ...g.eaAssignments || {} };
			delete currentEA[equipId];
			const firstEA = Object.keys(currentEA)[0] || null;
			return {
				...g,
				faAssignments: currentFA,
				faAssignment: firstFA,
				faAssignedQty: firstFA ? currentFA[firstFA] : 1,
				eaAssignments: currentEA,
				eaAssignment: firstEA,
				eaAssignedQty: firstEA ? currentEA[firstEA] : 1
			};
		});
		currentWorkspaceState = calculateVentilation(currentWorkspaceState.spaces, nextZones, nextEquip);
		saveState();
		notify();
	},
	undo() {
		if (undoStack.length === 0) return false;
		const previous = undoStack.pop();
		redoStack.push(JSON.stringify(currentWorkspaceState));
		currentWorkspaceState = JSON.parse(previous);
		saveState();
		notify();
		return true;
	},
	redo() {
		if (redoStack.length === 0) return false;
		const nextState = redoStack.pop();
		undoStack.push(JSON.stringify(currentWorkspaceState));
		currentWorkspaceState = JSON.parse(nextState);
		saveState();
		notify();
		return true;
	},
	copySpaces(ids) {
		const targets = currentWorkspaceState.spaces.filter((s) => ids.includes(s.id));
		if (targets.length === 0) return false;
		copiedSpaces = JSON.parse(JSON.stringify(targets));
		if (typeof window !== "undefined") localStorage.setItem("mep_clipboard_spaces", JSON.stringify(copiedSpaces));
		notify();
		return true;
	},
	cutSpaces(ids) {
		const targets = currentWorkspaceState.spaces.filter((s) => ids.includes(s.id));
		if (targets.length === 0) return false;
		copiedSpaces = JSON.parse(JSON.stringify(targets));
		if (typeof window !== "undefined") localStorage.setItem("mep_clipboard_spaces", JSON.stringify(copiedSpaces));
		this.deleteSpaces(ids);
		return true;
	},
	pasteSpaces() {
		if (copiedSpaces.length === 0) return [];
		pushHistory();
		const pasted = copiedSpaces.map((s, index) => {
			const newId = `sp-${Date.now()}-${index}-${Math.floor(Math.random() * 1e3)}`;
			const newCode = `${s.code.replace(/-CLONE(-\d+)?$/, "")}-CLONE-${Math.floor(Math.random() * 100)}`;
			return {
				...s,
				id: newId,
				code: newCode,
				name: `${s.name} (Copy)`
			};
		});
		const nextSpaces = [...currentWorkspaceState.spaces, ...pasted];
		const existingZoneNames = new Set(currentWorkspaceState.zones.map((z) => z.name.toLowerCase()));
		const existingZoneIds = new Set(currentWorkspaceState.zones.map((z) => z.id.toLowerCase()));
		const zonesToAdd = [];
		pasted.forEach((s) => {
			if (s.zone) {
				const zoneLower = s.zone.toLowerCase();
				if (!existingZoneNames.has(zoneLower) && !existingZoneIds.has(zoneLower)) {
					const zoneId = `zone-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
					zonesToAdd.push({
						id: zoneId,
						name: s.zone,
						building: s.building || "Tower A",
						floor: s.floor || "L01",
						spaceCount: 0,
						area: 0,
						freshAir: 0,
						extractAir: 0,
						pressure: 0,
						equipment: [],
						pressureType: "neutral",
						faAssignment: null,
						eaAssignment: null
					});
					existingZoneNames.add(zoneLower);
				}
			}
		});
		currentWorkspaceState = calculateVentilation(nextSpaces, [...currentWorkspaceState.zones, ...zonesToAdd], currentWorkspaceState.equipment);
		saveState();
		notify();
		return pasted;
	},
	getRoundOffPreset() {
		return currentWorkspaceState.roundOffPreset ?? 5;
	},
	setRoundOffPreset(value) {
		pushHistory();
		setGlobalRoundOffPreset(value);
		currentWorkspaceState.roundOffPreset = value;
		currentWorkspaceState = {
			...calculateVentilation(currentWorkspaceState.spaces, currentWorkspaceState.zones, currentWorkspaceState.equipment),
			roundOffPreset: value
		};
		saveState();
		notify();
	},
	subscribe(listener) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}
};
function useWorkspace() {
	const [state, setState] = (0, import_react.useState)(workspaceStore.getState());
	(0, import_react.useEffect)(() => {
		return workspaceStore.subscribe(() => {
			setState(workspaceStore.getState());
		});
	}, []);
	return {
		project: state.project,
		projects: state.projects,
		activeProjectId: state.activeProjectId,
		isInitializing: state.isInitializing,
		spaces: state.spaces,
		zones: state.zones,
		equipment: state.equipment,
		selectProject: (id) => workspaceStore.selectProject(id),
		createNewProject: (project) => workspaceStore.createNewProject(project),
		duplicateProject: (id) => workspaceStore.duplicateProject(id),
		deleteProject: (id) => workspaceStore.deleteProject(id),
		forceSaveToCloud: () => workspaceStore.forceSaveToCloud(),
		syncFromCloud: () => workspaceStore.syncFromCloud(),
		refreshProjects: () => workspaceStore.refreshProjects(),
		clearWorkspace: () => workspaceStore.clearWorkspace(),
		updateProject: (project) => workspaceStore.updateProject(project),
		updateSpaces: (spaces) => workspaceStore.updateSpaces(spaces),
		updateZones: (zones) => workspaceStore.updateZones(zones),
		updateEquipment: (equip) => workspaceStore.updateEquipment(equip),
		addSpace: (space) => workspaceStore.addSpace(space),
		addSpacesBulk: (spaces) => workspaceStore.addSpacesBulk(spaces),
		deleteSpaces: (ids) => workspaceStore.deleteSpaces(ids),
		bulkUpdateSpaces: (ids, updates) => workspaceStore.bulkUpdateSpaces(ids, updates),
		mergeSpaces: (ids, primaryId, mergedName) => workspaceStore.mergeSpaces(ids, primaryId, mergedName),
		addZone: (zone) => workspaceStore.addZone(zone),
		deleteZone: (zoneId) => workspaceStore.deleteZone(zoneId),
		autoZoneSpaces: (proposals) => workspaceStore.autoZoneSpaces(proposals),
		assignZoneToEquipment: (zoneId, equipId, stream, quantity) => workspaceStore.assignZoneToEquipment(zoneId, equipId, stream, quantity),
		removeZoneFromEquipment: (zoneId, equipId, stream) => workspaceStore.removeZoneFromEquipment(zoneId, equipId, stream),
		updateZoneInstances: (zoneId, instances) => workspaceStore.updateZoneInstances(zoneId, instances),
		addEquipment: (equip) => workspaceStore.addEquipment(equip),
		deleteEquipment: (equipId) => workspaceStore.deleteEquipment(equipId),
		setWorkspaceState: (newState) => workspaceStore.setState(newState),
		undo: () => workspaceStore.undo(),
		redo: () => workspaceStore.redo(),
		canUndo: undoStack.length > 0,
		canRedo: redoStack.length > 0,
		copySpaces: (ids) => workspaceStore.copySpaces(ids),
		cutSpaces: (ids) => workspaceStore.cutSpaces(ids),
		pasteSpaces: () => workspaceStore.pasteSpaces(),
		hasClipboard: copiedSpaces.length > 0,
		roundOffPreset: state.roundOffPreset,
		setRoundOffPreset: (val) => workspaceStore.setRoundOffPreset(val),
		isReadOnly: state.isReadOnly,
		setReadOnly: (val) => workspaceStore.setReadOnly(val),
		saveAsRevision: (name) => workspaceStore.saveAsRevision(name)
	};
}
//#endregion
export { getOccupancyData as a, predictOccupancyCategory as c, workspaceStore as d, workspace_store_Ct3ePlL1_exports as f, getOccupancyCategories as i, predictSpacePressure as l, getCalculatorTitleFromPath as n, logCalculatorUpdate as o, getCategoryDisplayName as r, logCalculatorView as s, calculateVentilation as t, useWorkspace as u };
