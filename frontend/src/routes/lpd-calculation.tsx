import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { Plus, Trash2, Search, Download, Trash, Upload, FolderKanban, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";
import { exportLpdExcel } from "../lib/exportLpdExcel";
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/lpd-calculation")({
  head: () => ({
    meta: [
      { title: "LPD Calculation — MEP Calc" },
      { name: "description", content: "Lighting Power Density (LPD) Calculations." },
    ],
  }),
  component: LPDCalculationPage,
});

export interface LightFixture {
  id: string;
  type: string;
  watts: string;
  qty: string;
}

const LPD_AUTHORITY_MAPPING: Record<string, number> = {
  "drive way": 0.15,
  "passenger lift lobby": 0.65,
  "service lift lobby": 0.65,
  "lift lobby": 0.65,
  "electrical room": 0.43,
  "telephone room": 0.43,
  "gym": 0.90,
  "toilet": 0.90,
  "balcony": 0.61,
  "bath": 0.63,
  "bedroom": 0.50,
  "bedroom-1": 0.50,
  "bedroom-3": 0.50,
  "chilled water pump room": 0.43,
  "circulation area": 0.41,
  "entrance": 0.84,
  "fahu rooms": 0.43,
  "fahu rooms (5 nos.)": 0.43,
  "fcc control room": 0.43,
  "generator room": 0.43,
  "gsm": 0.43,
  "garbage room": 0.38,
  "kitchen": 1.09,
  "lv room": 0.43,
  "living/ dining room": 0.60,
  "living/ dinning room": 0.60,
  "m. bath": 0.63,
  "m. bed room": 0.50,
  "m. dressing": 0.51,
  "mtr": 0.43,
  "maid room": 0.50,
  "powder room": 0.63,
  "rmu room": 0.43,
  "spa": 0.90,
  "staircase": 0.49,
  "store": 0.38,
  "swimming pool room": 0.43,
  "transformer room": 0.43,
  "waste room": 0.43,
  "water meter room": 0.43,
  "yoga lobby": 0.65,
  "yoga room": 0.90,
  "Building Area Typea - Automotive facility (Building Method)": 0.73,
  "Convention center (Building Method)": 0.64,
  "Courthouse (Building Method)": 0.75,
  "Dining: Bar lounge/leisure (Building Method)": 0.74,
  "Dining: Cafeteria/fast food (Building Method)": 0.7,
  "Dining: Family (Building Method)": 0.65,
  "Dormitory (Building Method)": 0.52,
  "Exercise center (Building Method)": 0.72,
  "Fire station (Building Method)": 0.56,
  "Gymnasium (Building Method)": 0.75,
  "Health care clinic (Building Method)": 0.77,
  "Hospital (Building Method)": 0.92,
  "Hotel/motel (Building Method)": 0.53,
  "Library (Building Method)": 0.83,
  "Manufacturing facility (Building Method)": 0.82,
  "Motion picture theater (Building Method)": 0.43,
  "Multifamily (Building Method)": 0.46,
  "Museum (Building Method)": 0.56,
  "Office (Building Method)": 0.62,
  "Parking garage (Building Method)": 0.17,
  "Penitentiary (Building Method)": 0.65,
  "Performing arts theater (Building Method)": 0.82,
  "Police station (Building Method)": 0.62,
  "Post office (Building Method)": 0.64,
  "Religious facility (Building Method)": 0.66,
  "Retail (Building Method)": 0.78,
  "School/university (Building Method)": 0.7,
  "Sports arena (Building Method)": 0.73,
  "Town hall (Building Method)": 0.67,
  "Transportation (Building Method)": 0.56,
  "Warehouse (Building Method)": 0.45,
  "Workshop (Building Method)": 0.86,
  "Atrium - <20 ft in height (Space Method)": 0.32,
  "20 ft and 40 ft in height (Space Method)": 0.41,
  ">40 ft in height (Space Method)": 0.51,
  "Audience Seating Area - Auditorium (Space Method)": 0.57,
  "Gymnasium (Space Method)": 0.23,
  "Motion picture theater (Space Method)": 0.2,
  "Performing arts theater (Space Method)": 1.21,
  "Sports arena (Space Method)": 0.27,
  "All other audience seating areas (Space Method)": 0.23,
  "Banking Activity Area (Space Method)": 0.56,
  "Classroom/Lecture Hall/Training Room - Shop classroom (Space Method)": 1.17,
  "All other classrooms/lecture halls/training rooms (Space Method)": 0.72,
  "Computer Room (Space Method)": 0.75,
  "Conference/Meeting/Multipurpose Rooms (Space Method)": 0.88,
  "Control/Editing Room or Booth (Space Method)": 0.73,
  "Copy/Print Room (Space Method)": 0.56,
  "Corridor (Space Method)": 0.44,
  "Courtroom (Space Method)": 1.08,
  "Dining Areas - Bar/lounge or leisure dining (Space Method)": 0.76,
  "food dining (Space Method)": 0.36,
  "Family dining (Space Method)": 0.52,
  "All other dining areas (Space Method)": 0.42,
  "Electrical/Mechanical Room (Space Method)": 0.71,
  "Emergency Vehicle Garage (Space Method)": 0.51,
  "Equipment Room (Space Method)": 0.73,
  "Food Preparation Area (Space Method)": 1.19,
  "Guest Room (Space Method)": 0.41,
  "Laboratory - In or as a classroom (Space Method)": 1.05,
  "All other laboratories (Space Method)": 1.21,
  "Laundry/Washing Area (Space Method)": 0.51,
  "Loading Dock, Interior (Space Method)": 0.87,
  "Lobby - Elevator (Space Method)": 0.64,
  "Hotel (Space Method)": 0.48,
  "All other lobbies (Space Method)": 0.8,
  "Locker Room (Space Method)": 0.43,
  "Lounge/Breakroom - Mother’s/wellness room (Space Method)": 0.68,
  "All other lounges/breakrooms (Space Method)": 0.55,
  "Office - Office 150 ft2 (Space Method)": 0.73,
  "Office >150 and 300 ft2 (Space Method)": 0.66,
  "Offices >300 ft2 (Space Method)": 0.56,
  "Parking Garage - Daylight transition zone (Space Method)": 1.06,
  "All other parking and drive areas (Space Method)": 0.11,
  "Pharmacy Area (Space Method)": 1.59,
  "Restroom (Space Method)": 0.74,
  "Sales Area (For accent lighting, see Section 9.5.2.2[b].) (Space Method)": 0.85,
  "Seating Area, General (Space Method)": 0.21,
  "Security Screening - Airport/bus/ship/train/transportation screening (Space Method)": 0.93,
  "Airport/bus/ship/train/transportation screening queue (Space Method)": 0.56,
  "General security screening (Space Method)": 0.64,
  "Stairwell (Space Method)": 0.47,
  "Storage Room - <50 ft2 (Space Method)": 0.49,
  "50 ft2 (Space Method)": 0.35,
  "Vehicular Maintenance Area (Space Method)": 0.59,
  "Workshop (including workshop classrooms) (Space Method)": 1.17,
  "Casino—Gaming Area - Betting/sportsbook/keno/bingo area (Space Method)": 0.82,
  "High-limit game area (Space Method)": 1.68,
  "Slot machine/digital gaming area (Space Method)": 0.54,
  "Table games area (Space Method)": 1.09,
  "Convention Center—Exhibit Space (Space Method)": 0.5,
  "Correctional Facilities - Audience seating area (Space Method)": 0.56,
  "Classroom/lecture hall/training room (Space Method)": 0.74,
  "Confinement cells (Space Method)": 0.6,
  "Dining area (Space Method)": 0.35,
  "Dormitory—Living Quarters (Space Method)": 0.48,
  "Chapel (used primarily by residents) (Space Method)": 0.58,
  "Corridor (used primarily by residents) (Space Method)": 0.71,
  "Dining (used primarily by residents) (Space Method)": 1.22,
  "Lobby (Space Method)": 1.44,
  "Recreation room/common living room  - (used primarily by residents) (Space Method)": 1.2,
  "Restroom (used primarily by residents) (Space Method)": 0.96,
  "Fire Station—Sleeping Quarters (Space Method)": 0.22,
  "Gymnasium/Fitness Center - Exercise area (Space Method)": 0.82,
  "Playing area (Space Method)": 0.82,
  "Health Care Facility - Control room (MRI/CT/radiology/PET) (Space Method)": 0.78,
  "Exam/treatment room (Space Method)": 1.33,
  "Hospital corridor (Space Method)": 0.61,
  "Imaging room (Space Method)": 0.94,
  "Lounge (Space Method)": 0.77,
  "Medical supply room (Space Method)": 0.56,
  "Nursery (Space Method)": 0.87,
  "Nurse’s station (Space Method)": 1.07,
  "Operating room (Space Method)": 2.31,
  "Patient room (Space Method)": 0.78,
  "Physical therapy room (Space Method)": 0.82,
  "Recovery room (Space Method)": 1.18,
  "Telemedicine (Space Method)": 1.44,
  "Library - Reading area (Space Method)": 0.86,
  "Stacks (Space Method)": 1.18,
  "Manufacturing Facility - Detailed manufacturing area (Space Method)": 0.75,
  "Extra-high bay area (>50 ft floor-to-ceiling height) (Space Method)": 1.36,
  "ceiling height) (Space Method)": 1.24,
  "Low bay area (<25 ft floor-to-ceiling height) (Space Method)": 0.85,
  "Museum - General exhibition area (Space Method)": 0.31,
  "Restoration area (Space Method)": 1.24,
  "Performing Arts Theater—Dressing Room (Space Method)": 0.39,
  "Post Office—Sorting Area (Space Method)": 0.71,
  "Religious Facility - Audience seating area (Space Method)": 0.72,
  "Fellowship hall (Space Method)": 0.5,
  "Worship/pulpit/choir area (Space Method)": 0.75,
  "Retail Facilities - Dressing/fitting room (Space Method)": 0.45,
  "Hair care (Space Method)": 0.65,
  "Mall concourse (Space Method)": 0.57,
  "Massage (Space Method)": 0.81,
  "Nail care (Space Method)": 0.75,
  "Sports Arena—Playing Area (Class of play as defined by ANSI/IES RP-6) - Class I facility (Space Method)": 2.86,
  "Class II facility (Space Method)": 1.47,
  "Class III facility (Space Method)": 0.99,
  "Class IV facility (Space Method)": 0.59,
  "Natatorium (Class of play as defined by IES RP-6) - Class I facility (Space Method)": 2.2,
  "Transportation Facility - Airport hanger (Space Method)": 1.36,
  "Baggage/carousel area (Space Method)": 0.28,
  "Concourse (Space Method)": 0.49,
  "Passenger loading area (Space Method)": 0.71,
  "Ticket counter (Space Method)": 0.4,
  "Warehouse—Storage Area - Medium-to-bulky, palletized items (Space Method)": 0.33,
  "Smaller items, picking areas (Space Method)": 0.69,
};


