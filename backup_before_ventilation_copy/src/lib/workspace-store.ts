import { useState, useEffect } from "react";
import { calculateVentilation, type Space, type Zone, type Equipment } from "./ventilation-calc";
export type { Space, Zone, Equipment };
export type { SpaceStatus } from "./mock-data";

export interface Project {
  id: string;
  name: string;
  code: string;
  client: string;
  location?: string;
  description?: string;
  notes?: string;
  createdDate?: string;
  lastModified?: string;
  status?: string;
}

const IS_SERVER = typeof window === "undefined";

let projects: Project[] = [];
let activeProjectId: string = "";

if (!IS_SERVER) {
  try {
    const saved = localStorage.getItem("mep_projects");
    projects = saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Failed to parse projects:", e);
  }
  activeProjectId = localStorage.getItem("mep_active_project_id") || "";
}

// Fallback if no projects exist
if (projects.length === 0) {
  const defaultProj: Project = {
    id: "proj_default",
    name: "Marina Bay Tower",
    code: "MBT-2026-117",
    client: "Marina Holdings",
    createdDate: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    status: "Active",
  };
  projects = [defaultProj];
  activeProjectId = "proj_default";
  if (!IS_SERVER) {
    localStorage.setItem("mep_projects", JSON.stringify(projects));
    localStorage.setItem("mep_active_project_id", activeProjectId);
  }
}

// If activeProjectId is not in projects, use the first one
let currentProject = projects.find((p) => p.id === activeProjectId);
if (!currentProject) {
  currentProject = projects[0];
  activeProjectId = currentProject.id || "proj_default";
  if (!IS_SERVER) {
    localStorage.setItem("mep_active_project_id", activeProjectId);
  }
}

// Load workspace state for the active project
let currentWorkspaceState = {
  spaces: [] as Space[],
  zones: [] as Zone[],
  equipment: [] as Equipment[],
};

if (!IS_SERVER) {
  try {
    const savedState = localStorage.getItem(`mep_project_workspace_${activeProjectId}`);
    if (savedState) {
      currentWorkspaceState = JSON.parse(savedState);
    }
  } catch (e) {
    console.error("Failed to parse workspace state:", e);
  }
}

const listeners = new Set<() => void>();

let undoStack: string[] = [];
let redoStack: string[] = [];
const MAX_HISTORY_LIMIT = 50;

function pushHistory() {
  undoStack.push(JSON.stringify(currentWorkspaceState));
  if (undoStack.length > MAX_HISTORY_LIMIT) {
    undoStack.shift();
  }
  redoStack = []; // Reset redo stack when a new operation occurs
}

function clearHistory() {
  undoStack = [];
  redoStack = [];
}

let copiedSpaces: Space[] = [];

if (typeof window !== "undefined") {
  try {
    const saved = localStorage.getItem("mep_clipboard_spaces");
    copiedSpaces = saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Failed to load clipboard:", e);
  }
}

function notify() {
  listeners.forEach((l) => l());
}

function saveState() {
  if (IS_SERVER) return;
  localStorage.setItem(`mep_project_workspace_${activeProjectId}`, JSON.stringify(currentWorkspaceState));
  localStorage.setItem("mep_projects", JSON.stringify(projects));
  localStorage.setItem("mep_active_project_id", activeProjectId);
}

