import { useState, useEffect } from "react";
import { calculateVentilation, setGlobalRoundOffPreset, type Space, type Zone, type Equipment, type ZoneInstanceAssignment } from "./ventilation-calc";
export type { ZoneInstanceAssignment };
import { predictOccupancyCategory, predictSpacePressure } from "./ai-occupancy";
import { api } from "../services/api";
import { supabase } from "./supabase";
import { getOccupancyData } from "./ashrae-data";
import { logCalculatorUpdate, getCalculatorTitleFromPath } from "@/utils/logger";
export type { Space, Zone, Equipment };
export type { SpaceStatus } from "./mock-data";
export function checkIfSpaceMissingData(s: Space): boolean {
  const isNoArea = !s.area || parseFloat(String(s.area)) === 0 || isNaN(parseFloat(String(s.area)));
  const isNoCategory = !s.category || s.category.trim() === "" || s.category.toLowerCase().includes("select category");
  if (isNoArea || isNoCategory) return true;

  if (s.category === "Rest Room / Changing Room") {
    const sub = s.restroomSubCategories || {};
    const sumSub = 
      (sub.toiletPrivateContinuous || 0) +
      (sub.toiletPublicContinuous || 0) +
      (sub.toiletPrivateDiscontinuous || 0) +
      (sub.toiletPublicDiscontinuous || 0) +
      (sub.showerContinuous || 0) +
      (sub.showerDiscontinuous || 0) +
      (sub.janitorCloset || 0) +
      (sub.lockerRoom || 0);
    if (sumSub === 0) {
      return true;
    }
  }

  return false;
}

