import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";
import { useElectricalNetworkStore } from "@/store/electrical-network";

import { AppShell } from "@/components/workspace/AppShell";
import { NetworkSLD } from "@/components/workspace/NetworkSLD";
import { Plus, Trash2, Network, Table as TableIcon, Copy, Zap, Download, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/hooks/use-confirm";

export const Route = createFileRoute("/project-load-schedule")({
  head: () => ({
    meta: [
      { title: "Project Load Schedule — MEP Calc" },
      { name: "description", content: "Hierarchical MEP Load Distribution Manager." },
    ],
  }),
  component: ProjectLoadSchedulePage,
});

// --- Constants & Types ---
const POINT_TYPES = [
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

function createDefaultBoard(id: string, name: string) {
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

function generateDefaultDBCircuit(id: string, index: number) {
  const phases = ["R", "Y", "B"];
  const phaseStr = phases[index % 3];
  const seq = Math.floor(index / 3) + 1;
  const cirNo = `${phaseStr}${seq}`;
  const fullPhase = `${phaseStr} Phase`;

  return {
    id,
    elcbGroup: "G1",
    slNo: index + 1,
    cirNo: cirNo,
    mcb: "10",
    wireEcc: "2.5",
    roomArea: "New Area",
    points: {}, // pointId -> qty
    wPerUnit: "",
    customW: "",
    phase: fullPhase,
    remarks: ""
  };
}

function generateDefaultMDBCircuit(id: string, index: number) {
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

// --- Main Component ---
function ProjectLoadSchedulePage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();
  const [view, setView] = useState<"schedule" | "sld">("schedule");
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const boards = useElectricalNetworkStore(state => state.boards);
  const setBoards = useElectricalNetworkStore(state => state.setBoards);
  const recalculateNetwork = useElectricalNetworkStore(state => state.recalculateNetwork);
  const updateBoardGlobal = useElectricalNetworkStore(state => state.updateBoard);
  const addBoard = useElectricalNetworkStore(state => state.addBoard);
  const deleteBoard = useElectricalNetworkStore(state => state.deleteBoard);

  const [activeBoardId, setActiveBoardId] = useState<string>("board-1");
  const [isCompactView, setIsCompactView] = useState(false);

  const activeBoard = boards.find(b => b.id === activeBoardId);
  const isDB = activeBoard?.type === "DB" || activeBoard?.type === "EDB";

  const updateBoard = (updates: any) => {
    setBoards(boards.map(b => b.id === activeBoardId ? { ...b, ...updates } : b));
  };
  const updateIncomer = (field: string, val: string) => {
    updateBoard({ incomer: { ...activeBoard.incomer, [field]: val } });
  };
  const updateCircuit = (cid: string, field: string, val: any) => {
    updateBoard({ circuits: activeBoard.circuits.map((c: any) => c.id === cid ? { ...c, [field]: val } : c) });
  };
  const updatePoint = (cid: string, pid: string, qty: string) => {
    updateBoard({
      circuits: activeBoard.circuits.map((c: any) => {
        if (c.id !== cid) return c;
        const newPoints = { ...c.points };
        if (!qty) delete newPoints[pid];
        else newPoints[pid] = parseInt(qty) || 0;
        return { ...c, points: newPoints };
      })
    });
  };

  const addCircuit = () => {
    const newCirc = isDB 
      ? generateDefaultDBCircuit(`c-${Date.now()}`, activeBoard.circuits.length)
      : generateDefaultMDBCircuit(`c-${Date.now()}`, activeBoard.circuits.length);
    updateBoard({ circuits: [...activeBoard.circuits, newCirc] });
    
  const duplicateCircuit = (circuitToClone: any) => {
    const isDB = activeBoard.type === "DB";
    const newIdx = activeBoard.circuits.length;
    
    // Generate fresh structural properties (id, index, cirNo, phase)
    const freshCirc = isDB 
      ? generateDefaultDBCircuit(`c-${Date.now()}`, newIdx)
      : generateDefaultMDBCircuit(`c-${Date.now()}`, newIdx);
      
    // Overwrite the cloned data onto the fresh circuit
    const clonedCirc = {
      ...freshCirc,
      // copy user fields
      mcb: circuitToClone.mcb,
      wireEcc: circuitToClone.wireEcc,
      roomArea: circuitToClone.roomArea,
      points: { ...circuitToClone.points },
      wPerUnit: circuitToClone.wPerUnit,
      customW: circuitToClone.customW,
      remarks: circuitToClone.remarks,
      
      // SMDB specific fields
      desc: circuitToClone.desc,
      kw: circuitToClone.kw,
      df: circuitToClone.df,
      loadW: circuitToClone.loadW,
      way: circuitToClone.way,
      spTp: circuitToClone.spTp,
      type: circuitToClone.type,
      ecc: circuitToClone.ecc,
      len: circuitToClone.len,
      ph1Mtr: circuitToClone.ph1Mtr,
      ph3Mtr: circuitToClone.ph3Mtr,
      ctMtr: circuitToClone.ctMtr,
    };
    
    updateBoard({ circuits: [...activeBoard.circuits, clonedCirc] });
    
    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTo({
          top: tableContainerRef.current.scrollHeight,
          behavior: "smooth"
        });
      }
    }, 50);
  };

  // Auto-scroll to bottom after rendering
    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTo({
          top: tableContainerRef.current.scrollHeight,
          behavior: "smooth"
        });
      }
    }, 50);
  };

  const copyDown = async (field: string, value: any) => {
    if (!await confirm(`Copy this value down to all circuits?`)) return;
    updateBoard({ circuits: activeBoard.circuits.map((c: any) => ({ ...c, [field]: value })) });
  };

  // Calculations
  const calculateCircuitLoad = (c: any) => {
    if (activeBoard?.type === "DB" || activeBoard?.type === "EDB") {
      let totalW = 0;
      Object.keys(c.points || {}).forEach(pid => {
        const pType = POINT_TYPES.find(p => p.id === pid);
        if (pType) totalW += (c.points[pid] || 0) * pType.defaultW;
      });
      return totalW + (Number(c.customW) || 0);
    } else {
      return (Number(c.qty) || 1) * (Number(c.loadW) || 0);
    }
  };

  const autoSizeAndGroup = () => {
    if (!isDB) return alert("Auto-Size & Group is only available for DB/EDB boards.");
    
    // 1. Auto-size existing circuits and classify
    let totalBoardLoad = 0;
    
    // Define point categories for sensitivities
    const lightingTypes = ['ltg', 'ch', 'callbell'];
    const mechTypes = ['exhood', 'fcu', 'hd', 'isol', 'wh', 'other'];
    
    const sizedCircuits = activeBoard.circuits.map((c: any) => {
      const load = calculateCircuitLoad(c);
      totalBoardLoad += load;
      
      const current = load / 230; // 230V single phase
      
      let mcb = "10";
      let wire = "2.5";
      
      if (load > 0) {
        if (current <= 10) { mcb = "10"; wire = "2.5"; }
        else if (current <= 16) { mcb = "16"; wire = "2.5"; }
        else if (current <= 20) { mcb = "20"; wire = "4.0"; }
        else if (current <= 32) { mcb = "32"; wire = "6.0"; }
        else { mcb = "40"; wire = "10.0"; }
      } else if (c.mcb) {
        mcb = c.mcb;
        wire = c.wireEcc || "2.5";
      }
      
      return { ...c, mcb, wireEcc: wire };
    });
    
    // 2. Classify circuits
    let lightingCircuits: any[] = []; // 100mA
    let powerCircuits: any[] = []; // 30mA
    let mechCircuits: any[] = []; // 100mA
    let spareCircuits: any[] = []; // Remaining Spares
    
    for (const c of sizedCircuits) {
      if (c.isSpare || calculateCircuitLoad(c) === 0) {
        spareCircuits.push(c);
        continue;
      }
      
      let hasLighting = false;
      let hasMech = false;
      let hasPower = false;
      
      if (c.points) {
        for (const pid of Object.keys(c.points)) {
          if ((c.points[pid] || 0) > 0) {
            if (lightingTypes.includes(pid)) {
              hasLighting = true;
            } else if (mechTypes.includes(pid)) {
              hasMech = true;
            } else {
              hasPower = true;
            }
          }
        }
      }
      
      if (c.customW && c.customW > 0) hasPower = true;
      
      if (hasPower) {
        powerCircuits.push(c);
      } else if (hasLighting) {
        lightingCircuits.push(c);
      } else if (hasMech) {
        mechCircuits.push(c);
      } else {
        powerCircuits.push(c); // fallback
      }
    }
    
    let newCircuits: any[] = [];
    let groupIndex = 1;
    
    // Calculate Incomer Base Rating string for ELCB Prefix
    const totalKW = totalBoardLoad / 1000;
    let iRatingStr = "40A";
    if (totalKW > 50) iRatingStr = "125A";
    else if (totalKW > 30) iRatingStr = "100A";
    else if (totalKW > 15) iRatingStr = "63A";
    
    const baseAmps = parseInt(iRatingStr.match(/\d+/)?.[0] || "40", 10);
    
    // 3. Process clusters
    const processCluster = (circuits: any[], sensitivity: number, isSparePass = false) => {
      let index = 0;
      while (index < circuits.length) {
        const remaining = circuits.length - index;
        let take = 0;
        let pad = 0;
        
        // Exact grouping rule to match 3-phase busbar (multiples of 3)
        if (remaining >= 6) { take = 6; pad = 0; }
        else if (remaining === 5) { take = 5; pad = 1; }
        else if (remaining === 4) { take = 4; pad = 2; }
        else if (remaining === 3) { take = 3; pad = 0; }
        else if (remaining === 2) { take = 2; pad = 1; }
        else if (remaining === 1) { take = 1; pad = 2; }
        
        const elcbGroup = `${baseAmps}A\n${sensitivity}mA 4P\nELCB - ${groupIndex}`;
        
        for (let i = 0; i < take; i++) {
          newCircuits.push({ ...circuits[index + i], elcbGroup });
        }
        
        for (let i = 0; i < pad; i++) {
          // If we are already processing the spares themselves, any padding must be a BRAND NEW spare,
          // otherwise we would steal from the unprocessed spares ahead of us!
          let spare = (!isSparePass && spareCircuits.length > 0) ? spareCircuits.shift() : {
            id: `spare-${Date.now()}-${groupIndex}-${i}`,
            mcb: "10",
            wireEcc: "2.5",
            roomArea: "Spare",
            points: {},
            customW: 0,
            isSpare: true
          };
          newCircuits.push({ ...spare, elcbGroup });
        }
        
        index += take;
        groupIndex++;
      }
    };
    
    // 1st: All Lighting ELCB's (100mA)
    processCluster(lightingCircuits, 100, false);
    
    // 2nd: Power ELCB's (30mA)
    processCluster(powerCircuits, 30, false);
    
    // Any remaining spares get padded into 30mA chunks (Power ELCBs) BEFORE mechanical
    if (spareCircuits.length > 0) {
      processCluster([...spareCircuits], 30, true);
      spareCircuits.length = 0; // Clear them so they aren't reused!
    }

    // 3rd: Mechanical / Others (100mA) AT THE VERY END
    processCluster(mechCircuits, 100, false);
    
    // 4. Sequence slNo, cirNo, phase correctly
    const phases = ["R", "Y", "B"];
    newCircuits = newCircuits.map((c, idx) => {
      const slNo = idx + 1;
      const phaseStr = phases[idx % 3];
      const seq = Math.floor(idx / 3) + 1;
      const cirNo = activeBoard.phaseType === "3-Phase" ? `${phaseStr}${seq}` : `L${idx + 1}`;
      const fullPhase = activeBoard.phaseType === "3-Phase" ? `${phaseStr} Phase` : "1-Phase";
      return { ...c, slNo, cirNo, phase: fullPhase };
    });
    
    updateBoard({ 
      circuits: newCircuits,
      incomer: { ...activeBoard.incomer, rating: iRatingStr }
    });
  };

  const balanceBoardPhases = (board: any) => {
    if (board.phaseType !== "3-Phase") return board;
    const circuits = [...board.circuits];
    
    const calcLoad = (c: any) => {
      if (board.type === "DB" || board.type === "EDB") {
        let totalW = 0;
        Object.keys(c.points || {}).forEach(pid => {
          const pType = POINT_TYPES.find(p => p.id === pid);
          if (pType) totalW += (c.points[pid] || 0) * pType.defaultW;
        });
        return totalW + (Number(c.customW) || 0);
      } else {
        return (Number(c.qty) || 1) * (Number(c.loadW) || 0);
      }
    };
    
    circuits.sort((a, b) => calcLoad(b) - calcLoad(a));
    const phaseLoads = { "R Phase": 0, "Y Phase": 0, "B Phase": 0 };
    
    const newCircuits = circuits.map(c => {
      let minPhase = "R Phase";
      if (phaseLoads["Y Phase"] < phaseLoads[minPhase]) minPhase = "Y Phase";
      if (phaseLoads["B Phase"] < phaseLoads[minPhase]) minPhase = "B Phase";
      c.phase = minPhase;
      phaseLoads[minPhase] += calcLoad(c);
      return c;
    });
    
    const finalCircuits = board.circuits.map((original: any) => 
      newCircuits.find(c => c.id === original.id)
    );
    
    return { ...board, circuits: finalCircuits };
  };

  const autoBalancePhases = () => {
    if (activeBoard.phaseType !== "3-Phase") return alert("Board must be 3-Phase to balance.");
    updateBoard(balanceBoardPhases(activeBoard));
  };

  const globalNetworkBalance = () => {
    let updatedBoards = [...boards];
    
    // 1. Determine level of each board to process bottom-up
    const levels: Record<string, number> = {};
    const getLevel = (id: string): number => {
      if (id === 'DEWA/GRID' || !id) return 0;
      if (levels[id] !== undefined) return levels[id];
      const board = updatedBoards.find(b => b.id === id);
      if (!board) return 1;
      const level = getLevel(board.fedFrom) + 1;
      levels[id] = level;
      return level;
    };
    
    updatedBoards.forEach(b => getLevel(b.id));
    
    // Sort boards by level descending (deepest first)
    const sortedBoards = [...updatedBoards].sort((a, b) => (levels[b.id] || 0) - (levels[a.id] || 0));
    
    // 2. Bubble up loads from children to parents
    sortedBoards.forEach(parent => {
      if (parent.type === "DB" || parent.type === "EDB") return;
      
      // For MDB/SMDB, find all children fed directly from this parent
      const children = updatedBoards.filter(b => b.fedFrom === parent.id);
      if (children.length === 0) return;
      
      let newCircuits = [...parent.circuits];
      children.forEach(child => {
        // Calculate child's total connected load
        let childLoad = 0;
        child.circuits.forEach((c: any) => {
          const load = (child.type === "DB" || child.type === "EDB") 
            ? (() => {
                let totalW = 0;
                Object.keys(c.points || {}).forEach(pid => {
                  const pType = POINT_TYPES.find(p => p.id === pid);
                  if (pType) totalW += (c.points[pid] || 0) * pType.defaultW;
                });
                return totalW + (Number(c.customW) || 0);
              })()
            : (Number(c.qty) || 1) * (Number(c.loadW) || 0);
          childLoad += load * (c.df !== undefined ? Number(c.df) : 1);
        });
        
        // Find existing circuit for this child or create one
        const existingIdx = newCircuits.findIndex((c: any) => c.desc === child.name);
        if (existingIdx >= 0) {
          newCircuits[existingIdx].loadW = childLoad;
          newCircuits[existingIdx].qty = 1; // It's one panel
        } else {
          const newCirc = generateDefaultMDBCircuit(`c-${Date.now()}-${Math.random()}`, newCircuits.length);
          newCirc.desc = child.name;
          newCirc.loadW = childLoad;
          newCirc.qty = 1;
          newCircuits.push(newCirc);
        }
      });
      
      // Update parent in the updatedBoards array so its parent can read the updated load
      const parentIdx = updatedBoards.findIndex(b => b.id === parent.id);
      if (parentIdx >= 0) {
        updatedBoards[parentIdx] = { ...updatedBoards[parentIdx], circuits: newCircuits };
      }
    });
    
    // Balance all boards
    updatedBoards = updatedBoards.map(b => balanceBoardPhases(b));
    setBoards(updatedBoards);
    alert("Global Network Balance Complete! Child loads bubbled up to parent boards, and all 3-Phase boards balanced.");
  };

  const exportSchedule = async () => {
    // Check for unlinked boards (SOP warning)
    const unlinked = boards.filter(b => b.fedFrom !== "DEWA/GRID" && !boards.find(p => p.id === b.fedFrom));
    if (unlinked.length > 0) {
      if (!await confirm("SOP Warning: Some panels do not trace back to an MDB/LV-PANEL or DEWA/GRID. They may not be accurately reflected in the main load schedule. Continue export anyway?")) {
        return;
      }
    }
    
    try {      // Use dynamic imports to load the locally installed packages (avoids SSR/build issues and network blockers)
      const exceljsModule = await import('exceljs/dist/exceljs.min.js');
      const ExcelJS = exceljsModule.default || (window as any).ExcelJS;
      const fileSaverModule = await import('file-saver');
      const saveAs = fileSaverModule.saveAs || fileSaverModule.default?.saveAs || fileSaverModule.default || ((window as any).saveAs);
      
      const wb = new ExcelJS.Workbook();
        const sheetMap: any = {};
        const crossSheetLinks: any[] = [];
      wb.creator = "MEP Calculator";
      wb.created = new Date();
      
      boards.forEach(board => {
        const ws = wb.addWorksheet(board.name.substring(0, 31));
        const isThisDB = board.type === "DB" || board.type === "EDB";
          
        const applyGreyHeader = (cell: any, bold = true, size = 9, align = 'center') => {
          cell.font = { bold, size, name: 'Cambria', color: { argb: 'FF000000' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } };
          cell.alignment = { horizontal: align as any, vertical: 'middle', wrapText: true };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        };

        const applyWhiteCell = (cell: any, bold = false, size = 9, align = 'center') => {
          cell.font = { bold, size, name: 'Cambria', color: { argb: 'FF000000' } };
          cell.alignment = { horizontal: align as any, vertical: 'middle', wrapText: true };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        };

        if (isThisDB) {
          const ptsCount = POINT_TYPES.length;
          const totalCols = 8 + ptsCount + 5; 
            
          // --- Rows 1 to 3: Meta Header ---
          for (let i = 1; i <= 3; i++) {
            ws.addRow(new Array(totalCols).fill(""));
            ws.getRow(i).height = 20;
            for (let c = 1; c <= totalCols; c++) {
              applyGreyHeader(ws.getCell(i, c), true);
            }
          }
            
          ws.mergeCells(1, 1, 1, 7);
          ws.getCell(1, 1).value = `Project : PLOT NO.`; 
          ws.mergeCells(1, 8, 1, 8 + ptsCount);
          ws.getCell(1, 8).value = `Load Distribution Schedule`;
          ws.getCell(1, 8).font = { bold: true, size: 14, name: 'Cambria', color: { argb: 'FF000000' } };
          ws.mergeCells(1, 8 + ptsCount + 1, 1, totalCols);
          ws.getCell(1, 8 + ptsCount + 1).value = `Plot No.# : `;
            
          ws.mergeCells(2, 1, 2, 7);
          ws.getCell(2, 1).value = `DB No.# : ${board.name}`;
          ws.mergeCells(2, 8, 2, 8 + ptsCount);
          ws.mergeCells(2, 8 + ptsCount + 1, 2, totalCols);
          ws.getCell(2, 8 + ptsCount + 1).value = `Location : `;
            
          ws.mergeCells(3, 1, 3, 7);
          ws.getCell(3, 1).value = `Fed From : ${boards.find(b=>b.id===board.fedFrom)?.name || board.fedFrom}`;
          ws.mergeCells(3, 8, 3, 8 + ptsCount);
          ws.mergeCells(3, 8 + ptsCount + 1, 3, totalCols);
          ws.getCell(3, 8 + ptsCount + 1).value = `SHEET: 1 OF 1`;
            
          // --- Rows 4, 5, 6: Table Headers ---
          ws.addRow(new Array(totalCols).fill(""));
          ws.addRow(new Array(totalCols).fill(""));
          ws.addRow(new Array(totalCols).fill(""));
            
          for (let r = 4; r <= 6; r++) {
            for (let c = 1; c <= totalCols; c++) {
              applyGreyHeader(ws.getCell(r, c), true);
            }
          }
            
          const headerFields = [
            { c: 1, v: "RATING\nOF\nINCOMER" },
            { c: 2, v: "RATING\nOF\nELCB" },
            { c: 3, v: "SL\nNO" },
            { c: 4, v: "CIRN\no" },
            { c: 5, v: "MCB\nRTG.\nIN\nAMP" },
            { c: 6, v: "CCT\nWIRE\nSIZE\nmm2" },
            { c: 7, v: "ECC\nWIRE\nSIZE\nmm2" },
            { c: 8, v: "ROOM / AREA" },
          ];
            
          headerFields.forEach(hf => {
            ws.mergeCells(4, hf.c, 6, hf.c);
            ws.getCell(4, hf.c).value = hf.v;
          });
            
          // Connected Loads/Points
          ws.mergeCells(4, 9, 4, 8 + ptsCount);
          ws.getCell(4, 9).value = "CONNECTED LOADS/POINTS";
            
          POINT_TYPES.forEach((pt, i) => {
            const col = 9 + i;
            ws.mergeCells(5, col, 6, col);
            ws.getCell(5, col).value = pt.name.replace("\n", " ");
            ws.getColumn(col).width = 6;
          });
            
          const wuCol = 9 + ptsCount;
          ws.mergeCells(4, wuCol, 6, wuCol);
          ws.getCell(4, wuCol).value = "WATT\n/\nUNIT";
            
          // Load Per Circuit
          const rCol = wuCol + 1;
          const yCol = rCol + 1;
          const bCol = yCol + 1;
            
          ws.mergeCells(4, rCol, 4, bCol);
          ws.getCell(4, rCol).value = "LOAD PER CIRCUIT W";
            
          ws.mergeCells(5, rCol, 6, rCol); ws.getCell(5, rCol).value = "R";
          ws.mergeCells(5, yCol, 6, yCol); ws.getCell(5, yCol).value = "Y";
          ws.mergeCells(5, bCol, 6, bCol); ws.getCell(5, bCol).value = "B";
            
          const remCol = bCol + 1;
          ws.mergeCells(4, remCol, 6, remCol);
          ws.getCell(4, remCol).value = "REMAR\nKS";
            
          // --- Data Rows ---
          let startDataRow = 7;
          let currentRow = startDataRow;
          let elcbGroups = new Map();
            
          let totalR = 0, totalY = 0, totalB = 0;
            
          board.circuits.forEach((c: any) => {
            if (!elcbGroups.has(c.elcbGroup)) {
              elcbGroups.set(c.elcbGroup, { start: currentRow, count: 0 });
            }
            elcbGroups.get(c.elcbGroup).count++;
              
            const load = calculateCircuitLoad(c);
            const isR = c.phase?.includes("R");
            const isY = c.phase?.includes("Y");
            const isB = c.phase?.includes("B");
              
            const rLoad = isR ? load : "";
            const yLoad = isY ? load : "";
            const bLoad = isB ? load : "";
              
            if (isR) totalR += load;
            if (isY) totalY += load;
            if (isB) totalB += load;
              
            const rowData = new Array(totalCols).fill("");
            rowData[0] = board.incomer?.rating ? `${board.incomer.rating} TP ISOLATOR` : "";
            rowData[1] = c.elcbGroup || "";
            rowData[2] = c.slNo || "";
            rowData[3] = c.cirNo || "";
            rowData[4] = c.mcb || "";
            rowData[5] = c.wireEcc || "";
            rowData[6] = c.wireEcc || "2.5"; 
            rowData[7] = c.roomArea || "";
              
            POINT_TYPES.forEach((pt, i) => {
              rowData[8 + i] = c.points?.[pt.id] || "";
            });
              
            rowData[wuCol - 1] = c.customW || "";
            rowData[rCol - 1] = rLoad;
            rowData[yCol - 1] = yLoad;
            rowData[bCol - 1] = bLoad;
            rowData[remCol - 1] = c.remarks || "";
              
            const row = ws.addRow(rowData);
            row.eachCell((cell, colNum) => applyWhiteCell(cell));
            currentRow++;
          });
            
          // Merge Incomer Cell & Vertical Text
          if (board.circuits.length > 0) {
            ws.mergeCells(startDataRow, 1, currentRow - 1, 1);
            const incCell = ws.getCell(startDataRow, 1);
            applyGreyHeader(incCell, false);
            incCell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
          }
            
          // Merge ELCB Cells & Vertical Text
          elcbGroups.forEach((data, groupName) => {
            if (data.count > 0) {
              ws.mergeCells(data.start, 2, data.start + data.count - 1, 2);
              const elcbCell = ws.getCell(data.start, 2);
              elcbCell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90, wrapText: true };
              elcbCell.font = { size: 9, name: 'Cambria', color: { argb: 'FF000000' } };
            }
          });
            
          // Subtotal Row
          const subRow = ws.addRow(new Array(totalCols).fill(""));
          subRow.eachCell(c => applyGreyHeader(c, true));
          const firstCirc = 7;
          const lastCirc = currentRow - 1;
          if (lastCirc >= firstCirc) {
            subRow.getCell(rCol).value = { formula: `SUM(${ws.getCell(firstCirc, rCol).address}:${ws.getCell(lastCirc, rCol).address})`, result: totalR };
            subRow.getCell(yCol).value = { formula: `SUM(${ws.getCell(firstCirc, yCol).address}:${ws.getCell(lastCirc, yCol).address})`, result: totalY };
            subRow.getCell(bCol).value = { formula: `SUM(${ws.getCell(firstCirc, bCol).address}:${ws.getCell(lastCirc, bCol).address})`, result: totalB };
          } else {
            subRow.getCell(rCol).value = totalR;
            subRow.getCell(yCol).value = totalY;
            subRow.getCell(bCol).value = totalB;
          }
          currentRow++;
            
          // Total Row
          const totalRow = ws.addRow(new Array(totalCols).fill(""));
          totalRow.eachCell(c => applyGreyHeader(c, true));
          totalRow.getCell(rCol - 1).value = "TOTAL"; 
          totalRow.getCell(rCol).value = { formula: `SUM(${subRow.getCell(rCol).address}:${subRow.getCell(bCol).address})/1000`, result: (totalR + totalY + totalB) / 1000 };
          totalRow.getCell(rCol + 1).value = "kw";
          
          sheetMap[board.name] = {
            sheetName: board.name.substring(0, 31),
            rCell: subRow.getCell(rCol).address,
            yCell: subRow.getCell(yCol).address,
            bCell: subRow.getCell(bCol).address,
            kwCell: totalRow.getCell(rCol).address
          };
          
          currentRow++;
            
          // Cable Size Footer
          const cableRow = ws.addRow(new Array(totalCols).fill(""));
          ws.mergeCells(currentRow, 1, currentRow, totalCols);
          cableRow.getCell(1).value = `CABLE SIZE: ${board.incomer?.cableSize || ""} + ${board.incomer?.eccSize || ""}`;
          applyGreyHeader(cableRow.getCell(1), true);
          currentRow++;
            
          // Legend Footer
          const legendRow = ws.addRow(new Array(totalCols).fill(""));
          ws.mergeCells(currentRow, 1, currentRow, totalCols);
          const legendText = POINT_TYPES.map(p => `${p.name.replace("\n", "")}=${p.id}`).join(", ");
          legendRow.getCell(1).value = legendText;
          applyGreyHeader(legendRow.getCell(1), true);
            
          ws.getColumn(1).width = 8;
          ws.getColumn(2).width = 8;
          ws.getColumn(3).width = 5;
          ws.getColumn(4).width = 6;
          ws.getColumn(5).width = 6;
          ws.getColumn(6).width = 6;
          ws.getColumn(7).width = 6;
          ws.getColumn(8).width = 25; 
            
        } else {
          // ================= SMDB LAYOUT =================
          const totalCols = 19;
            
          // Rows 1-4 Meta Header
          for (let i = 1; i <= 4; i++) {
            ws.addRow(new Array(totalCols).fill(""));
            ws.getRow(i).height = 20;
          }
            
          const makeMetaCell = (r: number, c: number, endC: number, text: string, bold = true) => {
             ws.mergeCells(r, c, r, endC);
             const cell = ws.getCell(r, c);
             cell.value = text;
             cell.font = { bold, size: 9, name: 'Cambria', color: { argb: 'FF000000' } };
             cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          };
            
          makeMetaCell(1, 1, 5, "PROJECT: ARISTA OFFICE BUILDING (3B+G+7+R)");
          ws.mergeCells(1, 6, 1, 14);
          const mTitle = ws.getCell(1, 6);
          mTitle.value = "DETAIL OF CONNECTED LOAD, MAX. DEMAND & kWh METERING";
          mTitle.font = { bold: true, size: 10, name: 'Cambria', color: { argb: 'FF000000' } };
          mTitle.alignment = { horizontal: 'center', vertical: 'middle' };
          makeMetaCell(1, 15, 19, "AREA: AL FURJAN, DUBAI, U.A.E\nPLOT NO. 5911831");
            
          makeMetaCell(2, 1, 5, "PLANNED COMPLETION DATE:");
          makeMetaCell(2, 15, 19, "PLOT NO. 5911831");
            
          makeMetaCell(3, 1, 5, `SMDB NO.\t\t${board.name}`);
          makeMetaCell(3, 6, 14, "MAIN CONSULTANT: JOHN R HARRIS");
            
          makeMetaCell(4, 1, 5, `FED FROM\t\t${boards.find((b: any)=>b.id===board.fedFrom)?.name || board.fedFrom}`);
          makeMetaCell(4, 6, 14, "MEP CONSULTANT: CONSISTENT ENGINEERING CONSULTANTS");
          makeMetaCell(4, 15, 19, "LOCATION: GF F&B");
            
          // Draw border around meta-header outer box
          for (let r=1; r<=4; r++) {
             for (let c=1; c<=19; c++) {
                 ws.getCell(r, c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
             }
          }

          // Rows 5-7 Table Headers
          for (let i = 5; i <= 7; i++) {
            ws.addRow(new Array(totalCols).fill(""));
            for (let c=1; c<=19; c++) applyWhiteCell(ws.getCell(i, c), true, 8, 'center');
          }
            
          // Header merging and text
          ws.mergeCells(5, 1, 7, 1); ws.getCell(5, 1).value = "CIRCUIT/FEEDER\n\nSMDB/\nDB NO.";
          ws.mergeCells(5, 2, 7, 2); ws.getCell(5, 2).value = "SP/\nTP";
          ws.mergeCells(5, 3, 7, 3); ws.getCell(5, 3).value = "ACB/\nMCCB/\nISOLATOR\n\nRATING\n(AMPS)";
          ws.mergeCells(5, 4, 7, 4); ws.getCell(5, 4).value = "FAULT\n\nDUTY\nkA";
            
          ws.mergeCells(5, 5, 5, 7); ws.getCell(5, 5).value = "CABLE SIZE, TYPE\nAND\nNO. OF CORES";
          ws.mergeCells(6, 5, 6, 5); ws.getCell(6, 5).value = "NO. OF\nCORES\n1C/\n2C/4C";
          ws.mergeCells(6, 6, 6, 6); ws.getCell(6, 6).value = "TYPE\nXLPE/\nPVC/\nSWA";
          ws.mergeCells(6, 7, 6, 7); ws.getCell(6, 7).value = "SIZE";
          ws.getCell(7, 5).value = "1x4C";
          ws.getCell(7, 6).value = "XLPE/SWA/PVC/CU";
          ws.getCell(7, 7).value = "95"; // default for now
            
          ws.mergeCells(5, 8, 6, 8); ws.getCell(5, 8).value = "ECC\nSIZE";
          ws.getCell(7, 8).value = "1C,\nmm2";
            
          ws.mergeCells(5, 9, 6, 9); ws.getCell(5, 9).value = "LENGTH\nOF";
          ws.getCell(7, 9).value = "CABLE\n(Mtrs.)";
            
          ws.mergeCells(5, 10, 6, 12); ws.getCell(5, 10).value = "CONNECTED LOAD\n(KW)";
          ws.getCell(7, 10).value = "R - PH\nKW";
          ws.getCell(7, 11).value = "Y - PH\nKW";
          ws.getCell(7, 12).value = "B - PH\nKW";
            
          ws.mergeCells(5, 13, 6, 13); ws.getCell(5, 13).value = "TOTAL\nCONNECTED/\nINSTALLED\nLOAD";
          ws.getCell(7, 13).value = "(TCL)\n*\nKW";
            
          ws.mergeCells(5, 14, 6, 14); ws.getCell(5, 14).value = "DIVERSITY\nFACTOR\n(DF)";
          ws.getCell(7, 14).value = "";
            
          ws.mergeCells(5, 15, 6, 15); ws.getCell(5, 15).value = "MAX.\nDEMAND/\nOPERATIONAL\nLOAD";
          ws.getCell(7, 15).value = "(MDL)\nKW";
            
          ws.mergeCells(5, 16, 6, 18); ws.getCell(5, 16).value = "PROPOSED TYPE & NO. OF\nkWh METERS";
          ws.getCell(7, 16).value = "1 - PH\n(1)";
          ws.getCell(7, 17).value = "3 - PH\n(2)";
          ws.getCell(7, 18).value = "* LV/\nHV\nCT\n(3)";
            
          ws.mergeCells(5, 19, 7, 19); ws.getCell(5, 19).value = "REMARKS";
            
          // Calculate total board load to render the Incomer row
          let totalBoardKW = 0;
          let totalR = 0; let totalY = 0; let totalB = 0;
            
          board.circuits.forEach((c: any) => {
             const lKW = (Number(c.qty) || 1) * (Number(c.loadW) || 0) / 1000;
             totalBoardKW += lKW;
             const isR = c.phase?.includes("R");
             const isY = c.phase?.includes("Y");
             const isB = c.phase?.includes("B");
             if (isR) totalR += lKW;
             if (isY) totalY += lKW;
             if (isB) totalB += lKW;
             if (c.phase?.includes("3-Phase") || !c.phase) {
                 totalR += lKW/3; totalY += lKW/3; totalB += lKW/3;
             }
          });
            
          // Render Incomer Row
          const incRow = ws.addRow(new Array(totalCols).fill(""));
          for (let c=1; c<=19; c++) applyWhiteCell(incRow.getCell(c), true, 9, 'center');
          incRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
          incRow.getCell(1).value = "INCOMER";
          incRow.getCell(2).value = "TP";
          incRow.getCell(3).value = board.incomer?.rating || "200";
          incRow.getCell(4).value = "50";
          incRow.getCell(5).value = "1x4C";
          incRow.getCell(6).value = "XLPE/SWA/PVC/CU";
          incRow.getCell(7).value = "95";
          incRow.getCell(8).value = "1x1cx50";
          incRow.getCell(10).value = totalR.toFixed(2);
          incRow.getCell(11).value = totalY.toFixed(2);
          incRow.getCell(12).value = totalB.toFixed(2);
          incRow.getCell(13).value = totalBoardKW.toFixed(2);
          incRow.getCell(14).value = "0";
          incRow.getCell(15).value = "0";
          incRow.getCell(16).value = "0";
          incRow.getCell(17).value = "0";
          incRow.getCell(18).value = "1";
          incRow.getCell(19).value = "200/5A CT METER";
            
          // OUTGOING label
          const outRow = ws.addRow(new Array(totalCols).fill(""));
          for (let c=1; c<=19; c++) applyWhiteCell(outRow.getCell(c), false, 9, 'center');
          outRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
          outRow.getCell(1).value = "OUTGOING:";
            
          let totalMDL = 0;
            
          // Circuits
          board.circuits.forEach((c: any) => {
             const r = ws.addRow(new Array(totalCols).fill(""));
             for (let col=1; col<=19; col++) applyWhiteCell(r.getCell(col), false, 9, 'center');
             r.height = 30; // matching screenshot height approx
               
             const lKW = (Number(c.qty) || 1) * (Number(c.loadW) || 0) / 1000;
             let rKw = 0; let yKw = 0; let bKw = 0;
               if (c.rKw !== undefined && c.yKw !== undefined && c.bKw !== undefined) {
                   rKw = c.rKw / 1000;
                   yKw = c.yKw / 1000;
                   bKw = c.bKw / 1000;
               } else if (c.phase?.includes("R")) rKw = lKW;
               else if (c.phase?.includes("Y")) yKw = lKW;
               else if (c.phase?.includes("B")) bKw = lKW;
               else { rKw = lKW/3; yKw = lKW/3; bKw = lKW/3; }
               
             const df = Number(c.df) || 1;
             const mdl = lKW * df;
             totalMDL += mdl;
               
             r.getCell(1).value = c.desc || `DB-${c.id}`;
             r.getCell(2).value = "TP";
             r.getCell(3).value = c.mcb || "63";
             r.getCell(4).value = c.faultKa || "35";
             r.getCell(5).value = "1x4C";
             r.getCell(6).value = "XLPE/SWA/PVC/CU";
             r.getCell(7).value = c.wire || "16";
             r.getCell(8).value = c.ecc || `1x1cx16`;
             r.getCell(9).value = c.len || "";
             r.getCell(10).value = rKw > 0 ? rKw.toFixed(2) : "";
             r.getCell(11).value = yKw > 0 ? yKw.toFixed(2) : "";
             r.getCell(12).value = bKw > 0 ? bKw.toFixed(2) : "";
             r.getCell(13).value = lKW.toFixed(2);
             r.getCell(14).value = ""; // DF usually left blank unless special
             r.getCell(15).value = ""; // MDL left blank
               
             r.getCell(19).value = c.remarks || "";
          });
            
          // Summary Totals
          const totRow = ws.addRow(new Array(totalCols).fill(""));
          for (let col=1; col<=19; col++) applyWhiteCell(totRow.getCell(col), true, 9, 'center');
            
          ws.mergeCells(totRow.number, 1, totRow.number, 4);
          const titleCell = totRow.getCell(1);
          titleCell.value = `${board.name} FED FROM ${boards.find((b: any)=>b.id===board.fedFrom)?.name || board.fedFrom}`;
          titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
            
          ws.mergeCells(totRow.number, 5, totRow.number, 9);
          totRow.getCell(5).value = "TOTAL CONNECTED LOAD PER\nPHASE:";
            
          const firstCircRow = outRow.number + 1;
            const lastCircRow = totRow.number - 1;
            if (lastCircRow >= firstCircRow) {
              totRow.getCell(10).value = { formula: `SUM(J${firstCircRow}:J${lastCircRow})`, result: totalR };
              totRow.getCell(11).value = { formula: `SUM(K${firstCircRow}:K${lastCircRow})`, result: totalY };
              totRow.getCell(12).value = { formula: `SUM(L${firstCircRow}:L${lastCircRow})`, result: totalB };
              totRow.getCell(13).value = { formula: `SUM(M${firstCircRow}:M${lastCircRow})`, result: totalBoardKW };
            } else {
              totRow.getCell(10).value = totalR.toFixed(2);
              totRow.getCell(11).value = totalY.toFixed(2);
              totRow.getCell(12).value = totalB.toFixed(2);
              totRow.getCell(13).value = totalBoardKW.toFixed(2);
            }
            // Update incomer row to reflect these totals
            incRow.getCell(10).value = { formula: `J${totRow.number}`, result: totalR };
            incRow.getCell(11).value = { formula: `K${totRow.number}`, result: totalY };
            incRow.getCell(12).value = { formula: `L${totRow.number}`, result: totalB };
            incRow.getCell(13).value = { formula: `M${totRow.number}`, result: totalBoardKW };
            
            sheetMap[board.name] = {
              sheetName: board.name.substring(0, 31),
              rCell: totRow.getCell(10).address,
              yCell: totRow.getCell(11).address,
              bCell: totRow.getCell(12).address,
              kwCell: totRow.getCell(13).address
            };
          totRow.getCell(14).value = "0.00";
          totRow.getCell(15).value = "0.00";
          totRow.getCell(16).value = "0";
          totRow.getCell(17).value = "0";
          totRow.getCell(18).value = "0";
          totRow.getCell(19).value = "TOTAL";
            
          ws.addRow(new Array(totalCols).fill("")); // spacer
            
          const demandRow = ws.addRow(new Array(totalCols).fill(""));
          for (let col=1; col<=19; col++) applyWhiteCell(demandRow.getCell(col), true, 9, 'left');
          ws.mergeCells(demandRow.number, 1, demandRow.number, 3);
          demandRow.getCell(1).value = "DEMAND FACTOR :";
          ws.mergeCells(demandRow.number, 4, demandRow.number, 7);
          demandRow.getCell(4).value = "0.00 Max. DEMAND:";
          ws.mergeCells(demandRow.number, 8, demandRow.number, 13);
          demandRow.getCell(8).value = "0.00 kW";
          ws.mergeCells(demandRow.number, 14, demandRow.number, 19);
          demandRow.getCell(14).value = "TOTAL BUILD-UP AREA:";
            
          // auto fit
          ws.getColumn(1).width = 25;
          ws.getColumn(2).width = 6;
          ws.getColumn(3).width = 10;
          ws.getColumn(4).width = 8;
          ws.getColumn(5).width = 8;
          ws.getColumn(6).width = 18;
          ws.getColumn(7).width = 6;
          ws.getColumn(8).width = 10;
          ws.getColumn(9).width = 8;
          ws.getColumn(10).width = 8;
          ws.getColumn(11).width = 8;
          ws.getColumn(12).width = 8;
          ws.getColumn(13).width = 10;
          ws.getColumn(14).width = 8;
          ws.getColumn(15).width = 10;
          ws.getColumn(16).width = 6;
          ws.getColumn(17).width = 6;
          ws.getColumn(18).width = 8;
          ws.getColumn(19).width = 25;
        }
      });
        // Apply cross sheet links
        crossSheetLinks.forEach(link => {
           const map = sheetMap[link.boardName];
           if (map) {
             link.targetR.value = { formula: `'${map.sheetName}'!${map.rCell}` };
             link.targetY.value = { formula: `'${map.sheetName}'!${map.yCell}` };
             link.targetB.value = { formula: `'${map.sheetName}'!${map.bCell}` };
             link.targetKW.value = { formula: `'${map.sheetName}'!${map.kwCell}` };
           }
        });
        
        const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, "Project_Load_Schedule.xlsx");
      
    } catch (err: any) {
      console.error("Export failed", err);
      alert("Export failed: " + (err.message || err));
    }
  };

  let totalR = 0, totalY = 0, totalB = 0;
  activeBoard?.circuits.forEach((c: any) => {
    const load = calculateCircuitLoad(c) * (c.df !== undefined ? Number(c.df) : 1);
    if (c.phase.includes("R")) totalR += load;
    else if (c.phase.includes("Y")) totalY += load;
    else if (c.phase.includes("B")) totalB += load;
    else if (c.phase.includes("3-Phase")) {
      totalR += load/3; totalY += load/3; totalB += load/3;
    }
  });

  return (
    <AppShell>
      <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shadow-2xs shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Load Schedule <span className="text-xs font-normal text-slate-500">Hierarchical MEP Load Distribution Manager</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={globalNetworkBalance} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#3178c6] text-white rounded hover:bg-[#2968ad] transition shadow-sm">
              <Zap className="size-3" /> Global Network Balance
            </button>
            <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
              <button onClick={() => setView("schedule")} className={`px-3 py-1 text-xs font-medium rounded transition ${view === "schedule" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <TableIcon className="size-3 inline mr-1" /> Table View
              </button>
              <button onClick={() => setView("sld")} className={`px-3 py-1 text-xs font-medium rounded transition ${view === "sld" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                <Network className="size-3 inline mr-1" /> Network SLD
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {view === "sld" ? (
            <div className="flex-1 m-4 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shadow-inner relative">
              <NetworkSLD 
                boards={boards} 
                onNodeClick={(id) => {
                  setActiveBoardId(id);
                  setView("schedule");
                }} 
                onConnectBoard={(source, target) => {
                  updateBoardGlobal(target, { fedFrom: source });
                }}
                onAddBoard={(newBoard) => {
                  addBoard(newBoard);
                  setActiveBoardId(newBoard.id);
                }}
                onUpdateBoard={(id, updates) => {
                  updateBoardGlobal(id, updates);
                }}
                onDeleteBoard={async (id) => {
                  if (await confirm("Delete this board?")) {
                    deleteBoard(id);
                    if (activeBoardId === id) setActiveBoardId("SUMMARY");
                  }
                }}
              />
            </div>
          ) : activeBoardId === "SUMMARY" ? (
            <div className="flex-1 m-4 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center bg-slate-100">
              <p className="text-slate-500">Project Load Summary View</p>
            </div>
          ) : activeBoard ? (
            <div className="flex-1 flex flex-col bg-white overflow-hidden">
              
              {/* Board Configuration Section */}
              <div className="flex gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0 items-center">
                {/* General Config */}
                <div className="flex-1 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 mb-1 flex items-center gap-1">
                    <Zap className="size-3" /> General Configuration
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] uppercase text-slate-500 font-bold mb-0.5 block">Board Name</label>
                      <input className="w-full h-7 px-2 border border-slate-300 rounded text-xs" value={activeBoard.name} onChange={e => updateBoard({name: e.target.value})} />
                    </div>
                    <div className="w-28">
                      <label className="text-[9px] uppercase text-slate-500 font-bold mb-0.5 block">Phase Type</label>
                      <select className="w-full h-7 px-1.5 border border-slate-300 rounded text-xs bg-white" value={activeBoard.phaseType} onChange={e => updateBoard({phaseType: e.target.value})}>
                        <option>3-Phase</option>
                        <option>1-Phase</option>
                      </select>
                    </div>
                    <div className="w-28">
                      <label className="text-[9px] uppercase text-slate-500 font-bold mb-0.5 block">Board Type</label>
                      <select className="w-full h-7 px-1.5 border border-slate-300 rounded text-xs bg-white" value={activeBoard.type} onChange={e => {
                        updateBoard({type: e.target.value, circuits: []}); // Clear circuits on type change to avoid schema mismatch
                      }}>
                        <option>DB</option>
                        <option>LV-PANEL</option>
                        <option>BUSBAR</option>
                        <option>MDB</option>
                        <option>SMDB</option>
                        <option>ESDB</option>
                        <option>EDB</option>
                      </select>
                    </div>
                    <div className="w-36">
                      <label className="text-[9px] uppercase text-slate-500 font-bold mb-0.5 block">Fed From</label>
                      <select className="w-full h-7 px-1.5 border border-slate-300 rounded text-xs bg-white" value={activeBoard.fedFrom || "DEWA/GRID"} onChange={e => updateBoard({fedFrom: e.target.value})}>
                        <option value="DEWA/GRID">DEWA/GRID</option>
                        {boards.filter(b => b.id !== activeBoard.id).map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Incomer Config */}
                <div className="flex-[1.4] bg-emerald-50/50 px-3 py-2 rounded-lg border border-emerald-200 shadow-2xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1 flex items-center gap-1">
                    <Network className="size-3" /> Incomer Specifications
                  </div>
                  <div className="flex gap-1.5">
                    {isDB ? (
                      <>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">Rating</label><input className="w-full h-7 px-2 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.rating} onChange={e => updateIncomer("rating", e.target.value)} /></div>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">SP/TP</label><input className="w-full h-7 px-2 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.sptp} onChange={e => updateIncomer("sptp", e.target.value)} /></div>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">Fault KA</label><input className="w-full h-7 px-2 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.faultKa} onChange={e => updateIncomer("faultKa", e.target.value)} /></div>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">Cable Size</label><input className="w-full h-7 px-2 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.cableSize} onChange={e => updateIncomer("cableSize", e.target.value)} /></div>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">ECC Size</label><input className="w-full h-7 px-2 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.eccSize} onChange={e => updateIncomer("eccSize", e.target.value)} /></div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">Inc 1 Rating</label><select className="w-full h-7 px-1 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.inc1} onChange={e => updateIncomer("inc1", e.target.value)}><option>1600A</option><option>2500A</option></select></div>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">Inc 2 Rating</label><select className="w-full h-7 px-1 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.inc2} onChange={e => updateIncomer("inc2", e.target.value)}><option>1600A</option><option>2500A</option></select></div>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">Meter Type</label><select className="w-full h-7 px-1 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.meterType} onChange={e => updateIncomer("meterType", e.target.value)}><option>None</option><option>KWH</option></select></div>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">SP/TP</label><input className="w-full h-7 px-2 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.sptp} onChange={e => updateIncomer("sptp", e.target.value)} /></div>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">Fault KA</label><input className="w-full h-7 px-2 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.faultKa} onChange={e => updateIncomer("faultKa", e.target.value)} /></div>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">Cable Size</label><input className="w-full h-7 px-2 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.cableSize} onChange={e => updateIncomer("cableSize", e.target.value)} /></div>
                        <div className="flex-1"><label className="text-[9px] uppercase text-emerald-700/70 font-bold mb-0.5 block">ECC Size</label><input className="w-full h-7 px-2 border border-emerald-200 rounded text-xs bg-white" value={activeBoard.incomer.eccSize} onChange={e => updateIncomer("eccSize", e.target.value)} /></div>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="grid grid-cols-2 gap-1.5 shrink-0">
                  <button onClick={autoSizeAndGroup} className="h-7 px-2.5 text-[11px] font-medium bg-white border border-slate-300 rounded shadow-2xs hover:bg-slate-50 flex items-center gap-1 whitespace-nowrap"><Network className="size-3"/> Auto-Size</button>
                  <button onClick={autoBalancePhases} className="h-7 px-2.5 text-[11px] font-medium bg-white border border-slate-300 rounded shadow-2xs hover:bg-slate-50 flex items-center gap-1 whitespace-nowrap"><Zap className="size-3"/> Auto Balance</button>
                  <button onClick={() => setIsCompactView(!isCompactView)} className={`h-7 px-2.5 text-[11px] font-medium border border-slate-300 rounded shadow-2xs flex items-center gap-1 whitespace-nowrap transition-colors ${isCompactView ? "bg-slate-700 text-white border-white/20 hover:bg-slate-800" : "bg-white hover:bg-slate-50"}`}>
                    {isCompactView ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    {isCompactView ? "Full View" : "Compact View"}
                  </button>
                  <button onClick={exportSchedule} className="h-7 px-2.5 text-[11px] font-medium bg-[#3178c6] text-white rounded shadow-2xs hover:bg-[#2968ad] flex items-center gap-1 whitespace-nowrap"><Download className="size-3"/> Export</button>
                </div>
              </div>

              {/* Table Container */}
              <div ref={tableContainerRef} className="flex-1 overflow-auto bg-white text-slate-800">
                <table className="w-max min-w-full text-xs text-center border-collapse">
                  <thead className="bg-[#2968ad] text-slate-200 sticky top-0 z-20 shadow-md outline outline-1 outline-slate-700">
                    {isDB ? (
                      <>
                        <tr>
                          <th rowSpan={2} className="border border-white/20 p-2 w-16 bg-[#3178c6]">CIRNo</th>
                          <th rowSpan={2} className="border border-white/20 p-2 w-16 bg-[#3178c6]">MCB (A) <Copy onClick={()=>copyDown("mcb", activeBoard.circuits[0]?.mcb)} className="size-3 inline cursor-pointer hover:text-white" /></th>
                          {!isCompactView && <th rowSpan={2} className="border border-white/20 p-2 w-20 bg-[#3178c6]">WIRE/ECC <Copy onClick={()=>copyDown("wireEcc", activeBoard.circuits[0]?.wireEcc)} className="size-3 inline cursor-pointer hover:text-white" /></th>}
                          <th rowSpan={2} className="border border-white/20 p-2 w-32 bg-[#3178c6]">ROOM/AREA <Copy onClick={()=>copyDown("roomArea", activeBoard.circuits[0]?.roomArea)} className="size-3 inline cursor-pointer hover:text-white" /></th>
                          <th colSpan={POINT_TYPES.length + 1} className="border border-white/20 p-1 bg-[#2968ad]">CONNECTED LOADS / POINTS</th>
                          <th rowSpan={2} className="border border-white/20 p-2 w-20 bg-slate-700/50">CUSTOM W</th>
                          <th rowSpan={2} className="border border-white/20 p-2 w-24 bg-[#3178c6]">PHASE</th>
                          {!isCompactView && <th rowSpan={2} className="border border-white/20 p-2 w-32 bg-[#3178c6]">REMARKS</th>}
                          <th rowSpan={2} className="border border-white/20 p-2 w-16 bg-[#3178c6] text-slate-400 text-center"><Trash2 className="size-3 inline" /></th>
                        </tr>
                        <tr>
                          {POINT_TYPES.map(p => (
                            <th key={p.id} className="border border-white/20 p-1 text-[9px] w-12 hover:bg-slate-700" title={`${p.defaultW}W`}>
                              {p.name} <Copy className="size-2.5 inline cursor-pointer" />
                            </th>
                          ))}
                          <th className="border border-white/20 p-1 text-[9px] w-14 bg-slate-700/30">W/UNIT</th>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <th className="border border-white/20 p-2 w-16 bg-[#3178c6]">CIR NO</th>
                        <th className="border border-white/20 p-2 w-48 bg-[#3178c6]">LOAD DESCRIPTION <Copy onClick={()=>copyDown("desc", activeBoard.circuits[0]?.desc)} className="size-3 inline cursor-pointer hover:text-white" /></th>
                        <th className="border border-white/20 p-2 w-16 bg-[#3178c6]">QTY <Copy onClick={()=>copyDown("qty", activeBoard.circuits[0]?.qty)} className="size-3 inline cursor-pointer hover:text-white" /></th>
                        <th className="border border-white/20 p-2 w-20 bg-[#3178c6]">LOAD(W) <Copy onClick={()=>copyDown("loadW", activeBoard.circuits[0]?.loadW)} className="size-3 inline cursor-pointer hover:text-white" /></th>
                        <th className="border border-white/20 p-2 w-24 bg-[#3178c6]">PHASE</th>
                        <th className="border border-white/20 p-2 w-20 bg-red-950/40 text-red-400">R (W)</th>
                        <th className="border border-white/20 p-2 w-20 bg-yellow-950/40 text-yellow-400">Y (W)</th>
                        <th className="border border-white/20 p-2 w-20 bg-blue-950/40 text-blue-400">B (W)</th>
                        <th className="border border-white/20 p-2 w-16 bg-[#3178c6]">DF</th>
                        <th className="border border-white/20 p-2 w-16 bg-[#3178c6]">MCB <Copy onClick={()=>copyDown("mcb", activeBoard.circuits[0]?.mcb)} className="size-3 inline cursor-pointer hover:text-white" /></th>
                        {!isCompactView && (
                          <>
                            <th className="border border-white/20 p-2 w-20 bg-[#3178c6]">FAULT KA</th>
                            <th className="border border-white/20 p-2 w-16 bg-[#3178c6]">WIRE <Copy onClick={()=>copyDown("wire", activeBoard.circuits[0]?.wire)} className="size-3 inline cursor-pointer hover:text-white" /></th>
                            <th className="border border-white/20 p-2 w-24 bg-[#3178c6]">TYPE <Copy onClick={()=>copyDown("type", activeBoard.circuits[0]?.type)} className="size-3 inline cursor-pointer hover:text-white" /></th>
                            <th className="border border-white/20 p-2 w-16 bg-[#3178c6]">ECC <Copy onClick={()=>copyDown("ecc", activeBoard.circuits[0]?.ecc)} className="size-3 inline cursor-pointer hover:text-white" /></th>
                            <th className="border border-white/20 p-2 w-20 bg-[#3178c6]">LEN(M)</th>
                            <th className="border border-white/20 p-2 w-20 bg-[#3178c6]">1-PH MTR</th>
                            <th className="border border-white/20 p-2 w-20 bg-[#3178c6]">3-PH MTR</th>
                            <th className="border border-white/20 p-2 w-20 bg-[#3178c6]">CT MTR</th>
                            <th className="border border-white/20 p-2 w-32 bg-[#3178c6]">REMARKS</th>
                          </>
                        )}
                          <th className="border border-white/20 p-2 w-16 bg-[#3178c6] text-slate-400 text-center"><Trash2 className="size-3 inline" /></th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {activeBoard.circuits.length === 0 ? (
                      <tr>
                        <td colSpan={30} className="p-12 text-center text-slate-500">
                          <Zap className="size-8 mx-auto mb-3 opacity-20" />
                          <p className="text-sm">No circuits added yet</p>
                          <p className="text-xs">Click the Add Circuit button below to start configuring your board's schedule.</p>
                        </td>
                      </tr>
                    ) : activeBoard.circuits.map((c: any) => {
                      const load = calculateCircuitLoad(c);
                      return (
                        <tr key={c.id} className="border-b border-slate-300 hover:bg-slate-50">
                          {isDB ? (
                            <>
                              <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.cirNo} onChange={e => updateCircuit(c.id, "cirNo", e.target.value)} /></td>
                              <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.mcb} onChange={e => updateCircuit(c.id, "mcb", e.target.value)} /></td>
                              {!isCompactView && <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.wireEcc} onChange={e => updateCircuit(c.id, "wireEcc", e.target.value)} /></td>}
                              <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 text-left" value={c.roomArea} onChange={e => updateCircuit(c.id, "roomArea", e.target.value)} /></td>
                              
                              {POINT_TYPES.map(p => (
                                <td key={p.id} className="p-0 border-r border-slate-300">
                                  <input type="number" min="0" className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100 text-blue-700 font-medium" value={c.points[p.id] || ""} onChange={e => updatePoint(c.id, p.id, e.target.value)} />
                                </td>
                              ))}
                              
                              <td className="p-0 border-r border-slate-300"><input type="number" className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.wPerUnit} onChange={e => updateCircuit(c.id, "wPerUnit", Number(e.target.value))} /></td>
                              <td className="p-0 border-r border-slate-300 bg-slate-100"><input type="number" className="w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 text-right text-emerald-700" value={c.customW} onChange={e => updateCircuit(c.id, "customW", Number(e.target.value))} /></td>
                              
                              <td className="p-0 border-r border-slate-300">
                                <select className="w-full h-8 px-1 bg-transparent outline-none focus:bg-slate-100" value={c.phase} onChange={e => updateCircuit(c.id, "phase", e.target.value)}>
                                  <option>R Phase</option><option>Y Phase</option><option>B Phase</option><option>3-Phase</option>
                                </select>
                              </td>
                              {!isCompactView && <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 text-left" value={c.remarks} onChange={e => updateCircuit(c.id, "remarks", e.target.value)} /></td>}
                            </>
                          ) : (
                            <>
                              <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.cirNo} onChange={e => updateCircuit(c.id, "cirNo", e.target.value)} /></td>
                              <td className="p-0 border-r border-slate-300">
                                <input 
                                  className={`w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 text-left ${c.isFeeder ? 'text-blue-700 font-medium' : ''}`} 
                                  value={c.desc} 
                                  onChange={e => updateCircuit(c.id, "desc", e.target.value)} 
                                  disabled={c.isFeeder}
                                  title={c.isFeeder ? "Feeder name is locked to the connected board name. Rename the board instead." : ""}
                                />
                              </td>
                              <td className="p-0 border-r border-slate-300"><input type="number" className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.qty} onChange={e => updateCircuit(c.id, "qty", Number(e.target.value))} /></td>
                              <td className="p-0 border-r border-slate-300"><input type="number" className="w-full h-8 px-2 bg-transparent text-right outline-none focus:bg-slate-100 text-emerald-700" value={c.loadW} onChange={e => updateCircuit(c.id, "loadW", Number(e.target.value))} /></td>
                              <td className="p-0 border-r border-slate-300">
                                <select className="w-full h-8 px-1 bg-transparent outline-none focus:bg-slate-100 text-xs" value={c.phase} onChange={e => updateCircuit(c.id, "phase", e.target.value)}>
                                  <option>R Phase</option><option>Y Phase</option><option>B Phase</option><option>3-Phase</option>
                                </select>
                              </td>
                              
                              <td className="p-0 border-r border-slate-300 text-right pr-2 text-red-600 font-medium font-mono">{c.rKw !== undefined ? c.rKw.toFixed(1) : (c.phase.includes("R") ? load : c.phase === "3-Phase" ? (load/3).toFixed(1) : "")}</td>
                              <td className="p-0 border-r border-slate-300 text-right pr-2 text-yellow-600 font-medium font-mono">{c.yKw !== undefined ? c.yKw.toFixed(1) : (c.phase.includes("Y") ? load : c.phase === "3-Phase" ? (load/3).toFixed(1) : "")}</td>
                              <td className="p-0 border-r border-slate-300 text-right pr-2 text-blue-700 font-medium font-mono">{c.bKw !== undefined ? c.bKw.toFixed(1) : (c.phase.includes("B") ? load : c.phase === "3-Phase" ? (load/3).toFixed(1) : "")}</td>
                              
                              <td className="p-0 border-r border-slate-300"><input type="number" step="0.1" className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.df} onChange={e => updateCircuit(c.id, "df", Number(e.target.value))} /></td>
                              <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.mcb} onChange={e => updateCircuit(c.id, "mcb", e.target.value)} /></td>
                              {!isCompactView && (
                                <>
                                  <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.faultKa} onChange={e => updateCircuit(c.id, "faultKa", e.target.value)} /></td>
                                  <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.wire} onChange={e => updateCircuit(c.id, "wire", e.target.value)} /></td>
                                  <td className="p-0 border-r border-slate-300">
                                    <select className="w-full h-8 px-1 bg-transparent outline-none focus:bg-slate-100 text-[10px]" value={c.type} onChange={e => updateCircuit(c.id, "type", e.target.value)}>
                                      <option>XLPE/SWA/PVC</option><option>PVC/PVC</option><option>FP200</option>
                                    </select>
                                  </td>
                                  <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.ecc} onChange={e => updateCircuit(c.id, "ecc", e.target.value)} /></td>
                                  <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.len} onChange={e => updateCircuit(c.id, "len", e.target.value)} /></td>
                                  <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.ph1Mtr} onChange={e => updateCircuit(c.id, "ph1Mtr", e.target.value)} /></td>
                                  <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.ph3Mtr} onChange={e => updateCircuit(c.id, "ph3Mtr", e.target.value)} /></td>
                                  <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-1 bg-transparent text-center outline-none focus:bg-slate-100" value={c.ctMtr} onChange={e => updateCircuit(c.id, "ctMtr", e.target.value)} /></td>
                                  <td className="p-0 border-r border-slate-300"><input className="w-full h-8 px-2 bg-transparent outline-none focus:bg-slate-100 text-left" value={c.remarks} onChange={e => updateCircuit(c.id, "remarks", e.target.value)} /></td>
                                </>
                              )}
                            </>
                          )}
                          <td className="p-0 text-center">
                            <div className="flex justify-center items-center gap-1">
                              <button onClick={() => duplicateCircuit(c)} className="p-1 text-slate-500 hover:text-[#3178c6] rounded" title="Duplicate Circuit">
                                <Copy className="size-3.5" />
                              </button>
                              <button onClick={() => {
                                const isBoardFeeder = c.isFeeder;
                                if (isBoardFeeder) {
                                  alert(`Cannot delete this circuit directly because it is a Feeder for a connected board (${c.desc}).\n\nTo remove this feeder, you must go to the child board and change its 'Fed From' setting to 'None'. The Global Network will then automatically remove this circuit from this board.`);
                                  return;
                                }
                                updateBoard({ circuits: activeBoard.circuits.filter((cc: any) => cc.id !== c.id) });
                              }} className="p-1 text-slate-500 hover:text-red-400 rounded">
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td colSpan={100} className="p-4 bg-slate-50 border-t border-slate-300">
                        <div className="flex justify-center">
                          <button onClick={addCircuit} className="px-6 py-2 bg-[#3178c6] hover:bg-[#2968ad] text-white font-medium rounded-full shadow-md flex items-center gap-2 transition-transform hover:scale-105 active:scale-95">
                            <Plus className="size-4" /> Add Circuit
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="sticky bottom-0 z-20 bg-[#2968ad] text-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.3)] outline outline-1 outline-slate-700">
                    {isDB ? (
                      <tr>
                        <td colSpan={isCompactView ? 3 : 4} className="border border-white/20 p-2 text-right font-bold text-[10px]">TOTALS:</td>
                        <td colSpan={POINT_TYPES.length + 5} className="border border-white/20 p-2 font-bold text-[11px] text-center bg-[#3178c6]">
                           <span className="text-red-400 mr-4">R: {totalR.toLocaleString(undefined, {maximumFractionDigits:0})} W</span>
                           <span className="text-yellow-400 mr-4">Y: {totalY.toLocaleString(undefined, {maximumFractionDigits:0})} W</span>
                           <span className="text-blue-400 mr-4">B: {totalB.toLocaleString(undefined, {maximumFractionDigits:0})} W</span>
                           <span className="text-white">TOTAL: {(totalR+totalY+totalB).toLocaleString(undefined, {maximumFractionDigits:0})} W</span>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={5} className="border border-white/20 p-2 text-right font-bold text-slate-300">TOTAL:</td>
                        <td className="border border-white/20 p-2 font-bold text-red-400 bg-[#3178c6]">{totalR.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                        <td className="border border-white/20 p-2 font-bold text-yellow-400 bg-[#3178c6]">{totalY.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                        <td className="border border-white/20 p-2 font-bold text-blue-400 bg-[#3178c6]">{totalB.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                        <td colSpan={isCompactView ? 3 : 12} className="border border-white/20 p-2 text-left font-bold pl-4 text-slate-300 bg-[#3178c6]">
                           TOTAL MDL: {activeBoard.circuits.reduce((sum: number, c: any) => sum + ((c.loadW || 0) * (c.df || 1)), 0).toLocaleString(undefined, {maximumFractionDigits:0})} W
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </div>
          ) : null}

          {/* Bottom Tabs */}
          <div className="flex items-center justify-between h-12 bg-white border-t border-slate-200 px-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-4 opacity-50">
                <TableIcon className="size-4" /> <span className="text-xs font-bold uppercase tracking-wider">Dashboard Totals</span>
              </div>
              <div className="text-xs bg-slate-100 px-3 py-1.5 rounded font-bold text-slate-700">
                TOTAL WATTS: <span className="font-mono text-sm ml-1">{(totalR+totalY+totalB).toLocaleString(undefined, {maximumFractionDigits:0})} W</span>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="text-xs bg-red-50 text-red-700 px-3 py-1.5 rounded font-bold border border-red-100 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div> {totalR.toLocaleString(undefined, {maximumFractionDigits:0})} W
              </div>
              <div className="text-xs bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded font-bold border border-yellow-100 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div> {totalY.toLocaleString(undefined, {maximumFractionDigits:0})} W
              </div>
              <div className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded font-bold border border-blue-100 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div> {totalB.toLocaleString(undefined, {maximumFractionDigits:0})} W
              </div>
            </div>
          </div>

          <div className="flex items-center h-12 bg-slate-100 border-t border-slate-300 select-none overflow-hidden text-xs shrink-0">
            <div className="flex h-full overflow-x-auto custom-scrollbar flex-1 items-end pl-1 pt-1">
              <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { height: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
              ` }} />
              <button 
                onClick={() => setActiveBoardId("SUMMARY")}
                className={`h-[32px] px-4 font-bold border-t border-r border-l rounded-t-md mx-[1px] whitespace-nowrap transition-colors flex items-center shadow-sm relative ${activeBoardId === "SUMMARY" ? "bg-emerald-500 text-white border-emerald-600 z-10 h-[34px] border-b-0 -mb-[1px]" : "bg-emerald-400 text-white border-emerald-500 hover:bg-emerald-500 z-0 opacity-80"}`}
              >
                PLOT LOAD SUMMARY
              </button>
              {boards.map(board => (
                <div key={board.id} className={`relative flex group mx-[1px] ${activeBoardId === board.id ? "z-10" : "z-0"}`}>
                  <button 
                    onClick={() => setActiveBoardId(board.id)}
                    className={`h-[32px] pl-4 pr-2 font-bold border-t border-r border-l rounded-t-md whitespace-nowrap transition-colors flex items-center shadow-sm relative ${activeBoardId === board.id ? "bg-white text-slate-800 border-slate-300 h-[34px] border-b-0 -mb-[1px]" : "bg-slate-200 text-slate-600 opacity-80 hover:bg-slate-300 hover:opacity-100"}`}
                  >
                    {board.name}
                    {activeBoardId === board.id && (
                      <Trash2 onClick={async (e) => {
                        e.stopPropagation();
                        if (await confirm("Delete this board?")) {
                          setBoards(boards.filter(b => b.id !== board.id));
                          setActiveBoardId("SUMMARY");
                        }
                      }} className="size-3.5 ml-2 text-slate-400 hover:text-red-500 transition-colors" />
                    )}
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => {
              const newBoard = createDefaultBoard(`board-${Date.now()}`, `New Board ${boards.length + 1}`);
              setBoards([...boards, newBoard]);
              setActiveBoardId(newBoard.id);
            }} className="h-full px-4 border-l border-slate-300 hover:bg-slate-200 flex items-center justify-center text-slate-600 shrink-0 font-bold gap-1 bg-white">
              <Plus className="size-4" /> New
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}


// trigger

// trigger2


