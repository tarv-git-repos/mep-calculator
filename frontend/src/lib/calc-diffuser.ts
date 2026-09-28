export type DiffuserType = "square" | "round" | "slot16" | "slot20" | "slot25";

export interface DiffuserSize {
  size: string;
  maxFlow_20?: number;
  maxFlow_25?: number;
  maxFlow?: number;
  throw: number;
  nc: number;
}

export interface DiffuserRowItem {
  id: string;
  name: string;
  floor: string;
  zone: string;
  coolingKw?: number | ""; // Q in kW from Preliminary Cooling Load
  deltaT?: number | "";    // Delta T in Â°C or Â°F
  airflow: number | "";   // Flow in L/s or CFM
  count: number | "";
  diffType: DiffuserType;
  designVelocity: number; // 2.0 or 2.5 m/s
  comments?: any[];
  flagged?: boolean;
}

export const DIFFUSER_NAMES: Record<DiffuserType, string> = {
  square: "4-Way Square Ceiling Diffuser",
  round: "Circular Cone Diffuser",
  slot16: "Linear Slot Diffuser (16mm)",
  slot20: "Linear Slot Diffuser (20mm)",
  slot25: "Linear Slot Diffuser (25mm)"
};

export const DIFFUSER_DATA: Record<DiffuserType, DiffuserSize[]> = {
  square: [
    { size: "150x150 mm (6\"x6\")", maxFlow_20: 95, maxFlow_25: 116, throw: 8, nc: 20 },
    { size: "225x225 mm (9\"x9\")", maxFlow_20: 212, maxFlow_25: 275, throw: 12, nc: 25 },
    { size: "300x300 mm (12\"x12\")", maxFlow_20: 392, maxFlow_25: 487, throw: 16, nc: 30 },
    { size: "375x375 mm (15\"x15\")", maxFlow_20: 614, maxFlow_25: 667, throw: 20, nc: 35 },
    { size: "450x450 mm (18\"x18\")", maxFlow_20: 826, maxFlow_25: 826, throw: 24, nc: 40 },
    { size: "525x525 mm (21\"x21\")", maxFlow_20: 1038, maxFlow_25: 1038, throw: 28, nc: 45 },
    { size: "600x600 mm (24\"x24\")", maxFlow_20: 1239, maxFlow_25: 1239, throw: 32, nc: 50 }
  ],
  round: [
    { size: "Ã˜250 mm (Ã˜10\")", maxFlow_20: 38, maxFlow_25: 47, throw: 8, nc: 20 },
    { size: "Ã˜307 mm (Ã˜12\")", maxFlow_20: 66, maxFlow_25: 83, throw: 10, nc: 22 },
    { size: "Ã˜366 mm (Ã˜14\")", maxFlow_20: 105, maxFlow_25: 132, throw: 12, nc: 24 },
    { size: "Ã˜424 mm (Ã˜16\")", maxFlow_20: 167, maxFlow_25: 210, throw: 15, nc: 26 },
    { size: "Ã˜483 mm (Ã˜18\")", maxFlow_20: 216, maxFlow_25: 271, throw: 18, nc: 28 },
    { size: "Ã˜541 mm (Ã˜20\")", maxFlow_20: 274, maxFlow_25: 345, throw: 20, nc: 30 },
    { size: "Ã˜600 mm (Ã˜24\")", maxFlow_20: 344, maxFlow_25: 432, throw: 22, nc: 32 }
  ],
  slot16: [
    { size: "1 Slot (16mm)", maxFlow: 45, throw: 6, nc: 20 },
    { size: "2 Slot (16mm)", maxFlow: 65, throw: 8, nc: 22 },
    { size: "3 Slot (16mm)", maxFlow: 100, throw: 10, nc: 24 },
    { size: "4 Slot (16mm)", maxFlow: 125, throw: 12, nc: 26 }
  ],
  slot20: [
    { size: "1 Slot (20mm)", maxFlow: 50, throw: 6, nc: 20 },
    { size: "2 Slot (20mm)", maxFlow: 75, throw: 8, nc: 22 },
    { size: "3 Slot (20mm)", maxFlow: 110, throw: 10, nc: 24 },
    { size: "4 Slot (20mm)", maxFlow: 130, throw: 12, nc: 26 }
  ],
  slot25: [
    { size: "1 Slot (25mm)", maxFlow: 55, throw: 6, nc: 20 },
    { size: "2 Slot (25mm)", maxFlow: 85, throw: 8, nc: 22 },
    { size: "3 Slot (25mm)", maxFlow: 125, throw: 10, nc: 24 },
    { size: "4 Slot (25mm)", maxFlow: 150, throw: 12, nc: 26 }
  ]
};

