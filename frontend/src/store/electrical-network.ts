import { create } from 'zustand';

export const POINT_TYPES = [
  { id: "ltg", name: "LTG", defaultW: 100 },
  { id: "ch", name: "CH.", defaultW: 1500 },
  { id: "callbell", name: "CALL BELL", defaultW: 50 },
  { id: "exhood", name: "EX Hood", defaultW: 150 },
  { id: "s13a", name: "13A S/O", defaultW: 200 },
  { id: "s13at", name: "13A T S/O", defaultW: 400 },
  { id: "wh", name: "W/H", defaultW: 1500 },
  { id: "s15a", name: "15A S/O", defaultW: 1000 },
  { id: "f13a", name: "13A FLEX O/L", defaultW: 500 },
  { id: "sp13a", name: "13A SP O/L", defaultW: 100 },
  { id: "dp20a", name: "20A Outlet + DP SWITCH", defaultW: 2000 },
  { id: "fcu", name: "FCU", defaultW: 800 },
  { id: "hd", name: "H/D", defaultW: 150 },
  { id: "isol", name: "ISOL", defaultW: 1000 },
  { id: "other", name: "OTHER", defaultW: 0 },
];

export interface Incomer {
  rating: string;
  sptp: string;
  faultKa: string;
  cableSize: string;
  eccSize: string;
  inc1: string;
  inc2: string;
  meterType: string;
}

export interface DBCircuit {
  id: string;
  elcbGroup: string;
  slNo: number;
  cirNo: string;
  mcb: string;
  wireEcc: string;
  roomArea: string;
  points: Record<string, number>;
  wPerUnit: number | "";
  customW: number | "";
  phase: string;
  remarks: string;
}

export interface MDBCircuit {
  id: string;
  cirNo: string | number;
  desc: string;
  qty: number;
  loadW: number;
  phase: string;
  df: number;
  mcb: string;
  faultKa: string;
  wire: string;
  type: string;
  ecc: string;
  len: string;
  ph1Mtr: string;
  ph3Mtr: string;
  ctMtr: string;
  remarks: string;
}

export interface Board {
  id: string;
  name: string;
  type: "MDB" | "SMDB" | "DB" | "EDB" | "EMDB" | "ESMDB" | "MCC" | "UPS";
  phaseType: string;
  fedFrom: string;
  incomer: Incomer;
  circuits: any[]; // DBCircuit | MDBCircuit
}

export function createDefaultBoard(id: string, name: string): Board {
  return {
    id,
    name,
    type: "DB",
    phaseType: "3-Phase",
    fedFrom: "DEWA/GRID",
    incomer: {
      rating: "100A",
      sptp: "4P",
      faultKa: "10",
      cableSize: "16",
      eccSize: "16",
      inc1: "1600A",
      inc2: "1600A",
      meterType: "None"
    },
    circuits: []
  };
}

export function generateDefaultDBCircuit(id: string, index: number): DBCircuit {
  return {
    id,
    elcbGroup: "G1",
    slNo: index + 1,
    cirNo: `L${index + 1}`,
    mcb: "10",
    wireEcc: "2.5",
    roomArea: "New Area",
    points: {},
    wPerUnit: "",
    customW: "",
    phase: "R Phase",
    remarks: ""
  };
}

export function generateDefaultMDBCircuit(id: string, index: number): MDBCircuit {
  return {
    id,
    cirNo: index + 1,
    desc: "New Area",
    qty: 1,
    loadW: 0,
    phase: "R Phase",
    df: 1,
    mcb: "10",
    faultKa: "10",
    wire: "2.5",
    type: "XLPE/SWA/PVC",
    ecc: "2.5",
    len: "",
    ph1Mtr: "",
    ph3Mtr: "",
    ctMtr: "",
    remarks: ""
  };
}

