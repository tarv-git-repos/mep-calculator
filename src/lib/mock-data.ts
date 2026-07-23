export type SpaceStatus = "complete" | "in-progress" | "warning" | "draft";

export interface Space {
  id: string;
  code: string;
  name: string;
  building: string;
  floor: string;
  zone: string;
  category: string;
  area: number;
  occupancy: number;
  freshAir: number;
  extractAir: number;
  pressure: string; // "Neutral" | "Positive" | "Negative" | "Critical"
  equipment: string;
  status: SpaceStatus;
  
  // Ported engineering attributes
  height: number;
  fixtures: string | number;
  multiplier: number;
  minOA?: number;
  minExt?: number;

  // AI occupancy matching fields
  aiDetected?: boolean;
  pressureAutoDetected?: boolean;
}

export interface Zone {
  id: string;
  name: string;
  building: string;
  floor: string;
  spaceCount: number;
  area: number;
  freshAir: number;
  extractAir: number;
  pressure: number;
  equipment: string[];
  pressureType: "positive" | "negative" | "neutral";
  multiplier?: number;
  faAssignedQty?: number;
  eaAssignedQty?: number;
  faAssignments?: Record<string, number>;
  eaAssignments?: Record<string, number>;
}

export interface Equipment {
  id: string;
  tag: string;
  type: string;
  zones: number;
  spaces: number;
  totalAirflow: number;
  capacity: number;
  utilization: number;
  status: "operational" | "design" | "warning";
}

const CATEGORIES = [
  "Office space", "Conference / meeting", "Corridors", "EX. Toilet - public (continuous)",
  "Kitchenettes", "Computer lab", "Lobbies", "Storage rooms", "Science laboratories",
];
const STATUSES: SpaceStatus[] = ["complete", "in-progress", "warning", "draft"];
const BUILDINGS = ["Tower A", "Tower B", "Tower C", "Podium"];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateSpaces(count = 1248): Space[] {
  const r = rng(42);
  const arr: Space[] = [];
  for (let i = 0; i < count; i++) {
    const building = BUILDINGS[Math.floor(r() * BUILDINGS.length)];
    const floorNum = Math.floor(r() * 24) + 1;
    const floor = `L${String(floorNum).padStart(2, "0")}`;
    const zoneIdx = Math.floor(r() * 84) + 1;
    const zone = `Z-${String(zoneIdx).padStart(3, "0")}`;
    const category = CATEGORIES[Math.floor(r() * CATEGORIES.length)];
    const area = +(20 + r() * 280).toFixed(1);
    const occupancy = Math.floor(r() * 40);
    const freshAir = Math.floor(area * (r() * 4 + 2));
    const extractAir = Math.floor(freshAir * (0.85 + r() * 0.3));
    
    const pressVal = r();
    const pressure = pressVal > 0.75 ? "Positive" : pressVal > 0.50 ? "Negative" : pressVal > 0.45 ? "Critical" : "Neutral";
    
    const status = STATUSES[Math.floor(r() * STATUSES.length)];
    arr.push({
      id: `sp-${i}`,
      code: `${building.split(" ")[1] ?? "A"}-${floor}-${String(i % 1000).padStart(3, "0")}`,
      name: `${category} ${String(i + 1).padStart(4, "0")}`,
      building,
      floor,
      zone,
      category,
      area,
      occupancy,
      freshAir,
      extractAir,
      pressure,
      equipment: `AHU-${String(Math.floor(r() * 28) + 1).padStart(2, "0")}`,
      status,
      height: 3.0,
      fixtures: "",
      multiplier: 1,
    });
  }
  return arr;
}

export function generateZones(spaces: Space[]): Zone[] {
  const map = new Map<string, Zone>();
  for (const s of spaces) {
    const z = map.get(s.zone);
    if (z) {
      z.spaceCount++;
      z.area += s.area;
      z.freshAir += s.freshAir;
      z.extractAir += s.extractAir;
      if (!z.equipment.includes(s.equipment)) z.equipment.push(s.equipment);
    } else {
      map.set(s.zone, {
        id: s.zone,
        name: s.zone,
        building: s.building,
        floor: s.floor,
        spaceCount: 1,
        area: s.area,
        freshAir: s.freshAir,
        extractAir: s.extractAir,
        pressure: 0,
        equipment: [s.equipment],
        pressureType: "neutral",
      });
    }
  }
  const zones = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  for (const z of zones) {
    const diff = z.freshAir - z.extractAir;
    z.pressure = +diff.toFixed(0);
    z.pressureType = diff > 50 ? "positive" : diff < -50 ? "negative" : "neutral";
    z.area = +z.area.toFixed(1);
  }
  return zones;
}

export function generateEquipment(spaces: Space[]): Equipment[] {
  const map = new Map<string, Equipment>();
  for (const s of spaces) {
    const e = map.get(s.equipment);
    const airflow = s.freshAir + s.extractAir;
    if (e) {
      e.spaces++;
      e.totalAirflow += airflow;
    } else {
      map.set(s.equipment, {
        id: s.equipment,
        tag: s.equipment,
        type: "Air Handling Unit",
        zones: 0,
        spaces: 1,
        totalAirflow: airflow,
        capacity: 60000,
        utilization: 0,
        status: "operational",
      });
    }
  }
  const zoneMap = new Map<string, Set<string>>();
  for (const s of spaces) {
    if (!zoneMap.has(s.equipment)) zoneMap.set(s.equipment, new Set());
    zoneMap.get(s.equipment)!.add(s.zone);
  }
  const list = Array.from(map.values());
  for (const e of list) {
    e.zones = zoneMap.get(e.tag)?.size ?? 0;
    e.utilization = Math.min(100, Math.round((e.totalAirflow / e.capacity) * 100));
    e.status = e.utilization > 92 ? "warning" : e.utilization > 0 ? "operational" : "design";
  }
  return list.sort((a, b) => a.tag.localeCompare(b.tag));
}

export const PROJECT = {
  name: "Marina Bay Tower",
  code: "MBT-2026-117",
  client: "Marina Holdings",
  spacesTotal: 1248,
  zonesTotal: 84,
  equipmentTotal: 28,
};