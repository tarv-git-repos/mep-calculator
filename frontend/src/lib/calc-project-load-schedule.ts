import { POINT_TYPES, generateDefaultMDBCircuit } from "@/store/electrical-network";

export function performCalculateCircuitLoad(c: any, boardType: string) {
  if (boardType === "DB" || boardType === "EDB") {
    let totalW = 0;
    Object.keys(c.points || {}).forEach(pid => {
      const pType = POINT_TYPES.find(p => p.id === pid);
      if (pType) totalW += (c.points[pid] || 0) * pType.defaultW;
    });
    return totalW + (Number(c.customW) || 0);
  } else {
    return (Number(c.qty) || 1) * (Number(c.loadW) || 0);
  }
}

export function performAutoSizeAndGroup(activeBoard: any) {
  if (activeBoard.type !== "DB" && activeBoard.type !== "EDB") {
    throw new Error("Auto-Size & Group is only available for DB/EDB boards.");
  }
  
  let totalBoardLoad = 0;
  const lightingTypes = ['ltg', 'ch', 'callbell'];
  const mechTypes = ['exhood', 'fcu', 'hd', 'isol', 'wh', 'other'];
  
  const sizedCircuits = activeBoard.circuits.map((c: any) => {
    const load = performCalculateCircuitLoad(c, activeBoard.type);
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
  
  let lightingCircuits: any[] = [];
  let powerCircuits: any[] = [];
  let mechCircuits: any[] = [];
  let spareCircuits: any[] = [];
  
  for (const c of sizedCircuits) {
    if (c.isSpare || performCalculateCircuitLoad(c, activeBoard.type) === 0) {
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
      powerCircuits.push(c);
    }
  }
  
  let newCircuits: any[] = [];
  let groupIndex = 1;
  
  const totalKW = totalBoardLoad / 1000;
  let iRatingStr = "40A";
  if (totalKW > 50) iRatingStr = "125A";
  else if (totalKW > 30) iRatingStr = "100A";
  else if (totalKW > 15) iRatingStr = "63A";
  
  const baseAmps = parseInt(iRatingStr.match(/\d+/)?.[0] || "40", 10);
  
  const processCluster = (circuits: any[], sensitivity: number, isSparePass = false) => {
    let index = 0;
    while (index < circuits.length) {
      const remaining = circuits.length - index;
      let take = 0;
      let pad = 0;
      
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
  
  processCluster(lightingCircuits, 100, false);
  processCluster(powerCircuits, 30, false);
  
  if (spareCircuits.length > 0) {
    processCluster([...spareCircuits], 30, true);
    spareCircuits.length = 0;
  }

  processCluster(mechCircuits, 100, false);
  
  const phases = ["R", "Y", "B"];
  newCircuits = newCircuits.map((c, idx) => {
    const slNo = idx + 1;
    const phaseStr = phases[idx % 3];
    const seq = Math.floor(idx / 3) + 1;
    const cirNo = activeBoard.phaseType === "3-Phase" ? `${phaseStr}${seq}` : `L${idx + 1}`;
    const fullPhase = activeBoard.phaseType === "3-Phase" ? `${phaseStr} Phase` : "1-Phase";
    return { ...c, slNo, cirNo, phase: fullPhase };
  });
  
  return { 
    ...activeBoard,
    circuits: newCircuits,
    incomer: { ...activeBoard.incomer, rating: iRatingStr }
  };
}

export function performBalanceBoardPhases(board: any) {
  if (board.phaseType !== "3-Phase") return board;
  const circuits = [...board.circuits];
  
  const calcLoad = (c: any) => performCalculateCircuitLoad(c, board.type);
  
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
}

export function performGlobalNetworkBalance(boards: any[]) {
  let updatedBoards = JSON.parse(JSON.stringify(boards));
  
  const levels: Record<string, number> = {};
  const getLevel = (id: string): number => {
    if (id === 'DEWA/GRID' || !id) return 0;
    if (levels[id] !== undefined) return levels[id];
    const board = updatedBoards.find((b: any) => b.id === id);
    if (!board) return 1;
    const level = getLevel(board.fedFrom) + 1;
    levels[id] = level;
    return level;
  };
  
  updatedBoards.forEach((b: any) => getLevel(b.id));
  
  const sortedBoards = [...updatedBoards].sort((a, b) => (levels[b.id] || 0) - (levels[a.id] || 0));
  
  sortedBoards.forEach(parent => {
    if (parent.type === "DB" || parent.type === "EDB") return;
    
    const children = updatedBoards.filter((b: any) => b.fedFrom === parent.id);
    if (children.length === 0) return;
    
    let newCircuits = [...parent.circuits];
    children.forEach((child: any) => {
      let childLoad = 0;
      child.circuits.forEach((c: any) => {
        const load = performCalculateCircuitLoad(c, child.type);
        childLoad += load * (c.df !== undefined ? Number(c.df) : 1);
      });
      
      const existingIdx = newCircuits.findIndex((c: any) => c.desc === child.name);
      if (existingIdx >= 0) {
        newCircuits[existingIdx].loadW = childLoad;
        newCircuits[existingIdx].qty = 1;
      } else {
        const newCirc = generateDefaultMDBCircuit(`c-${Date.now()}-${Math.random()}`, newCircuits.length);
        newCirc.desc = child.name;
        newCirc.loadW = childLoad;
        newCirc.qty = 1;
        newCircuits.push(newCirc);
      }
    });
    
    const parentIdx = updatedBoards.findIndex((b: any) => b.id === parent.id);
    if (parentIdx >= 0) {
      updatedBoards[parentIdx] = { ...updatedBoards[parentIdx], circuits: newCircuits };
    }
  });
  
  updatedBoards = updatedBoards.map((b: any) => performBalanceBoardPhases(b));
  return updatedBoards;
}