// Specific Heat Capacity (cp) lookup table at different temperatures for water (in kJ/kgÂ·K)
export function getCpWater(tempC: number): number {
  if (tempC <= 0) return 4.217;
  if (tempC >= 100) return 4.216;
  if (tempC <= 20) return 4.217 + ((4.186 - 4.217) / 20) * tempC;
  if (tempC <= 40) return 4.186 + ((4.179 - 4.186) / 20) * (tempC - 20);
  if (tempC <= 60) return 4.179 + ((4.184 - 4.179) / 20) * (tempC - 40);
  if (tempC <= 80) return 4.184 + ((4.196 - 4.184) / 20) * (tempC - 60);
  return 4.196 + ((4.216 - 4.196) / 20) * (tempC - 80);
}

// Compute flow rate from Q = m * Cp * Delta_T
export function computeAirflowFromKw(
  coolingKw: number,
  deltaT: number, // in Â°C (or Â°F if isIP)
  isIP: boolean = false,
  fluidType: "air" | "water" = "air",
  tempC: number = 20
): { massFlowKgS: number; flowRate: number } {
  if (coolingKw <= 0 || deltaT <= 0) return { massFlowKgS: 0, flowRate: 0 };

  if (fluidType === "air") {
    const dtMetric = isIP ? deltaT / 1.8 : deltaT;
    const mDot = coolingKw / (1.005 * dtMetric);
    const flowLps = (mDot / 1.204) * 1000;
    const flowFinal = isIP ? flowLps * 2.1189 : flowLps;
    return { massFlowKgS: mDot, flowRate: Math.round(flowFinal * 10) / 10 };
  } else {
    const dtMetric = isIP ? deltaT / 1.8 : deltaT;
    const cp = getCpWater(tempC);
    const mDot = coolingKw / (cp * dtMetric);
    const flowLps = mDot;
    const flowFinal = isIP ? (flowLps * 60) / 3.78541 : flowLps;
    return { massFlowKgS: mDot, flowRate: Math.round(flowFinal * 100) / 100 };
  }
}

// Sizing calculation engine for a single row
export const computeRowSizing = (row: DiffuserRowItem, ip: boolean) => {
  const flowVal = row.airflow !== "" ? Number(row.airflow) : 0;
  const countVal = row.count !== "" && Number(row.count) > 0 ? Number(row.count) : 1;
  const flowLps = ip ? flowVal / 2.1189 : flowVal;
  const flowPerDiffLps = flowLps / countVal;
  const flowPerDiffDisplay = ip ? flowPerDiffLps * 2.1189 : flowPerDiffLps;

  const flowKey = row.designVelocity === 2.5 ? "maxFlow_25" : "maxFlow_20";
  const options = DIFFUSER_DATA[row.diffType] || DIFFUSER_DATA.square;

  let selected: DiffuserSize | null = null;
  for (let i = 0; i < options.length; i++) {
    let maxFlow = 0;
    if (row.diffType === "square" || row.diffType === "round") {
      maxFlow = (options[i] as any)[flowKey] || 0;
    } else {
      maxFlow = options[i].maxFlow || 0;
    }
    if (flowPerDiffLps <= maxFlow) {
      selected = options[i];
      break;
    }
  }

  if (!selected) {
    if (row.diffType === "slot16" || row.diffType === "slot20" || row.diffType === "slot25") {
      return {
        flowPerDiff: flowPerDiffDisplay,
        neckSize: "Capacity Exceeded",
        velocity: row.designVelocity,
        velocityFpm: row.designVelocity * 196.85,
        throwVal: "-",
        nc: "NC > 35",
        adpi: "Exceeds Slot Limit",
        isExceeded: true,
        status: "FAIL"
      };
    }
    selected = options[options.length - 1];
  }

  const velocityFpm = row.designVelocity * 196.85;
  let adpi = "Good Selection (ADPI â‰¥ 80%)";
  let status = "PASS";
  if (velocityFpm > 600) {
    adpi = "High velocity - draft risk";
    status = "WARN";
  } else if (velocityFpm < 250) {
    adpi = "Low velocity - stagnation risk";
    status = "WARN";
  }

  const throwDisplay = ip ? `${selected.throw.toFixed(1)} ft` : `${(selected.throw * 0.3048).toFixed(1)} m`;

  return {
    flowPerDiff: flowPerDiffDisplay,
    neckSize: selected.size,
    velocity: row.designVelocity,
    velocityFpm,
    throwVal: throwDisplay,
    nc: `NC-${selected.nc}`,
    adpi,
    isExceeded: false,
    status
  };
};

export const calculateComputedRows = (rows: DiffuserRowItem[], ip: boolean) => {
  return rows.map(r => ({
    ...r,
    sizing: computeRowSizing(r, ip)
  }));
};