interface ElectricalNetworkState {
  boards: Board[];
  addBoard: (board: Board) => void;
  updateBoard: (id: string, updates: Partial<Board>) => void;
  deleteBoard: (id: string) => void;
  updateIncomer: (boardId: string, field: string, val: string) => void;
  updateCircuit: (boardId: string, cid: string, field: string, val: any) => void;
  addCircuit: (boardId: string) => void;
  deleteCircuit: (boardId: string, cid: string) => void;
  recalculateNetwork: () => void;
  setBoards: (boards: Board[]) => void;
}

export function calculateCircuitLoad(c: any) {
  let totalW = 0;
  Object.keys(c.points || {}).forEach(pid => {
    const pType = POINT_TYPES.find(p => p.id === pid);
    if (pType) totalW += (c.points[pid] || 0) * pType.defaultW;
  });
  return totalW + (Number(c.customW) || 0);
}

export const useElectricalNetworkStore = create<ElectricalNetworkState>((set, get) => {
  let initialBoards = [createDefaultBoard("board-1", "New Board 1")];
  try {
    const saved = localStorage.getItem("mep-load-schedule-boards-v2");
    if (saved) {
      initialBoards = JSON.parse(saved);
    }
  } catch (e) {}

  return {
    boards: initialBoards,

    setBoards: (boards) => set(() => {
      localStorage.setItem("mep-load-schedule-boards-v2", JSON.stringify(boards));
      // Schedule a recalculate to update all upstream values
      setTimeout(() => get().recalculateNetwork(), 0);
      return { boards };
    }),

    addBoard: (board) => set((state) => {
      const next = [...state.boards, board];
      localStorage.setItem("mep-load-schedule-boards-v2", JSON.stringify(next));
      setTimeout(() => get().recalculateNetwork(), 0);
      return { boards: next };
    }),

    updateBoard: (id, updates) => set((state) => {
      const next = state.boards.map(b => b.id === id ? { ...b, ...updates } : b);
      localStorage.setItem("mep-load-schedule-boards-v2", JSON.stringify(next));
      setTimeout(() => get().recalculateNetwork(), 0);
      return { boards: next };
    }),

    deleteBoard: (id) => set((state) => {
      const next = state.boards.filter(b => b.id !== id);
      localStorage.setItem("mep-load-schedule-boards-v2", JSON.stringify(next));
      setTimeout(() => get().recalculateNetwork(), 0);
      return { boards: next };
    }),

    updateIncomer: (boardId, field, val) => set((state) => {
      const next = state.boards.map(b => 
        b.id === boardId ? { ...b, incomer: { ...b.incomer, [field]: val } } : b
      );
      localStorage.setItem("mep-load-schedule-boards-v2", JSON.stringify(next));
      setTimeout(() => get().recalculateNetwork(), 0);
      return { boards: next };
    }),

    updateCircuit: (boardId, cid, field, val) => set((state) => {
      const next = state.boards.map(b => {
        if (b.id !== boardId) return b;
        return {
          ...b,
          circuits: b.circuits.map(c => c.id === cid ? { ...c, [field]: val } : c)
        };
      });
      localStorage.setItem("mep-load-schedule-boards-v2", JSON.stringify(next));
      setTimeout(() => get().recalculateNetwork(), 0);
      return { boards: next };
    }),

    addCircuit: (boardId) => set((state) => {
      const next = state.boards.map(b => {
        if (b.id !== boardId) return b;
        const isDB = b.type === "DB" || b.type === "EDB";
        const newCirc = isDB 
          ? generateDefaultDBCircuit(`c-${Date.now()}`, b.circuits.length)
          : generateDefaultMDBCircuit(`c-${Date.now()}`, b.circuits.length);
        return { ...b, circuits: [...b.circuits, newCirc] };
      });
      localStorage.setItem("mep-load-schedule-boards-v2", JSON.stringify(next));
      setTimeout(() => get().recalculateNetwork(), 0);
      return { boards: next };
    }),

    deleteCircuit: (boardId, cid) => set((state) => {
      const next = state.boards.map(b => {
        if (b.id !== boardId) return b;
        return { ...b, circuits: b.circuits.filter(c => c.id !== cid) };
      });
      localStorage.setItem("mep-load-schedule-boards-v2", JSON.stringify(next));
      setTimeout(() => get().recalculateNetwork(), 0);
      return { boards: next };
    }),

    recalculateNetwork: () => set((state) => {
      // Create a deep copy to allow mutation during calculation
      let boards = JSON.parse(JSON.stringify(state.boards));
      
      const levels: Record<string, number> = {};
      const getLevel = (id: string, visited = new Set<string>()): number => {
        if (visited.has(id)) return 0;
        visited.add(id);
        const b = boards.find((br: any) => br.id === id);
        if (!b || b.fedFrom === "DEWA/GRID" || b.fedFrom === "GEN" || b.fedFrom === "") return 0;
        if (levels[id] !== undefined) return levels[id];
        levels[id] = 1 + getLevel(b.fedFrom, visited);
        return levels[id];
      };
      
      boards.forEach((b: any) => getLevel(b.id));
      const sortedBoards = [...boards].sort((a, b) => (levels[b.id] || 0) - (levels[a.id] || 0));
      
      // Bubble up loads
      sortedBoards.forEach(parent => {
        if (parent.type === "DB" || parent.type === "EDB") return;
        
        const children = boards.filter((b: any) => b.fedFrom === parent.id);
        
        // Remove old child references that are no longer children
        parent.circuits = parent.circuits.filter((c: any) => {
            const isBoardFeeder = c.isFeeder || (c.desc && (c.desc.startsWith("New Board") || c.desc.startsWith("DB-") || c.desc.startsWith("SMDB-") || c.desc.startsWith("MDB-") || boards.some((ab: any) => ab.name === c.desc)));
            if (!isBoardFeeder) return true; // keep non-child circuits
            const stillExists = children.some((ch: any) => (c.fedBoardId && c.fedBoardId === ch.id) || c.desc === ch.name || c.desc === `DB-${ch.id}`);
            return stillExists;
        });

        if (children.length === 0) return;
        
        children.forEach((child: any) => {
          let childLoad = 0;
          let rLoad = 0; let yLoad = 0; let bLoad = 0;
          child.circuits.forEach((c: any) => {
            const load = (child.type === "DB" || child.type === "EDB") 
              ? calculateCircuitLoad(c)
              : ((Number(c.qty) || 1) * (Number(c.loadW) || 0) * (Number(c.df) || 1));
            childLoad += load;
            
            const isR = c.phase?.includes("R");
            const isY = c.phase?.includes("Y");
            const isB = c.phase?.includes("B");
            if (isR) rLoad += load;
            if (isY) yLoad += load;
            if (isB) bLoad += load;
            if (c.phase?.includes("3-Phase") || !c.phase) {
               rLoad += load/3; yLoad += load/3; bLoad += load/3;
            }
          });
          
          let pCirc = parent.circuits.find((c: any) => (c.fedBoardId && c.fedBoardId === child.id) || c.desc === child.name || c.desc === `DB-${child.id}`);
          if (pCirc) {
            pCirc.isFeeder = true;
            pCirc.fedBoardId = child.id;
            pCirc.desc = child.name; // Keep name in sync
            pCirc.loadW = childLoad;
            pCirc.phase = child.phaseType === "3-Phase" ? "3-Phase" : "R Phase"; 
            pCirc.rKw = rLoad;
            pCirc.yKw = yLoad;
            pCirc.bKw = bLoad;
          } else {
            pCirc = generateDefaultMDBCircuit(`c-${Date.now()}-${child.id}`, parent.circuits.length);
            pCirc.desc = child.name;
            pCirc.isFeeder = true;
            pCirc.fedBoardId = child.id;
            pCirc.loadW = childLoad;
            pCirc.phase = child.phaseType === "3-Phase" ? "3-Phase" : "R Phase";
            pCirc.rKw = rLoad;
            pCirc.yKw = yLoad;
            pCirc.bKw = bLoad;
            parent.circuits.push(pCirc);
          }
        });
      });
      
      localStorage.setItem("mep-load-schedule-boards-v2", JSON.stringify(boards));
      return { boards };
    })
  };
});
