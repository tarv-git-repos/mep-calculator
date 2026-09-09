import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { useState, useMemo, useEffect, Fragment } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  AlertTriangle, Info, Printer, FileSpreadsheet, Plus, Trash2,
  ChevronDown, ChevronUp, Edit3, Settings, HelpCircle, Sparkles,
  Wind, Layers, Gauge, Zap, Activity, FileText, X, Flag,
  Copy, Scissors, Clipboard
} from "lucide-react";
import * as XLSX from "xlsx";
import { exportBasementSmokePDF } from "@/lib/exportBasementSmokePDF";

export const Route = createFileRoute("/basement-smoke-calc")({
  head: () => ({
    meta: [
      { title: "Basement Smoke Calc — MEP Calc" },
      { name: "description", content: "Basement smoke control ventilation calculator and fan system head sizer." },
    ],
  }),
  component: BasementSmokeCalcPage,
});

interface BasementFloor {
  id: string;
  basementLevel: string;
  zoneName: string;
  name: string;
  area: number;
  effArea: number;
  height: number;
  flagged?: boolean;
}

interface FanSystem {
  id: string;
  name: string;
  floorIds: string[];
  fanType: "Extract" | "Makeup";
  length: number;
  frictionFactor: number;
  louver: number;
  grille: number;
  sa: number;
  collapsed: boolean;
}

function BasementSmokeCalcPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("ip");
  
  // Active section view state
  const [activeSection, setActiveSection] = useState<"schedule" | "fan-systems">("schedule");
  
  // Collapsible Global Fan Sizing card state
  const [showGlobalFanSizing, setShowGlobalFanSizing] = useState<boolean>(true);

  // Synced Calculation Review State (Ventilation style)
  const getSyncedReviewState = useMemo(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_review_${pId}_/basement-smoke-calc`;
    if (project?.workspace_data) {
      let wdata = project.workspace_data;
      if (typeof wdata === 'string') {
        try { wdata = JSON.parse(wdata); } catch(e) {}
      }
      if (wdata?.review_states?.[storageKey]) {
        return wdata.review_states[storageKey];
      }
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch(e) {}
    }
    return { status: "DRAFT" };
  }, [project]);

  const [calcReviewState, setCalcReviewState] = useState<any>(getSyncedReviewState);

  useEffect(() => {
    setCalcReviewState(getSyncedReviewState);
  }, [getSyncedReviewState]);
  
  // Schedule state
  const [floors, setFloors] = useState<BasementFloor[]>([]);
  const [newFloor, setNewFloor] = useState<{ name: string; area: number | ""; effArea: number | ""; height: number | ""; numZones: number | "" }>({ name: "", area: "", effArea: "", height: "", numZones: "" });

  // Fan Systems state
  const [fanSystems, setFanSystems] = useState<FanSystem[]>([]);
  const [totalFans, setTotalFans] = useState<number>(2);

  // Modal state
  const [showAddLevelModal, setShowAddLevelModal] = useState<boolean>(false);
  const [showEditLevelModal, setShowEditLevelModal] = useState<boolean>(false);
  const [editLevelTarget, setEditLevelTarget] = useState<string | null>(null);
  const [editLevelData, setEditLevelData] = useState<{ levelName: string; area: number | ""; effArea: number | ""; height: number | ""; numZones: number | "" }>({ levelName: "", area: "", effArea: "", height: "", numZones: "" });
  const [showFSModal, setShowFSModal] = useState<boolean>(false);
  const [modalFSId, setModalFSId] = useState<string | null>(null);
  const [modalFSName, setModalFSName] = useState<string>("");
  const [modalFSType, setModalFSType] = useState<"Extract" | "Makeup">("Extract");
  const [modalSelectedFloorIds, setModalSelectedFloorIds] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string>("");

  // Selection & Keyboard Shortcuts state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<BasementFloor[]>([]);
  const [history, setHistory] = useState<BasementFloor[][]>([]);
  const [redoStack, setRedoStack] = useState<BasementFloor[][]>([]);

  // Push to history helper
  const updateFloorsWithHistory = (newFloors: BasementFloor[]) => {
    setHistory(prev => [...prev.slice(-25), floors]);
    setRedoStack([]);
    setFloors(newFloors);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prevFloors = history[history.length - 1];
    setRedoStack(prev => [...prev, floors]);
    setFloors(prevFloors);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextFloors = redoStack[redoStack.length - 1];
    setHistory(prev => [...prev, floors]);
    setFloors(nextFloors);
    setRedoStack(prev => prev.slice(0, -1));
  };

  // Keyboard shortcut listener (Ctrl+A, Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+X, Ctrl+V, Delete, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInputActive = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const key = e.key.toLowerCase();

      // Undo: Ctrl + Z
      if (isCmdOrCtrl && !e.shiftKey && key === "z") {
        if (history.length > 0) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }

      // Redo: Ctrl + Y or Ctrl + Shift + Z
      if ((isCmdOrCtrl && key === "y") || (isCmdOrCtrl && e.shiftKey && key === "z")) {
        if (redoStack.length > 0) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }

      // Allow default input behavior for text typing inside inputs
      if (isInputActive) return;

      // Select All: Ctrl + A
      if (isCmdOrCtrl && key === "a") {
        e.preventDefault();
        const allIds = new Set(floors.map(f => f.id));
        setSelectedRowIds(allIds);
        return;
      }

      // Copy: Ctrl + C
      if (isCmdOrCtrl && key === "c") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
          setClipboard(selectedItems);
        }
        return;
      }

      // Cut: Ctrl + X
      if (isCmdOrCtrl && key === "x") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
          setClipboard(selectedItems);
          updateFloorsWithHistory(floors.filter(f => !selectedRowIds.has(f.id)));
          setSelectedRowIds(new Set());
        }
        return;
      }

      // Paste: Ctrl + V
      if (isCmdOrCtrl && key === "v") {
        if (clipboard.length > 0) {
          e.preventDefault();
          const baseTime = Date.now();
          const newPasted: BasementFloor[] = clipboard.map((item, idx) => ({
            ...item,
            id: `floor-${baseTime}-${idx}`,
            name: item.name.includes("(Copy)") ? item.name : `${item.name} (Copy)`
          }));
          updateFloorsWithHistory([...floors, ...newPasted]);
          setSelectedRowIds(new Set(newPasted.map(n => n.id)));
        }
        return;
      }

      // Delete: Delete or Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          updateFloorsWithHistory(floors.filter(f => !selectedRowIds.has(f.id)));
          setSelectedRowIds(new Set());
        }
        return;
      }

      // Escape: Deselect all
      if (e.key === "Escape") {
        if (selectedRowIds.size > 0) {
          e.preventDefault();
          setSelectedRowIds(new Set());
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [floors, selectedRowIds, clipboard, history, redoStack]);

  const ip = unitSystem === "ip";

  // Load from local storage
  useEffect(() => {
    try {
      const pId = project?.id;

      const savedUnitSystem = (pId && localStorage.getItem(`bs_unit_system_${pId}`)) || localStorage.getItem("bs_unit_system") as "si" | "ip" | null;
      if (savedUnitSystem && (savedUnitSystem === "si" || savedUnitSystem === "ip")) {
        setUnitSystem(savedUnitSystem);
      }

      const savedRows = (pId && localStorage.getItem(`bs_rows_${pId}`)) || localStorage.getItem("bs_rows");
      if (savedRows) {
        const parsed: any[] = JSON.parse(savedRows);
        const converted: BasementFloor[] = parsed.map((f, idx) => {
          const bLevel = f.basementLevel || (f.name ? f.name.split(" - ")[0] : `Basement ${idx + 1}`);
          const zName = f.zoneName || (f.name && f.name.includes(" - ") ? f.name.split(" - ")[1] : `Zone ${idx + 1}`);
          const displayName = f.name && f.name.includes(" - ") ? f.name : `${bLevel} - ${zName}`;
          return {
            id: f.id || `floor-${idx}`,
            basementLevel: bLevel,
            zoneName: zName,
            name: displayName,
            area: typeof f.area === 'number' ? f.area : Number(f.area) || 0,
            effArea: typeof f.effArea === 'number' ? f.effArea : Number(f.effArea) || 0,
            height: typeof f.height === 'number' ? f.height : Number(f.height) || 0,
            flagged: !!f.flagged
          };
        });
        setFloors(converted);
      } else {
        // Initial defaults (IP) - Basement 1 with 2 Zones
        setFloors([
          { id: "floor-1", basementLevel: "Basement 1", zoneName: "Zone 1", name: "Basement 1 - Zone 1", area: 600, effArea: 500, height: 3 },
          { id: "floor-2", basementLevel: "Basement 1", zoneName: "Zone 2", name: "Basement 1 - Zone 2", area: 600, effArea: 500, height: 3 }
        ]);
      }
      
      const savedFans = (pId && localStorage.getItem(`bs_fan_systems_${pId}`)) || localStorage.getItem("bs_fan_systems");
      if (savedFans) {
        setFanSystems(JSON.parse(savedFans));
      } else {
        setFanSystems([
          {
            id: "fs-1",
            name: "Basement Extract System 1",
            floorIds: ["floor-1", "floor-2"],
            fanType: "Extract",
            length: 30,
            frictionFactor: 1.2,
            louver: 40,
            grille: 15,
            sa: 30,
            collapsed: false
          }
        ]);
      }

      const savedTotalFans = (pId && localStorage.getItem(`bs_total_fans_${pId}`)) || localStorage.getItem("bs_total_fans");
      if (savedTotalFans) {
        setTotalFans(Number(savedTotalFans));
      }

      const savedShowSizing = localStorage.getItem("bs_show_global_fan_sizing");
      if (savedShowSizing !== null) {
        setShowGlobalFanSizing(savedShowSizing === "true");
      }
    } catch (e) {
      console.error("Failed to load basement smoke calc configurations", e);
    }
  }, [project?.id]);

  // Save to local storage on changes
  useEffect(() => {
    if (floors.length > 0) {
      const pId = project?.id;
      const str = JSON.stringify(floors);
      localStorage.setItem("bs_rows", str);
      if (pId) localStorage.setItem(`bs_rows_${pId}`, str);
      dirtyStore.set(true);
    }
  }, [floors, project?.id]);

  useEffect(() => {
    if (fanSystems.length > 0) {
      const pId = project?.id;
      const str = JSON.stringify(fanSystems);
      localStorage.setItem("bs_fan_systems", str);
      if (pId) localStorage.setItem(`bs_fan_systems_${pId}`, str);
      dirtyStore.set(true);
    }
  }, [fanSystems, project?.id]);

  useEffect(() => {
    const pId = project?.id;
    const str = totalFans.toString();
    localStorage.setItem("bs_total_fans", str);
    if (pId) localStorage.setItem(`bs_total_fans_${pId}`, str);
    dirtyStore.set(true);
  }, [totalFans, project?.id]);

  useEffect(() => {
    localStorage.setItem("bs_show_global_fan_sizing", showGlobalFanSizing.toString());
  }, [showGlobalFanSizing]);

  const handleUnitSystemChange = (unit: "si" | "ip") => {
    if (unit === unitSystem) return;
    setUnitSystem(unit);
    const pId = project?.id;
    localStorage.setItem("bs_unit_system", unit);
    if (pId) localStorage.setItem(`bs_unit_system_${pId}`, unit);
    if ((window as any).__mep_keep_values) return;
    // Convert current floor values
    const conv = unit === "ip" ? 10.7639 : 1 / 10.7639; // m² to ft²
    const convH = unit === "ip" ? 3.28084 : 1 / 3.28084; // m to ft

    setFloors(floors.map(f => ({
      ...f,
      area: Number((f.area * conv).toFixed(0)),
      effArea: Number((f.effArea * conv).toFixed(0)),
      height: Number((f.height * convH).toFixed(1))
    })));

    setNewFloor(prev => ({
      ...prev,
      area: prev.area !== "" ? Number((Number(prev.area) * conv).toFixed(0)) : "",
      effArea: prev.effArea !== "" ? Number((Number(prev.effArea) * conv).toFixed(0)) : "",
      height: prev.height !== "" ? Number((Number(prev.height) * convH).toFixed(1)) : ""
    }));
  };

  const calculatedRows = useMemo(() => {
    return floors.map(f => {
      const vol = f.effArea * f.height;
      let f3 = 0, f6 = 0, f10 = 0;
      if (ip) {
        // CFM
        f3 = Math.ceil(vol * 3 / 60);
        f6 = Math.ceil(vol * 6 / 60);
        f10 = Math.ceil(vol * 10 / 60);
      } else {
        // L/s
        f3 = Math.ceil(vol * 3 / 3.6);
        f6 = Math.ceil(vol * 6 / 3.6);
        f10 = Math.ceil(vol * 10 / 3.6);
      }
      return {
        ...f,
        volume: vol,
        flow3ach: f3,
        flow6ach: f6,
        flow10ach: f10
      };
    });
  }, [floors, ip, unitSystem]);

  // Group calculated rows by basementLevel
  const calculatedGroups = useMemo(() => {
    const map = new Map<string, typeof calculatedRows>();
    calculatedRows.forEach(r => {
      const bLevel = r.basementLevel || r.name.split(" - ")[0] || r.name || "Basement 1";
      if (!map.has(bLevel)) map.set(bLevel, []);
      map.get(bLevel)!.push(r);
    });

    const result: { basementLevel: string; rows: typeof calculatedRows; subtotal3: number; subtotal6: number; max10Fire: number; totalArea: number; totalEffArea: number }[] = [];
    map.forEach((rows, bLevel) => {
      const subtotal3 = rows.reduce((a, b) => a + b.flow3ach, 0);
      const subtotal6 = rows.reduce((a, b) => a + b.flow6ach, 0);
      const max10Fire = Math.max(...rows.map(r => r.flow10ach), 0);
      const totalArea = rows.reduce((a, b) => a + b.area, 0);
      const totalEffArea = rows.reduce((a, b) => a + b.effArea, 0);

      result.push({
        basementLevel: bLevel,
        rows,
        subtotal3,
        subtotal6,
        max10Fire,
        totalArea,
        totalEffArea
      });
    });

    return result;
  }, [calculatedRows]);

  const totals = useMemo(() => {
    const total3 = calculatedRows.reduce((a, b) => a + b.flow3ach, 0);
    const total6 = calculatedRows.reduce((a, b) => a + b.flow6ach, 0);
    // In multi-zone fire scenario: fire occurs in 1 zone at a time (worst-case single zone fire extract)
    const max10 = Math.max(...calculatedRows.map(r => r.flow10ach), 0);

    const lowCap = Math.ceil(total3 / (totalFans || 1));
    const highCap = Math.ceil(Math.max(total6, max10) / (totalFans || 1));

    return {
      total3,
      total6,
      max10,
      lowCap,
      highCap
    };
  }, [calculatedRows, totalFans]);

  const handleAddFloor = () => {
    if (!newFloor.name) return;
    const bLevel = newFloor.name.trim();
    const numZ = newFloor.numZones !== "" && !isNaN(Number(newFloor.numZones)) ? Math.max(1, Number(newFloor.numZones)) : 1;
    
    const totalArea = newFloor.area !== "" && !isNaN(Number(newFloor.area)) ? Number(newFloor.area) : 600;
    const totalEffArea = newFloor.effArea !== "" && !isNaN(Number(newFloor.effArea)) ? Number(newFloor.effArea) : 500;
    const heightVal = newFloor.height !== "" && !isNaN(Number(newFloor.height)) ? Number(newFloor.height) : 3;

    const baseId = Date.now();
    const newEntries: BasementFloor[] = [];

    if (numZ === 1) {
      newEntries.push({
        id: `floor-${baseId}`,
        basementLevel: bLevel,
        zoneName: "Zone 1",
        name: bLevel.toLowerCase().includes("zone") ? bLevel : `${bLevel} - Zone 1`,
        area: totalArea,
        effArea: totalEffArea,
        height: heightVal
      });
    } else {
      const perZoneArea = Math.round(totalArea / numZ);
      const perZoneEffArea = Math.round(totalEffArea / numZ);

      for (let i = 1; i <= numZ; i++) {
        const zName = `Zone ${i}`;
        newEntries.push({
          id: `floor-${baseId}-${i}`,
          basementLevel: bLevel,
          zoneName: zName,
          name: `${bLevel} - ${zName}`,
          area: perZoneArea,
          effArea: perZoneEffArea,
          height: heightVal
        });
      }
    }

    updateFloorsWithHistory([...floors, ...newEntries]);
    setNewFloor({ name: "", area: "", effArea: "", height: "", numZones: "" });
    setShowAddLevelModal(false);
  };

  const handleDeleteFloor = (id: string) => {
    const updatedFloors = floors.filter(f => f.id !== id);
    updateFloorsWithHistory(updatedFloors);
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Clean floor ID refs from Fan Systems
    setFanSystems(fanSystems.map(fs => ({
      ...fs,
      floorIds: fs.floorIds.filter(fId => fId !== id)
    })));
  };

  const handleRenameLevel = (oldLevelName: string, newLevelName: string) => {
    if (!newLevelName.trim()) return;
    setHistory(prev => [...prev.slice(-25), floors]);
    setRedoStack([]);
    setFloors(prev => prev.map(f => {
      if (f.basementLevel !== oldLevelName) return f;
      const zName = f.zoneName || (f.name.includes(" - ") ? f.name.split(" - ")[1] : "Zone 1");
      return {
        ...f,
        basementLevel: newLevelName.trim(),
        name: `${newLevelName.trim()} - ${zName}`
      };
    }));
  };

  const handleOpenEditLevelModal = (grp: { basementLevel: string; rows: BasementFloor[]; totalArea: number; totalEffArea: number }) => {
    setEditLevelTarget(grp.basementLevel);
    setEditLevelData({
      levelName: grp.basementLevel,
      area: grp.totalArea,
      effArea: grp.totalEffArea,
      height: grp.rows[0]?.height || 3,
      numZones: grp.rows.length
    });
    setShowEditLevelModal(true);
  };

  const handleSaveEditLevel = () => {
    if (!editLevelTarget) return;
    const newLvlName = editLevelData.levelName.trim() || editLevelTarget;
    const totalArea = editLevelData.area !== "" && !isNaN(Number(editLevelData.area)) ? Number(editLevelData.area) : 600;
    const totalEffArea = editLevelData.effArea !== "" && !isNaN(Number(editLevelData.effArea)) ? Number(editLevelData.effArea) : 500;
    const heightVal = editLevelData.height !== "" && !isNaN(Number(editLevelData.height)) ? Number(editLevelData.height) : 3;
    const numZones = editLevelData.numZones !== "" && !isNaN(Number(editLevelData.numZones)) ? Math.max(1, Number(editLevelData.numZones)) : 1;

    const existingInLevel = floors.filter(f => f.basementLevel === editLevelTarget);
    const otherFloors = floors.filter(f => f.basementLevel !== editLevelTarget);

    const perZoneArea = Math.round(totalArea / numZones);
    const perZoneEffArea = Math.round(totalEffArea / numZones);
    const baseId = Date.now();

    const newLevelRows: BasementFloor[] = [];
    for (let i = 1; i <= numZones; i++) {
      const existingZone = existingInLevel[i - 1];
      const zName = existingZone?.zoneName || `Zone ${i}`;
      newLevelRows.push({
        id: existingZone?.id || `floor-${baseId}-${i}`,
        basementLevel: newLvlName,
        zoneName: zName,
        name: `${newLvlName} - ${zName}`,
        area: perZoneArea,
        effArea: perZoneEffArea,
        height: heightVal,
        flagged: existingZone?.flagged
      });
    }

    updateFloorsWithHistory([...otherFloors, ...newLevelRows]);
    setShowEditLevelModal(false);
    setEditLevelTarget(null);
  };

  const handleAddZoneToLevel = (bLevel: string) => {
    const existingInLevel = floors.filter(f => f.basementLevel === bLevel);
    const nextNum = existingInLevel.length + 1;
    const zName = `Zone ${nextNum}`;
    const baseHeight = existingInLevel[0]?.height || 3;
    const newZone: BasementFloor = {
      id: `floor-${Date.now()}`,
      basementLevel: bLevel,
      zoneName: zName,
      name: `${bLevel} - ${zName}`,
      area: 600,
      effArea: 500,
      height: baseHeight
    };
    updateFloorsWithHistory([...floors, newZone]);
  };

  const handleDeleteLevel = (bLevel: string) => {
    const idsToDelete = new Set(floors.filter(f => f.basementLevel === bLevel).map(f => f.id));
    const updatedFloors = floors.filter(f => f.basementLevel !== bLevel);
    updateFloorsWithHistory(updatedFloors);
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      idsToDelete.forEach(id => next.delete(id));
      return next;
    });
    setFanSystems(fanSystems.map(fs => ({
      ...fs,
      floorIds: fs.floorIds.filter(fId => !idsToDelete.has(fId))
    })));
  };

  const handleUpdateFloorCell = (id: string, field: keyof BasementFloor, value: any) => {
    setHistory(prev => [...prev.slice(-25), floors]);
    setRedoStack([]);
    setFloors(prev => prev.map(f => {
      if (f.id !== id) return f;
      const updated = { ...f, [field]: value };
      if (field === "name" && typeof value === "string") {
        if (value.includes(" - ")) {
          const parts = value.split(" - ");
          updated.basementLevel = parts[0].trim();
          updated.zoneName = parts.slice(1).join(" - ").trim();
        } else {
          updated.basementLevel = value.trim();
        }
      }
      return updated;
    }));
  };

  // Open Fan System Modal for create
  const handleOpenCreateFS = () => {
    setModalFSId(null);
    setModalFSName("");
    setModalFSType("Extract");
    setModalSelectedFloorIds([]);
    setModalError("");
    setShowFSModal(true);
  };

  // Open Fan System Modal for edit
  const handleOpenEditFS = (fs: FanSystem) => {
    setModalFSId(fs.id);
    setModalFSName(fs.name);
    setModalFSType(fs.fanType);
    setModalSelectedFloorIds(fs.floorIds);
    setModalError("");
    setShowFSModal(true);
  };

  const handleSaveFanSystem = () => {
    if (!modalFSName.trim()) {
      setModalError("Please enter a Fan System Name.");
      return;
    }
    if (modalSelectedFloorIds.length === 0) {
      setModalError("Please select at least one floor to serve.");
      return;
    }

    if (modalFSId) {
      // Edit
      setFanSystems(fanSystems.map(fs => fs.id === modalFSId ? {
        ...fs,
        name: modalFSName.trim(),
        fanType: modalFSType,
        floorIds: modalSelectedFloorIds
      } : fs));
    } else {
      // Create
      const newFS: FanSystem = {
        id: "fs-" + Date.now(),
        name: modalFSName.trim(),
        fanType: modalFSType,
        floorIds: modalSelectedFloorIds,
        length: 20,
        frictionFactor: 1.2,
        louver: 0,
        grille: 0,
        sa: 0,
        collapsed: false
      };
      setFanSystems([...fanSystems, newFS]);
    }
    setShowFSModal(false);
  };

  const calculatedFanSystems = useMemo(() => {
    return fanSystems.map(fs => {
      const fittings = fs.length * 0.6;
      const eqLen = fs.length + fittings;
      const frictionLoss = eqLen * fs.frictionFactor;
      const safety = (frictionLoss + fs.louver + fs.grille + fs.sa) * 0.10;
      const totalStatic = Math.round((frictionLoss + fs.louver + fs.grille + fs.sa + safety) / 10) * 10;

      // Find the associated flowrate
      const servedFloors = calculatedRows.filter(r => fs.floorIds.includes(r.id));
      let flow3 = servedFloors.reduce((a, b) => a + b.flow3ach, 0);
      let flow6 = servedFloors.reduce((a, b) => a + b.flow6ach, 0);
      let flow10Max = Math.max(...servedFloors.map(r => r.flow10ach), 0);

      let lowCap = Math.ceil(flow3 / (totalFans || 1));
      let highCap = Math.ceil(Math.max(flow6, flow10Max) / (totalFans || 1));

      // Scaling for makeup fan
      if (fs.fanType === "Makeup") {
        flow3 = Math.round(flow3 * 0.85);
        flow6 = Math.round(flow6 * 0.85);
        flow10Max = Math.round(flow10Max * 0.85);
        lowCap = Math.round(lowCap * 0.85);
        highCap = Math.round(highCap * 0.85);
      }

      return {
        ...fs,
        fittings,
        eqLen,
        frictionLoss,
        safety,
        totalStatic,
        flow3,
        flow6,
        flow10Max,
        lowCap,
        highCap,
        servedFloors
      };
    });
  }, [fanSystems, calculatedRows, totalFans]);

  // Check if a floor is already assigned to a system of the target type
  const assignedFloorsMap = useMemo(() => {
    const map: Record<string, string> = {};
    fanSystems.forEach(fs => {
      if (fs.id !== modalFSId && fs.fanType === modalFSType) {
        fs.floorIds.forEach(id => {
          map[id] = fs.name;
        });
      }
    });
    return map;
  }, [fanSystems, modalFSId, modalFSType]);

  const handleExportPDF = () => {
    exportBasementSmokePDF(calculatedGroups, calculatedFanSystems, totals, totalFans, unitSystem);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const floorData = calculatedRows.map(r => [
      r.basementLevel || r.name.split(" - ")[0] || r.name,
      r.zoneName || (r.name.includes(" - ") ? r.name.split(" - ")[1] : "Zone 1"),
      r.name,
      r.area,
      r.effArea,
      r.height,
      r.flow3ach,
      r.flow6ach,
      r.flow10ach
    ]);
    const headers = ["Basement Level", "Zone Name", "Full Name", `Gross Area (${ip ? "ft²" : "m²"})`, `Effective Area (${ip ? "ft²" : "m²"})`, `Height (${ip ? "ft" : "m"})`, `3 ACH Flow (${ip ? "CFM" : "L/s"})`, `6 ACH Flow (${ip ? "CFM" : "L/s"})`, `10 ACH Flow (${ip ? "CFM" : "L/s"})` ];
    const ws = XLSX.utils.aoa_to_sheet([["Basement Multi-Zone Ventilation Schedule"], [], headers, ...floorData]);
    XLSX.utils.book_append_sheet(wb, ws, "Basement Schedule");
    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Basement_Smoke_Calculation.xlsx", "Excel Document", ["xlsx"]);
  };



  // Fan system overall metrics
  const fanSystemMetrics = useMemo(() => {
    const totalSystems = calculatedFanSystems.length;
    const extractCount = calculatedFanSystems.filter(fs => fs.fanType === "Extract").length;
    const makeupCount = calculatedFanSystems.filter(fs => fs.fanType === "Makeup").length;
    const totalDuctLength = calculatedFanSystems.reduce((acc, fs) => acc + fs.length, 0);
    const maxStaticPressure = Math.max(0, ...calculatedFanSystems.map(fs => fs.totalStatic));
    return { totalSystems, extractCount, makeupCount, totalDuctLength, maxStaticPressure };
  }, [calculatedFanSystems]);

  return (
    <AppShell title="Basement Smoke Calc" hideSubHeader={true}>
      <>
        <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6">
          {/* Breadcrumbs & Page Header (Ventilation style) */}
          <div className="flex justify-between items-start shrink-0 select-none no-print">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">SMOKE MANAGEMENT &gt; BASEMENT VENTILATION</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Basement Smoke Extract Schedule</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">{calculatedGroups.length} levels</span>
                </div>
                <CalculationReviewBar
                  projectId={project?.id}
                  calculatorPath="/basement-smoke-calc"
                  calculatorTitle="Basement Smoke Calc"
                  onReviewStateChange={setCalcReviewState}
                />
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Formulate car park ventilating schedule calculations (3, 6, and 10 ACH) and head losses for extract/makeup fan systems.
              </p>
            </div>
          </div>

          {/* Ventilation-style Outer Card Container */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED" 
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            {/* Top SubHeader / Section Navigation Tabs & Action Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-card shrink-0 select-none no-print border-b border-border/50 flex-wrap gap-3">
              {/* Rounded-full Pill Tabs (Ventilation style) */}
              <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-full border border-border/80 gap-1">
                <button
                  onClick={() => setActiveSection("schedule")}
                  className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeSection === "schedule"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Activity className="size-3.5" />
                  Basement Schedule
                </button>
                <button
                  onClick={() => setActiveSection("fan-systems")}
                  className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeSection === "fan-systems"
                      ? "bg-white dark:bg-slate-800 text-primary shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Wind className="size-3.5" />
                  Fan Systems
                  <span className="ml-1 text-[10px] px-2 py-0.5 bg-primary/15 text-primary rounded-full font-extrabold">
                    {fanSystems.length}
                  </span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {activeSection === "schedule" && (
                  <>
                    {clipboard.length > 0 && (
                      <button
                        onClick={() => {
                          const baseTime = Date.now();
                          const newPasted: BasementFloor[] = clipboard.map((item, idx) => ({
                            ...item,
                            id: `floor-${baseTime}-${idx}`,
                            name: item.name.includes("(Copy)") ? item.name : `${item.name} (Copy)`
                          }));
                          updateFloorsWithHistory([...floors, ...newPasted]);
                          setSelectedRowIds(new Set(newPasted.map(n => n.id)));
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold hover:bg-emerald-500/20 transition cursor-pointer shadow-xs"
                        title="Paste copied rows (Ctrl+V)"
                      >
                        <Clipboard className="size-3.5" />
                        Paste ({clipboard.length})
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (!newFloor.name) {
                          const nextLevelNum = calculatedGroups.length + 1;
                          setNewFloor({ name: `B${nextLevelNum}`, area: 600, effArea: 500, height: 3, numZones: 1 });
                        }
                        setShowAddLevelModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0A7BC7] text-white rounded-xl text-xs font-semibold hover:bg-[#06456F] transition cursor-pointer shadow-xs"
                    >
                      <Plus className="size-3.5" />
                      Add Level
                    </button>
                  </>
                )}
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <FileText className="size-3.5 text-red-600" />
                  Export PDF
                </button>
                {activeSection === "schedule" && (
                  <button
                    onClick={() => setShowGlobalFanSizing(!showGlobalFanSizing)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-xl text-xs font-semibold transition cursor-pointer ${
                      showGlobalFanSizing
                        ? "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"
                        : "border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Gauge className="size-3.5" />
                    Global Sizing
                  </button>
                )}
              </div>
            </div>

            {/* Inner Content Area */}
            <div className="p-5 flex-1 overflow-y-auto">
              {/* Basement Level Schedule & Global Sizing Section */}
              {activeSection === "schedule" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left - Schedule Table */}
                  <div className={`${showGlobalFanSizing ? "lg:col-span-9" : "lg:col-span-12"} flex flex-col gap-4 transition-all duration-200`}>

                  {/* Floating Row Selection Toolbar */}
                  {selectedRowIds.size > 0 && (
                    <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-xl px-4 py-2 text-xs font-semibold text-primary animate-fade-in">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{selectedRowIds.size} row(s) selected</span>
                        <span className="text-muted-foreground text-[11px]">(Shortcuts: Ctrl+C, Ctrl+X, Ctrl+V, Del, Esc)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
                            setClipboard(selectedItems);
                          }}
                          className="flex items-center gap-1 hover:underline font-bold cursor-pointer"
                          title="Copy (Ctrl+C)"
                        >
                          <Copy className="size-3" /> Copy
                        </button>
                        <button
                          onClick={() => {
                            const selectedItems = floors.filter(f => selectedRowIds.has(f.id));
                            setClipboard(selectedItems);
                            updateFloorsWithHistory(floors.filter(f => !selectedRowIds.has(f.id)));
                            setSelectedRowIds(new Set());
                          }}
                          className="flex items-center gap-1 hover:underline font-bold cursor-pointer"
                          title="Cut (Ctrl+X)"
                        >
                          <Scissors className="size-3" /> Cut
                        </button>
                        <button
                          onClick={() => {
                            updateFloorsWithHistory(floors.filter(f => !selectedRowIds.has(f.id)));
                            setSelectedRowIds(new Set());
                          }}
                          className="flex items-center gap-1 hover:underline font-bold text-red-500 cursor-pointer"
                          title="Delete selected (Del)"
                        >
                          <Trash2 className="size-3" /> Delete
                        </button>
                        <button
                          onClick={() => setSelectedRowIds(new Set())}
                          className="text-muted-foreground hover:text-foreground font-semibold ml-2 cursor-pointer"
                        >
                          Clear (Esc)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Grouped Table View */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/70 text-muted-foreground font-semibold bg-slate-100/50 dark:bg-slate-900/30">
                          <th className="py-2.5 px-2 text-center w-8">
                            <input
                              type="checkbox"
                              checked={floors.length > 0 && selectedRowIds.size === floors.length}
                              onChange={e => setSelectedRowIds(e.target.checked ? new Set(floors.map(f => f.id)) : new Set())}
                              className="rounded border-border cursor-pointer"
                              title="Select / Deselect all rows (Ctrl+A)"
                            />
                          </th>
                          <th className="py-2.5 px-3">Level / Zone Name</th>
                          <th className="py-2.5">Gross Area ({ip ? "ft²" : "m²"})</th>
                          <th className="py-2.5">Eff. Area ({ip ? "ft²" : "m²"})</th>
                          <th className="py-2.5">Height ({ip ? "ft" : "m"})</th>
                          <th className="py-2.5">3 ACH ({ip ? "CFM" : "L/s"})</th>
                          <th className="py-2.5">6 ACH ({ip ? "CFM" : "L/s"})</th>
                          <th className="py-2.5 text-primary">10 ACH ({ip ? "CFM" : "L/s"})</th>
                          <th className="py-2.5 text-center w-12">Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {calculatedGroups.map(grp => (
                          <Fragment key={grp.basementLevel + "-group"}>
                            {/* Basement Level Group Header */}
                            <tr className="bg-slate-100/70 dark:bg-slate-800/50 font-sans border-t-2 border-border/70 group/header">
                              <td colSpan={9} className="py-1.5 px-3 font-bold text-foreground text-[12px]">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">🏢</span>
                                    <input
                                      type="text"
                                      value={grp.basementLevel}
                                      onChange={e => handleRenameLevel(grp.basementLevel, e.target.value)}
                                      className="bg-transparent hover:bg-slate-200/60 dark:hover:bg-slate-700/60 focus:bg-background border border-transparent focus:border-[#0A7BC7] rounded px-2 py-0.5 font-bold text-xs text-foreground outline-none transition-colors"
                                      title="Click to rename level inline"
                                    />
                                    <span className="text-muted-foreground text-xs font-semibold">
                                      ({grp.rows.length} {grp.rows.length === 1 ? "Zone" : "Zones"})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => handleOpenEditLevelModal(grp)}
                                      className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-border/80 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/10 transition cursor-pointer shadow-2xs"
                                      title="Edit level parameters & zones"
                                    >
                                      <Edit3 className="size-3" /> Edit Level
                                    </button>
                                    <button
                                      onClick={() => handleAddZoneToLevel(grp.basementLevel)}
                                      className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-border/80 rounded-lg text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition cursor-pointer shadow-2xs"
                                      title="Add new zone to this level"
                                    >
                                      <Plus className="size-3" /> Add Zone
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLevel(grp.basementLevel)}
                                      className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 border border-border/80 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-500/10 transition cursor-pointer shadow-2xs"
                                      title="Delete entire level"
                                    >
                                      <Trash2 className="size-3" /> Delete Level
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            {/* Zone Rows */}
                            {grp.rows.map(r => (
                              <tr
                                key={r.id}
                                className={`transition-colors group ${
                                  selectedRowIds.has(r.id)
                                    ? "bg-primary/10 dark:bg-primary/20 border-l-2 border-l-primary"
                                    : "hover:bg-slate-50/50 dark:hover:bg-slate-900/10"
                                }`}
                              >
                                <td className="py-1 px-2 text-center w-8 select-none">
                                  <input
                                    type="checkbox"
                                    checked={selectedRowIds.has(r.id)}
                                    onChange={e => {
                                      e.stopPropagation();
                                      const next = new Set(selectedRowIds);
                                      if (next.has(r.id)) next.delete(r.id);
                                      else next.add(r.id);
                                      setSelectedRowIds(next);
                                    }}
                                    className="rounded border-border cursor-pointer"
                                  />
                                </td>
                                <td className="py-1 px-3 font-sans font-semibold pl-4">
                                  <input
                                    type="text"
                                    value={r.name}
                                    onChange={e => handleUpdateFloorCell(r.id, "name", e.target.value)}
                                    className="w-full bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:bg-background border border-transparent focus:border-[#0A7BC7] rounded px-2 py-1 font-semibold text-xs text-foreground outline-none transition-colors"
                                  />
                                </td>
                                <td className="py-1 px-1">
                                  <input
                                    type="number"
                                    value={r.area === 0 ? "" : r.area}
                                    onChange={e => handleUpdateFloorCell(r.id, "area", e.target.value === "" ? 0 : Number(e.target.value))}
                                    className="w-24 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:bg-background border border-transparent focus:border-[#0A7BC7] rounded px-1.5 py-1 font-mono font-semibold text-xs text-foreground outline-none transition-colors"
                                  />
                                </td>
                                <td className="py-1 px-1">
                                  <input
                                    type="number"
                                    value={r.effArea === 0 ? "" : r.effArea}
                                    onChange={e => handleUpdateFloorCell(r.id, "effArea", e.target.value === "" ? 0 : Number(e.target.value))}
                                    className="w-24 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:bg-background border border-transparent focus:border-[#0A7BC7] rounded px-1.5 py-1 font-mono font-semibold text-xs text-foreground outline-none transition-colors"
                                  />
                                </td>
                                <td className="py-1 px-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={r.height === 0 ? "" : r.height}
                                    onChange={e => handleUpdateFloorCell(r.id, "height", e.target.value === "" ? 0 : Number(e.target.value))}
                                    className="w-20 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:bg-background border border-transparent focus:border-[#0A7BC7] rounded px-1.5 py-1 font-mono font-semibold text-xs text-foreground outline-none transition-colors"
                                  />
                                </td>
                                <td className="py-2.5 font-semibold text-slate-700 dark:text-slate-300">{r.flow3ach.toLocaleString()}</td>
                                <td className="py-2.5">{r.flow6ach.toLocaleString()}</td>
                                <td className="py-2.5 font-bold text-primary">{r.flow10ach.toLocaleString()}</td>
                                <td className="py-1.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateFloorCell(r.id, "flagged", !r.flagged)}
                                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer group/flag flex items-center justify-center"
                                      title={r.flagged ? "Unflag zone" : "Flag zone"}
                                    >
                                      <Flag
                                        className={`size-3.5 transition-all duration-200 ${
                                          r.flagged
                                            ? "fill-red-500 text-red-500 scale-110"
                                            : "text-muted-foreground/30 hover:text-red-500/60 group-hover/flag:scale-110"
                                        }`}
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteFloor(r.id)}
                                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground/40 hover:text-red-500 transition cursor-pointer"
                                      title="Delete zone"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {/* Basement Subtotal Row */}
                            <tr className="bg-slate-50/90 dark:bg-slate-900/40 font-bold border-b-2 border-border/70 text-[11.5px]">
                              <td className="py-2 px-3 font-sans text-muted-foreground uppercase tracking-wider" colSpan={2}>{grp.basementLevel} Subtotal</td>
                              <td className="py-2 font-mono">{grp.totalArea.toLocaleString()}</td>
                              <td className="py-2 font-mono">{grp.totalEffArea.toLocaleString()}</td>
                              <td className="py-2 font-mono">-</td>
                              <td className="py-2 font-mono text-slate-800 dark:text-slate-200">{grp.subtotal3.toLocaleString()}</td>
                              <td className="py-2 font-mono text-slate-800 dark:text-slate-200">{grp.subtotal6.toLocaleString()}</td>
                              <td className="py-2 font-mono text-red-600 dark:text-red-400">
                                {grp.max10Fire.toLocaleString()}
                                <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded font-bold uppercase tracking-tight">1 Zone Fire Rate</span>
                              </td>
                              <td className="py-2"></td>
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              {/* Right - Global Selection */}
              {showGlobalFanSizing && (
                <div className="lg:col-span-3 flex flex-col gap-5 animate-fade-in">
                  {/* Fan selection parameters */}
                  <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Global Fan Sizing</h3>
                      </div>
                      <button
                        onClick={() => setShowGlobalFanSizing(false)}
                        className="text-muted-foreground hover:text-foreground text-[11px] font-bold px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        title="Hide section"
                      >
                        Hide
                      </button>
                    </div>

                    <div className="flex flex-col gap-3.5 text-xs">
                      <div className="flex flex-col gap-1">
                        <label className="font-semibold text-foreground">Total Fan Qty Sized</label>
                        <input type="number" min="1" step="1" value={totalFans} onChange={e => setTotalFans(Number(e.target.value))} className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:border-[#0A7BC7]" />
                      </div>

                      <div className="flex flex-col gap-2.5 font-sans mt-2 pt-2 border-t border-border/60">
                        <div className="bg-slate-100/40 dark:bg-slate-900/30 p-2.5 rounded-xl border border-border/60 flex flex-col gap-0.5">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">Total 3 ACH Flow</span>
                          <strong className="text-sm font-bold text-foreground font-mono">{totals.total3.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                        </div>
                        <div className="bg-slate-100/40 dark:bg-slate-900/30 p-2.5 rounded-xl border border-border/60 flex flex-col gap-0.5">
                          <span className="text-[10px] text-primary font-bold uppercase">Max 10 ACH Flow</span>
                          <strong className="text-sm font-bold text-primary font-mono">{totals.max10.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                        </div>
                        <div className="bg-slate-100/40 dark:bg-slate-900/30 p-2.5 rounded-xl border border-border/60 flex flex-col gap-0.5">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">Low Speed Capacity / Fan</span>
                          <strong className="text-base font-bold text-foreground font-mono">{totals.lowCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                        </div>
                        <div className="bg-primary/5 p-2.5 rounded-xl border border-primary/20 flex flex-col gap-0.5">
                          <span className="text-[10px] text-primary font-bold uppercase">High Speed Capacity / Fan</span>
                          <strong className="text-base font-bold text-primary font-mono">{totals.highCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fan Systems Head Loss Section */}
          {activeSection === "fan-systems" && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Fan Systems Head Loss Calculations</h3>
                </div>
                <TBtn onClick={handleOpenCreateFS} className="h-8.5 text-xs">
                  <Plus className="size-3.5" /> Create Fan System
                </TBtn>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {calculatedFanSystems.map(fs => (
                  <div key={fs.id} className="border border-border/75 rounded-2xl bg-slate-50/30 dark:bg-slate-900/10 flex flex-col overflow-hidden shadow-xs">
                    
                    {/* Card Header with Toggle Collapse */}
                    <div
                      onClick={() => setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, collapsed: !x.collapsed } : x))}
                      className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/40 p-4 border-b border-border/70 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/60 select-none transition"
                    >
                      <div className="flex items-center gap-2 flex-wrap max-w-[80%]">
                        <span className={`text-[10px] text-muted-foreground transition duration-200 block ${fs.collapsed ? "-rotate-90" : ""}`}>▼</span>
                        <strong className="text-xs text-foreground font-sans font-bold">{fs.name}</strong>
                        <span className="text-[9.5px] px-2 py-0.5 bg-primary/10 text-primary font-bold rounded-full uppercase">
                          {fs.fanType} System
                        </span>
                        <div className="flex items-center gap-1.5 ml-2">
                          {fs.servedFloors.map(f => (
                            <span key={f.id} className="text-[10px] bg-slate-200/50 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded-md">
                              {f.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEditFS(fs); }}
                          className="bg-transparent text-primary hover:bg-primary/10 font-bold px-2 py-1 rounded text-[11px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit3 className="size-3" /> Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setFanSystems(fanSystems.filter(x => x.id !== fs.id)); }}
                          className="bg-transparent text-red-500 hover:bg-red-500/10 font-bold px-2 py-1 rounded text-[11px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 className="size-3" /> Delete
                        </button>
                      </div>
                    </div>

                    {!fs.collapsed && (
                      <div className="p-5 flex flex-col gap-4">
                        {/* Flow summary for this system */}
                        <div className="grid grid-cols-5 gap-2 select-none">
                          <div className="bg-slate-100/30 dark:bg-slate-900/30 border border-border/80 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">3 ACH Total</span>
                            <strong className="text-[12px] font-bold text-primary font-mono mt-1 block">{fs.flow3.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                          </div>
                          <div className="bg-slate-100/30 dark:bg-slate-900/30 border border-border/80 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">6 ACH Total</span>
                            <strong className="text-[12px] font-bold text-primary font-mono mt-1 block">{fs.flow6.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                          </div>
                          <div className="bg-slate-100/30 dark:bg-slate-900/30 border border-border/80 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">10 ACH Max</span>
                            <strong className="text-[12px] font-bold text-red-500 font-mono mt-1 block">{fs.flow10Max.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                          </div>
                          <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                            <span className="text-[9px] font-bold text-primary uppercase tracking-wider block">Low Speed</span>
                            <strong className="text-[12px] font-bold text-primary font-mono mt-1 block">{fs.lowCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                          </div>
                          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
                            <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider block">High Speed</span>
                            <strong className="text-[12px] font-bold text-red-500 font-mono mt-1 block">{fs.highCap.toLocaleString()} {ip ? "CFM" : "L/s"}</strong>
                          </div>
                        </div>

                        {/* Friction configuration row */}
                        <div className="flex justify-between items-center bg-slate-100/30 dark:bg-slate-900/30 border border-border rounded-xl px-4 py-2.5 text-xs select-none">
                          <span className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Design Friction Rate</span>
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                            <span>Friction Factor:</span>
                            <input
                              type="number"
                              step="0.1"
                              value={fs.frictionFactor}
                              onChange={e => {
                                const val = Number(e.target.value);
                                setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, frictionFactor: val } : x));
                              }}
                              className="w-12 bg-transparent text-primary font-bold text-center border-b border-primary/50 outline-none"
                            />
                            <span>Pa/m of ducting</span>
                          </div>
                        </div>

                        {/* Inputs Split */}
                        <div className="grid grid-cols-2 gap-5">
                          <div className="flex flex-col gap-2.5 text-xs">
                            <div className="font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]">Ductwork Inputs</div>
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-muted-foreground">Duct Length (m)</label>
                              <input
                                type="number"
                                value={fs.length}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, length: val } : x));
                                }}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-muted-foreground">Losses in Louver (Pa)</label>
                              <input
                                type="number"
                                value={fs.louver}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, louver: val } : x));
                                }}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-muted-foreground">Losses in Grille (Pa)</label>
                              <input
                                type="number"
                                value={fs.grille}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, grille: val } : x));
                                }}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-muted-foreground">Losses in SAs (Pa)</label>
                              <input
                                type="number"
                                value={fs.sa}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setFanSystems(fanSystems.map(x => x.id === fs.id ? { ...x, sa: val } : x));
                                }}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-2.5 py-1.5 font-bold outline-none text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col gap-2.5 text-xs">
                            <div className="font-bold text-[#64748b] border-b border-border pb-1.5 uppercase tracking-wider text-[10px]">Calculated Results</div>
                            <div className="bg-slate-100/20 dark:bg-slate-900/10 border border-border rounded-xl p-3 flex flex-col gap-2 font-sans">
                              <div className="flex justify-between items-center py-1 border-b border-border/40">
                                <span className="font-semibold text-muted-foreground">Fittings in Ducting</span>
                                <strong className="font-bold text-foreground font-mono">{fs.fittings.toFixed(1)} m</strong>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-border/40">
                                <span className="font-semibold text-muted-foreground">Equivalent Length</span>
                                <strong className="font-bold text-foreground font-mono">{fs.eqLen.toFixed(1)} m</strong>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-border/40">
                                <span className="font-semibold text-muted-foreground">Frictional Losses</span>
                                <strong className="font-bold text-foreground font-mono">{fs.frictionLoss.toFixed(2)} Pa</strong>
                              </div>
                              <div className="flex justify-between items-center py-1 border-b border-border/40">
                                <span className="font-semibold text-muted-foreground">Safety Overhead (10%)</span>
                                <strong className="font-bold text-foreground font-mono">{fs.safety.toFixed(2)} Pa</strong>
                              </div>
                              <div className="flex justify-between items-center pt-1 text-[#0A7BC7]">
                                <span className="font-bold">Total Static Sized</span>
                                <strong className="font-bold text-sm font-mono">{fs.totalStatic} Pa</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>

      {/* Add Level Modal */}
      {showAddLevelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <h3 className="font-bold text-base text-foreground">Add Basement Level</h3>
              <button onClick={() => setShowAddLevelModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-xs font-sans">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Floor / Basement Name</label>
                <input
                  type="text"
                  placeholder="e.g. B1, B2"
                  value={newFloor.name}
                  onChange={e => setNewFloor({ ...newFloor, name: e.target.value })}
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Gross Area ({ip ? "ft²" : "m²"})</label>
                  <input
                    type="number"
                    placeholder="600"
                    value={newFloor.area}
                    onChange={e => setNewFloor({ ...newFloor, area: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Effective Area ({ip ? "ft²" : "m²"})</label>
                  <input
                    type="number"
                    placeholder="500"
                    value={newFloor.effArea}
                    onChange={e => setNewFloor({ ...newFloor, effArea: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Height ({ip ? "ft" : "m"})</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="3"
                    value={newFloor.height}
                    onChange={e => setNewFloor({ ...newFloor, height: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Number of Zones</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="1"
                    value={newFloor.numZones}
                    onChange={e => setNewFloor({ ...newFloor, numZones: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setShowAddLevelModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFloor}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="size-3.5" /> Add Level
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Level Modal */}
      {showEditLevelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <h3 className="font-bold text-base text-foreground">Edit Level — {editLevelTarget}</h3>
              <button onClick={() => setShowEditLevelModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-xs font-sans">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Level Name</label>
                <input
                  type="text"
                  value={editLevelData.levelName}
                  onChange={e => setEditLevelData({ ...editLevelData, levelName: e.target.value })}
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Total Gross Area ({ip ? "ft²" : "m²"})</label>
                  <input
                    type="number"
                    value={editLevelData.area}
                    onChange={e => setEditLevelData({ ...editLevelData, area: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Total Effective Area ({ip ? "ft²" : "m²"})</label>
                  <input
                    type="number"
                    value={editLevelData.effArea}
                    onChange={e => setEditLevelData({ ...editLevelData, effArea: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Height ({ip ? "ft" : "m"})</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editLevelData.height}
                    onChange={e => setEditLevelData({ ...editLevelData, height: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Number of Zones</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editLevelData.numZones}
                    onChange={e => setEditLevelData({ ...editLevelData, numZones: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setShowEditLevelModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditLevel}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer flex items-center gap-1.5"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

  {/* Fan System Modal */}
      {showFSModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-fade-in">
            <h3 className="font-bold text-base text-foreground">
              {modalFSId ? "Edit Fan System" : "Create Fan System"}
            </h3>
            
            {modalError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 rounded-lg p-2.5 text-xs flex items-center gap-2 select-none">
                <AlertTriangle className="size-4 shrink-0 text-red-600" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex flex-col gap-3.5 text-xs font-sans">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">System Name</label>
                <input
                  type="text"
                  value={modalFSName}
                  onChange={e => setModalFSName(e.target.value)}
                  placeholder="e.g. SF-1 Extract"
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7] text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">System Type</label>
                <select
                  value={modalFSType}
                  onChange={e => setModalFSType(e.target.value as any)}
                  className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 font-bold outline-none focus:border-[#0A7BC7]"
                >
                  <option value="Extract">Smoke Extract Fan</option>
                  <option value="Makeup">Makeup Air Fan</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Associate Floor Levels</label>
                <div className="border border-border/80 rounded-lg p-1.5 bg-background max-h-36 overflow-y-auto flex flex-col gap-1 select-none">
                  {floors.map(f => {
                    const checked = modalSelectedFloorIds.includes(f.id);
                    const assignedTo = assignedFloorsMap[f.id];
                    const isDisabled = !!assignedTo;
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center gap-2 px-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold cursor-pointer ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isDisabled}
                          onChange={() => {
                            if (isDisabled) return;
                            const nextIds = checked 
                              ? modalSelectedFloorIds.filter(id => id !== f.id)
                              : [...modalSelectedFloorIds, f.id];
                            setModalSelectedFloorIds(nextIds);
                          }}
                        />
                        <span className="flex-1 text-foreground">{f.name}</span>
                        {assignedTo && (
                          <span className="text-[10px] text-red-500 font-bold">
                            Assigned to {assignedTo}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setShowFSModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFanSystem}
                className="px-4 py-2 bg-[#0A7BC7] text-white font-bold rounded-lg text-xs transition hover:bg-[#06456F] cursor-pointer"
              >
                {modalFSId ? "Save Changes" : "Create System"}
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    </AppShell>
  );
}
