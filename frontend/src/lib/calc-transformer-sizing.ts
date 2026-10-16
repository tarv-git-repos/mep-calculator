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
  25, 50, 75, 100, 160, 200, 250, 315, 400, 500, 630, 750, 800, 1000, 1250, 1500, 1600, 2000, 2500, 3150, 4000
];


export function computeTransformerSizing(loadRows: LoadRow[], designParams: { spareCapacity: number, deratingFactor: number, powerFactor: number }) {
  let totalConnectedKw = 0;
  let totalMaxDemandKw = 0;

  const rowDetails = loadRows.map(row => {
    const lh = Number(row.lightingHeatingKw) || 0;
    const im = Number(row.inductiveMotorKw) || 0;
    const div = Number(row.diversityFactor) || 1.0;
    const dem = Number(row.demandFactor) || 1.0;

    const connectedLoad = lh + im;
    const maxDemand = connectedLoad * div;

    totalConnectedKw += connectedLoad;
    totalMaxDemandKw += maxDemand;

    return {
      ...row,
      connectedLoad,
      maxDemand
    };
  });

  const spareMult = 1 + (Number(designParams.spareCapacity) || 0) / 100;
  const derating = Number(designParams.deratingFactor) || 1.0;
  const pf = Number(designParams.powerFactor) || 0.8;

  const totalDemandWithSpareKw = totalMaxDemandKw * spareMult;
  
  // Final Design power (kVA)
  const requiredKvaVal = totalDemandWithSpareKw / (pf * derating);
  const requiredKva = isNaN(requiredKvaVal) || !isFinite(requiredKvaVal) ? 0 : requiredKvaVal;

  let recommendedKva = STANDARD_TX_RATINGS.find(r => r >= requiredKva) || STANDARD_TX_RATINGS[STANDARD_TX_RATINGS.length - 1];

  // ADDC & DEWA Limit Enforcement Override
  const totalMotorAc = loadRows.reduce((sum, r) => sum + (Number(r.inductiveMotorKw) || 0), 0);
  const isMostlyMotor = totalMotorAc > (totalConnectedKw * 0.5);

  // DEWA Connected Load Limits override (These are maximum CEILINGS for the transformer size)
  if (isMostlyMotor) {
    if (totalConnectedKw > 950) recommendedKva = Math.max(recommendedKva, 2000);
    else if (totalConnectedKw > 650) recommendedKva = Math.max(recommendedKva, 1500);
  } else {
    if (totalConnectedKw > 1200) recommendedKva = Math.max(recommendedKva, 2000);
    else if (totalConnectedKw > 800) recommendedKva = Math.max(recommendedKva, 1500);
  }

  // ADDC Maximum Demand Limits override (These are maximum CEILINGS for the transformer size)
  if (totalMaxDemandKw > 1147) recommendedKva = Math.max(recommendedKva, 2000);
  else if (totalMaxDemandKw > 956) recommendedKva = Math.max(recommendedKva, 1500);
  else if (totalMaxDemandKw > 765) recommendedKva = Math.max(recommendedKva, 1250);
  else if (totalMaxDemandKw > 482) recommendedKva = Math.max(recommendedKva, 1000);
  else if (totalMaxDemandKw > 382) recommendedKva = Math.max(recommendedKva, 630);

  const utilization = recommendedKva > 0 ? (requiredKva / recommendedKva) * 100 : 0;

  let recommendedFeeder = "";
  if (totalConnectedKw > 0 && totalConnectedKw <= 200) {
    if (totalConnectedKw <= 30) recommendedFeeder = "60 Amp Feeder (Direct LV)";
    else if (totalConnectedKw <= 50) recommendedFeeder = "100 Amp Feeder (Direct LV)";
    else if (totalConnectedKw <= 60) recommendedFeeder = "125 Amp Feeder (Direct LV)";
    else if (totalConnectedKw <= 80) recommendedFeeder = "160 Amp Feeder (Direct LV)";
    else if (totalConnectedKw <= 100) recommendedFeeder = "200 Amp Feeder (Direct LV)";
    else if (totalConnectedKw <= 150) recommendedFeeder = "300 Amp Feeder (Direct LV)";
    else if (totalConnectedKw <= 200) recommendedFeeder = "400 Amp Feeder (Direct LV)";
  }

  return {
    rowDetails,
    totalConnectedKw,
    totalMaxDemandKw,
    totalDemandWithSpareKw,
    requiredKva,
    recommendedKva,
    utilization: isNaN(utilization) ? 0 : utilization,
    totalSpareKw: totalMaxDemandKw * (designParams.spareCapacity / 100),
    recommendedFeeder
  };
}






