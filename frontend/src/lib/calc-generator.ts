export type StarterType = "DOL" | "SD" | "Soft Starter" | "VFD" | "None";

export interface GenRow {
  id: string;
  desc: string;
  unit: number | string;
  kwPerUnit: number | string;
  starter: StarterType;
  multiplier: number | string;
  standby: number | string;
  emergency: number | string;
  powerFail: number | string;
  remark: string;
  excludeEmergency?: boolean;
  flagged?: boolean;
  comments?: any[]; // TaskComment[]
}

export function getGenRowValidation(r?: Partial<GenRow>) {
  const warnings: string[] = [];
  if (!r) return { isAutoFlagged: false, isFlagged: false, warnings: [] };

  const descEmpty = !r.desc || String(r.desc).trim() === "";
  const unitEmpty = r.unit === "" || r.unit === undefined || r.unit === null || Number(r.unit) === 0;
  const kwEmpty = r.kwPerUnit === "" || r.kwPerUnit === undefined || r.kwPerUnit === null || Number(r.kwPerUnit) === 0;

  // Don't auto-flag brand new completely blank rows
  const isCompletelyEmpty = descEmpty && unitEmpty && kwEmpty;

  if (!isCompletelyEmpty) {
    if (descEmpty) {
      warnings.push("description");
    }
    if (r.unit === "" || r.unit === undefined || r.unit === null || isNaN(Number(r.unit)) || Number(r.unit) <= 0) {
      warnings.push("unit count (0 or missing)");
    }
    if (r.kwPerUnit === "" || r.kwPerUnit === undefined || r.kwPerUnit === null || isNaN(Number(r.kwPerUnit)) || Number(r.kwPerUnit) <= 0) {
      warnings.push("kW/unit (0 or missing)");
    }
  }

  const isAutoFlagged = warnings.length > 0;
  const isFlagged = r.flagged !== undefined ? Boolean(r.flagged) : isAutoFlagged;
  return { isAutoFlagged, isFlagged, warnings };
}

export const STARTER_MULTIPLIERS: Record<StarterType, number> = {
  DOL: 7,
  SD: 3,
  "Soft Starter": 2,
  VFD: 1,
  None: 0,
};

export const STANDARD_SIZES = [
  5, 7.5, 10, 12.5, 15, 20, 25, 30, 35, 40, 45, 50, 62.5, 75, 82.5, 100,
  125, 160, 200, 250, 320, 400, 500, 625, 750, 800, 1000, 1250, 1500, 1600, 2000, 2500,
];

export const calculateGeneratorSizing = (
  rows: GenRow[],
  pf: number,
  lf: number,
  unitSystem: "si" | "ip",
  userSelectedSize: number | null,
  manualOverrides: Record<string, string>
) => {
  let totalAcl = 0;
  let totalEmergency = 0;
  let maxStartCur = 0;
  let largestMotorKw = 0;
  let largestMotorStarter = "-";

  rows.forEach((r) => {
    const rKw = Number(r.kwPerUnit) || 0;
    const rSb = Number(r.standby) || 0;
    const rEm = r.excludeEmergency ? 0 : Number(r.emergency) || 0;
    const rUnit = Number(r.unit) || 0;
    const rMult = Number(r.multiplier) || 0;

    const kwPerUnit = unitSystem === "ip" ? rKw * 0.746 : rKw;
    const standby = unitSystem === "ip" ? rSb * 0.746 : rSb;
    const emergency = unitSystem === "ip" ? rEm * 0.746 : rEm;

    const totalKw = rUnit * kwPerUnit;
    const actualKw = totalKw - standby;
    totalAcl += actualKw;
    totalEmergency += emergency;

    const startCur = kwPerUnit * 1.739 * rMult;

    if (startCur > maxStartCur) {
      maxStartCur = startCur;
    }

    if (kwPerUnit > largestMotorKw) {
      largestMotorKw = kwPerUnit;
      largestMotorStarter = r.starter;
    }
  });

  const getEffective = (key: string, computed: number) => {
    if (manualOverrides[key] !== undefined && manualOverrides[key] !== "") {
      return parseFloat(manualOverrides[key]) || 0;
    }
    return computed;
  };

  const baseAcl = getEffective("acl", unitSystem === "ip" ? totalAcl / 0.746 : totalAcl);
  const baseEm = getEffective(
    "em",
    unitSystem === "ip" ? totalEmergency / 0.746 : totalEmergency,
  );

  const aclKw = unitSystem === "ip" ? baseAcl * 0.746 : baseAcl;
  const emKw = unitSystem === "ip" ? baseEm * 0.746 : baseEm;

  const demandLoadAcl = getEffective("demandAcl", aclKw / pf);
  const demandLoadEm = getEffective("demandEm", emKw / pf);

  const calcSizeAcl = getEffective("calcAcl", demandLoadAcl / lf);
  const calcSizeEm = getEffective("calcEm", demandLoadEm / lf);

  const effectiveMaxStart = getEffective("maxStart", maxStartCur);

  const maxCalcSize = Math.max(calcSizeAcl, calcSizeEm);
  let autoSize: number;
  const matchingStandard = STANDARD_SIZES.find((size) => size >= maxCalcSize);
  if (matchingStandard) {
    autoSize = matchingStandard;
  } else if (maxCalcSize > 0) {
    autoSize = Math.ceil(maxCalcSize / 50) * 50;
  } else {
    autoSize = STANDARD_SIZES[0] || 5;
  }

  const selectedSize = userSelectedSize !== null ? userSelectedSize : autoSize;

  return {
    totalAcl: baseAcl,
    totalEmergency: baseEm,
    demandLoadAcl,
    demandLoadEm,
    calcSizeAcl,
    calcSizeEm,
    autoSize,
    selectedSize,
    maxStartCur: effectiveMaxStart,
    largestMotorKw,
    largestMotorStarter,
  };
};
