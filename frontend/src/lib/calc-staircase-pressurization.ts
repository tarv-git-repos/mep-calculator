export type DoorTypeKey = "single_leaf_into" | "single_leaf_outwards" | "double_leaf" | "lift_landing";

export interface DoorTypeDefinition {
  key: DoorTypeKey;
  name: string;
  designLeakageRate: number;
}

export const DOOR_TYPES_CONFIG: Record<DoorTypeKey, DoorTypeDefinition> = {
  single_leaf_into: { key: "single_leaf_into", name: "Single-leaf opening into space", designLeakageRate: 0.03 },
  single_leaf_outwards: { key: "single_leaf_outwards", name: "Single-leaf opening outwards", designLeakageRate: 0.06 },
  double_leaf: { key: "double_leaf", name: "Double-leaf opening", designLeakageRate: 0.10 },
  lift_landing: { key: "lift_landing", name: "Lift landing door", designLeakageRate: 0.19 },
};

export const CALCULATION_CONSTANTS = {
  EGRESS_VELOCITY: 1.0, 
  CLOSED_DOOR_SAFETY_FACTOR: 0.25,
  FINAL_SAFETY_FACTOR: 0.10,
  DEFAULT_PRESSURE_REF_PA: 12.5,
  DEFAULT_DUCT_LENGTH_M: 68,
  GRILL_LOUVER_DROP_PA: 85,
  DUCT_PRESSURE_RATE_PA_PER_M: 1.0,
};

export interface StaircaseItem {
  id: string;
  name: string;
  floor?: string;
  doorType: DoorTypeKey;
  doorArea: number | "";
  openDoorsCount: number | "";
  closedDoorsCount: number | "";
  flagged?: boolean;
  comments?: any[];
}

export function calculateStaircase(item: StaircaseItem, isIp: boolean = false) {
  const activeDoor = DOOR_TYPES_CONFIG[item.doorType] || DOOR_TYPES_CONFIG.lift_landing;
  const rawArea = Number(item.doorArea) || 0;
  const doorArea = isIp ? rawArea / 10.7639 : rawArea;
  const openDoors = Number(item.openDoorsCount) || 0;
  const closedDoors = Number(item.closedDoorsCount) || 0;

  const openFlowM3s = doorArea * CALCULATION_CONSTANTS.EGRESS_VELOCITY * openDoors;
  const closedFlowM3s = activeDoor.designLeakageRate * closedDoors;
  const closedSafetyFlowM3s = closedFlowM3s * CALCULATION_CONSTANTS.CLOSED_DOOR_SAFETY_FACTOR;
  const subTotalM3s = openFlowM3s + closedFlowM3s + closedSafetyFlowM3s;
  const finalSafetyM3s = subTotalM3s * CALCULATION_CONSTANTS.FINAL_SAFETY_FACTOR;
  
  const totalFanCapacityM3s = subTotalM3s + finalSafetyM3s;
  const totalFanCapacityLs = Math.ceil((totalFanCapacityM3s * 1000) / 5) * 5;

  const ductLoss = CALCULATION_CONSTANTS.DEFAULT_DUCT_LENGTH_M * CALCULATION_CONSTANTS.DUCT_PRESSURE_RATE_PA_PER_M;
  const combinedDrop = ductLoss + CALCULATION_CONSTANTS.GRILL_LOUVER_DROP_PA + CALCULATION_CONSTANTS.DEFAULT_PRESSURE_REF_PA;
  const safetyDrop = combinedDrop * 0.25;
  const designPressureDropPa = Math.ceil((combinedDrop + safetyDrop) / 5) * 5;

  const reliefAreaM2 = (totalFanCapacityLs / 1000) / (0.827 * Math.sqrt(CALCULATION_CONSTANTS.DEFAULT_PRESSURE_REF_PA));

  const totalFanCapacityCfm = Math.round((totalFanCapacityM3s) * 2118.88);
  const reliefAreaSqFt = reliefAreaM2 * 10.7639;
  const designPressureDropInWg = designPressureDropPa / 249.0889;

  return {
    openFlowM3s: openFlowM3s.toFixed(3),
    openFlowLs: (openFlowM3s * 1000).toFixed(1),
    closedFlowM3s: closedFlowM3s.toFixed(3),
    closedFlowLs: (closedFlowM3s * 1000).toFixed(1),
    closedSafetyFlowM3s: closedSafetyFlowM3s.toFixed(3),
    subTotalM3s: subTotalM3s.toFixed(3),
    finalSafetyM3s: finalSafetyM3s.toFixed(3),
    totalFanCapacityM3s: totalFanCapacityM3s.toFixed(3),
    totalFanCapacityLs,
    totalFanCapacityCfm,
    ductLoss: ductLoss.toFixed(1),
    combinedDrop: combinedDrop.toFixed(1),
    safetyDrop: safetyDrop.toFixed(1),
    designPressureDropPa,
    designPressureDropInWg: designPressureDropInWg.toFixed(2),
    reliefAreaM2: reliefAreaM2.toFixed(3),
    reliefAreaSqFt: reliefAreaSqFt.toFixed(2)
  };
}
