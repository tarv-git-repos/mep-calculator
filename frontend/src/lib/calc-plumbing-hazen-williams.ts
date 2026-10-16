// Standard NFPA 13 & ASME B36.10 Schedule 40 Steel Pipe Diameters (Inside Diameter in inches and mm)
export const PIPE_PRESETS = [
  { name: '1" (25 mm) Sch 40', idInches: 1.049, idMm: 26.64, nps: 1.0 },
  { name: '1-1/4" (32 mm) Sch 40', idInches: 1.380, idMm: 35.05, nps: 1.25 },
  { name: '1-1/2" (40 mm) Sch 40', idInches: 1.610, idMm: 40.89, nps: 1.5 },
  { name: '2" (50 mm) Sch 40', idInches: 2.067, idMm: 52.50, nps: 2.0 },
  { name: '2-1/2" (65 mm) Sch 40', idInches: 2.469, idMm: 62.71, nps: 2.5 },
  { name: '3" (80 mm) Sch 40', idInches: 3.068, idMm: 77.93, nps: 3.0 },
  { name: '4" (100 mm) Sch 40', idInches: 4.026, idMm: 102.26, nps: 4.0 },
  { name: '6" (150 mm) Sch 40', idInches: 6.065, idMm: 154.05, nps: 6.0 },
  { name: '8" (200 mm) Sch 40', idInches: 7.981, idMm: 202.72, nps: 8.0 },
  { name: '10" (250 mm) Sch 40', idInches: 10.020, idMm: 254.51, nps: 10.0 },
  { name: '12" (300 mm) Sch 40', idInches: 11.938, idMm: 303.23, nps: 12.0 },
];

// Standard Hazen-Williams C-Factors (NFPA 13 Table A.23.4.2)
export const C_FACTOR_PRESETS = [
  { label: "C = 150 (Plastic / CPVC / Copper)", value: 150 },
  { label: "C = 140 (Cement-lined Ductile Iron)", value: 140 },
  { label: "C = 120 (Wet Steel Pipe - Standard NFPA)", value: 120 },
  { label: "C = 100 (Dry Steel / Galvanized Pipe)", value: 100 },
  { label: "C = 90 (Unlined Cast Iron)", value: 90 },
];

export interface HazenSizingParams {
  flowRate: number | ""; // GPM (ip) or L/s (si)
  pipeDiameter: number | ""; // inches (ip) or mm (si)
  cFactor: number; // Hazen-Williams roughness coefficient
  pipeLength: number | ""; // ft (ip) or m (si)
  fittingsPct: number | ""; // % equivalent fitting length allowance (default 15%)
  elevationChange: number | ""; // ft (ip) or m (si)
  residualPressure: number | ""; // psi (ip) or bar (si)
}


