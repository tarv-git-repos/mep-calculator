export interface GasTankInputs {
  gasType: "ng" | "lpg";
  unitSystem: "SI" | "IP";
  resKitchens: number;
  resDemandConst: number; // m3/day (SI) or ft3/day (IP)
  retKitchens: number;
  retDemandConst: number; // m3/day (SI) or ft3/day (IP)
  storageCapacity: number; // Litres (SI) or US Gallons (IP)
}

export const DEFAULT_INPUTS: GasTankInputs = {
  gasType: "ng",
  unitSystem: "SI",
  resKitchens: 0,
  resDemandConst: 0.19,
  retKitchens: 0,
  retDemandConst: 52,
  storageCapacity: 30000,
};


export function computeGasTankCalculations(inputs: GasTankInputs) {
  const isIP = inputs.unitSystem === "IP";
  const M3_TO_FT3 = 35.3147;
  const L_TO_GAL = 0.264172;
  const demandUnit = isIP ? "ft³/day" : "m³/day";
  const volUnit = isIP ? "US Gal" : "Litres";

  const resConsumption = inputs.resKitchens * inputs.resDemandConst; // m³/day
  const retConsumption = inputs.retKitchens * inputs.retDemandConst; // m³/day

  const totalDemandNg = (resConsumption + retConsumption) * 1000; // L/day
  const totalDemandLpg = totalDemandNg / 2.67; // L/day (LPG energy ratio ~2.67x)

  const activeDemand = inputs.gasType === "ng" ? totalDemandNg : totalDemandLpg; // L/day
  const activeDemandM3 = activeDemand / 1000; // m³/day

  const resConsumptionDisp = isIP ? resConsumption * M3_TO_FT3 : resConsumption;
  const retConsumptionDisp = isIP ? retConsumption * M3_TO_FT3 : retConsumption;
  const activeDemandDisp = isIP ? activeDemandM3 * M3_TO_FT3 : activeDemandM3;
  const activeDemandVolDisp = isIP ? activeDemand * L_TO_GAL : activeDemand;
  const volUnitDay = isIP ? "gal/day" : "L/day";

  const tankCapacity = activeDemand > 0 ? (activeDemand * 7) / 0.7 : 0; // Litres recommended for 7 days
  const tankCapacityDisp = isIP ? tankCapacity * L_TO_GAL : tankCapacity;

  const storageCapacityL = isIP ? inputs.storageCapacity / L_TO_GAL : inputs.storageCapacity;
  const usableGas = storageCapacityL * 0.7 * 0.8;
  const reserveGas = storageCapacityL * 0.7 * 0.2;
  const vaporHeadspace = storageCapacityL * 0.3;

  const usableGasDisp = isIP ? usableGas * L_TO_GAL : usableGas;
  const reserveGasDisp = isIP ? reserveGas * L_TO_GAL : reserveGas;
  const vaporHeadspaceDisp = isIP ? vaporHeadspace * L_TO_GAL : vaporHeadspace;

  const autonomyDays = activeDemand > 0 ? (usableGas / activeDemand) : 0;
  const isAdequate = storageCapacityL >= tankCapacity;
  const volumeSurplusDeficit = storageCapacityL - tankCapacity;
  const volumeSurplusDeficitDisp = isIP ? volumeSurplusDeficit * L_TO_GAL : volumeSurplusDeficit;

  return {
    isIP,
    M3_TO_FT3,
    L_TO_GAL,
    demandUnit,
    volUnit,
    resConsumption,
    retConsumption,
    totalDemandNg,
    totalDemandLpg,
    activeDemand,
    activeDemandM3,
    resConsumptionDisp,
    retConsumptionDisp,
    activeDemandDisp,
    activeDemandVolDisp,
    volUnitDay,
    tankCapacity,
    tankCapacityDisp,
    storageCapacityL,
    usableGas,
    reserveGas,
    vaporHeadspace,
    usableGasDisp,
    reserveGasDisp,
    vaporHeadspaceDisp,
    autonomyDays,
    isAdequate,
    volumeSurplusDeficit,
    volumeSurplusDeficitDisp
  };
}
