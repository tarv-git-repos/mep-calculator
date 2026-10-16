/**
 * Intelligent Facility-to-Room Area Validation Module
 * 
 * Provides an area-based facility capacity screening system for the Ventilation Calculator.
 * Estimates spatial planning area requirements for sanitary and changing facilities
 * and detects implausible combinations (e.g., spatial requirements exceeding room floor area).
 * 
 * NOTE: These planning allowances are preliminary spatial screening assumptions,
 * not verified regulatory minimums or proof of Dubai Building Code compliance.
 * This validation is purely non-blocking and does not alter ventilation airflow calculations.
 */

import type { Space } from "./ventilation-calc";

/**
 * Configuration for an individual facility or position planning allowance.
 */
export interface FacilityAllowanceConfig {
  key: string;
  name: string;
  allowanceM2: number; // m² per physical unit or position
  unitLabel: string;
  description: string;
}

/**
 * Centralized catalogue for estimated planning-area allowances per physical facility.
 * Initial engineering estimates:
 * - Private WC, compact arrangement: 1.75 m²/unit
 * - Public WC cubicle: 2.15 m²/unit
 * - Shower position: 1.85 m²/unit
 * - Janitor/service room: 2.25 m²/unit
 * - Changing position: 2.00 m²/position
 * - Locker position: 1.40 m²/locker position
 */
export interface FacilityAreaCatalogue {
  toiletPrivate: FacilityAllowanceConfig;
  toiletPublic: FacilityAllowanceConfig;
  shower: FacilityAllowanceConfig;
  janitorCloset: FacilityAllowanceConfig;
  changingPosition: FacilityAllowanceConfig;
  lockerPosition: FacilityAllowanceConfig;
}

export const DEFAULT_FACILITY_AREA_CATALOGUE: FacilityAreaCatalogue = {
  toiletPrivate: {
    key: "toiletPrivate",
    name: "Private WC, compact arrangement",
    allowanceM2: 1.75,
    unitLabel: "m²/unit",
    description: "Preliminary spatial planning allowance for compact private WC cubicle",
  },
  toiletPublic: {
    key: "toiletPublic",
    name: "Public WC cubicle",
    allowanceM2: 2.15,
    unitLabel: "m²/unit",
    description: "Preliminary spatial planning allowance for public WC cubicle",
  },
  shower: {
    key: "shower",
    name: "Shower position",
    allowanceM2: 1.85,
    unitLabel: "m²/unit",
    description: "Preliminary spatial planning allowance for shower position",
  },
  janitorCloset: {
    key: "janitorCloset",
    name: "Janitor/service room",
    allowanceM2: 2.25,
    unitLabel: "m²/unit",
    description: "Preliminary spatial planning allowance for janitor closet / service room",
  },
  changingPosition: {
    key: "changingPosition",
    name: "Changing position",
    allowanceM2: 2.00,
    unitLabel: "m²/position",
    description: "Preliminary spatial planning allowance per changing position",
  },
  lockerPosition: {
    key: "lockerPosition",
    name: "Locker position",
    allowanceM2: 1.40,
    unitLabel: "m²/locker position",
    description: "Preliminary spatial planning allowance per locker position",
  },
};

/**
 * Breakdown of a facility's contribution to estimated room area.
 */
export interface FacilityBreakdownItem {
  facilityKey: keyof FacilityAreaCatalogue | string;
  facilityName: string;
  physicalCount: number;
  continuousCount?: number;
  discontinuousCount?: number;
  isContinuousDiscontinuousMerged?: boolean;
  allowanceM2: number;
  totalAreaM2: number;
  shareOfRequiredPercent: number;
}

export interface ValidationIssue {
  code: "AREA_CAPACITY_EXCEEDED" | "INVALID_ROOM_AREA" | "UNKNOWN_FACILITY" | "NO_FACILITIES";
  severity: "warning" | "info" | "error";
  message: string;
}