export function computeHazenWilliamsCalculations(sizingParams: HazenSizingParams, unitSystem: "si" | "ip") {
  const isIp = unitSystem === "ip";
  const flowInput = typeof sizingParams.flowRate === "number" ? sizingParams.flowRate : 0;
  const dInput = typeof sizingParams.pipeDiameter === "number" ? sizingParams.pipeDiameter : (isIp ? 2.469 : 62.71);
  const C = sizingParams.cFactor || 120;
  const lenInput = typeof sizingParams.pipeLength === "number" ? sizingParams.pipeLength : 0;
  const fittingsPct = typeof sizingParams.fittingsPct === "number" ? sizingParams.fittingsPct : 0;
  const elevInput = typeof sizingParams.elevationChange === "number" ? sizingParams.elevationChange : 0;
  const resPInput = typeof sizingParams.residualPressure === "number" ? sizingParams.residualPressure : 0;

  // Standardize to Imperial Base for exact NFPA 13 Formula equivalence
  // Q in GPM, d in inches, L in feet
  const Q_gpm = isIp ? flowInput : flowInput / 0.06309;
  const d_in = isIp ? dInput : dInput / 25.4;
  const L_ft_straight = isIp ? lenInput : lenInput / 0.3048;
  const elev_ft = isIp ? elevInput : elevInput / 0.3048;

  // Equivalent Length (Straight + Fittings Allowance)
  const L_eq_ft = L_ft_straight * (1 + fittingsPct / 100);
  const L_eq_m = L_eq_ft * 0.3048;

  // NFPA 13 Formula: p_loss (psi/ft) = 4.52 * Q^1.85 / (C^1.85 * d^4.87)
  let p_loss_per_ft = 0;
  let p_loss_per_100ft = 0;
  let total_friction_psi = 0;
  let velocity_fps = 0;

  if (d_in > 0 && C > 0 && Q_gpm > 0) {
    const denom = Math.pow(C, 1.85) * Math.pow(d_in, 4.87);
    p_loss_per_ft = (4.52 * Math.pow(Q_gpm, 1.85)) / denom;
    p_loss_per_100ft = p_loss_per_ft * 100;
    total_friction_psi = p_loss_per_ft * L_eq_ft;
    // Velocity: v (fps) = 0.408 * Q / d^2
    velocity_fps = (0.408 * Q_gpm) / (d_in * d_in);
  }

  const velocity_mps = velocity_fps * 0.3048;

  // Elevation Head Loss: 1 ft water = 0.4335 psi (or 1 m = 0.0981 bar)
  const elev_head_psi = elev_ft * 0.4335;
  const elev_head_bar = elev_head_psi * 0.0689476;

  // Total System Pressure Head
  const res_psi = isIp ? resPInput : resPInput / 0.0689476;
  const total_system_head_psi = total_friction_psi + elev_head_psi + res_psi;
  const total_friction_bar = total_friction_psi * 0.0689476;
  const total_friction_kpa = total_friction_bar * 100;
  const total_friction_m_head = total_friction_psi * 0.703249; // psi to m H2O

  const loss_per_100m_bar = p_loss_per_100ft * 0.0689476 * 3.28084; // bar / 100m

  // Recommended Velocity Limit Checks
  const maxRecVel = isIp ? 8.0 : 2.44; // 8 fps for potable / 20 fps for fire
  const isVelHigh = velocity_fps > 15.0;
  const isVelModerate = velocity_fps > 8.0 && velocity_fps <= 15.0;

  return {
    isIp,
    flowUnit: isIp ? "GPM" : "L/s",
    diamUnit: isIp ? "in" : "mm",
    lenUnit: isIp ? "ft" : "m",
    pressUnit: isIp ? "psi" : "bar",
    pressPer100Unit: isIp ? "psi/100ft" : "bar/100m",
    velUnit: isIp ? "fps" : "m/s",
    Q_gpm,
    d_in,
    L_eq_ft: Number(L_eq_ft.toFixed(1)),
    L_eq_m: Number(L_eq_m.toFixed(1)),
    totalFrictionLoss: isIp ? Number(total_friction_psi.toFixed(3)) : Number(total_friction_bar.toFixed(4)),
    totalFrictionLossPsi: Number(total_friction_psi.toFixed(3)),
    totalFrictionLossBar: Number(total_friction_bar.toFixed(4)),
    totalFrictionLossKpa: Number(total_friction_kpa.toFixed(2)),
    totalFrictionMHead: Number(total_friction_m_head.toFixed(2)),
    lossPer100: isIp ? Number(p_loss_per_100ft.toFixed(3)) : Number(loss_per_100m_bar.toFixed(4)),
    velocity: isIp ? Number(velocity_fps.toFixed(2)) : Number(velocity_mps.toFixed(2)),
    velocityFps: Number(velocity_fps.toFixed(2)),
    velocityMps: Number(velocity_mps.toFixed(2)),
    maxRecVel,
    isVelHigh,
    isVelModerate,
    elevHead: isIp ? Number(elev_head_psi.toFixed(2)) : Number(elev_head_bar.toFixed(3)),
    totalSystemHead: isIp ? Number(total_system_head_psi.toFixed(2)) : Number((total_system_head_psi * 0.0689476).toFixed(3)),
  };
}
