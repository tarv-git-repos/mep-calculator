import { type CalculationPreviewData, type CalculationStep } from "@/components/calculator-framework/CalculationPreviewModal";
import type { TaskComment } from "@/lib/ventilation-calc";

export interface LoadRow {
  id: string;
  description: string;
  qty: number;
  area: number;
  lighting: number;
  power: number;
  hvac: number;
  other: number;
  totalLoad: number;
  remarks: string;
  flagged?: boolean;
  comments?: TaskComment[];
}

export const computeRowOutputs = (row: LoadRow): LoadRow => {
  const qty = row.qty || 0;
  const lighting = row.lighting || 0;
  const power = row.power || 0;
  const hvac = row.hvac || 0;
  const other = row.other || 0;

  let totalLoad = 0;
  if (qty > 0) {
    totalLoad = qty * (lighting + power + hvac + other);
  } else {
    totalLoad = lighting + power + hvac + other;
  }

  return { ...row, totalLoad: Number(totalLoad.toFixed(2)) };
};

export const getCalculationPreview = (row: LoadRow, unitSystem: "si" | "ip", totalPower: number): CalculationPreviewData => {
  const qty = Number(row.qty) || 1;
  const area = Number(row.area) || 0;
  const lighting = Number(row.lighting) || 0;
  const power = Number(row.power) || 0;
  const hvac = Number(row.hvac) || 0;
  const other = Number(row.other) || 0;
  const unitLoad = lighting + power + hvac + other;
  const totalLoad = row.totalLoad || (qty > 0 ? qty * unitLoad : unitLoad);
  const areaUnit = unitSystem === "ip" ? "sq.ft" : "sq.m";
  const densityUnit = unitSystem === "ip" ? "W/sq.ft" : "W/m²";
  const powerDensity = area > 0 ? (totalLoad * 1000) / area : 0;
  const projectShare = totalPower > 0 ? (totalLoad / totalPower) * 100 : 0;
  const totalWithSafety = totalLoad * 1.1;

  const steps: CalculationStep[] = [
    {
      stepNumber: 1,
      label: "Sub-Loads Summation (Unit Power Demand)",
      formula: "P_unit = P_lighting + P_power + P_hvac + P_other",
      substitution: `${lighting} kW + ${power} kW + ${hvac} kW + ${other} kW`,
      result: `${unitLoad.toFixed(2)} kW`,
      status: "pass",
      description: "Direct summation of all connected branch loads for a single unit of this space.",
    },
    {
      stepNumber: 2,
      label: "Total Connected Load (with Quantity Multiplier)",
      formula: qty > 0 ? "P_total = Qty × P_unit" : "P_total = P_unit",
      substitution: qty > 0 ? `${qty} × ${unitLoad.toFixed(2)} kW` : `${unitLoad.toFixed(2)} kW`,
      result: `${totalLoad.toFixed(2)} kW`,
      status: "pass",
      description: "Gross active power demand taking into account space multiplier quantity.",
    },
  ];

  if (area > 0) {
    steps.push({
      stepNumber: steps.length + 1,
      label: `Area Power Density (${densityUnit})`,
      formula: "Power Density = (P_total × 1000) / Area",
      substitution: `(${totalLoad.toFixed(2)} kW × 1000) / ${area} ${areaUnit}`,
      result: `${powerDensity.toFixed(2)} ${densityUnit}`,
      status: "pass",
      description: "Specific power demand per unit area for space benchmarking and thermal compliance.",
    });
  }

  if (totalPower > 0) {
    steps.push({
      stepNumber: steps.length + 1,
      label: "Share of Total Facility Connected Load",
      formula: "Project Share = (P_total / P_project_total) × 100%",
      substitution: `(${totalLoad.toFixed(2)} kW / ${totalPower.toFixed(2)} kW) × 100%`,
      result: `${projectShare.toFixed(1)}%`,
      status: "pass",
      description: "Contribution of this space to the entire facility's active connected power.",
    });
  }

  steps.push({
    stepNumber: steps.length + 1,
    label: "Design Safety Margin (10% Additional Capacity)",
    formula: "P_design = P_total × 1.10",
    substitution: `${totalLoad.toFixed(2)} kW × 1.10`,
    result: `${totalWithSafety.toFixed(2)} kW`,
    status: "pass",
    description: "Standard 10% design safety margin allocated for feeder cable and transformer sizing.",
  });

  return {
    title: "Electrical Load Calculation Breakdown",
    itemName: row.description || "Unnamed Load Area",
    standardReference: "IEC 60364-5-52 / ASHRAE 90.1 / NEC NFPA 70",
    inputs: [
      { label: "Space Description", value: row.description || "—" },
      { label: "Quantity (Units)", value: qty },
      { label: "Floor Area", value: area > 0 ? area : "N/A", unit: area > 0 ? areaUnit : undefined },
      { label: "Lighting Load", value: lighting, unit: "kW" },
      { label: "Power Load", value: power, unit: "kW" },
      { label: "HVAC Load", value: hvac, unit: "kW" },
      { label: "Other Load", value: other, unit: "kW" },
      { label: "Remarks / Notes", value: row.remarks || "None" },
    ],
    steps,
    finalResultLabel: "Total Design Load (+10% Safety)",
    finalResultValue: totalWithSafety.toFixed(2),
    finalResultUnit: "kW",
    complianceNote: "Calculations follow standard electrical engineering practices for commercial and residential load estimation.",
  };
};