export interface FacilityValidationOptions {
  catalogue?: FacilityAreaCatalogue;
  /**
   * Classification handling for continuous and discontinuous entries:
   * - 'alternative_max' (default): Continuous & discontinuous rows for the same fixture type
   *   are treated as alternative ventilation ratings of the same installed fixtures (i.e. physicalCount = max(cont, discont)).
   * - 'additive': Continuous & discontinuous rows represent genuinely separate physical fixtures (i.e. physicalCount = cont + discont).
   */
  classificationMode?: "alternative_max" | "additive";
  /**
   * Unit of the provided room area. If 'ft2', will be normalized to m² (1 ft² = 0.09290304 m²).
   */
  unit?: "m2" | "ft2";
  /**
   * Numerical comparison tolerance to prevent floating-point inaccuracies. Default 0.001 m².
   */
  tolerance?: number;
}

export interface FacilityCapacityValidationResult {
  status: "over_capacity" | "valid" | "no_facilities" | "invalid_area";
  hasWarning: boolean;
  availableArea: number; // in requested unit (or m²)
  availableAreaM2: number;
  estimatedRequiredArea: number; // in m²
  excessArea: number; // in m² (0 if not exceeded)
  utilizationPercent: number; // rounded percentage (0 if area invalid)
  issues: ValidationIssue[];
  breakdown: FacilityBreakdownItem[];
  tooltipText: string;
  summaryTitle: string;
}

const SQFT_TO_SQM = 0.09290304;

/**
 * Pure function to validate a space's facility capacity against its room area.
 * 
 * Does NOT mutate input space, facility configuration, or airflow calculations.
 */
