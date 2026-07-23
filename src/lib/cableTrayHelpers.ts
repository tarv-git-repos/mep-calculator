export interface Cable {
  id: string;
  type: string;
  from?: string;
  to?: string;
  cores: string;
  size: string;
  qty: number | "";
  customOd?: number | string;
}

export interface Tray {
  id: string;
  name: string;
  spareCapacity?: number | string;
  spacingFactor?: number | string;
  cables: Cable[];
}

export const TRAY_RANGES = [
  { limit: 0, size: "100" }, { limit: 101, size: "150" }, { limit: 151, size: "225" }, { limit: 226, size: "300" },
  { limit: 301, size: "450" }, { limit: 451, size: "600" }, { limit: 601, size: "750" }, { limit: 751, size: "900" },
  { limit: 901, size: "1 X 600, 1 X 450" }, { limit: 1051, size: "2 X 600" }, { limit: 1201, size: "1 X 900, 1 X 600" },
  { limit: 1501, size: "2 X 900" }, { limit: 1801, size: "2 X 900, 1 X 300" }, { limit: 2101, size: "2 X 900, 1 X 600" },
  { limit: 2401, size: "2 X 900, 1 X 750" }, { limit: 2701, size: "3 X 900, 1 X 300" }, { limit: 3001, size: "4 X 900" },
  { limit: 3601, size: "5 X 900" }, { limit: 4500, size: "5 X 900" }
];

export function getCableTraySize(w: number) {
  if (w <= 0 || isNaN(w)) return 'N/A';
  let matched = TRAY_RANGES[0];
  for (let i = 0; i < TRAY_RANGES.length; i++) {
    if (TRAY_RANGES[i].limit <= w) {
      matched = TRAY_RANGES[i];
    }
  }
  return matched.size;
}
