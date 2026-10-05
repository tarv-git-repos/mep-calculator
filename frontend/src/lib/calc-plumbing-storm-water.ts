export interface CatchmentRow {
  id: string;
  name: string;
  area: number;
  surface: string;
  coef: number;
  intensity: number;
}

export const SURFACE_COEFS: Record<string, number> = {
  "asphalt": 0.95,
  "brick": 0.85,
  "concrete": 0.95,
  "sandy_soil": 0.20,
  "clay_soil": 0.85,
  "agricultural": 0.30
};

export const SURFACE_LABELS: Record<string, string> = {
  "asphalt": "Asphalt (0.95)",
  "brick": "Brick (0.85)",
  "concrete": "Concrete (0.95)",
  "sandy_soil": "Sandy Soil (0.20)",
  "clay_soil": "Clay Soil (0.85)",
  "agricultural": "Agricultural (0.30)"
};

// Modal for editing individual catchment properties on double click or right click Edit

export function computeStormWaterCalculations(
  rows: CatchmentRow[],
  unitSystem: "ip" | "si"
) {
  const isIp = unitSystem === "ip";
  let totalArea = 0;
  let weightedSumC = 0;
  let totalFlow = 0;
  let imperviousArea = 0;

  const items = rows.map(r => {
    // SI equivalents for calculation
    const areaSI = r.area / (isIp ? 10.7639 : 1);
    const intensitySI = r.intensity * (isIp ? 25.4 : 1);
    const flowSI = (r.coef * intensitySI * areaSI) / 3600;
    
    totalArea += r.area;
    weightedSumC += (r.coef * r.area);
    totalFlow += flowSI;

    if (r.coef >= 0.8) {
      imperviousArea += r.area;
    }

    // Current unit flow
    const flowVal = flowSI * (isIp ? 15.85 : 1);

    return {
      ...r,
      flow: flowVal
    };
  });

  const avgC = totalArea > 0 ? (weightedSumC / totalArea) : 0;
  const finalFlow = totalFlow * (isIp ? 15.85 : 1);
  const totalFlowM3s = totalFlow / 1000;
  const totalFlowM3h = totalFlow * 3.6;

  // Peak 15-min and 30-min attenuation volume
  const retentionVol15m = (totalFlow / 1000) * 15 * 60; // m³
  const retentionVol30m = (totalFlow / 1000) * 30 * 60; // m³

  // Recommended Storm Pipe Diameter (Target velocity ~1.5 m/s)
  const targetVel = 1.5;
  const calcDiaM = totalFlowM3s > 0 ? Math.sqrt((4 * totalFlowM3s) / (Math.PI * targetVel)) : 0;
  const calcDiaMm = calcDiaM * 1000;

  const standardDNs = [
    { dn: 100, nps: '4"', idMm: 105 },
    { dn: 150, nps: '6"', idMm: 155 },
    { dn: 200, nps: '8"', idMm: 204 },
    { dn: 250, nps: '10"', idMm: 257 },
    { dn: 300, nps: '12"', idMm: 307 },
    { dn: 375, nps: '15"', idMm: 382 },
    { dn: 450, nps: '18"', idMm: 458 },
    { dn: 600, nps: '24"', idMm: 610 },
  ];

  let chosenPipe = standardDNs[0];
  for (const p of standardDNs) {
    if (p.idMm >= calcDiaMm * 0.9) {
      chosenPipe = p;
      break;
    }
    chosenPipe = p;
  }

  const areaM2 = (Math.PI * Math.pow(chosenPipe.idMm / 1000, 2)) / 4;
  const actualVelMps = areaM2 > 0 ? totalFlowM3s / areaM2 : 0;
  const actualVelFps = actualVelMps * 3.28084;

  const imperviousPercentage = totalArea > 0 ? Math.round((imperviousArea / totalArea) * 100) : 0;

  return {
    items,
    totalArea,
    avgC,
    totalFlow: finalFlow,
    totalFlowM3h,
    totalFlowSI: totalFlow,
    retentionVol15m,
    retentionVol30m,
    imperviousPercentage,
    recommendedPipe: chosenPipe,
    actualVelMps,
    actualVelFps,
  };
}
