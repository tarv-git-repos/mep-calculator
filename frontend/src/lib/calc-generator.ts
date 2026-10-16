import { computeFirePumpCalculations } from "./calc-plumbing-fire-pump-duty";
import { computePumpSizingCalculations } from "./calc-plumbing-pump-sizing";
import { computeSumpPumpCalculations } from "./calc-plumbing-sump-pump";
import { computeSewagePumpCalculations } from "./calc-plumbing-sewage-pump";
import { computeSmokeExtractFanData } from "./calc-smoke-extract-fan";
import { calculateStaircase } from "./calc-staircase-pressurization";
import { calculateCentralBattery } from "./calc-central-battery";
import { computeUpsSizing } from "./calc-ups-sizing-calculation";
import { calculateSmokeFlows, calculateFanStatic } from "./calc-basement-smoke";

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

export const STANDARD_MOTOR_KW = [
  0.75, 1.1, 1.5, 2.2, 3.0, 3.7, 4.0, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250,
];

export function roundToStandardMotorKw(rawKw: number, minKw: number = 0.75): number {
  const target = Math.max(minKw, Number(rawKw) || 0);
  const found = STANDARD_MOTOR_KW.find((m) => m >= target);
  return found ?? Math.ceil(target / 10) * 10;
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

/**
 * Stage 2: AI Motor Starter & Multiplier Decision Engine
 * Determines Starter Type & Starting Current Multiplier from equipment description and kW/unit rating.
 */
export function decideStarterAndMultiplier(
  desc: string,
  kwPerUnit: number
): { starter: StarterType; multiplier: number; reason: string } {
  const text = (desc || "").toLowerCase().trim();
  const kw = Number(kwPerUnit) || 0;

  // 1. Static / Electronic Loads (Any kW) -> None (0x)
  if (
    /central\s*battery|\bcbs\b|\bups\b|lighting|luminaire|exit\s*sign|emergency\s*light|\bbms\b|\bcctv\b|security|access\s*control|fire\s*alarm|\bfapa\b|public\s*address|telecom|server|it\s*rack|static|inverter|rectifier|battery|socket|small\s*power|control\s*panel|plc/i.test(
      text
    )
  ) {
    return {
      starter: "None",
      multiplier: STARTER_MULTIPLIERS["None"],
      reason: "Static electronic / resistive load (0x starting surge)",
    };
  }

  // 2. VFD-Driven Equipment (Any kW) -> VFD (1x)
  if (
    /\blift\b|\blifts\b|elevator|escalator|travellator|\bahu\b|air\s*handling|\bfahu\b|fresh\s*air\s*handling|chilled\s*water\s*pump|chw\s*pump|secondary\s*pump|\bvfd\b|\bvsd\b|variable\s*frequency|variable\s*speed|regenerative/i.test(
      text
    )
  ) {
    return {
      starter: "VFD",
      multiplier: STARTER_MULTIPLIERS["VFD"],
      reason: "VFD soft-ramped drive (1x full-load current)",
    };
  }

  // Explicit starter mention in description
  if (/soft\s*start/i.test(text)) {
    return {
      starter: "Soft Starter",
      multiplier: STARTER_MULTIPLIERS["Soft Starter"],
      reason: "Soft Starter electronic voltage ramp (2x)",
    };
  }
  if (/star[\s-]*delta|\bsd\b/i.test(text)) {
    return {
      starter: "SD",
      multiplier: STARTER_MULTIPLIERS["SD"],
      reason: "Star-Delta reduced voltage starter (3x)",
    };
  }
  if (/\bdol\b|direct\s*on\s*line/i.test(text)) {
    return {
      starter: "DOL",
      multiplier: STARTER_MULTIPLIERS["DOL"],
      reason: "Direct On-Line starter (7x)",
    };
  }

  // 3. Main Fire Pump or Large Motors (> 37 kW) -> Soft Starter (2x)
  if (
    kw > 37 ||
    (/main\s*fire\s*pump|electric\s*fire\s*pump|sprinkler\s*pump|hydrant\s*pump/i.test(text) && (kw === 0 || kw >= 22))
  ) {
    return {
      starter: "Soft Starter",
      multiplier: STARTER_MULTIPLIERS["Soft Starter"],
      reason: "Heavy motor (> 37 kW) / Main Fire Pump Soft Starter (2x)",
    };
  }

  // 4. Medium Motors (> 7.5 to 37 kW) -> Star-Delta (3x)
  if (
    (kw > 7.5 && kw <= 37) ||
    (kw === 0 &&
      /stair|pressurization|pressurisation|smoke\s*extract|smoke\s*fan|transfer\s*pump|booster\s*pump/i.test(
        text
      ))
  ) {
    return {
      starter: "SD",
      multiplier: STARTER_MULTIPLIERS["SD"],
      reason: "Medium motor (> 7.5 to 37 kW) Star-Delta starter (3x)",
    };
  }

  // 5. Small Motors (<= 7.5 kW) -> DOL (7x)
  return {
    starter: "DOL",
    multiplier: STARTER_MULTIPLIERS["DOL"],
    reason: "Small motor (<= 7.5 kW) Direct On-Line starter (7x)",
  };
}

/**
 * Stage 3: Duty / Standby Deduction Inference
 * Detects patterns like "(1D+1S)", "2D+1S", "1W+1S", "Duty + Standby", etc. and returns the standby kW to deduct.
 */
export function inferStandbyLoad(
  desc: string,
  unit: number,
  kwPerUnit: number
): number | null {
  const text = (desc || "").toLowerCase().trim();
  const u = Number(unit) || 0;
  const kw = Number(kwPerUnit) || 0;
  if (u <= 1 || kw <= 0) return null;

  // Match explicit XD+YS or XW+YS pattern e.g. 1D+1S, 2D+1S, 1W+1S, 1W_1S
  const dsMatch = text.match(/(\d+)\s*[dw]\s*[\+_\/-]\s*(\d+)\s*s/i);
  if (dsMatch) {
    const standbyUnits = parseInt(dsMatch[2], 10);
    if (standbyUnits > 0 && standbyUnits < u) {
      return Number((standbyUnits * kw).toFixed(2));
    }
  }

  // Match "duty + standby", "duty/standby", "with standby"
  if (/duty\s*[\+&\/-]\s*standby|with\s+standby|\b1\s*standby\b/i.test(text)) {
    return Number(kw.toFixed(2));
  }

  return null;
}

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
    const rMult =
      r.multiplier !== "" && r.multiplier !== undefined && r.multiplier !== null
        ? Number(r.multiplier)
        : STARTER_MULTIPLIERS[r.starter] ?? 0;

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

    if (r.starter !== "None" && rMult > 0 && kwPerUnit > largestMotorKw) {
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

/**
 * Helper to construct a fully populated GenRow applying Stage 2 (AI Starter/Multiplier) & Stage 3 (Standby Deduction).
 */
export function buildAutomatedGenRow(
  desc: string,
  unit: number,
  kwPerUnitSi: number,
  remark: string = "",
  unitSystem: "si" | "ip" = "si",
  explicitStandbySi?: number
): GenRow {
  const { starter, multiplier } = decideStarterAndMultiplier(desc, kwPerUnitSi);
  const inferredSbSi =
    explicitStandbySi !== undefined
      ? explicitStandbySi
      : inferStandbyLoad(desc, unit, kwPerUnitSi) ?? 0;

  const toDisplayUnit = (valKw: number) =>
    unitSystem === "ip"
      ? Number((valKw / 0.746).toFixed(2))
      : Number(valKw.toFixed(2));

  const kwDisplay = toDisplayUnit(kwPerUnitSi);
  const sbDisplay = inferredSbSi > 0 ? toDisplayUnit(inferredSbSi) : 0;
  const totalDisplay = Number((unit * kwDisplay).toFixed(2));
  const aclDisplay = Number(Math.max(0, totalDisplay - sbDisplay).toFixed(2));

  return {
    id: `gen_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    desc,
    unit,
    kwPerUnit: kwDisplay,
    starter,
    multiplier,
    standby: sbDisplay,
    emergency: aclDisplay,
    powerFail: aclDisplay,
    remark,
    excludeEmergency: false,
  };
}

/**
 * Stage 1: Auto-Collect Essential & Life-Safety Loads
 * Scans all project calculators (Plumbing Fire Pump, Domestic Transfer/Booster Pump, Sump Pump, Sewage Pump,
 * Corridor & Basement Smoke Extract Fans, Staircase & Liftwell Pressurization Fans, 3D Studio/Load Summary Lifts,
 * Central Battery System, and Essential UPS) using their exact calculation engines,
 * then applies Stage 2 (AI Starter/Multiplier) & Stage 3 (Standby Deduction).
 */
export function autoCollectGeneratorLoads(
  projectId: string,
  unitSystem: "si" | "ip" = "si",
  workspaceData?: Record<string, any>
): { rows: GenRow[]; sources: string[] } {
  const pid = projectId || "default";
  const sources: string[] = [];
  const rows: GenRow[] = [];

  // ============================================================================
  // 1. ELECTRIC FIRE PUMP (1D+1S) & JOCKEY PUMP (NFPA 20)
  // ============================================================================
  let firePumpKw = 75;
  let jockeyPumpKw = 5.5;

  if (typeof window !== "undefined") {
    try {
      const fpRaw = localStorage.getItem(`mep_fire_pump_duty_calc_${pid}`);
      const fpData = fpRaw ? JSON.parse(fpRaw) : workspaceData?.fire_pump_duty?.params;
      if (fpData && (Number(fpData.fpFlow) > 0 || Number(fpData.fpPress) > 0)) {
        const fpCalc = computeFirePumpCalculations({
          fpFlow: fpData.fpFlow ?? 500,
          fpPress: fpData.fpPress ?? 100,
          fpDisch: fpData.fpDisch ?? 5,
          fpSuct: fpData.fpSuct ?? 0,
          fpEff: fpData.fpEff ?? 70,
          fpSafetyMargin: fpData.fpSafetyMargin ?? 3,
          driverType: fpData.driverType ?? "electric",
          jockeyFlowPct: fpData.jockeyFlowPct ?? 2,
          jockeyPressureMargin: fpData.jockeyPressureMargin ?? 10,
        });
        if (fpCalc.selectedMotorKw > 0) {
          firePumpKw = roundToStandardMotorKw(fpCalc.selectedMotorKw, 15);
          sources.push("Fire Pump Duty");
        }
        if (fpCalc.jockeyFlowGpm > 0 && fpCalc.jockeyCutOutPsi > 0) {
          const jpWhp = (fpCalc.jockeyFlowGpm * fpCalc.jockeyCutOutPsi) / 1714.28;
          const jpBhp = (jpWhp / 0.65) * 1.15;
          jockeyPumpKw = roundToStandardMotorKw(jpBhp * 0.7457, 2.2);
        }
      }
    } catch {}
  }
  rows.push(
    buildAutomatedGenRow("Electric Fire Pump (1D+1S)", 2, firePumpKw, "", unitSystem, firePumpKw),
    buildAutomatedGenRow("Jockey Pump", 1, jockeyPumpKw, "", unitSystem, 0)
  );

  // ============================================================================
  // 2. DOMESTIC WATER TRANSFER / BOOSTER PUMP (1D+1S)
  // ============================================================================
  let transferPumpUnits = 2;
  let transferPumpStandbyUnits = 1;
  let transferPumpKw = 11;

  if (typeof window !== "undefined") {
    try {
      const psRaw = localStorage.getItem(`mep_pump_sizing_calc_${pid}`);
      const psData = psRaw ? JSON.parse(psRaw) : workspaceData?.pump_sizing?.params;
      if (psData && (Number(psData.wsfuVal || psData.reqVolume || psData.manualFlow) > 0 || Number(psData.staticHead) > 0)) {
        const wPumps = Math.max(1, parseInt(String(psData.workingPumps ?? "1"), 10) || 1);
        const sPumps = Math.max(0, parseInt(String(psData.standbyPumps ?? "1"), 10));
        const psCalc = computePumpSizingCalculations(
          String(psData.pipeVert ?? "30"),
          String(psData.pipeHoriz ?? "50"),
          String(psData.fricFactor ?? "0.4"),
          String(psData.pumpType ?? "booster"),
          Boolean(psData.filtCarbon),
          Boolean(psData.filtMM),
          Boolean(psData.filtCuAg),
          Boolean(psData.filtSoftener),
          String(psData.staticHead ?? "4.5"),
          String(psData.presidHead ?? "1.5"),
          String(psData.suctionHead ?? "0"),
          String(psData.sfHead ?? "10"),
          String(psData.selectedHead ?? ""),
          String(psData.manualFlow ?? ""),
          String(psData.effPump ?? "70"),
          String(psData.effMotor ?? "85"),
          String(psData.wsfuVal ?? "350"),
          String(psData.reqVolume ?? "50000"),
          String(psData.fillTime ?? "2"),
          String(wPumps)
        );
        if (psCalc.motorPower > 0) {
          transferPumpKw = roundToStandardMotorKw(psCalc.motorPower, 3.7);
          transferPumpUnits = wPumps + sPumps;
          transferPumpStandbyUnits = sPumps;
          sources.push("Domestic Water Pump");
        }
      }
    } catch {}
  }
  const transferLabel =
    transferPumpStandbyUnits > 0
      ? `Transfer / Booster Water Pump (${transferPumpUnits - transferPumpStandbyUnits}D+${transferPumpStandbyUnits}S)`
      : "Transfer / Booster Water Pump";
  rows.push(
    buildAutomatedGenRow(
      transferLabel,
      transferPumpUnits,
      transferPumpKw,
      "",
      unitSystem,
      transferPumpStandbyUnits * transferPumpKw
    )
  );

  // ============================================================================
  // 3. SUBMERSIBLE SUMP / DRAINAGE PUMP (1D+1S)
  // ============================================================================
  let sumpPumpKw = 3.7;

  if (typeof window !== "undefined") {
    try {
      const spRaw =
        localStorage.getItem(`mep_sump_pump_params_${pid}`) ||
        localStorage.getItem("mep_sump_pump_params");
      const spData = spRaw ? JSON.parse(spRaw) : workspaceData?.sump_pump?.params;
      if (spData && (Number(spData.flow || spData.req || spData.pitFlow) > 0 || Number(spData.staticHead) > 0)) {
        const spCalc = computeSumpPumpCalculations(
          Number(spData.req) || 1000,
          Number(spData.time) || 1,
          Number(spData.flow) || Number(spData.pitFlow) || 5,
          Number(spData.pitFlow) || 5,
          Number(spData.pitHold) || 5,
          Number(spData.longestPipe) || 15,
          Number(spData.propSide) || 2,
          Number(spData.pipeVert) || 5,
          Number(spData.pipeHoriz) || 20,
          Number(spData.fricFactor) || 0.4,
          Number(spData.staticHead) || 5,
          Number(spData.presid) || 1,
          Number(spData.suction) || 0,
          Number(spData.sfHead) || 10,
          Number(spData.selectedHead) || "",
          Number(spData.effPump) || 70,
          Number(spData.effMotor) || 85
        );
        if (spCalc.P_motor > 0) {
          sumpPumpKw = roundToStandardMotorKw(spCalc.P_motor, 2.2);
          sources.push("Sump Pump");
        }
      }
    } catch {}
  }
  rows.push(
    buildAutomatedGenRow("Submersible Sump Pump (1D+1S)", 2, sumpPumpKw, "", unitSystem, sumpPumpKw)
  );

  // ============================================================================
  // 4. SEWAGE EJECTOR PUMP (1D+1S)
  // ============================================================================
  let sewageUnits = 2;
  let sewageStandbyUnits = 1;
  let sewagePumpKw = 5.5;

  if (typeof window !== "undefined") {
    try {
      const swRaw =
        localStorage.getItem(`mep_sewage_pump_params_${pid}`) ||
        localStorage.getItem("mep_sewage_pump_params");
      const swData = swRaw ? JSON.parse(swRaw) : workspaceData?.sewage_pump?.params;
      if (swData && (Number(swData.inflow) > 0 || Number(swData.lift) > 0)) {
        const pMode: "1W_1S" | "2W_1S" = swData.pumpCountMode === "2W_1S" ? "2W_1S" : "1W_1S";
        const swCalc = computeSewagePumpCalculations(
          Number(swData.inflow) || 50,
          Number(swData.flowMultiplier) || 2.0,
          Number(swData.cycle) || 6,
          Number(swData.starts) || 6,
          Number(swData.lift) || 25,
          Number(swData.pipeDia) || 3.0,
          Number(swData.pipeLen) || 65,
          Number(swData.fittingsHead) || 6.0,
          Number(swData.safetyFactor) || 15,
          Number(swData.basinDia) || 36,
          Number(swData.pumpEfficiency) || 60,
          Number(swData.motorEfficiency) || 85,
          pMode
        );
        if (swCalc.recommendedMotorKW > 0) {
          sewagePumpKw = roundToStandardMotorKw(swCalc.recommendedMotorKW, 2.2);
          if (pMode === "2W_1S") {
            sewageUnits = 3;
            sewageStandbyUnits = 1;
          } else {
            sewageUnits = 2;
            sewageStandbyUnits = 1;
          }
          sources.push("Sewage Pump");
        }
      }
    } catch {}
  }
  const sewageLabel =
    sewageUnits === 3 ? "Sewage Ejector Pump (2D+1S)" : "Sewage Ejector Pump (1D+1S)";
  rows.push(
    buildAutomatedGenRow(
      sewageLabel,
      sewageUnits,
      sewagePumpKw,
      "",
      unitSystem,
      sewageStandbyUnits * sewagePumpKw
    )
  );

  // ============================================================================
  // 5. CORRIDOR & BASEMENT SMOKE EXTRACT FANS
  // ============================================================================
  let smokeFanQty = 4;
  let smokeFanKw = 15;

  if (typeof window !== "undefined") {
    try {
      const seRaw = localStorage.getItem(`smoke_extract_state_${pid}`);
      const seData = seRaw ? JSON.parse(seRaw) : workspaceData?.smoke_extract_fan;
      if (seData && Number(seData.area) > 0) {
        const fq = Math.max(1, Number(seData.fanQty) || 4);
        const seCalc = computeSmokeExtractFanData(
          Number(seData.area) || 100,
          Number(seData.height) || 3,
          Number(seData.acph) || 10,
          fq,
          Number(seData.ductLength) || 20,
          Number(seData.frictionFactor) || 1.0,
          Number(seData.louverLoss) || 50,
          Number(seData.fanLoss) || 20,
          Number(seData.effMotor) || 90,
          Number(seData.effFan) || 75,
          Number(seData.numFansMotor) || fq
        );
        if (seCalc.powerEachRound > 0) {
          smokeFanQty = fq;
          smokeFanKw = roundToStandardMotorKw(seCalc.powerEachRound, 5.5);
          sources.push("Smoke Extract Fan");
        }
      }
    } catch {}
  }
  rows.push(
    buildAutomatedGenRow("Smoke Extract Fans", smokeFanQty, smokeFanKw, "", unitSystem, 0)
  );

  // Optional: Basement Smoke Extract Fans if configured in project
  if (typeof window !== "undefined") {
    try {
      const bsSystemsRaw = localStorage.getItem(`bs_fan_systems_${pid}`);
      const bsRowsRaw = localStorage.getItem(`bs_rows_${pid}`);
      const bsSystems = bsSystemsRaw
        ? JSON.parse(bsSystemsRaw)
        : workspaceData?.basement_smoke_calc?.fanSystems;
      const bsRows = bsRowsRaw
        ? JSON.parse(bsRowsRaw)
        : workspaceData?.basement_smoke_calc?.rows;

      if (Array.isArray(bsSystems) && bsSystems.length > 0 && Array.isArray(bsRows) && bsRows.length > 0) {
        let totalFlowLps = 0;
        bsRows.forEach((z: any) => {
          const flows = calculateSmokeFlows(Number(z.effArea) || 0, Number(z.height) || 3.2, false);
          totalFlowLps += flows.flow10ach;
        });
        const avgStatic =
          bsSystems.reduce((acc: number, sys: any) => {
            const st = calculateFanStatic(
              Number(sys.length) || 40,
              Number(sys.frictionFactor) || 1.0,
              Number(sys.louver) || 50,
              Number(sys.grille) || 35,
              Number(sys.sa) || 50
            );
            return acc + (st.totalStatic || 300);
          }, 0) / bsSystems.length;

        const bsQty = Math.max(2, bsSystems.length);
        const flowPerFanM3s = totalFlowLps / 1000 / bsQty;
        const rawBsKw = (flowPerFanM3s * Math.max(250, avgStatic)) / (0.75 * 0.88 * 1000);
        if (rawBsKw > 1.5) {
          const bsKw = roundToStandardMotorKw(rawBsKw, 7.5);
          rows.push(
            buildAutomatedGenRow(
              "Basement Smoke Extract Fans",
              bsQty,
              bsKw,
              "",
              unitSystem,
              0
            )
          );
          sources.push("Basement Smoke Extract");
        }
      }
    } catch {}
  }

  // ============================================================================
  // 6. STAIRCASE & LIFTWELL PRESSURIZATION FANS (BS EN 12101-6 / NFPA 92)
  // ============================================================================
  let pressFanQty = 2;
  let pressFanKw = 11;

  if (typeof window !== "undefined") {
    try {
      const stRaw = localStorage.getItem(`mep_auto_state_${pid}_/Staircase-pressurization_list`);
      const lwRaw = localStorage.getItem(`mep_auto_state_${pid}_/liftwell-pressurization_list`);
      const stList = stRaw ? JSON.parse(stRaw) : workspaceData?.staircase_pressurization?.staircases;
      const lwList = lwRaw ? JSON.parse(lwRaw) : workspaceData?.liftwell_pressurization?.liftwells;

      const combinedShafts = [
        ...(Array.isArray(stList) ? stList : []),
        ...(Array.isArray(lwList) ? lwList : []),
      ];

      if (combinedShafts.length > 0) {
        let totalPowerKw = 0;
        combinedShafts.forEach((shaft: any) => {
          const calc = calculateStaircase(shaft, false);
          const qM3s = Math.max(2.5, parseFloat(calc.totalFanCapacityM3s) || 4.5);
          const totalStaticPa = Math.max(250, (calc.designPressureDropPa || 150) + 100);
          const shaftKw = (qM3s * totalStaticPa) / (0.72 * 0.88 * 1000);
          totalPowerKw += shaftKw;
        });
        pressFanQty = combinedShafts.length;
        pressFanKw = roundToStandardMotorKw(totalPowerKw / pressFanQty, 5.5);
        sources.push("Staircase/Liftwell Pressurization");
      }
    } catch {}
  }
  rows.push(
    buildAutomatedGenRow(
      "Staircase & Liftwell Pressurization Fans",
      pressFanQty,
      pressFanKw,
      "",
      unitSystem,
      0
    )
  );

  // ============================================================================
  // 7. FIREMEN & PASSENGER LIFTS (VFD REGENERATIVE DRIVE)
  // ============================================================================
  let liftQty = 3;
  let liftKw = 22;

  if (typeof window !== "undefined") {
    try {
      const lsRaw = localStorage.getItem(`mep_load_summary_rows_${pid}`);
      const lsRows = lsRaw ? JSON.parse(lsRaw) : workspaceData?.electrical_loads;
      if (Array.isArray(lsRows)) {
        const liftRows = lsRows.filter(
          (r: any) =>
            /\blift\b|elevator/i.test(String(r.description || r.name || "")) &&
            Number(r.other || r.power || r.kw) > 3
        );
        if (liftRows.length > 0) {
          liftQty = liftRows.reduce((acc: number, r: any) => acc + (Number(r.qty) || 1), 0);
          const avgKw =
            liftRows.reduce((acc: number, r: any) => acc + (Number(r.other || r.power || r.kw) || 22), 0) /
            liftRows.length;
          liftKw = roundToStandardMotorKw(avgKw, 11);
          sources.push("Load Summary / 3D Studio");
        }
      }
    } catch {}
  }
  rows.push(
    buildAutomatedGenRow("Firemen & Passenger Lifts", liftQty, liftKw, "", unitSystem, 0)
  );

  // ============================================================================
  // 8. CENTRAL BATTERY SYSTEM (CBS) — EMERGENCY & EXIT LIGHTING
  // ============================================================================
  let cbsKw = 18;

  if (typeof window !== "undefined") {
    try {
      const cbsRaw = localStorage.getItem(`mep_central_battery_rows_${pid}`);
      const cbsRows = cbsRaw ? JSON.parse(cbsRaw) : workspaceData?.central_battery_sizing?.rows;
      if (Array.isArray(cbsRows) && cbsRows.length > 0) {
        const cbsCalc = calculateCentralBattery(cbsRows, 0.9, 0.8, 20);
        if (cbsCalc.finalRecommendedKva > 0) {
          cbsKw = Number(Math.max(2.0, cbsCalc.finalRecommendedKva * 0.8).toFixed(2));
          sources.push("Central Battery Sizing");
        }
      }
    } catch {}
  }
  rows.push(
    buildAutomatedGenRow("Central Battery System (CBS)", 1, cbsKw, "", unitSystem, 0)
  );

  // ============================================================================
  // 9. ESSENTIAL UPS SYSTEM (FIRE ALARM, BMS, ACCESS CONTROL & CCTV)
  // ============================================================================
  let upsKw = 10;

  if (typeof window !== "undefined") {
    try {
      const upsRaw = localStorage.getItem(`mep_ups_sizing_rows_${pid}`);
      const upsRows = upsRaw ? JSON.parse(upsRaw) : workspaceData?.ups_sizing?.rows;
      if (Array.isArray(upsRows) && upsRows.length > 0) {
        const upsCalc = computeUpsSizing(upsRows, 0.9, 0.8, 20);
        if (upsCalc.finalRecommendedKva > 0) {
          upsKw = Number(Math.max(3.0, upsCalc.finalRecommendedKva * 0.8).toFixed(2));
          sources.push("UPS Sizing");
        }
      }
    } catch {}
  }
  rows.push(
    buildAutomatedGenRow("Essential UPS (FAPA, BMS & Security)", 1, upsKw, "", unitSystem, 0)
  );

  if (sources.length === 0) {
    sources.push(
      "NFPA 20 Fire & Jockey Pumps",
      "Transfer, Sump & Sewage Pumps",
      "Smoke Extract & Pressurization Fans",
      "3D Studio Lifts",
      "Central Battery & Essential UPS"
    );
  }

  return { rows, sources };
}

