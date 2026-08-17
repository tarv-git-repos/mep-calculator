import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { j as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { N as Plus, Ot as ChevronRight, kt as ChevronDown, l as Upload, m as Trash2, ot as FolderKanban, p as Trash } from "../_libs/lucide-react.mjs";
import { a as usePrompt, i as useConfirm, r as cn } from "./use-confirm-BT3fngjN.mjs";
import { _ as dirtyStore, t as AppShell } from "./AppShell-urg-0zDa.mjs";
import { t as TBtn } from "./Button-BxVwVdnO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/lpd-calculation-CAVkiFzl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var LPD_AUTHORITY_MAPPING = {
	"drive way": .15,
	"passenger lift lobby": .65,
	"service lift lobby": .65,
	"lift lobby": .65,
	"electrical room": .43,
	"telephone room": .43,
	"gym": .9,
	"toilet": .9,
	"balcony": .61,
	"bath": .63,
	"bedroom": .5,
	"bedroom-1": .5,
	"bedroom-3": .5,
	"chilled water pump room": .43,
	"circulation area": .41,
	"entrance": .84,
	"fahu rooms": .43,
	"fahu rooms (5 nos.)": .43,
	"fcc control room": .43,
	"generator room": .43,
	"gsm": .43,
	"garbage room": .38,
	"kitchen": 1.09,
	"lv room": .43,
	"living/ dining room": .6,
	"living/ dinning room": .6,
	"m. bath": .63,
	"m. bed room": .5,
	"m. dressing": .51,
	"mtr": .43,
	"maid room": .5,
	"powder room": .63,
	"rmu room": .43,
	"spa": .9,
	"staircase": .49,
	"store": .38,
	"swimming pool room": .43,
	"transformer room": .43,
	"waste room": .43,
	"water meter room": .43,
	"yoga lobby": .65,
	"yoga room": .9,
	"Building Area Typea - Automotive facility (Building Method)": .73,
	"Convention center (Building Method)": .64,
	"Courthouse (Building Method)": .75,
	"Dining: Bar lounge/leisure (Building Method)": .74,
	"Dining: Cafeteria/fast food (Building Method)": .7,
	"Dining: Family (Building Method)": .65,
	"Dormitory (Building Method)": .52,
	"Exercise center (Building Method)": .72,
	"Fire station (Building Method)": .56,
	"Gymnasium (Building Method)": .75,
	"Health care clinic (Building Method)": .77,
	"Hospital (Building Method)": .92,
	"Hotel/motel (Building Method)": .53,
	"Library (Building Method)": .83,
	"Manufacturing facility (Building Method)": .82,
	"Motion picture theater (Building Method)": .43,
	"Multifamily (Building Method)": .46,
	"Museum (Building Method)": .56,
	"Office (Building Method)": .62,
	"Parking garage (Building Method)": .17,
	"Penitentiary (Building Method)": .65,
	"Performing arts theater (Building Method)": .82,
	"Police station (Building Method)": .62,
	"Post office (Building Method)": .64,
	"Religious facility (Building Method)": .66,
	"Retail (Building Method)": .78,
	"School/university (Building Method)": .7,
	"Sports arena (Building Method)": .73,
	"Town hall (Building Method)": .67,
	"Transportation (Building Method)": .56,
	"Warehouse (Building Method)": .45,
	"Workshop (Building Method)": .86,
	"Atrium - <20 ft in height (Space Method)": .32,
	"20 ft and 40 ft in height (Space Method)": .41,
	">40 ft in height (Space Method)": .51,
	"Audience Seating Area - Auditorium (Space Method)": .57,
	"Gymnasium (Space Method)": .23,
	"Motion picture theater (Space Method)": .2,
	"Performing arts theater (Space Method)": 1.21,
	"Sports arena (Space Method)": .27,
	"All other audience seating areas (Space Method)": .23,
	"Banking Activity Area (Space Method)": .56,
	"Classroom/Lecture Hall/Training Room - Shop classroom (Space Method)": 1.17,
	"All other classrooms/lecture halls/training rooms (Space Method)": .72,
	"Computer Room (Space Method)": .75,
	"Conference/Meeting/Multipurpose Rooms (Space Method)": .88,
	"Control/Editing Room or Booth (Space Method)": .73,
	"Copy/Print Room (Space Method)": .56,
	"Corridor (Space Method)": .44,
	"Courtroom (Space Method)": 1.08,
	"Dining Areas - Bar/lounge or leisure dining (Space Method)": .76,
	"food dining (Space Method)": .36,
	"Family dining (Space Method)": .52,
	"All other dining areas (Space Method)": .42,
	"Electrical/Mechanical Room (Space Method)": .71,
	"Emergency Vehicle Garage (Space Method)": .51,
	"Equipment Room (Space Method)": .73,
	"Food Preparation Area (Space Method)": 1.19,
	"Guest Room (Space Method)": .41,
	"Laboratory - In or as a classroom (Space Method)": 1.05,
	"All other laboratories (Space Method)": 1.21,
	"Laundry/Washing Area (Space Method)": .51,
	"Loading Dock, Interior (Space Method)": .87,
	"Lobby - Elevator (Space Method)": .64,
	"Hotel (Space Method)": .48,
	"All other lobbies (Space Method)": .8,
	"Locker Room (Space Method)": .43,
	"Lounge/Breakroom - Mother’s/wellness room (Space Method)": .68,
	"All other lounges/breakrooms (Space Method)": .55,
	"Office - Office 150 ft2 (Space Method)": .73,
	"Office >150 and 300 ft2 (Space Method)": .66,
	"Offices >300 ft2 (Space Method)": .56,
	"Parking Garage - Daylight transition zone (Space Method)": 1.06,
	"All other parking and drive areas (Space Method)": .11,
	"Pharmacy Area (Space Method)": 1.59,
	"Restroom (Space Method)": .74,
	"Sales Area (For accent lighting, see Section 9.5.2.2[b].) (Space Method)": .85,
	"Seating Area, General (Space Method)": .21,
	"Security Screening - Airport/bus/ship/train/transportation screening (Space Method)": .93,
	"Airport/bus/ship/train/transportation screening queue (Space Method)": .56,
	"General security screening (Space Method)": .64,
	"Stairwell (Space Method)": .47,
	"Storage Room - <50 ft2 (Space Method)": .49,
	"50 ft2 (Space Method)": .35,
	"Vehicular Maintenance Area (Space Method)": .59,
	"Workshop (including workshop classrooms) (Space Method)": 1.17,
	"Casino—Gaming Area - Betting/sportsbook/keno/bingo area (Space Method)": .82,
	"High-limit game area (Space Method)": 1.68,
	"Slot machine/digital gaming area (Space Method)": .54,
	"Table games area (Space Method)": 1.09,
	"Convention Center—Exhibit Space (Space Method)": .5,
	"Correctional Facilities - Audience seating area (Space Method)": .56,
	"Classroom/lecture hall/training room (Space Method)": .74,
	"Confinement cells (Space Method)": .6,
	"Dining area (Space Method)": .35,
	"Dormitory—Living Quarters (Space Method)": .48,
	"Chapel (used primarily by residents) (Space Method)": .58,
	"Corridor (used primarily by residents) (Space Method)": .71,
	"Dining (used primarily by residents) (Space Method)": 1.22,
	"Lobby (Space Method)": 1.44,
	"Recreation room/common living room  - (used primarily by residents) (Space Method)": 1.2,
	"Restroom (used primarily by residents) (Space Method)": .96,
	"Fire Station—Sleeping Quarters (Space Method)": .22,
	"Gymnasium/Fitness Center - Exercise area (Space Method)": .82,
	"Playing area (Space Method)": .82,
	"Health Care Facility - Control room (MRI/CT/radiology/PET) (Space Method)": .78,
	"Exam/treatment room (Space Method)": 1.33,
	"Hospital corridor (Space Method)": .61,
	"Imaging room (Space Method)": .94,
	"Lounge (Space Method)": .77,
	"Medical supply room (Space Method)": .56,
	"Nursery (Space Method)": .87,
	"Nurse’s station (Space Method)": 1.07,
	"Operating room (Space Method)": 2.31,
	"Patient room (Space Method)": .78,
	"Physical therapy room (Space Method)": .82,
	"Recovery room (Space Method)": 1.18,
	"Telemedicine (Space Method)": 1.44,
	"Library - Reading area (Space Method)": .86,
	"Stacks (Space Method)": 1.18,
	"Manufacturing Facility - Detailed manufacturing area (Space Method)": .75,
	"Extra-high bay area (>50 ft floor-to-ceiling height) (Space Method)": 1.36,
	"ceiling height) (Space Method)": 1.24,
	"Low bay area (<25 ft floor-to-ceiling height) (Space Method)": .85,
	"Museum - General exhibition area (Space Method)": .31,
	"Restoration area (Space Method)": 1.24,
	"Performing Arts Theater—Dressing Room (Space Method)": .39,
	"Post Office—Sorting Area (Space Method)": .71,
	"Religious Facility - Audience seating area (Space Method)": .72,
	"Fellowship hall (Space Method)": .5,
	"Worship/pulpit/choir area (Space Method)": .75,
	"Retail Facilities - Dressing/fitting room (Space Method)": .45,
	"Hair care (Space Method)": .65,
	"Mall concourse (Space Method)": .57,
	"Massage (Space Method)": .81,
	"Nail care (Space Method)": .75,
	"Sports Arena—Playing Area (Class of play as defined by ANSI/IES RP-6) - Class I facility (Space Method)": 2.86,
	"Class II facility (Space Method)": 1.47,
	"Class III facility (Space Method)": .99,
	"Class IV facility (Space Method)": .59,
	"Natatorium (Class of play as defined by IES RP-6) - Class I facility (Space Method)": 2.2,
	"Transportation Facility - Airport hanger (Space Method)": 1.36,
	"Baggage/carousel area (Space Method)": .28,
	"Concourse (Space Method)": .49,
	"Passenger loading area (Space Method)": .71,
	"Ticket counter (Space Method)": .4,
	"Warehouse—Storage Area - Medium-to-bulky, palletized items (Space Method)": .33,
	"Smaller items, picking areas (Space Method)": .69
};
var LIGHT_TYPE_MAPPING = {
	"W3": 40,
	"TR-3": 10.5,
	"D1": 10,
	"L2": 26,
	"L3": 26,
	"D10": 35,
	"TR-3, COVE": 20.5
};
var DEFAULT_AUTHORITY_MAPPING_SQM = Object.fromEntries(Object.entries(LPD_AUTHORITY_MAPPING).map(([k, v]) => [k, v * 10.76391]));
var defaultFixture = () => ({
	id: crypto.randomUUID(),
	type: "W3",
	watts: "40",
	qty: "1"
});
var defaultSpace = () => ({
	id: crypto.randomUUID(),
	name: "",
	areaType: "",
	areaSqM: "",
	baselineLpd: "0.43",
	remarks: "",
	fixtures: [defaultFixture()]
});
var defaultGroup = (name = "GROUND FLOOR") => ({
	id: crypto.randomUUID(),
	name,
	isExpanded: true,
	spaces: [defaultSpace()]
});
var defaultProject = () => ({
	id: crypto.randomUUID(),
	name: "New LPD Project",
	type: "Internal",
	projectNo: "",
	client: "",
	endUser: "",
	calculationNo: "",
	revNo: "00",
	date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
	internalGroups: [defaultGroup("INTERNAL AREA")],
	externalGroups: [defaultGroup("EXTERNAL AREA")]
});
function LPDCalculationPage() {
	const [projects, setProjects] = (0, import_react.useState)([defaultProject()]);
	const [currentProjectId, setCurrentProjectId] = (0, import_react.useState)(projects[0].id);
	const [authorityMapping, setAuthorityMapping] = (0, import_react.useState)(DEFAULT_AUTHORITY_MAPPING_SQM);
	const confirm = useConfirm();
	const prompt = usePrompt();
	(0, import_react.useEffect)(() => {
		const saved = localStorage.getItem("mep-lpd-calc-v2");
		if (saved) try {
			const parsed = JSON.parse(saved);
			if (parsed.projects && parsed.projects.length > 0) {
				const migratedProjects = parsed.projects.map((p) => {
					if (p.groups) {
						p.internalGroups = p.groups;
						p.externalGroups = [defaultGroup("EXTERNAL AREA")];
						delete p.groups;
					}
					if (!p.internalGroups) p.internalGroups = [defaultGroup("INTERNAL AREA")];
					if (!p.externalGroups) p.externalGroups = [defaultGroup("EXTERNAL AREA")];
					return p;
				});
				setProjects(migratedProjects);
				setCurrentProjectId(parsed.currentProjectId || migratedProjects[0].id);
			}
		} catch (e) {}
		const savedMapping = localStorage.getItem("mep-lpd-custom-mapping-sqm");
		if (savedMapping) try {
			const parsed = JSON.parse(savedMapping);
			setAuthorityMapping((prev) => ({
				...prev,
				...parsed
			}));
		} catch (e) {}
	}, []);
	(0, import_react.useEffect)(() => {
		localStorage.setItem("mep-lpd-calc-v2", JSON.stringify({
			projects,
			currentProjectId
		}));
		localStorage.setItem("mep-lpd-custom-mapping-sqm", JSON.stringify(authorityMapping));
		dirtyStore.set(true);
	}, [
		projects,
		currentProjectId,
		authorityMapping
	]);
	const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0];
	const updateProject = (fn) => {
		setProjects((prev) => prev.map((p) => p.id === currentProjectId ? fn(p) : p));
	};
	const updateProjectField = (field, value) => {
		updateProject((p) => ({
			...p,
			[field]: value
		}));
	};
	const isInt = currentProject.type === "Internal";
	const activeGroups = isInt ? currentProject.internalGroups : currentProject.externalGroups;
	const updateActiveGroups = (fn) => {
		updateProject((p) => isInt ? {
			...p,
			internalGroups: fn(p.internalGroups)
		} : {
			...p,
			externalGroups: fn(p.externalGroups)
		});
	};
	const addGroup = () => updateActiveGroups((groups) => [...groups, defaultGroup(isInt ? "INTERNAL AREA" : "EXTERNAL AREA")]);
	const removeGroup = (gid) => updateActiveGroups((groups) => groups.filter((g) => g.id !== gid));
	const addSpace = (gid) => updateActiveGroups((groups) => groups.map((g) => g.id === gid ? {
		...g,
		spaces: [...g.spaces, defaultSpace()]
	} : g));
	const removeSpace = (gid, sid) => updateActiveGroups((groups) => groups.map((g) => g.id === gid ? {
		...g,
		spaces: g.spaces.filter((s) => s.id !== sid)
	} : g));
	const addFixture = (gid, sid) => updateActiveGroups((groups) => groups.map((g) => g.id === gid ? {
		...g,
		spaces: g.spaces.map((s) => s.id === sid ? {
			...s,
			fixtures: [...s.fixtures, defaultFixture()]
		} : s)
	} : g));
	const updateFixture = (gid, sid, fid, field, val) => updateActiveGroups((groups) => groups.map((g) => g.id === gid ? {
		...g,
		spaces: g.spaces.map((s) => s.id === sid ? {
			...s,
			fixtures: s.fixtures.map((f) => {
				if (f.id === fid) {
					const newF = {
						...f,
						[field]: val
					};
					if (field === "type" && val !== "custom") {
						if (LIGHT_TYPE_MAPPING[val] !== void 0) newF.watts = LIGHT_TYPE_MAPPING[val].toString();
						else if (val === "") newF.watts = "";
					}
					return newF;
				}
				return f;
			})
		} : s)
	} : g));
	const updateSpace = (gid, sid, field, val) => updateActiveGroups((groups) => groups.map((g) => g.id === gid ? {
		...g,
		spaces: g.spaces.map((s) => {
			if (s.id === sid) {
				const newS = {
					...s,
					[field]: val
				};
				if (field === "areaType" && val !== "") {
					const lpdSqm = authorityMapping[val.toLowerCase()] || authorityMapping[val];
					if (lpdSqm !== void 0) newS.baselineLpd = Number(lpdSqm).toFixed(2);
				}
				return newS;
			}
			return s;
		})
	} : g));
	const updateGroup = (gid, field, val) => updateActiveGroups((groups) => groups.map((g) => g.id === gid ? {
		...g,
		[field]: val
	} : g));
	const createNewProject = () => {
		const p = defaultProject();
		setProjects([...projects, p]);
		setCurrentProjectId(p.id);
	};
	const deleteProject = async () => {
		if (projects.length <= 1) return alert("Cannot delete the last project.");
		if (await confirm("Are you sure you want to delete this project?")) {
			const newProjects = projects.filter((p) => p.id !== currentProjectId);
			setProjects(newProjects);
			setCurrentProjectId(newProjects[0].id);
		}
	};
	const handleImportExcel = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		try {
			const { read, utils } = await import("../_libs/xlsx.mjs").then((n) => n.i);
			const workbook = read(await file.arrayBuffer());
			const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
			const json = utils.sheet_to_json(firstSheet, { header: 1 });
			const newMap = { ...authorityMapping };
			let added = 0;
			for (let i = 1; i < json.length; i++) {
				const row = json[i];
				if (row && row[0] && row[1] !== void 0) {
					const areaName = String(row[0]).trim();
					const lpd = Number(row[1]);
					if (areaName && !isNaN(lpd)) {
						newMap[areaName] = lpd;
						added++;
					}
				}
			}
			if (added > 0) {
				setAuthorityMapping(newMap);
				localStorage.setItem("mep-lpd-custom-mapping-sqm", JSON.stringify(newMap));
				alert(`Successfully imported ${added} area types!`);
			} else alert("No valid rows found. Please ensure Column A has Area Names and Column B has Baseline LPD values.");
		} catch (err) {
			console.error(err);
			alert("Error importing Excel file.");
		}
		e.target.value = "";
	};
	const actions = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex gap-2",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
			className: "flex items-center gap-2 cursor-pointer bg-surface-2 hover:bg-surface-3 border border-border rounded-xl px-3 py-1.5 text-[12.5px] font-medium transition-colors",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, { className: "size-3.5" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Import Catalog" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "file",
					accept: ".xlsx, .xls",
					className: "hidden",
					onChange: handleImportExcel
				})
			]
		})
	});
	let globalSrNo = 1;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "LPD Calculation",
		hideSubHeader: true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col h-full overflow-hidden pt-4 gap-4 bg-slate-50/30 dark:bg-slate-950/30 relative",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-4 z-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] font-bold tracking-wider text-muted-foreground uppercase",
								children: "ELECTRICAL > LPD CALCULATION"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex items-center gap-3 mt-0.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
									className: "text-[28px] font-bold tracking-tight text-foreground",
									children: "LPD Calculation"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[13px] text-muted-foreground mt-0.5",
								children: "Calculate Lighting Power Density using Space-by-Space Method"
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-2 flex-wrap",
						children: actions
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative z-10 flex flex-col w-full h-full min-h-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col md:flex-row items-start md:items-center justify-between px-4 py-3 min-h-[56px] h-auto border-b border-white/40 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md shrink-0 select-none gap-y-3 overflow-x-auto shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
									className: "h-8 text-[12.5px] font-medium bg-white/50 dark:bg-black/40 hover:bg-white/80 dark:hover:bg-white/10 border border-white/50 dark:border-white/10 rounded-xl px-2 outline-none cursor-pointer transition-all backdrop-blur-sm shadow-sm",
									value: currentProjectId,
									onChange: (e) => setCurrentProjectId(e.target.value),
									children: projects.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: p.id,
										children: p.name
									}, p.id))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
									onClick: createNewProject,
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderKanban, { className: "size-3.5" }), " New"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TBtn, {
									onClick: deleteProject,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash, { className: "size-3.5 text-red-500" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "w-px h-4 bg-black/10 dark:bg-white/10 mx-1" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex bg-surface-2 p-0.5 rounded-full border border-border",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => updateProjectField("type", "Internal"),
										className: `px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${currentProject.type === "Internal" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`,
										children: "Internal Area"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => updateProjectField("type", "External"),
										className: `px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${currentProject.type === "External" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`,
										children: "External Area"
									})]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
								primary: true,
								onClick: addGroup,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Add Group"]
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 overflow-auto p-4 space-y-6",
						children: activeGroups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden transition-all duration-300",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center px-4 py-3 bg-white/40 dark:bg-white/5 border-b border-white/40 dark:border-white/10 group",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => updateGroup(group.id, "isExpanded", !group.isExpanded),
										className: "p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md mr-2 text-foreground/70 transition-colors",
										children: group.isExpanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "bg-transparent font-bold text-[14px] text-primary outline-none focus:bg-white/50 dark:focus:bg-black/50 px-2 py-1 rounded-md w-64 uppercase transition-colors",
										value: group.name,
										onChange: (e) => updateGroup(group.id, "name", e.target.value),
										placeholder: "e.g. GROUND FLOOR"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TBtn, {
											onClick: () => addSpace(group.id),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" }), " Space"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TBtn, {
											onClick: () => removeGroup(group.id),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5 text-red-500" })
										})]
									})
								]
							}), group.isExpanded && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "overflow-x-auto",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full text-left border-collapse min-w-[800px]",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										className: "bg-white/30 dark:bg-white/5 border-b border-white/40 dark:border-white/10 text-[11px] font-bold text-foreground/70 uppercase tracking-wider",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-12 text-center",
												children: "S.No"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-48",
												children: "Area / Space"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-48",
												children: "Type of Area"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-40",
												children: "Light Type"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center",
												children: "Watts"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center",
												children: "Qty"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center",
												children: "Total Watts"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center",
												children: "Sq.M Area"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center",
												children: "Sq.F Area"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-28 text-center text-primary drop-shadow-sm",
												children: [
													"Proposed LPD",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
													"(W/SQ.M)"
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center",
												children: [
													"Baseline LPD",
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
													"(W/SQ.M)"
												]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "px-3 py-2 border-r border-white/40 dark:border-white/10 w-32 text-center",
												children: "Remarks"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "px-2 py-2 w-10 text-center" })
										]
									}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
										className: "text-[13px]",
										children: [group.spaces.map((space, sIndex) => {
											const totalWatts = space.fixtures.reduce((sum, f) => {
												return sum + (parseFloat(String(f.watts)) || 0) * (parseFloat(String(f.qty)) || 0);
											}, 0);
											const sqM = parseFloat(String(space.areaSqM)) || 0;
											const sqF = sqM * 10.764;
											const proposedLpd = sqM > 0 ? totalWatts / sqM : 0;
											const isPass = proposedLpd <= (parseFloat(String(space.baselineLpd)) || 0);
											const srNo = globalSrNo++;
											return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Fragment, { children: space.fixtures.map((fixture, fIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
												className: "border-b border-white/20 dark:border-white/5 group/row hover:bg-white/40 dark:hover:bg-white/10 transition-colors",
												children: [
													fIndex === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "px-3 py-1.5 border-r border-white/20 dark:border-white/10 text-center font-mono text-foreground/70",
															rowSpan: space.fixtures.length,
															children: srNo
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-0 border-r border-white/20 dark:border-white/10",
															rowSpan: space.fixtures.length,
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																className: "w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 transition-colors",
																value: space.name,
																onChange: (e) => updateSpace(group.id, space.id, "name", e.target.value),
																placeholder: "e.g. Electrical Room"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-0 border-r border-white/20 dark:border-white/10",
															rowSpan: space.fixtures.length,
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
																className: "w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 cursor-pointer font-medium text-[12.5px] transition-colors",
																value: space.areaType || "",
																onChange: async (e) => {
																	const val = e.target.value;
																	if (val === "ADD_NEW") {
																		const newArea = await prompt("Enter new Area Name:", "", { title: "New Area Name" });
																		if (newArea) {
																			const newLpdStr = await prompt(`Enter Baseline LPD for '${newArea}' (W/Sq.M):`, "", { title: "Baseline LPD" });
																			if (newLpdStr && !isNaN(Number(newLpdStr))) {
																				const newLpd = Number(newLpdStr);
																				const newMap = {
																					...authorityMapping,
																					[newArea]: newLpd
																				};
																				setAuthorityMapping(newMap);
																				localStorage.setItem("mep-lpd-custom-mapping-sqm", JSON.stringify(newMap));
																				updateActiveGroups((groups) => groups.map((g) => g.id === group.id ? {
																					...g,
																					spaces: g.spaces.map((s) => {
																						if (s.id === space.id) return {
																							...s,
																							areaType: newArea,
																							baselineLpd: newLpd.toFixed(2)
																						};
																						return s;
																					})
																				} : g));
																			}
																		}
																	} else updateSpace(group.id, space.id, "areaType", val);
																},
																children: [
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "",
																		children: "Select Type..."
																	}),
																	Object.keys(authorityMapping).sort().map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: k,
																		children: k.replace(/\b\w/g, (l) => l.toUpperCase())
																	}, k)),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		disabled: true,
																		children: "──────────"
																	}),
																	/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																		value: "ADD_NEW",
																		children: "+ Add New Area Type..."
																	})
																]
															})
														})
													] }),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-0 border-r border-white/20 dark:border-white/10 relative",
														children: !Object.keys(LIGHT_TYPE_MAPPING).includes(fixture.type) && fixture.type !== "" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex w-full h-full items-center",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																className: "w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 font-medium text-[12.5px] transition-colors",
																value: fixture.type === "custom" ? "" : fixture.type,
																onChange: (e) => updateFixture(group.id, space.id, fixture.id, "type", e.target.value || "custom"),
																placeholder: "Type Light Name...",
																autoFocus: fixture.type === "custom"
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => updateFixture(group.id, space.id, fixture.id, "type", ""),
																className: "px-2 text-foreground/50 hover:text-red-500 font-bold transition-colors",
																title: "Reset to Dropdown",
																children: "×"
															})]
														}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
															className: "w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 cursor-pointer font-medium text-[12.5px] transition-colors",
															value: fixture.type,
															onChange: (e) => updateFixture(group.id, space.id, fixture.id, "type", e.target.value),
															children: [
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "",
																	children: "Select..."
																}),
																Object.keys(LIGHT_TYPE_MAPPING).map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
																	value: k,
																	children: [
																		k,
																		" (",
																		LIGHT_TYPE_MAPPING[k],
																		"W)"
																	]
																}, k)),
																/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
																	value: "custom",
																	children: "Custom Input"
																})
															]
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-0 border-r border-white/20 dark:border-white/10",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															min: "0",
															className: "w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 text-center font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors",
															value: fixture.watts,
															onChange: (e) => updateFixture(group.id, space.id, fixture.id, "watts", e.target.value),
															placeholder: "0",
															disabled: Object.keys(LIGHT_TYPE_MAPPING).includes(fixture.type)
														})
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "p-0 border-r border-white/20 dark:border-white/10",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
															type: "number",
															min: "1",
															className: "w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors",
															value: fixture.qty,
															onChange: (e) => updateFixture(group.id, space.id, fixture.id, "qty", e.target.value),
															placeholder: "1"
														})
													}),
													fIndex === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "px-3 py-1.5 border-r border-white/20 dark:border-white/10 text-center font-mono font-medium",
															rowSpan: space.fixtures.length,
															children: totalWatts
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-0 border-r border-white/20 dark:border-white/10",
															rowSpan: space.fixtures.length,
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																min: "0",
																className: "w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors",
																value: space.areaSqM,
																onChange: (e) => updateSpace(group.id, space.id, "areaSqM", e.target.value),
																placeholder: "0.0"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "px-3 py-1.5 border-r border-white/20 dark:border-white/10 text-center font-mono text-foreground/70 bg-white/10 dark:bg-white/5",
															rowSpan: space.fixtures.length,
															children: sqF.toFixed(2)
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: cn("px-3 py-1.5 border-r border-white/20 dark:border-white/10 text-center font-mono font-bold drop-shadow-sm", isPass ? "text-green-600 dark:text-green-400 bg-green-500/20" : "text-red-600 dark:text-red-400 bg-red-500/20"),
															rowSpan: space.fixtures.length,
															children: proposedLpd.toFixed(4)
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-0 border-r border-white/20 dark:border-white/10",
															rowSpan: space.fixtures.length,
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "number",
																min: "0",
																step: "0.01",
																className: "w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors",
																value: space.baselineLpd,
																onChange: (e) => updateSpace(group.id, space.id, "baselineLpd", e.target.value),
																placeholder: "0.43"
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
															className: "p-0 border-r border-white/20 dark:border-white/10",
															rowSpan: space.fixtures.length,
															children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
																type: "text",
																className: "w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 text-center transition-colors",
																value: space.remarks || "",
																onChange: (e) => updateSpace(group.id, space.id, "remarks", e.target.value),
																placeholder: ""
															})
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
															className: "px-2 py-1.5 text-center flex flex-col gap-1 items-center",
															rowSpan: space.fixtures.length,
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => addFixture(group.id, space.id),
																className: "p-1 hover:bg-white/20 rounded-md text-foreground/50 hover:text-primary transition-colors",
																title: "Add Fixture",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-3.5" })
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
																onClick: () => removeSpace(group.id, space.id),
																className: "p-1 hover:bg-red-500/20 rounded-md text-foreground/50 hover:text-red-500 transition-colors",
																title: "Remove Space",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "size-3.5" })
															})]
														})
													] })
												]
											}, fixture.id)) }, space.id);
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
											colSpan: 13,
											className: "p-2 border-t border-white/40 dark:border-white/10",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
												onClick: () => addSpace(group.id),
												className: "w-full flex items-center justify-center py-2 border-2 border-dashed border-border/60 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all font-medium text-sm",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4 mr-2" }), " Add Row (Space)"]
											})
										}) })]
									})]
								})
							})]
						}, group.id))
					})]
				})
			]
		})
	});
}
//#endregion
export { LPDCalculationPage as component };
