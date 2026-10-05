export type HazardOpt = "0.10,1500" | "0.15,1500" | "0.20,1500" | "0.30,2500" | "0.40,2500" | "custom";

export const STANDARD_K_FACTORS = [2.8, 4.2, 5.6, 8.0, 11.2, 14.0, 16.8, 19.6, 22.4, 25.2, 28.0];


export function computeSprinklerDensityCalculations(
  hazard: HazardOpt,
  customDens: number | "",
  customArea: number | "",
  coverage: number | "",
  kFactor: number | "",
  unitSystem: "ip" | "si"
) {
  const customDensVal = customDens === "" ? 0 : Number(customDens);
  const customAreaVal = customArea === "" ? 0 : Number(customArea);
  const coverageVal = coverage === "" ? 0 : Number(coverage);
  const kFactorVal = kFactor === "" ? 5.6 : Number(kFactor);

  let densIP = 0.20;
  let designAreaFt2 = 1500;

  const ip = unitSystem === "ip";

  if (hazard === "custom") {
    if (ip) {
      densIP = customDensVal;
      designAreaFt2 = customAreaVal;
    } else {
      densIP = customDensVal / 40.7458;
      designAreaFt2 = customAreaVal * 10.7639;
    }
  } else {
    const parts = hazard.split(",");
    densIP = parseFloat(parts[0]) || 0.20;
    designAreaFt2 = parseFloat(parts[1]) || 1500;
  }

  // coverage: if SI, coverageVal is in m2 (e.g. 12.1 m2 -> 130.2 ft2). If IP, it is in ft2 (130 ft2)
  const coverFt2 = ip ? coverageVal : coverageVal * 10.7639;

  // kFactor: if SI, kFactor is in metric (e.g. 80 -> 5.6). If IP, it is in IP (5.6).
  const kFactorIP = ip ? kFactorVal : kFactorVal / 14.288;

  const flowPerSprink = densIP * coverFt2; // GPM
  const pressReq = kFactorIP > 0 ? Math.pow(flowPerSprink / kFactorIP, 2) : 0; // psi
  const nSprink = coverFt2 > 0 ? Math.ceil(designAreaFt2 / coverFt2) : 0;
  const totalSprinkFlow = densIP * designAreaFt2; // GPM

  // Hose stream allowance: LH (0.10)=100, OH (0.15/0.20)=250, EH (0.30/0.40)=500 GPM
  const hoseAllow = densIP <= 0.105 ? 100 : densIP <= 0.205 ? 250 : 500;
  const systemTotal = totalSprinkFlow + hoseAllow;

  // Unit conversions for display
  const formatFlow = (gpm: number) => {
    return ip ? `${gpm.toFixed(1)} GPM` : `${(gpm * 3.78541).toFixed(1)} L/min`;
  };

  const formatPressure = (psi: number) => {
    return ip ? `${psi.toFixed(1)} psi` : `${(psi * 0.0689476).toFixed(2)} bar`;
  };

  const formatArea = (ft2: number) => {
    return ip ? `${ft2.toFixed(0)} ft²` : `${(ft2 * 0.092903).toFixed(1)} m²`;
  };

  const formatDens = (gpmft2: number) => {
    return ip ? `${gpmft2.toFixed(2)} gpm/ft²` : `${(gpmft2 * 40.7458).toFixed(2)} mm/min`;
  };

  return {
    densIP,
    coverFt2,
    designAreaFt2,
    flowPerSprink,
    pressReq,
    nSprink,
    totalSprinkFlow,
    hoseAllow,
    systemTotal,
    formatFlow,
    formatPressure,
    formatArea,
    formatDens
  };
}