export function validateSpaceFacilityCapacity(
  space: Partial<Space> | null | undefined,
  facilityAreaConfig: FacilityAreaCatalogue = DEFAULT_FACILITY_AREA_CATALOGUE,
  options?: FacilityValidationOptions
): FacilityCapacityValidationResult {
  const catalogue = options?.catalogue || facilityAreaConfig || DEFAULT_FACILITY_AREA_CATALOGUE;
  const classificationMode = options?.classificationMode ?? "alternative_max";
  const unit = options?.unit ?? "m2";
  const tolerance = options?.tolerance ?? 0.001;

  // 1. Safe extraction and normalization of room floor area
  const rawArea = space?.area;
  const numericArea = typeof rawArea === "number" ? rawArea : parseFloat(String(rawArea ?? ""));

  const isInvalidArea = isNaN(numericArea) || numericArea <= 0;
  const availableAreaM2 = isInvalidArea ? 0 : unit === "ft2" ? numericArea * SQFT_TO_SQM : numericArea;
  const availableAreaDisplay = isInvalidArea ? 0 : numericArea;

  // 2. Read facility quantities from space subcategories or physical fixture counts
  const sub = space?.restroomSubCategories || {};

  const toiletPrivateCont = Math.max(0, parseInt(String(sub.toiletPrivateContinuous || 0)) || 0);
  const toiletPrivateDiscont = Math.max(0, parseInt(String(sub.toiletPrivateDiscontinuous || 0)) || 0);

  const toiletPublicCont = Math.max(0, parseInt(String(sub.toiletPublicContinuous || 0)) || 0);
  const toiletPublicDiscont = Math.max(0, parseInt(String(sub.toiletPublicDiscontinuous || 0)) || 0);

  const showerCont = Math.max(0, parseInt(String(sub.showerContinuous || 0)) || 0);
  const showerDiscont = Math.max(0, parseInt(String(sub.showerDiscontinuous || 0)) || 0);

  const janitorQty = Math.max(0, parseInt(String(sub.janitorCloset || 0)) || 0);
  
  // Changing positions can be in changingPositions or changingRoom
  const changingQty = Math.max(
    0,
    parseInt(String((sub as any).changingPositions ?? (sub as any).changingRoom ?? (sub as any).changing ?? 0)) || 0
  );

  // Locker positions can be in lockerRoom or lockerPositions
  const lockerQty = Math.max(
    0,
    parseInt(String((sub as any).lockerPositions ?? (sub as any).lockers ?? sub.lockerRoom ?? 0)) || 0
  );

  // 3. Resolve physical counts handling continuous and discontinuous classifications
  let physicalToiletPrivate = 0;
  let toiletPrivateMerged = false;
  if (classificationMode === "alternative_max") {
    physicalToiletPrivate = Math.max(toiletPrivateCont, toiletPrivateDiscont);
    toiletPrivateMerged = toiletPrivateCont > 0 && toiletPrivateDiscont > 0;
  } else {
    physicalToiletPrivate = toiletPrivateCont + toiletPrivateDiscont;
  }

  let physicalToiletPublic = 0;
  let toiletPublicMerged = false;
  if (classificationMode === "alternative_max") {
    physicalToiletPublic = Math.max(toiletPublicCont, toiletPublicDiscont);
    toiletPublicMerged = toiletPublicCont > 0 && toiletPublicDiscont > 0;
  } else {
    physicalToiletPublic = toiletPublicCont + toiletPublicDiscont;
  }

  let physicalShower = 0;
  let showerMerged = false;
  if (classificationMode === "alternative_max") {
    physicalShower = Math.max(showerCont, showerDiscont);
    showerMerged = showerCont > 0 && showerDiscont > 0;
  } else {
    physicalShower = showerCont + showerDiscont;
  }

  // 4. Estimate required spatial area from configured allowances
  const rawBreakdown: Omit<FacilityBreakdownItem, "shareOfRequiredPercent">[] = [];

  if (physicalToiletPrivate > 0) {
    const allowance = catalogue.toiletPrivate.allowanceM2;
    rawBreakdown.push({
      facilityKey: "toiletPrivate",
      facilityName: catalogue.toiletPrivate.name,
      physicalCount: physicalToiletPrivate,
      continuousCount: toiletPrivateCont,
      discontinuousCount: toiletPrivateDiscont,
      isContinuousDiscontinuousMerged: toiletPrivateMerged,
      allowanceM2: allowance,
      totalAreaM2: physicalToiletPrivate * allowance,
    });
  }

  if (physicalToiletPublic > 0) {
    const allowance = catalogue.toiletPublic.allowanceM2;
    rawBreakdown.push({
      facilityKey: "toiletPublic",
      facilityName: catalogue.toiletPublic.name,
      physicalCount: physicalToiletPublic,
      continuousCount: toiletPublicCont,
      discontinuousCount: toiletPublicDiscont,
      isContinuousDiscontinuousMerged: toiletPublicMerged,
      allowanceM2: allowance,
      totalAreaM2: physicalToiletPublic * allowance,
    });
  }

  if (physicalShower > 0) {
    const allowance = catalogue.shower.allowanceM2;
    rawBreakdown.push({
      facilityKey: "shower",
      facilityName: catalogue.shower.name,
      physicalCount: physicalShower,
      continuousCount: showerCont,
      discontinuousCount: showerDiscont,
      isContinuousDiscontinuousMerged: showerMerged,
      allowanceM2: allowance,
      totalAreaM2: physicalShower * allowance,
    });
  }

  if (janitorQty > 0) {
    const allowance = catalogue.janitorCloset.allowanceM2;
    rawBreakdown.push({
      facilityKey: "janitorCloset",
      facilityName: catalogue.janitorCloset.name,
      physicalCount: janitorQty,
      allowanceM2: allowance,
      totalAreaM2: janitorQty * allowance,
    });
  }

  if (changingQty > 0) {
    const allowance = catalogue.changingPosition.allowanceM2;
    rawBreakdown.push({
      facilityKey: "changingPosition",
      facilityName: catalogue.changingPosition.name,
      physicalCount: changingQty,
      allowanceM2: allowance,
      totalAreaM2: changingQty * allowance,
    });
  }

  if (lockerQty > 0) {
    const allowance = catalogue.lockerPosition.allowanceM2;
    rawBreakdown.push({
      facilityKey: "lockerPosition",
      facilityName: catalogue.lockerPosition.name,
      physicalCount: lockerQty,
      allowanceM2: allowance,
      totalAreaM2: lockerQty * allowance,
    });
  }

  const estimatedRequiredArea = rawBreakdown.reduce((sum, item) => sum + item.totalAreaM2, 0);

  // Complete breakdown with percentage share
  const breakdown: FacilityBreakdownItem[] = rawBreakdown.map((item) => ({
    ...item,
    shareOfRequiredPercent: estimatedRequiredArea > 0 ? Math.round((item.totalAreaM2 / estimatedRequiredArea) * 100) : 0,
  }));

  // 5. Handle zero facilities or invalid room area states
  if (breakdown.length === 0) {
    return {
      status: "no_facilities",
      hasWarning: false,
      availableArea: availableAreaDisplay,
      availableAreaM2,
      estimatedRequiredArea: 0,
      excessArea: 0,
      utilizationPercent: 0,
      issues: [],
      breakdown: [],
      tooltipText: "No facilities configured for spatial capacity validation.",
      summaryTitle: "Facility capacity valid",
    };
  }

  if (isInvalidArea) {
    return {
      status: "invalid_area",
      hasWarning: false, // Rule: If available area is unknown or invalid, do not falsely report that the room exceeds capacity
      availableArea: 0,
      availableAreaM2: 0,
      estimatedRequiredArea: roundToTwo(estimatedRequiredArea),
      excessArea: 0,
      utilizationPercent: 0,
      issues: [
        {
          code: "INVALID_ROOM_AREA",
          severity: "info",
          message: "Available room area is missing, zero, or invalid. Spatial capacity cannot be computed.",
        },
      ],
      breakdown,
      tooltipText: `Facility capacity check: Room area is missing or invalid. Estimated required area for configured facilities is ${roundToTwo(estimatedRequiredArea)} m².`,
      summaryTitle: "Invalid room area",
    };
  }

  // 6. Calculate utilization and check excess
  const utilizationRatio = estimatedRequiredArea / availableAreaM2;
  const utilizationPercent = Math.round(utilizationRatio * 100);
  const excessAreaM2 = Math.max(0, estimatedRequiredArea - availableAreaM2);
  const isOverCapacity = estimatedRequiredArea - availableAreaM2 > tolerance;

  if (isOverCapacity) {
    const excessDisplay = unit === "ft2" ? excessAreaM2 / SQFT_TO_SQM : excessAreaM2;
    const unitSymbol = unit === "ft2" ? "ft²" : "m²";

    const lines: string[] = [
      "Facility capacity warning\n",
      `Available area: ${availableAreaDisplay.toFixed(2)} ${unitSymbol}`,
      `Estimated required area: ${roundToTwo(unit === "ft2" ? estimatedRequiredArea / SQFT_TO_SQM : estimatedRequiredArea).toFixed(2)} ${unitSymbol}`,
      `Estimated excess: ${roundToTwo(excessDisplay).toFixed(2)} ${unitSymbol}`,
      `Estimated utilization: ${utilizationPercent}%\n`,
      "The selected facilities may exceed the available room area.",
    ];

    return {
      status: "over_capacity",
      hasWarning: true,
      availableArea: roundToTwo(availableAreaDisplay),
      availableAreaM2: roundToTwo(availableAreaM2),
      estimatedRequiredArea: roundToTwo(estimatedRequiredArea),
      excessArea: roundToTwo(excessAreaM2),
      utilizationPercent,
      issues: [
        {
          code: "AREA_CAPACITY_EXCEEDED",
          severity: "warning",
          message: "The selected facilities may exceed the available room area. Review facility quantities and spatial requirements.",
        },
      ],
      breakdown,
      tooltipText: lines.join("\n"),
      summaryTitle: "Facility capacity warning",
    };
  }

  return {
    status: "valid",
    hasWarning: false,
    availableArea: roundToTwo(availableAreaDisplay),
    availableAreaM2: roundToTwo(availableAreaM2),
    estimatedRequiredArea: roundToTwo(estimatedRequiredArea),
    excessArea: 0,
    utilizationPercent,
    issues: [],
    breakdown,
    tooltipText: `Facility capacity normal: ${utilizationPercent}% utilization (${roundToTwo(estimatedRequiredArea)} m² used of ${roundToTwo(availableAreaM2)} m²).`,
    summaryTitle: "Facility capacity normal",
  };
}

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
