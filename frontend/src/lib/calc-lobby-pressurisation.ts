export interface LobbyFloor {
  id: string;
  basementLevel: string;
  zoneName: string;
  name: string;
  area: number;
  height: number;
  flagged?: boolean;
}

export interface FanSystem {
  id: string;
  name: string;
  floorIds: string[];
  fanType: "Extract" | "Makeup" | "Pressurisation";
  fanQty?: number;
  length: number;
  frictionFactor: number;
  louver: number;
  grille: number;
  sa: number;
  collapsed: boolean;
}

export interface CalculatedLobbyFloor extends LobbyFloor {
  volume: number;
  flow6ach: number;
  flowM3h: number;
}

export interface LobbyGroup {
  groupKey: string;
  groupName: string;
  groupType: "zone" | "level";
  rows: CalculatedLobbyFloor[];
  totalArea: number;
  totalVolume: number;
  subtotal6: number;
  subtotalM3h: number;
  levelCount: number;
}

export interface LobbyTotals {
  totalArea: number;
  totalVolume: number;
  total6: number;
  totalM3h: number;
  perFanCapacity: number;
  sizedCap: number;
}

export interface CalculatedLobbyFanSystem extends FanSystem {
  servedFloors: CalculatedLobbyFloor[];
  fittings: number;
  eqLen: number;
  frictionLoss: number;
  safety: number;
  totalStatic: number;
  totalFlow6: number;
  totalFlowM3h: number;
  flow6: number;
  perFanCap: number;
}

export function computeLobbyFloors(floors: LobbyFloor[], ip: boolean): CalculatedLobbyFloor[] {
  return floors.map(f => {
    const vol = f.area * f.height;
    let f6 = 0;
    let fM3h = 0;
    if (ip) {
      // CFM = Volume (cu ft) * 6 ACH / 60
      f6 = Math.ceil(vol * 6 / 60);
      fM3h = Math.round(f6 * 1.699);
    } else {
      // L/s = Volume (cu m) * 6 ACH / 3.6
      f6 = Math.ceil(vol * 6 / 3.6);
      fM3h = Math.round(f6 * 3.6);
    }
    return {
      ...f,
      volume: vol,
      flow6ach: f6,
      flowM3h: fM3h
    };
  });
}

export function computeLobbyGroups(
  filteredRows: CalculatedLobbyFloor[],
  groupByMode: "zone" | "level",
  zoneSortBy: "none" | "name" | "area",
  levelSortOrder: "asc" | "desc"
): LobbyGroup[] {
  const map = new Map<string, CalculatedLobbyFloor[]>();
  filteredRows.forEach(r => {
    const key = groupByMode === "zone"
      ? ((r.zoneName || "Lift Lobby 1").trim() || "Lift Lobby 1")
      : ((r.basementLevel || "Level 1").trim() || "Level 1");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  });

  const result: LobbyGroup[] = [];

  map.forEach((rows, key) => {
    let sortedRows = [...rows];
    if (zoneSortBy === "name") {
      sortedRows.sort((a, b) => (a.name).localeCompare(b.name, undefined, { numeric: true }));
    } else if (zoneSortBy === "area") {
      sortedRows.sort((a, b) => b.area - a.area);
    } else {
      sortedRows.sort((a, b) => {
        const fieldA = groupByMode === "zone" ? a.basementLevel : a.zoneName;
        const fieldB = groupByMode === "zone" ? b.basementLevel : b.zoneName;
        return fieldA.localeCompare(fieldB, undefined, { numeric: true });
      });
    }

    const totalArea = sortedRows.reduce((a, b) => a + b.area, 0);
    const totalVolume = sortedRows.reduce((a, b) => a + b.volume, 0);
    const subtotal6 = sortedRows.reduce((a, b) => a + b.flow6ach, 0);
    const subtotalM3h = sortedRows.reduce((a, b) => a + b.flowM3h, 0);
    const distinctLevels = new Set(sortedRows.map(r => r.basementLevel)).size;

    result.push({
      groupKey: key,
      groupName: key,
      groupType: groupByMode,
      rows: sortedRows,
      totalArea,
      totalVolume,
      subtotal6,
      subtotalM3h,
      levelCount: distinctLevels
    });
  });

  result.sort((a, b) => {
    const matchA = a.groupName.match(/(\d+)/);
    const matchB = b.groupName.match(/(\d+)/);
    const numA = matchA ? parseInt(matchA[1], 10) : 999;
    const numB = matchB ? parseInt(matchB[1], 10) : 999;
    let diff = 0;
    if (numA !== numB) {
      diff = numA - numB;
    } else {
      diff = a.groupName.localeCompare(b.groupName, undefined, { numeric: true, sensitivity: 'base' });
    }
    return levelSortOrder === "asc" ? diff : -diff;
  });

  return result;
}

export function computeLobbyTotals(calculatedRows: CalculatedLobbyFloor[], totalFans: number): LobbyTotals {
  const totalArea = calculatedRows.reduce((a, b) => a + b.area, 0);
  const totalVolume = calculatedRows.reduce((a, b) => a + b.volume, 0);
  const total6 = calculatedRows.reduce((a, b) => a + b.flow6ach, 0);
  const totalM3h = calculatedRows.reduce((a, b) => a + b.flowM3h, 0);

  const perFanCapacity = Math.ceil(total6 / (totalFans || 1));

  return {
    totalArea,
    totalVolume,
    total6,
    totalM3h,
    perFanCapacity,
    sizedCap: total6
  };
}

export function computeLobbyFanSystems(fanSystems: FanSystem[], calculatedRows: CalculatedLobbyFloor[]): CalculatedLobbyFanSystem[] {
  return fanSystems.map(fs => {
    const fittings = fs.length * 0.6;
    const eqLen = fs.length + fittings;
    const frictionLoss = eqLen * fs.frictionFactor;
    const safety = (frictionLoss + fs.louver + fs.grille + fs.sa) * 0.10;
    const totalStatic = Math.round((frictionLoss + fs.louver + fs.grille + fs.sa + safety) / 10) * 10;

    const servedFloors = calculatedRows.filter(r => fs.floorIds.includes(r.id));
    
    const totalFlow6 = servedFloors.reduce((a, b) => a + b.flow6ach, 0);
    const totalFlowM3h = servedFloors.reduce((a, b) => a + b.flowM3h, 0);
    const perFanCap = Math.ceil(totalFlow6 / (fs.fanQty || 1));

    return {
      ...fs,
      servedFloors,
      fittings,
      eqLen,
      frictionLoss,
      safety,
      totalStatic,
      totalFlow6,
      totalFlowM3h,
      flow6: totalFlow6,
      perFanCap
    };
  });
}
