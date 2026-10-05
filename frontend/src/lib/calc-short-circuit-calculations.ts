export interface CableRow {
  id: string;
  description: string;
  length: number;
  runs: number;
  size: number; // mm²
  voltage: number; // V
  material: "Copper" | "Aluminium";
  remarks: string;
  flagged?: boolean;
  comments?: any[];
}

export interface RowDetail {
  id: string;
  segmentR: number;
  segmentX: number;
  segmentZ: number;
  runningSumR: number;
  runningSumX: number;
  runningSumZ: number;
  isc: number;
}

export const IEC_CABLE_SIZES = [
  1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630
];

export const STANDARD_REACTANCE_LOOKUP = (size: number): number => {
  if (size <= 16) return 0.10; // ohms/km
  if (size <= 95) return 0.09;
  if (size <= 300) return 0.08;
  return 0.075;
};


export function computeShortCircuitData(
  rows: CableRow[], 
  sourceFaultLevel: number, 
  nominalVoltage: number, 
  sourceXrRatio: number, 
  unitSystem: "si" | "ip"
) {
  const vLL = nominalVoltage || 400;
  const iScSource = sourceFaultLevel || 25;
  const xr = sourceXrRatio || 10;

  const zSource = vLL / (Math.sqrt(3) * iScSource * 1000);
  const angle = Math.atan(xr);
  const rSource = zSource * Math.cos(angle);
  const xSource = zSource * Math.sin(angle);

  let totalCableLength = 0;
  let totalR = 0;
  let totalX = 0;

  let currentSumR = rSource;
  let currentSumX = xSource;

  const rowDetails: RowDetail[] = rows.map((r) => {
    const L_input = r.length || 0;
    const L = unitSystem === "ip" ? L_input * 0.3048 : L_input;
    const N = r.runs || 1;
    const A = r.size || 1.5;
    const V = r.voltage || 400;

    const rho20 = r.material === "Copper" ? 0.01724 : 0.0282;
    const alpha = r.material === "Copper" ? 0.00393 : 0.00403;
    const rho70 = rho20 * (1 + alpha * 50);

    const segmentR = (rho70 * L) / (A * N);
    
    const xStd = STANDARD_REACTANCE_LOOKUP(A);
    const segmentX = (xStd * L) / (1000 * N);

    const segmentZ = Math.sqrt(Math.pow(segmentR, 2) + Math.pow(segmentX, 2));

    totalCableLength += L_input;
    totalR += segmentR;
    totalX += segmentX;

    currentSumR += segmentR;
    currentSumX += segmentX;

    const runningZ = Math.sqrt(Math.pow(currentSumR, 2) + Math.pow(currentSumX, 2));

    const isc = runningZ > 0 ? V / (Math.sqrt(3) * runningZ * 1000) : 0;

    return {
      id: r.id,
      segmentR,
      segmentX,
      segmentZ,
      runningSumR: currentSumR,
      runningSumX: currentSumX,
      runningSumZ: runningZ,
      isc
    };
  });

  const totalZ = Math.sqrt(Math.pow(totalR, 2) + Math.pow(totalX, 2));
  const finalIsc = rowDetails.length > 0 ? rowDetails[rowDetails.length - 1].isc : iScSource;

  return {
    rSource,
    xSource,
    zSource,
    totalCableLength,
    totalR,
    totalX,
    totalZ,
    finalIsc,
    rowDetails,
    rowDetailsMap: new Map<string, RowDetail>(rowDetails.map((d): [string, RowDetail] => [d.id, d]))
  };
}

export function computeShortCircuitValidations(
  rows: CableRow[],
  sourceFaultLevel: number,
  nominalVoltage: number,
  sourceXrRatio: number,
  calculatedData: ReturnType<typeof computeShortCircuitData>
) {
  const logs: { type: "warning" | "danger"; msg: string }[] = [];

  const zeroLength = rows.some(r => r.length <= 0);
  const zeroRuns = rows.some(r => r.runs <= 0);
  const zeroSize = rows.some(r => r.size <= 0);
  const zeroVoltage = rows.some(r => r.voltage <= 0);

  if (zeroLength) {
    logs.push({
      type: "warning",
      msg: "One or more cables have length of zero or blank."
    });
  }

  if (zeroRuns) {
    logs.push({
      type: "danger",
      msg: "Number of parallel runs must be 1 or greater."
    });
  }

  if (zeroSize) {
    logs.push({
      type: "danger",
      msg: "Cable size must be a valid cross-sectional area (mm²)."
    });
  }

  if (zeroVoltage) {
    logs.push({
      type: "danger",
      msg: "Voltage rating must be greater than zero."
    });
  }

  if (sourceFaultLevel <= 0) {
    logs.push({
      type: "danger",
      msg: "Source short circuit fault level must be greater than zero."
    });
  }

  if (nominalVoltage <= 0) {
    logs.push({
      type: "danger",
      msg: "Nominal voltage must be greater than zero."
    });
  }

  if (sourceXrRatio <= 0) {
    logs.push({
      type: "warning",
      msg: "Source X/R ratio is zero or negative. Sizing calculations might be slightly skewed."
    });
  }

  if (calculatedData.finalIsc > 100) {
    logs.push({
      type: "warning",
      msg: "Calculated fault current exceeds 100 kA. Ensure switchgear rating compliance."
    });
  } else if (calculatedData.finalIsc < 0.1) {
    logs.push({
      type: "warning",
      msg: "Calculated fault current is unusually low (less than 100 A)."
    });
  }

  return logs;
}