export const workspaceStore = {
  getState() {
    return {
      project: currentProject!,
      projects,
      activeProjectId,
      spaces: currentWorkspaceState.spaces,
      zones: currentWorkspaceState.zones,
      equipment: currentWorkspaceState.equipment,
    };
  },

  setState(newState: { project?: Project; spaces: Space[]; zones: Zone[]; equipment: Equipment[] }) {
    pushHistory();
    if (newState.project) {
      currentProject = newState.project;
      projects = projects.map((p) => (p.id === currentProject.id ? currentProject : p));
    }
    currentWorkspaceState = {
      spaces: newState.spaces,
      zones: newState.zones,
      equipment: newState.equipment,
    };
    saveState();
    notify();
  },

  selectProject(id: string) {
    const target = projects.find((p) => p.id === id);
    if (!target) return;

    // Save previous active project's state first
    saveState();
    clearHistory();

    currentProject = target;
    activeProjectId = id;

    // Load target project's state
    let nextState = {
      spaces: [] as Space[],
      zones: [] as Zone[],
      equipment: [] as Equipment[],
    };

    if (!IS_SERVER) {
      try {
        const saved = localStorage.getItem(`mep_project_workspace_${id}`);
        if (saved) nextState = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load project state:", e);
      }
    }

    currentWorkspaceState = nextState;
    saveState();
    notify();
  },

  createNewProject(projData: Omit<Project, "id">) {
    const newId = `proj_${Date.now()}`;
    const newProj: Project = {
      ...projData,
      id: newId,
      createdDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      status: "Active",
    };

    // Save current active project
    saveState();
    clearHistory();

    projects.unshift(newProj);
    currentProject = newProj;
    activeProjectId = newId;

    currentWorkspaceState = {
      spaces: [],
      zones: [],
      equipment: [],
    };

    saveState();
    notify();
    return newProj;
  },

  duplicateProject(id: string) {
    const target = projects.find((p) => p.id === id);
    if (!target) return null;

    const newId = `proj_${Date.now()}`;
    const newProj: Project = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
      code: `${target.code}-COPY`,
      createdDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };

    // Find position of target and insert after it
    const idx = projects.findIndex((p) => p.id === id);
    if (idx !== -1) {
      projects.splice(idx + 1, 0, newProj);
    } else {
      projects.push(newProj);
    }

    // Load workspace state of source
    let sourceState = { spaces: [], zones: [], equipment: [] };
    if (!IS_SERVER) {
      try {
        const saved = localStorage.getItem(`mep_project_workspace_${id}`);
        if (saved) sourceState = JSON.parse(saved);
      } catch (e) {}
    }

    // Save workspace state of clone
    if (!IS_SERVER) {
      localStorage.setItem(`mep_project_workspace_${newId}`, JSON.stringify(sourceState));
    }

    saveState();
    notify();
    return newProj;
  },

  deleteProject(id: string) {
    projects = projects.filter((p) => p.id !== id);
    if (!IS_SERVER) {
      localStorage.removeItem(`mep_project_workspace_${id}`);
    }

    if (activeProjectId === id) {
      if (projects.length > 0) {
        activeProjectId = projects[0].id;
        currentProject = projects[0];
        // Load its workspace state
        let nextState = { spaces: [], zones: [], equipment: [] };
        if (!IS_SERVER) {
          try {
            const saved = localStorage.getItem(`mep_project_workspace_${activeProjectId}`);
            if (saved) nextState = JSON.parse(saved);
          } catch (e) {}
        }
        currentWorkspaceState = nextState;
      } else {
        // Fallback default
        const defaultProj: Project = {
          id: "proj_default",
          name: "Marina Bay Tower",
          code: "MBT-2026-117",
          client: "Marina Holdings",
          createdDate: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          status: "Active",
        };
        projects = [defaultProj];
        activeProjectId = "proj_default";
        currentProject = defaultProj;
        currentWorkspaceState = { spaces: [], zones: [], equipment: [] };
      }
    }

    saveState();
    notify();
  },

  clearWorkspace() {
    pushHistory();
    currentWorkspaceState = {
      spaces: [],
      zones: [],
      equipment: [],
    };
    saveState();
    notify();
  },

  updateProject(updated: Project) {
    projects = projects.map((p) => (p.id === updated.id ? updated : p));
    if (activeProjectId === updated.id) {
      currentProject = updated;
    }
    saveState();
    notify();
  },

  updateSpaces(updatedSpaces: Space[]) {
    pushHistory();
    const spaceMap = new Map(updatedSpaces.map((s) => [s.id, s]));
    const nextSpaces = currentWorkspaceState.spaces.map((s) => spaceMap.get(s.id) || s);

    const balanced = calculateVentilation(
      nextSpaces,
      currentWorkspaceState.zones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  updateZones(updatedZones: Zone[]) {
    pushHistory();
    const zoneMap = new Map(updatedZones.map((z) => [z.id, z]));
    const nextZones = currentWorkspaceState.zones.map((z) => zoneMap.get(z.id) || z);

    const balanced = calculateVentilation(
      currentWorkspaceState.spaces,
      nextZones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  updateEquipment(updatedEquip: Equipment[]) {
    pushHistory();
    const equipMap = new Map(updatedEquip.map((e) => [e.id, e]));
    const nextEquip = currentWorkspaceState.equipment.map((e) => equipMap.get(e.id) || e);

    const balanced = calculateVentilation(
      currentWorkspaceState.spaces,
      currentWorkspaceState.zones,
      nextEquip
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  addSpace(newSpace: Space) {
    pushHistory();
    const nextSpaces = [...currentWorkspaceState.spaces, newSpace];
    const balanced = calculateVentilation(
      nextSpaces,
      currentWorkspaceState.zones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  addSpacesBulk(newSpaces: Space[]) {
    pushHistory();
    const existingZoneNames = new Set(
      currentWorkspaceState.zones.map((z) => z.name.toLowerCase())
    );
    const existingZoneIds = new Set(
      currentWorkspaceState.zones.map((z) => z.id.toLowerCase())
    );

    const zonesToAdd: Zone[] = [];
    newSpaces.forEach((s) => {
      if (s.zone) {
        const zoneLower = s.zone.toLowerCase();
        if (!existingZoneNames.has(zoneLower) && !existingZoneIds.has(zoneLower)) {
          const zoneId = `zone-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
          });
          existingZoneNames.add(zoneLower);
        }
      }
    });

    const nextZones = [...currentWorkspaceState.zones, ...zonesToAdd];
    const nextSpaces = [...currentWorkspaceState.spaces, ...newSpaces];

    const balanced = calculateVentilation(
      nextSpaces,
      nextZones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  deleteSpaces(idsToDelete: string[]) {
    pushHistory();
    const nextSpaces = currentWorkspaceState.spaces.filter((s) => !idsToDelete.includes(s.id));
    const balanced = calculateVentilation(
      nextSpaces,
      currentWorkspaceState.zones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  bulkUpdateSpaces(ids: string[], updates: Partial<Space>) {
    pushHistory();
    const nextSpaces = currentWorkspaceState.spaces.map((s) => {
      if (ids.includes(s.id)) {
        return { ...s, ...updates };
      }
      return s;
    });
    const balanced = calculateVentilation(
      nextSpaces,
      currentWorkspaceState.zones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  mergeSpaces(ids: string[], primaryId: string, mergedName: string) {
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
      if (s.fixtures !== "" && s.fixtures !== undefined && s.fixtures !== null) {
        combinedFixtures += (parseFloat(String(s.fixtures || 0)) || 0) * mult;
        hasAnyFixturesVal = true;
      }
    });

    const mergedSpace: Space = {
      ...primarySpace,
      id: `merged-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: mergedName,
      area: combinedArea,
      fixtures: hasAnyFixturesVal ? combinedFixtures : "",
      multiplier: 1,
      status: "complete",
    };

    const firstIndex = currentWorkspaceState.spaces.findIndex((s) => ids.includes(s.id));
    const filteredSpaces = currentWorkspaceState.spaces.filter((s) => !ids.includes(s.id));
    filteredSpaces.splice(firstIndex === -1 ? 0 : firstIndex, 0, mergedSpace);

    const balanced = calculateVentilation(
      filteredSpaces,
      currentWorkspaceState.zones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  addZone(newZone: Zone) {
    pushHistory();
    const nextZones = [...currentWorkspaceState.zones, newZone];
    const balanced = calculateVentilation(
      currentWorkspaceState.spaces,
      nextZones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  deleteZone(zoneId: string) {
    pushHistory();
    const nextZones = currentWorkspaceState.zones.filter((z) => z.id !== zoneId);
    // Dissolve zone: set all spaces in this zone to have zone = ""
    const nextSpaces = currentWorkspaceState.spaces.map((s) =>
      s.zone === zoneId || s.zone === nextZones.find((z) => z.id === zoneId)?.name
        ? { ...s, zone: "" }
        : s
    );
    const balanced = calculateVentilation(
      nextSpaces,
      nextZones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  autoZoneSpaces(selectedProposals: { name: string; floor: string; spaces: Space[] }[]) {
    pushHistory();
    const nextZones = [...currentWorkspaceState.zones];
    const nextSpaces = [...currentWorkspaceState.spaces];

    selectedProposals.forEach((p) => {
      const zoneId = `zone-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const zoneName = p.name + " Zone";

      const newZone: Zone = {
        id: zoneId,
        name: zoneName,
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
      };
      nextZones.push(newZone);

      const spaceIds = p.spaces.map((s) => s.id);
      nextSpaces.forEach((s, idx) => {
        if (spaceIds.includes(s.id)) {
          nextSpaces[idx] = { ...s, zone: zoneId };
        }
      });
    });

    const balanced = calculateVentilation(
      nextSpaces,
      nextZones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  assignZoneToEquipment(zoneId: string, equipId: string, stream: "FA" | "EA") {
    pushHistory();
    const nextZones = currentWorkspaceState.zones.map((g) => {
      if (g.id === zoneId) {
        return {
          ...g,
          faAssignment: stream === "FA" ? equipId : g.faAssignment,
          eaAssignment: stream === "EA" ? equipId : g.eaAssignment,
        };
      }
      return g;
    });

    const balanced = calculateVentilation(
      currentWorkspaceState.spaces,
      nextZones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  removeZoneFromEquipment(zoneId: string, equipId: string, stream: "FA" | "EA") {
    pushHistory();
    const nextZones = currentWorkspaceState.zones.map((g) => {
      if (g.id === zoneId) {
        return {
          ...g,
          faAssignment: stream === "FA" && g.faAssignment === equipId ? null : g.faAssignment,
          eaAssignment: stream === "EA" && g.eaAssignment === equipId ? null : g.eaAssignment,
        };
      }
      return g;
    });

    const balanced = calculateVentilation(
      currentWorkspaceState.spaces,
      nextZones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  addEquipment(newEquip: Equipment) {
    pushHistory();
    const nextEquip = [...currentWorkspaceState.equipment, newEquip];
    const balanced = calculateVentilation(
      currentWorkspaceState.spaces,
      currentWorkspaceState.zones,
      nextEquip
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  deleteEquipment(equipId: string) {
    pushHistory();
    const nextEquip = currentWorkspaceState.equipment.filter((e) => e.id !== equipId);
    const nextZones = currentWorkspaceState.zones.map((g) => ({
      ...g,
      faAssignment: g.faAssignment === equipId ? null : g.faAssignment,
      eaAssignment: g.eaAssignment === equipId ? null : g.eaAssignment,
    }));

    const balanced = calculateVentilation(
      currentWorkspaceState.spaces,
      nextZones,
      nextEquip
    );
    currentWorkspaceState = balanced;
    saveState();
    notify();
  },

  undo() {
    if (undoStack.length === 0) return false;
    const previous = undoStack.pop()!;
    redoStack.push(JSON.stringify(currentWorkspaceState));
    currentWorkspaceState = JSON.parse(previous);
    saveState();
    notify();
    return true;
  },

  redo() {
    if (redoStack.length === 0) return false;
    const nextState = redoStack.pop()!;
    undoStack.push(JSON.stringify(currentWorkspaceState));
    currentWorkspaceState = JSON.parse(nextState);
    saveState();
    notify();
    return true;
  },

  copySpaces(ids: string[]) {
    const targets = currentWorkspaceState.spaces.filter((s) => ids.includes(s.id));
    if (targets.length === 0) return false;
    copiedSpaces = JSON.parse(JSON.stringify(targets));
    if (typeof window !== "undefined") {
      localStorage.setItem("mep_clipboard_spaces", JSON.stringify(copiedSpaces));
    }
    notify(); // Notify so that state updates (e.g. paste capability)
    return true;
  },

  cutSpaces(ids: string[]) {
    const targets = currentWorkspaceState.spaces.filter((s) => ids.includes(s.id));
    if (targets.length === 0) return false;
    copiedSpaces = JSON.parse(JSON.stringify(targets));
    if (typeof window !== "undefined") {
      localStorage.setItem("mep_clipboard_spaces", JSON.stringify(copiedSpaces));
    }
    this.deleteSpaces(ids); // deleteSpaces already pushes history
    return true;
  },

  pasteSpaces(): Space[] {
    if (copiedSpaces.length === 0) return [];
    pushHistory();
    const pasted: Space[] = copiedSpaces.map((s, index) => {
      const timestamp = Date.now();
      const newId = `sp-${timestamp}-${index}-${Math.floor(Math.random() * 1000)}`;
      const newCode = `${s.code.replace(/-CLONE(-\d+)?$/, "")}-CLONE-${Math.floor(Math.random() * 100)}`;
      return {
        ...s,
        id: newId,
        code: newCode,
        name: `${s.name} (Copy)`,
      };
    });

    const nextSpaces = [...currentWorkspaceState.spaces, ...pasted];
    
    // Auto-create zones if they don't exist
    const existingZoneNames = new Set(
      currentWorkspaceState.zones.map((z) => z.name.toLowerCase())
    );
    const existingZoneIds = new Set(
      currentWorkspaceState.zones.map((z) => z.id.toLowerCase())
    );
    const zonesToAdd: Zone[] = [];
    
    pasted.forEach((s) => {
      if (s.zone) {
        const zoneLower = s.zone.toLowerCase();
        if (!existingZoneNames.has(zoneLower) && !existingZoneIds.has(zoneLower)) {
          const zoneId = `zone-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
          });
          existingZoneNames.add(zoneLower);
        }
      }
    });

    const nextZones = [...currentWorkspaceState.zones, ...zonesToAdd];
    const balanced = calculateVentilation(
      nextSpaces,
      nextZones,
      currentWorkspaceState.equipment
    );
    
    currentWorkspaceState = balanced;
    saveState();
    notify();
    return pasted;
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useWorkspace() {
  const [state, setState] = useState(workspaceStore.getState());

  useEffect(() => {
    return workspaceStore.subscribe(() => {
      setState(workspaceStore.getState());
    });
  }, []);

  return {
    project: state.project,
    projects: state.projects,
    activeProjectId: state.activeProjectId,
    spaces: state.spaces,
    zones: state.zones,
    equipment: state.equipment,
    selectProject: (id: string) => workspaceStore.selectProject(id),
    createNewProject: (project: Omit<Project, "id">) => workspaceStore.createNewProject(project),
    duplicateProject: (id: string) => workspaceStore.duplicateProject(id),
    deleteProject: (id: string) => workspaceStore.deleteProject(id),
    clearWorkspace: () => workspaceStore.clearWorkspace(),
    updateProject: (project: Project) => workspaceStore.updateProject(project),
    updateSpaces: (spaces: Space[]) => workspaceStore.updateSpaces(spaces),
    updateZones: (zones: Zone[]) => workspaceStore.updateZones(zones),
    updateEquipment: (equip: Equipment[]) => workspaceStore.updateEquipment(equip),
    addSpace: (space: Space) => workspaceStore.addSpace(space),
    addSpacesBulk: (spaces: Space[]) => workspaceStore.addSpacesBulk(spaces),
    deleteSpaces: (ids: string[]) => workspaceStore.deleteSpaces(ids),
    bulkUpdateSpaces: (ids: string[], updates: Partial<Space>) => workspaceStore.bulkUpdateSpaces(ids, updates),
    mergeSpaces: (ids: string[], primaryId: string, mergedName: string) => workspaceStore.mergeSpaces(ids, primaryId, mergedName),
    addZone: (zone: Zone) => workspaceStore.addZone(zone),
    deleteZone: (zoneId: string) => workspaceStore.deleteZone(zoneId),
    autoZoneSpaces: (proposals: { name: string; floor: string; spaces: Space[] }[]) => workspaceStore.autoZoneSpaces(proposals),
    assignZoneToEquipment: (zoneId: string, equipId: string, stream: "FA" | "EA") => workspaceStore.assignZoneToEquipment(zoneId, equipId, stream),
    removeZoneFromEquipment: (zoneId: string, equipId: string, stream: "FA" | "EA") => workspaceStore.removeZoneFromEquipment(zoneId, equipId, stream),
    addEquipment: (equip: Equipment) => workspaceStore.addEquipment(equip),
    deleteEquipment: (equipId: string) => workspaceStore.deleteEquipment(equipId),
    setWorkspaceState: (newState: any) => workspaceStore.setState(newState),
    undo: () => workspaceStore.undo(),
    redo: () => workspaceStore.redo(),
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    copySpaces: (ids: string[]) => workspaceStore.copySpaces(ids),
    cutSpaces: (ids: string[]) => workspaceStore.cutSpaces(ids),
    pasteSpaces: () => workspaceStore.pasteSpaces(),
    hasClipboard: copiedSpaces.length > 0,
  };
}

export const workspace = currentWorkspaceState;