const LIGHT_TYPE_MAPPING: Record<string, number> = {
  "W3": 40,
  "TR-3": 10.5,
  "D1": 10,
  "L2": 26,
  "L3": 26,
  "D10": 35,
  "TR-3, COVE": 20.5
};

const DEFAULT_AUTHORITY_MAPPING_SQM: Record<string, number> = Object.fromEntries(
  Object.entries(LPD_AUTHORITY_MAPPING).map(([k, v]) => [k, v * 10.76391])
);

export interface LpdSpace {
  id: string;
  name: string;
  areaType?: string;
  areaSqM: string;
  baselineLpd: string;
  remarks: string;
  fixtures: LightFixture[];
}

export interface LpdGroup {
  id: string;
  name: string;
  isExpanded: boolean;
  spaces: LpdSpace[];
}

export interface LpdProject {
  id: string;
  name: string;
  type: "Internal" | "External";
  projectNo: string;
  client: string;
  endUser: string;
  calculationNo: string;
  revNo: string;
  date: string;
  internalGroups: LpdGroup[];
  externalGroups: LpdGroup[];
}

const defaultFixture = (): LightFixture => ({ id: crypto.randomUUID(), type: "W3", watts: "40", qty: "1" });
const defaultSpace = (): LpdSpace => ({ id: crypto.randomUUID(), name: "", areaType: "", areaSqM: "", baselineLpd: "0.43", remarks: "", fixtures: [defaultFixture()] });
const defaultGroup = (name = "GROUND FLOOR"): LpdGroup => ({ id: crypto.randomUUID(), name, isExpanded: true, spaces: [defaultSpace()] });
const defaultProject = (): LpdProject => ({
  id: crypto.randomUUID(),
  name: "New LPD Project",
  type: "Internal",
  projectNo: "",
  client: "",
  endUser: "",
  calculationNo: "",
  revNo: "00",
  date: new Date().toISOString().split('T')[0],
  internalGroups: [defaultGroup("INTERNAL AREA")],
  externalGroups: [defaultGroup("EXTERNAL AREA")]
});

