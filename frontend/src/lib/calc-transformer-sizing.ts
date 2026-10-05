export interface LoadRow {
  id: string;
  selected?: boolean;
  flagged?: boolean;
  description: string;
  lightingHeatingKw: number | "";
  inductiveMotorKw: number | "";
  diversityFactor: number | "";
  demandFactor: number | "";
  remarks: string;
}

export const STANDARD_TX_RATINGS = [
  25, 50, 75, 100, 160, 200, 250, 315, 400, 500, 630, 750, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000
];


export function computeTransformerSizing(loadRows: LoadRow[], designParams: { spareCapacity: number, deratingFactor1: number, deratingFactor2: number, powerFactor: number }) {
  let totalConnectedKw = 0;
  let totalMaxDemandKw = 0;

  const rowDetails = loadRows.map(row => {
    const lh = Number(row.lightingHeatingKw) || 0;
    const im = Number(row.inductiveMotorKw) || 0;
    const div = Number(row.diversityFactor) || 1.0;
    const dem = Number(row.demandFactor) || 1.0;

    const connectedLoad = lh + im;
    const maxDemand = connectedLoad * dem * div;

    totalConnectedKw += connectedLoad;
    totalMaxDemandKw += maxDemand;

    return {
      ...row,
      connectedLoad,
      maxDemand
    };
  });

  const spareMult = 1 + (Number(designParams.spareCapacity) || 0) / 100;
  const derating1 = Number(designParams.deratingFactor1) || 1.0;
  const derating2 = Number(designParams.deratingFactor2) || 1.0;
  const pf = Number(designParams.powerFactor) || 0.8;

  const totalDemandWithSpareKw = totalMaxDemandKw * spareMult;
  
  // Final Design power (kVA)
  const requiredKvaVal = totalDemandWithSpareKw / (pf * derating1 * derating2);
  const requiredKva = isNaN(requiredKvaVal) || !isFinite(requiredKvaVal) ? 0 : requiredKvaVal;

  const recommendedKva = STANDARD_TX_RATINGS.find(r => r >= requiredKva) || STANDARD_TX_RATINGS[STANDARD_TX_RATINGS.length - 1];

  const utilization = recommendedKva > 0 ? (requiredKva / recommendedKva) * 100 : 0;

  return {
    rowDetails,
    totalConnectedKw,
    totalMaxDemandKw,
    totalDemandWithSpareKw,
    requiredKva,
    recommendedKva,
    utilization: isNaN(utilization) ? 0 : utilization,
    totalSpareKw: totalMaxDemandKw * (designParams.spareCapacity / 100),
  };
}