export function sanitizeWorkspaceState(state: any) {
  if (!state || !Array.isArray(state.zones)) return state;

  const seenIds = new Set<string>();
  const idMap = new Map<string, string>(); // oldId -> newId
  const zoneNameMap = new Map<string, string>();

  state.zones = state.zones.map((z: any) => {
    if (!z.id || seenIds.has(z.id)) {
      const newId = `zone-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
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

  // Always resolve space.zone to clean human-readable zone.name, NEVER raw zone-xxxx
  if (Array.isArray(state.spaces)) {
    state.spaces = state.spaces.map((s: any) => {
      if (s.zone) {
        const cleanName = zoneNameMap.get(s.zone) || zoneNameMap.get(s.zone.toLowerCase());
        if (cleanName) {
          s.zone = cleanName;
        } else if (s.zone.startsWith("zone-")) {
          s.zone = "Default";
        }
      }
      return s;
    });
  }

  return state;
}

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
  workspace_data?: any;
}

const IS_SERVER = typeof window === "undefined";

let projects: Project[] = [];
let activeProjectId: string = "";
let currentProject: Project | undefined = undefined;

let currentWorkspaceState = {
  spaces: [] as Space[],
  zones: [] as Zone[],
  equipment: [] as Equipment[],
  roundOffPreset: 5,
  isReadOnly: false,
};

let cloudInitDone = false;
export let isInitializing = true;

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

let saveTimeout: any = null;
function saveState() {
  if (IS_SERVER) return;
  currentWorkspaceState = sanitizeWorkspaceState(currentWorkspaceState);
  
  if (typeof localStorage !== "undefined" && activeProjectId) {
    localStorage.setItem("mep_active_project_id", activeProjectId);
    localStorage.setItem("mep_last_worked_project_id", activeProjectId);
  }

  // Immediately log calculator update action on any workspace state change
  if (typeof window !== 'undefined' && window.location.pathname) {
    const path = window.location.pathname;
    const calcTitle = getCalculatorTitleFromPath(path);
    if (calcTitle) {
      logCalculatorUpdate(calcTitle, `Changes occurred in ${calcTitle}`);
    }
  }

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (activeProjectId) {
      const lsState: Record<string, string> = {};
      const knownPrefixes = ['mep', 'drainage', 'fireTank', 'gasTank', 'sewagePump', 'sumpPump', 'tankSizing', 'pcl', 'bs_', 'chw_', 'customCableCatalog', 'customBusbarRatings'];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && knownPrefixes.some(p => key.startsWith(p)) && !key.includes('clipboard')) {
          lsState[key] = localStorage.getItem(key) || "";
        }
      }
      
      const nowIso = new Date().toISOString();
      const existingWdata = currentProject ? (currentProject.workspace_data || {}) : {};
      
      const payload = {
        ...existingWdata,
        ...currentWorkspaceState,
        localStorageCache: lsState
      };
      
      if (currentProject) {
        currentProject.workspace_data = payload;
        (currentProject as any).updated_at = nowIso;
        (currentProject as any).last_modified = nowIso;
        currentProject.lastModified = nowIso;
      }
      const targetProj = projects.find(proj => proj.id === activeProjectId);
      if (targetProj) {
        targetProj.workspace_data = payload;
        (targetProj as any).updated_at = nowIso;
        (targetProj as any).last_modified = nowIso;
        targetProj.lastModified = nowIso;
      }
      
      api.saveWorkspace(activeProjectId, payload);
      notify();
    }
  }, 1000);
}

function injectLocalStorageCache(wdata: any) {
  if (typeof localStorage === "undefined") return;
  const knownPrefixes = ['mep', 'drainage', 'fireTank', 'gasTank', 'sewagePump', 'sumpPump', 'tankSizing', 'pcl', 'bs_', 'chw_', 'customCableCatalog', 'customBusbarRatings'];
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && knownPrefixes.some(p => key.startsWith(p)) && !key.includes('clipboard')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  
  if (wdata && wdata.localStorageCache) {
    Object.entries(wdata.localStorageCache).forEach(([key, val]) => {
       localStorage.setItem(key, val as string);
    });
  }
}

export const workspaceStore = {
  forceSaveToCloud() {
    saveState();
  },
  async syncFromCloud() {
    const cloudProjects = await api.getProjects();
    if (cloudProjects && cloudProjects.length > 0) {
      projects = cloudProjects;
      const lastActive = typeof localStorage !== "undefined"
        ? (localStorage.getItem("mep_active_project_id") || localStorage.getItem("mep_last_worked_project_id") || activeProjectId)
        : activeProjectId;
      let target = projects.find(p => p.id === lastActive || p.id === activeProjectId) || projects[0];
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
          const updatedActive = projects.find(p => p.id === activeProjectId);
          if (updatedActive) {
            currentProject = updatedActive;
          }
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
      supabase
        .channel('public:projects')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
          workspaceStore.refreshProjects();
        })
        .subscribe();

      const cloudProjects = await api.getProjects();
      projects = cloudProjects || [];
      
      if (projects.length > 0) {
         let lastActive = typeof localStorage !== "undefined"
           ? (localStorage.getItem("mep_active_project_id") || localStorage.getItem("mep_last_worked_project_id"))
           : null;
         let target = projects[0];
         if (lastActive) {
           const found = projects.find(p => p.id === lastActive || p.code === lastActive);
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
         currentProject = undefined;
         currentWorkspaceState = { spaces: [], zones: [], equipment: [], roundOffPreset: 5, isReadOnly: false };
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
    const defaultProject = { id: "", name: "No Workspace Selected", code: "---", client: "N/A" };
    return {
      project: currentProject || defaultProject,
      projects,
      activeProjectId,
      isInitializing,
      spaces: currentWorkspaceState.spaces,
      zones: currentWorkspaceState.zones,
      equipment: currentWorkspaceState.equipment,
      roundOffPreset: currentWorkspaceState.roundOffPreset ?? 5,
      isReadOnly: currentWorkspaceState.isReadOnly ?? false,
    };
  },

  setReadOnly(val: boolean) {
    currentWorkspaceState.isReadOnly = val;
    saveState();
    notify();
  },

  setState(newState: { project?: Project; spaces: Space[]; zones: Zone[]; equipment: Equipment[]; isReadOnly?: boolean }) {
    pushHistory();
    if (newState.project) {
      const proj = newState.project;
      currentProject = proj;
      projects = projects.map((p) => (p.id === proj.id ? proj : p));
    }
    const processedSpaces = (newState.spaces || []).map(s => {
      const isMissing = checkIfSpaceMissingData(s);
      return isMissing ? { ...s, flagged: true } : s;
    });
    currentWorkspaceState = {
      spaces: processedSpaces,
      zones: newState.zones,
      equipment: newState.equipment,
      roundOffPreset: currentWorkspaceState.roundOffPreset,
      isReadOnly: newState.isReadOnly ?? currentWorkspaceState.isReadOnly,
    };
    saveState();
    notify();
  },

  selectProject(id: string) {
    const target = projects.find((p) => p.id === id);
    if (!target) return;

    saveState();
    clearHistory();

    currentProject = target;
    activeProjectId = id;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("mep_active_project_id", id);
    }

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

  async createNewProject(projData: Omit<Project, "id">, assigned_users: string[] = [], assigned_teams: string[] = []) {
    const res = await api.createProject({
       ...projData,
       workspace_data: { spaces: [], zones: [], equipment: [], roundOffPreset: 5 }
    }, assigned_users, assigned_teams);
    
    if (res.success) {
      const newProj = res.project;
      
      try {
        const cloudProjects = await api.getProjects();
        if (cloudProjects && cloudProjects.length > 0) {
          projects = cloudProjects;
        } else {
          projects = [newProj, ...projects];
        }
      } catch (e) {
        projects = [newProj, ...projects];
      }
      
      saveState();
      clearHistory();
      
      const targetProj = projects.find(p => p.id === newProj.id) || newProj;
      currentProject = targetProj;
      activeProjectId = targetProj.id;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("mep_active_project_id", targetProj.id);
        localStorage.setItem("mep_last_worked_project_id", targetProj.id);
      }
      currentWorkspaceState = { spaces: [], zones: [], equipment: [], roundOffPreset: 5, isReadOnly: false };
      
      notify();
    }
    return res;
  },

  async duplicateProject(id: string) {
    // Currently disabled for cloud MVP, will just fetch the target and create a new project
    const target = projects.find((p) => p.id === id);
    if (!target) return null;
    
    const res = await api.createProject({
      ...target,
      name: `${target.name} (Copy)`,
      code: `${target.code}-COPY`,
      workspace_data: target.workspace_data || { spaces: [], zones: [], equipment: [], roundOffPreset: 5 }
    }, [], []);

    if (res.success) {
      projects.unshift(res.project);
      notify();
      return res.project;
    }
    return null;
  },

  saveAsRevision(versionName: string) {
    if (!currentProject) return null;
    const newId = `proj_${Date.now()}_${versionName}`;
    const newProj: Project = {
      ...currentProject,
      id: newId,
      name: `${currentProject.name} (${versionName})`,
      createdDate: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    };
    
    projects.unshift(newProj);
    
    if (!IS_SERVER) {
      localStorage.setItem(`mep_project_workspace_${newId}`, JSON.stringify({ ...currentWorkspaceState, isReadOnly: true }));
    }
    
    saveState();
    notify();
    return newProj;
  },

  async deleteProject(id: string) {
    const res = await api.deleteProject(id);
    if (res.success) {
      projects = projects.filter((p) => p.id !== id);

      if (activeProjectId === id) {
        if (projects.length > 0) {
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
          currentProject = undefined;
          setGlobalRoundOffPreset(5);
          currentWorkspaceState = { spaces: [], zones: [], equipment: [], roundOffPreset: 5, isReadOnly: false };
        }
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
    const nextSpaces = currentWorkspaceState.spaces.map((s) => {
      const updated = spaceMap.get(s.id);
      if (updated) {
        const wasMissing = checkIfSpaceMissingData(s);
        const isMissing = checkIfSpaceMissingData(updated);
        let flagged = updated.flagged;
        if (isMissing) {
          flagged = true;
        } else if (wasMissing && !isMissing) {
          flagged = false;
        }
        return { ...updated, flagged };
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
    logCalculatorUpdate('Ventilation', 'Updated spaces in Ventilation');
    notify();
  },

  updateZones(updatedZones: Zone[]) {
    pushHistory();
    const zoneMap = new Map(updatedZones.map((z) => [z.id, z]));
    const nextZones = currentWorkspaceState.zones.map((z) => {
      const updated = zoneMap.get(z.id);
      if (updated) {
        const mult = updated.multiplier ?? 1;
        return {
          ...updated,
          faAssignedQty: Math.min(mult, updated.faAssignedQty ?? 1),
          eaAssignedQty: Math.min(mult, updated.eaAssignedQty ?? 1),
        };
      }
      return z;
    });

    const balanced = calculateVentilation(
      currentWorkspaceState.spaces,
      nextZones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = balanced;
    saveState();
    logCalculatorUpdate('Ventilation', 'Updated zones in Ventilation');
    notify();
  },


  updateEquipment(updatedEquip: Equipment[]) {
    pushHistory();
    const balanced = calculateVentilation(
      currentWorkspaceState.spaces,
      currentWorkspaceState.zones,
      updatedEquip
    );
    currentWorkspaceState = balanced;
    saveState();
    logCalculatorUpdate('Ventilation', 'Updated equipment in Ventilation');
    notify();
  },

  addCommentToTarget(targetId: string, targetType: 'space' | 'zone' | 'equipment', comment: any) {
    pushHistory();
    if (targetType === 'space') {
      const nextSpaces = currentWorkspaceState.spaces.map(s => {
        if (s.id === targetId) {
          const comments = [...(s.comments || []), comment];
          return { ...s, comments };
        }
        return s;
      });
      currentWorkspaceState = { ...currentWorkspaceState, spaces: nextSpaces };
    } else if (targetType === 'zone') {
      const nextZones = currentWorkspaceState.zones.map(z => {
        if (z.id === targetId) {
          const comments = [...(z.comments || []), comment];
          return { ...z, comments };
        }
        return z;
      });
      currentWorkspaceState = { ...currentWorkspaceState, zones: nextZones };
    } else if (targetType === 'equipment') {
      const nextEquip = currentWorkspaceState.equipment.map(e => {
        if (e.id === targetId) {
          const comments = [...(e.comments || []), comment];
          return { ...e, comments };
        }
        return e;
      });
      currentWorkspaceState = { ...currentWorkspaceState, equipment: nextEquip };
    }
    saveState();
    logCalculatorUpdate('Ventilation', `Added comment to ${targetType}`);
    notify();
  },

  removeCommentFromTarget(targetId: string, targetType: 'space' | 'zone' | 'equipment', commentId: string) {
    pushHistory();
    if (targetType === 'space') {
      const nextSpaces = currentWorkspaceState.spaces.map(s => {
        if (s.id === targetId) {
          const comments = (s.comments || []).filter(c => c.id !== commentId);
          return { ...s, comments };
        }
        return s;
      });
      currentWorkspaceState = { ...currentWorkspaceState, spaces: nextSpaces };
    } else if (targetType === 'zone') {
      const nextZones = currentWorkspaceState.zones.map(z => {
        if (z.id === targetId) {
          const comments = (z.comments || []).filter(c => c.id !== commentId);
          return { ...z, comments };
        }
        return z;
      });
      currentWorkspaceState = { ...currentWorkspaceState, zones: nextZones };
    } else if (targetType === 'equipment') {
      const nextEquip = currentWorkspaceState.equipment.map(e => {
        if (e.id === targetId) {
          const comments = (e.comments || []).filter(c => c.id !== commentId);
          return { ...e, comments };
        }
        return e;
      });
      currentWorkspaceState = { ...currentWorkspaceState, equipment: nextEquip };
    }
    saveState();
    logCalculatorUpdate('Ventilation', `Removed comment from ${targetType}`);
    notify();
  },

  addSpace(newSpace: Space) {
    pushHistory();
    const nextSpace = { ...newSpace };
    if (!nextSpace.category && nextSpace.name) {
      const nameVal = nextSpace.name.trim();
      const pred = predictOccupancyCategory(nameVal);
      let predCategory = "";

      if (pred && pred.category) {
        nextSpace.category = pred.category;
        nextSpace.aiDetected = true;
        predCategory = pred.category;

        const data = getOccupancyData(pred.category);
        if (data) {
          const density = data.defaultDensity || 0;
          const hasFixtures = nextSpace.fixtures !== "" && nextSpace.fixtures !== undefined;
          nextSpace.occupancy = hasFixtures ? parseFloat(String(nextSpace.fixtures)) || 0 : Math.ceil((nextSpace.area * density) / 100);
          nextSpace.isOccupancyCustomized = false;
          if (data.exhaustPerUnit > 0) {
            nextSpace.fixtures = nextSpace.occupancy.toString();
          } else if (!hasFixtures) {
            nextSpace.fixtures = "";
          }
        }
      }

      const predPress = predictSpacePressure(predCategory);
      if (predPress && predPress.autoDetected) {
        nextSpace.pressure = predPress.pressure;
        nextSpace.pressureAutoDetected = true;
      }
    }
    if (checkIfSpaceMissingData(nextSpace)) {
      nextSpace.flagged = true;
    }
    const nextSpaces = [...currentWorkspaceState.spaces, nextSpace];
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
            multiplier: 1,
            faAssignedQty: 1,
            eaAssignedQty: 1,
          });
          existingZoneNames.add(zoneLower);
        }
      }
    });

    const processedSpaces = newSpaces.map(s => {
      const isMissing = checkIfSpaceMissingData(s);
      return isMissing ? { ...s, flagged: true } : s;
    });

    const nextZones = [...currentWorkspaceState.zones, ...zonesToAdd];
    const nextSpaces = [...currentWorkspaceState.spaces, ...processedSpaces];

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
    
    // Find the names/ids of the zones assigned to the spaces we are deleting
    const spacesToDelete = currentWorkspaceState.spaces.filter((s) => idsToDelete.includes(s.id));
    const zonesToCheck = new Set<string>();
    spacesToDelete.forEach((s) => {
      if (s.zone) {
        zonesToCheck.add(s.zone.toLowerCase());
      }
    });

    const nextSpaces = currentWorkspaceState.spaces.filter((s) => !idsToDelete.includes(s.id));

    // Filter zones: if a zone was assigned to deleted spaces, and has no remaining spaces left, delete it too
    const nextZones = currentWorkspaceState.zones.filter((g) => {
      const isDefault = g.name.toLowerCase() === "default" || g.name.toLowerCase() === "unzoned";
      if (isDefault) return true;

      const wasAssigned = zonesToCheck.has(g.id.toLowerCase()) || zonesToCheck.has(g.name.toLowerCase());
      if (!wasAssigned) return true; // Keep it if it wasn't affected

      const hasSpaces = nextSpaces.some(
        (s) => s.zone && (s.zone.toLowerCase() === g.id.toLowerCase() || s.zone.toLowerCase() === g.name.toLowerCase())
      );
      return hasSpaces; // Keep it only if it still has spaces
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

  bulkUpdateSpaces(ids: string[], updates: Partial<Space>) {
    pushHistory();
    const nextSpaces = currentWorkspaceState.spaces.map((s) => {
      if (ids.includes(s.id)) {
        const next = { ...s, ...updates };

        // Sanitize zone to ensure we store human-readable zone name, never raw zoneId
        if (updates.zone !== undefined && updates.zone !== "") {
          const matchingZone = currentWorkspaceState.zones.find(
            (z) => z.id === updates.zone || z.name === updates.zone
          );
          if (matchingZone) {
            next.zone = matchingZone.name;
          }
        }

        // If the name is being updated, perform automatic classification!
        if (updates.name !== undefined) {
          const nameVal = updates.name.trim();
          
          if (!s.category || s.aiDetected) {
            const pred = predictOccupancyCategory(nameVal);

            if (pred && pred.category) {
              next.category = pred.category;
              next.aiDetected = true;

              const data = getOccupancyData(pred.category);
              if (data) {
                const density = data.defaultDensity || 0;
                const hasFixtures = next.fixtures !== "" && next.fixtures !== undefined;
                if (!s.isOccupancyCustomized) {
                  next.occupancy = hasFixtures ? parseFloat(String(next.fixtures)) || 0 : Math.ceil((next.area * density) / 100);
                  next.isOccupancyCustomized = false;
                }
                if (data.exhaustPerUnit > 0) {
                  next.fixtures = next.occupancy.toString();
                } else if (!hasFixtures) {
                  next.fixtures = "";
                }
              }
            } else if (s.aiDetected) {
              // Clear auto-detected category if the name is now unrecognized
              next.category = "";
              next.aiDetected = false;
            }
          }

          const predPress = predictSpacePressure(next.category);
          if (predPress && predPress.autoDetected) {
            next.pressure = predPress.pressure;
            next.pressureAutoDetected = true;
          } else if (s.pressureAutoDetected) {
            // Reset to default (Positive) if the name is now unrecognized
            next.pressure = "Positive";
            next.pressureAutoDetected = false;
          }
        }

        // If category is explicitly being updated (and name is not), predict pressure based on category
        if (updates.category !== undefined && updates.name === undefined) {
          const predPress = predictSpacePressure(updates.category);
          if (predPress && predPress.autoDetected) {
            next.pressure = predPress.pressure;
            next.pressureAutoDetected = true;
          }
        }

        // If area or category changes and occupancy is not customized, recalculate default occupancy
        if ((updates.area !== undefined || updates.category !== undefined) && !next.isOccupancyCustomized) {
          const cat = next.category;
          if (cat && !cat.endsWith(" (Custom)") && cat !== "OTHER") {
            const data = getOccupancyData(cat);
            if (data) {
              const density = data.defaultDensity || 0;
              const hasFixtures = next.fixtures !== "" && next.fixtures !== undefined;
              next.occupancy = hasFixtures ? parseFloat(String(next.fixtures)) || 0 : Math.ceil((next.area * density) / 100);
              next.isOccupancyCustomized = false;
            }
          }
        }

        const isMissingVal = checkIfSpaceMissingData(next);
        if (isMissingVal) {
          next.flagged = true;
        } else if (updates.area !== undefined || updates.category !== undefined) {
          next.flagged = false;
        }

        return next;
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
        multiplier: 1,
        faAssignedQty: 1,
        eaAssignedQty: 1,
      };
      nextZones.push(newZone);

      const spaceIds = p.spaces.map((s) => s.id);
      nextSpaces.forEach((s, idx) => {
        if (spaceIds.includes(s.id)) {
          nextSpaces[idx] = { ...s, zone: newZone.name };
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

  assignZoneToEquipment(zoneId: string, equipId: string, stream: "FA" | "EA", quantity?: number) {
    pushHistory();
    const nextZones = currentWorkspaceState.zones.map((g) => {
      if (g.id === zoneId) {
        const qty = quantity ?? 1;

        if (stream === "FA") {
          const currentFA = { ...(g.faAssignments || {}) };
          currentFA[equipId] = qty;
          
          if (qty <= 0) {
            delete currentFA[equipId];
          }

          const keys = Object.keys(currentFA);
          const firstKey = keys[0] || null;

          return {
            ...g,
            faAssignments: currentFA,
            faAssignment: firstKey,
            faAssignedQty: firstKey ? currentFA[firstKey] : 1,
          };
        } else {
          const currentEA = { ...(g.eaAssignments || {}) };
          currentEA[equipId] = qty;

          if (qty <= 0) {
            delete currentEA[equipId];
          }

          const keys = Object.keys(currentEA);
          const firstKey = keys[0] || null;

          return {
            ...g,
            eaAssignments: currentEA,
            eaAssignment: firstKey,
            eaAssignedQty: firstKey ? currentEA[firstKey] : 1,
          };
        }
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
        if (stream === "FA") {
          const currentFA = { ...(g.faAssignments || {}) };
          delete currentFA[equipId];

          const keys = Object.keys(currentFA);
          const firstKey = keys[0] || null;

          return {
            ...g,
            faAssignments: currentFA,
            faAssignment: firstKey,
            faAssignedQty: firstKey ? currentFA[firstKey] : 1,
          };
        } else {
          const currentEA = { ...(g.eaAssignments || {}) };
          delete currentEA[equipId];

          const keys = Object.keys(currentEA);
          const firstKey = keys[0] || null;

          return {
            ...g,
            eaAssignments: currentEA,
            eaAssignment: firstKey,
            eaAssignedQty: firstKey ? currentEA[firstKey] : 1,
          };
        }
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

  // Instance-based allocation — each multiplier slot is one independent instance
  updateZoneInstances(zoneId: string, instances: ZoneInstanceAssignment[]) {
    pushHistory();
    const nextZones = currentWorkspaceState.zones.map((g) => {
      if (g.id !== zoneId) return g;

      // Derive backward-compat dicts: count instances served per equipment
      const faMap: Record<string, number> = {};
      const eaMap: Record<string, number> = {};
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
        eaAssignedQty: firstEA ? eaMap[firstEA] : 1,
      };
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
    const nextZones = currentWorkspaceState.zones.map((g) => {
      const currentFA = { ...(g.faAssignments || {}) };
      delete currentFA[equipId];
      const faKeys = Object.keys(currentFA);
      const firstFA = faKeys[0] || null;

      const currentEA = { ...(g.eaAssignments || {}) };
      delete currentEA[equipId];
      const eaKeys = Object.keys(currentEA);
      const firstEA = eaKeys[0] || null;

      return {
        ...g,
        faAssignments: currentFA,
        faAssignment: firstFA,
        faAssignedQty: firstFA ? currentFA[firstFA] : 1,
        eaAssignments: currentEA,
        eaAssignment: firstEA,
        eaAssignedQty: firstEA ? currentEA[firstEA] : 1,
      };
    });

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

  getRoundOffPreset() {
    return currentWorkspaceState.roundOffPreset ?? 5;
  },

  setRoundOffPreset(value: number) {
    pushHistory();
    setGlobalRoundOffPreset(value);
    currentWorkspaceState.roundOffPreset = value;
    
    // Recalculate based on new rounding preset
    const balanced = calculateVentilation(
      currentWorkspaceState.spaces,
      currentWorkspaceState.zones,
      currentWorkspaceState.equipment
    );
    currentWorkspaceState = {
      ...balanced,
      roundOffPreset: value,
    };
    saveState();
    notify();
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
    isInitializing: state.isInitializing,
    spaces: state.spaces,
    zones: state.zones,
    equipment: state.equipment,
    selectProject: (id: string) => workspaceStore.selectProject(id),
    createNewProject: (project: Omit<Project, "id">) => workspaceStore.createNewProject(project),
    duplicateProject: (id: string) => workspaceStore.duplicateProject(id),
    deleteProject: (id: string) => workspaceStore.deleteProject(id),
    forceSaveToCloud: () => workspaceStore.forceSaveToCloud(),
    syncFromCloud: () => workspaceStore.syncFromCloud(),
    refreshProjects: () => workspaceStore.refreshProjects(),
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
    assignZoneToEquipment: (zoneId: string, equipId: string, stream: "FA" | "EA", quantity?: number) => workspaceStore.assignZoneToEquipment(zoneId, equipId, stream, quantity),
    removeZoneFromEquipment: (zoneId: string, equipId: string, stream: "FA" | "EA") => workspaceStore.removeZoneFromEquipment(zoneId, equipId, stream),
    updateZoneInstances: (zoneId: string, instances: ZoneInstanceAssignment[]) => workspaceStore.updateZoneInstances(zoneId, instances),
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
    roundOffPreset: state.roundOffPreset,
    setRoundOffPreset: (val: number) => workspaceStore.setRoundOffPreset(val),
    isReadOnly: state.isReadOnly,
    setReadOnly: (val: boolean) => workspaceStore.setReadOnly(val),
    saveAsRevision: (name: string) => workspaceStore.saveAsRevision(name),
    addCommentToTarget: (targetId: string, targetType: 'space' | 'zone' | 'equipment', comment: any) => workspaceStore.addCommentToTarget(targetId, targetType, comment),
    removeCommentFromTarget: (targetId: string, targetType: 'space' | 'zone' | 'equipment', commentId: string) => workspaceStore.removeCommentFromTarget(targetId, targetType, commentId),
  };
}

export const workspace = currentWorkspaceState;