function LPDCalculationPage() {
  const [projects, setProjects] = useState<LpdProject[]>([defaultProject()]);
  const [currentProjectId, setCurrentProjectId] = useState<string>(projects[0].id);
  const [authorityMapping, setAuthorityMapping] = useState<Record<string, number>>(DEFAULT_AUTHORITY_MAPPING_SQM);
  const confirm = useConfirm();
  const prompt = usePrompt();

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem("mep-lpd-calc-v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.projects && parsed.projects.length > 0) {
          const migratedProjects = parsed.projects.map((p: any) => {
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
      } catch(e) {}
    }

    const savedMapping = localStorage.getItem("mep-lpd-custom-mapping-sqm");
    if (savedMapping) {
      try {
        const parsed = JSON.parse(savedMapping);
        setAuthorityMapping(prev => ({ ...prev, ...parsed }));
      } catch(e) {}
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem("mep-lpd-calc-v2", JSON.stringify({ projects, currentProjectId }));
    localStorage.setItem("mep-lpd-custom-mapping-sqm", JSON.stringify(authorityMapping));
    dirtyStore.set(true);
  }, [projects, currentProjectId, authorityMapping]);

  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];

  const updateProject = (fn: (p: LpdProject) => LpdProject) => {
    setProjects(prev => prev.map(p => p.id === currentProjectId ? fn(p) : p));
  };

  const updateProjectField = (field: keyof LpdProject, value: any) => {
    updateProject(p => ({ ...p, [field]: value }));
  };

  const isInt = currentProject.type === "Internal";
  const activeGroups = isInt ? currentProject.internalGroups : currentProject.externalGroups;

  const updateActiveGroups = (fn: (groups: LpdGroup[]) => LpdGroup[]) => {
    updateProject(p => isInt 
      ? { ...p, internalGroups: fn(p.internalGroups) }
      : { ...p, externalGroups: fn(p.externalGroups) }
    );
  };

  const addGroup = () => updateActiveGroups(groups => [...groups, defaultGroup(isInt ? "INTERNAL AREA" : "EXTERNAL AREA")]);
  const removeGroup = (gid: string) => updateActiveGroups(groups => groups.filter(g => g.id !== gid));
  const addSpace = (gid: string) => updateActiveGroups(groups => groups.map(g => g.id === gid ? { ...g, spaces: [...g.spaces, defaultSpace()] } : g));
  const removeSpace = (gid: string, sid: string) => updateActiveGroups(groups => groups.map(g => g.id === gid ? { ...g, spaces: g.spaces.filter(s => s.id !== sid) } : g));
  const addFixture = (gid: string, sid: string) => updateActiveGroups(groups => groups.map(g => g.id === gid ? { ...g, spaces: g.spaces.map(s => s.id === sid ? { ...s, fixtures: [...s.fixtures, defaultFixture()] } : s) } : g));
  const removeFixture = (gid: string, sid: string, fid: string) => updateActiveGroups(groups => groups.map(g => g.id === gid ? { ...g, spaces: g.spaces.map(s => s.id === sid ? { ...s, fixtures: s.fixtures.filter(f => f.id !== fid) } : s) } : g));
  const updateFixture = (gid: string, sid: string, fid: string, field: keyof LightFixture, val: any) => updateActiveGroups(groups => groups.map(g => g.id === gid ? { ...g, spaces: g.spaces.map(s => s.id === sid ? { ...s, fixtures: s.fixtures.map(f => {
    if (f.id === fid) {
      const newF = { ...f, [field]: val };
      if (field === "type" && val !== "custom") {
        if (LIGHT_TYPE_MAPPING[val] !== undefined) {
          newF.watts = LIGHT_TYPE_MAPPING[val].toString();
        } else if (val === "") {
          newF.watts = "";
        }
      }
      return newF;
    }
    return f;
  }) } : s) } : g));

  const updateSpace = (gid: string, sid: string, field: keyof LpdSpace, val: any) => updateActiveGroups(groups => groups.map(g => g.id === gid ? { ...g, spaces: g.spaces.map(s => {
    if (s.id === sid) {
      const newS = { ...s, [field]: val };
      if (field === "areaType" && val !== "") {
        const lpdSqm = authorityMapping[val.toLowerCase()] || authorityMapping[val];
        if (lpdSqm !== undefined) {
          newS.baselineLpd = Number(lpdSqm).toFixed(2);
        }
      }
      return newS;
    }
    return s;
  }) } : g));
  const updateGroup = (gid: string, field: keyof LpdGroup, val: any) => updateActiveGroups(groups => groups.map(g => g.id === gid ? { ...g, [field]: val } : g));

  const createNewProject = () => {
    const p = defaultProject();
    setProjects([...projects, p]);
    setCurrentProjectId(p.id);
  };

  const deleteProject = async () => {
    if (projects.length <= 1) return alert("Cannot delete the last project.");
    if (await confirm("Are you sure you want to delete this project?")) {
      const newProjects = projects.filter(p => p.id !== currentProjectId);
      setProjects(newProjects);
      setCurrentProjectId(newProjects[0].id);
    }
  };

  const handleExport = () => {
    exportLpdExcel(currentProject);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { read, utils } = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: any[][] = utils.sheet_to_json(firstSheet, { header: 1 });
      
      const newMap = { ...authorityMapping };
      let added = 0;
      // Assume column A is Area Name, Column B is Baseline LPD
      for (let i = 1; i < json.length; i++) { // Skip header
        const row = json[i];
        if (row && row[0] && row[1] !== undefined) {
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
      } else {
        alert("No valid rows found. Please ensure Column A has Area Names and Column B has Baseline LPD values.");
      }
    } catch (err) {
      console.error(err);
      alert("Error importing Excel file.");
    }
    e.target.value = ""; // reset
  };

  const actions = (
    <div className="flex gap-2">
      <label className="flex items-center gap-2 cursor-pointer bg-surface-2 hover:bg-surface-3 border border-border rounded-xl px-3 py-1.5 text-[12.5px] font-medium transition-colors">
        <Upload className="size-3.5" />
        <span>Import Catalog</span>
        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
      </label>
    </div>
  );

  let globalSrNo = 1;



  return (
    <AppShell title="LPD Calculation" hideSubHeader={true}>
      <div className="flex flex-col h-full overflow-hidden pt-4 gap-4 bg-slate-50/30 dark:bg-slate-950/30 relative">
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        
        {/* Breadcrumbs & Page Header */}
        <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-4 z-10">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">ELECTRICAL &gt; LPD CALCULATION</span>
            <div className="flex items-center gap-3 mt-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">LPD Calculation</h1>
              
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Calculate Lighting Power Density using Space-by-Space Method
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {actions}
          </div>
        </div>

        <div className="relative z-10 flex flex-col w-full h-full min-h-0">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between px-4 py-3 min-h-[56px] h-auto border-b border-white/40 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-md shrink-0 select-none gap-y-3 overflow-x-auto shadow-sm">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
              <select className="h-8 text-[12.5px] font-medium bg-white/50 dark:bg-black/40 hover:bg-white/80 dark:hover:bg-white/10 border border-white/50 dark:border-white/10 rounded-xl px-2 outline-none cursor-pointer transition-all backdrop-blur-sm shadow-sm" value={currentProjectId} onChange={e => setCurrentProjectId(e.target.value)}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <TBtn onClick={createNewProject}><FolderKanban className="size-3.5" /> New</TBtn>
              <TBtn onClick={deleteProject}><Trash className="size-3.5 text-red-500" /></TBtn>
              <div className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />
              
              <div className="flex bg-surface-2 p-0.5 rounded-full border border-border">
                <button
                  onClick={() => updateProjectField("type", "Internal")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    currentProject.type === "Internal" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Internal Area
                </button>
                <button
                  onClick={() => updateProjectField("type", "External")}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                    currentProject.type === "External" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  External Area
                </button>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
              <TBtn primary onClick={addGroup}><Plus className="size-3.5" /> Add Group</TBtn>
            </div>
          </div>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          

          {/* Groups */}
          {activeGroups.map(group => (
            <div key={group.id} className="bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-3xl border border-white/50 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden transition-all duration-300">
              <div className="flex items-center px-4 py-3 bg-white/40 dark:bg-white/5 border-b border-white/40 dark:border-white/10 group">
                <button onClick={() => updateGroup(group.id, "isExpanded", !group.isExpanded)} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-md mr-2 text-foreground/70 transition-colors">
                  {group.isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
                <input 
                  className="bg-transparent font-bold text-[14px] text-primary outline-none focus:bg-white/50 dark:focus:bg-black/50 px-2 py-1 rounded-md w-64 uppercase transition-colors"
                  value={group.name}
                  onChange={e => updateGroup(group.id, "name", e.target.value)}
                  placeholder="e.g. GROUND FLOOR"
                />
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <TBtn onClick={() => addSpace(group.id)}><Plus className="size-3.5" /> Space</TBtn>
                  <TBtn onClick={() => removeGroup(group.id)}><Trash2 className="size-3.5 text-red-500" /></TBtn>
                </div>
              </div>

              {group.isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-white/30 dark:bg-white/5 border-b border-white/40 dark:border-white/10 text-[11px] font-bold text-foreground/70 uppercase tracking-wider">
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-12 text-center">S.No</th>
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-48">Area / Space</th>
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-48">Type of Area</th>
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-40">Light Type</th>
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center">Watts</th>
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center">Qty</th>
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center">Total Watts</th>
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center">Sq.M Area</th>
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center">Sq.F Area</th>
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-28 text-center text-primary drop-shadow-sm">Proposed LPD<br/>(W/SQ.M)</th>
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-24 text-center">Baseline LPD<br/>(W/SQ.M)</th>
                        <th className="px-3 py-2 border-r border-white/40 dark:border-white/10 w-32 text-center">Remarks</th>
                        <th className="px-2 py-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="text-[13px]">
                      {group.spaces.map((space, sIndex) => {
                        const totalWatts = space.fixtures.reduce((sum, f) => {
                          const w = parseFloat(String(f.watts)) || 0;
                          const q = parseFloat(String(f.qty)) || 0;
                          return sum + (w * q);
                        }, 0);
                        const sqM = parseFloat(String(space.areaSqM)) || 0;
                        const sqF = sqM * 10.764;
                        const proposedLpd = sqM > 0 ? totalWatts / sqM : 0;
                        const baselineLpd = parseFloat(String(space.baselineLpd)) || 0;
                        
                        const isPass = proposedLpd <= baselineLpd;
                        const srNo = globalSrNo++;
                        
                        return (
                          <React.Fragment key={space.id}>
                            {space.fixtures.map((fixture, fIndex) => (
                              <tr key={fixture.id} className="border-b border-white/20 dark:border-white/5 group/row hover:bg-white/40 dark:hover:bg-white/10 transition-colors">
                                {/* Only show S.No and Space details on the first fixture row */}
                                {fIndex === 0 && (
                                  <>
                                    <td className="px-3 py-1.5 border-r border-white/20 dark:border-white/10 text-center font-mono text-foreground/70" rowSpan={space.fixtures.length}>
                                      {srNo}
                                    </td>
                                    <td className="p-0 border-r border-white/20 dark:border-white/10" rowSpan={space.fixtures.length}>
                                      <input 
                                        className="w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 transition-colors"
                                        value={space.name}
                                        onChange={e => updateSpace(group.id, space.id, "name", e.target.value)}
                                        placeholder="e.g. Electrical Room"
                                      />
                                    </td>
                                    <td className="p-0 border-r border-white/20 dark:border-white/10" rowSpan={space.fixtures.length}>
                                      <select
                                        className="w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 cursor-pointer font-medium text-[12.5px] transition-colors"
                                        value={space.areaType || ""}
                                        onChange={async e => {
                                          const val = e.target.value;
                                          if (val === "ADD_NEW") {
                                            const newArea = await prompt("Enter new Area Name:", "", { title: "New Area Name" });
                                            if (newArea) {
                                              const newLpdStr = await prompt(`Enter Baseline LPD for '${newArea}' (W/Sq.M):`, "", { title: "Baseline LPD" });
                                              if (newLpdStr && !isNaN(Number(newLpdStr))) {
                                                const newLpd = Number(newLpdStr);
                                                const newMap = { ...authorityMapping, [newArea]: newLpd };
                                                setAuthorityMapping(newMap);
                                                localStorage.setItem("mep-lpd-custom-mapping-sqm", JSON.stringify(newMap));
                                                updateActiveGroups(groups => groups.map(g => g.id === group.id ? { ...g, spaces: g.spaces.map(s => {
                                                  if (s.id === space.id) {
                                                    return { ...s, areaType: newArea, baselineLpd: newLpd.toFixed(2) };
                                                  }
                                                  return s;
                                                }) } : g));
                                              }
                                            }
                                          } else {
                                            updateSpace(group.id, space.id, "areaType", val);
                                          }
                                        }}
                                      >
                                        <option value="">Select Type...</option>
                                        {Object.keys(authorityMapping).sort().map(k => (
                                          <option key={k} value={k}>{k.replace(/\b\w/g, l => l.toUpperCase())}</option>
                                        ))}
                                        <option disabled>──────────</option>
                                        <option value="ADD_NEW">+ Add New Area Type...</option>
                                      </select>
                                    </td>
                                  </>
                                )}
                                
                                <td className="p-0 border-r border-white/20 dark:border-white/10 relative">
                                  {(!Object.keys(LIGHT_TYPE_MAPPING).includes(fixture.type) && fixture.type !== "") ? (
                                    <div className="flex w-full h-full items-center">
                                      <input 
                                        className="w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 font-medium text-[12.5px] transition-colors"
                                        value={fixture.type === "custom" ? "" : fixture.type}
                                        onChange={e => updateFixture(group.id, space.id, fixture.id, "type", e.target.value || "custom")}
                                        placeholder="Type Light Name..."
                                        autoFocus={fixture.type === "custom"}
                                      />
                                      <button 
                                        onClick={() => updateFixture(group.id, space.id, fixture.id, "type", "")}
                                        className="px-2 text-foreground/50 hover:text-red-500 font-bold transition-colors"
                                        title="Reset to Dropdown"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ) : (
                                    <select 
                                      className="w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 cursor-pointer font-medium text-[12.5px] transition-colors"
                                      value={fixture.type}
                                      onChange={e => updateFixture(group.id, space.id, fixture.id, "type", e.target.value)}
                                    >
                                      <option value="">Select...</option>
                                      {Object.keys(LIGHT_TYPE_MAPPING).map(k => (
                                        <option key={k} value={k}>{k} ({LIGHT_TYPE_MAPPING[k]}W)</option>
                                      ))}
                                      <option value="custom">Custom Input</option>
                                    </select>
                                  )}
                                </td>
                                <td className="p-0 border-r border-white/20 dark:border-white/10">
                                  <input 
                                    type="number"
                                    min="0"
                                    className="w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 text-center font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                                    value={fixture.watts}
                                    onChange={e => updateFixture(group.id, space.id, fixture.id, "watts", e.target.value)}
                                    placeholder="0"
                                    disabled={Object.keys(LIGHT_TYPE_MAPPING).includes(fixture.type)}
                                  />
                                </td>
                                <td className="p-0 border-r border-white/20 dark:border-white/10">
                                  <input 
                                    type="number"
                                    min="1"
                                    className="w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                                    value={fixture.qty}
                                    onChange={e => updateFixture(group.id, space.id, fixture.id, "qty", e.target.value)}
                                    placeholder="1"
                                  />
                                </td>
                                
                                {fIndex === 0 && (
                                  <>
                                    <td className="px-3 py-1.5 border-r border-white/20 dark:border-white/10 text-center font-mono font-medium" rowSpan={space.fixtures.length}>
                                      {totalWatts}
                                    </td>
                                    <td className="p-0 border-r border-white/20 dark:border-white/10" rowSpan={space.fixtures.length}>
                                      <input 
                                        type="number"
                                        min="0"
                                        className="w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                                        value={space.areaSqM}
                                        onChange={e => updateSpace(group.id, space.id, "areaSqM", e.target.value)}
                                        placeholder="0.0"
                                      />
                                    </td>
                                    <td className="px-3 py-1.5 border-r border-white/20 dark:border-white/10 text-center font-mono text-foreground/70 bg-white/10 dark:bg-white/5" rowSpan={space.fixtures.length}>
                                      {sqF.toFixed(2)}
                                    </td>
                                    <td className={cn("px-3 py-1.5 border-r border-white/20 dark:border-white/10 text-center font-mono font-bold drop-shadow-sm", isPass ? "text-green-600 dark:text-green-400 bg-green-500/20" : "text-red-600 dark:text-red-400 bg-red-500/20")} rowSpan={space.fixtures.length}>
                                      {proposedLpd.toFixed(4)}
                                    </td>
                                    <td className="p-0 border-r border-white/20 dark:border-white/10" rowSpan={space.fixtures.length}>
                                      <input 
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                                        value={space.baselineLpd}
                                        onChange={e => updateSpace(group.id, space.id, "baselineLpd", e.target.value)}
                                        placeholder="0.43"
                                      />
                                    </td>
                                    <td className="p-0 border-r border-white/20 dark:border-white/10" rowSpan={space.fixtures.length}>
                                      <input 
                                        type="text"
                                        className="w-full h-full min-h-[32px] px-3 bg-transparent outline-none focus:bg-white/30 dark:focus:bg-white/10 text-center transition-colors"
                                        value={space.remarks || ""}
                                        onChange={e => updateSpace(group.id, space.id, "remarks", e.target.value)}
                                        placeholder=""
                                      />
                                    </td>
                                    <td className="px-2 py-1.5 text-center flex flex-col gap-1 items-center" rowSpan={space.fixtures.length}>
                                      <button onClick={() => addFixture(group.id, space.id)} className="p-1 hover:bg-white/20 rounded-md text-foreground/50 hover:text-primary transition-colors" title="Add Fixture">
                                        <Plus className="size-3.5" />
                                      </button>
                                      <button onClick={() => removeSpace(group.id, space.id)} className="p-1 hover:bg-red-500/20 rounded-md text-foreground/50 hover:text-red-500 transition-colors" title="Remove Space">
                                        <Trash2 className="size-3.5" />
                                      </button>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      <tr>
                        <td colSpan={13} className="p-2 border-t border-white/40 dark:border-white/10">
                          <button
                            onClick={() => addSpace(group.id)}
                            className="w-full flex items-center justify-center py-2 border-2 border-dashed border-border/60 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all font-medium text-sm"
                          >
                            <Plus className="size-4 mr-2" /> Add Row (Space)
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
        </div>
      </div>
    </AppShell>
  );
}
