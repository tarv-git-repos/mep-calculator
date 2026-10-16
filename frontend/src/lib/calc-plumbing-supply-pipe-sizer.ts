export interface SupplyPipeInputs {
  flow: number; // L/s (SI) or GPM (IP)
  pAvail: number; // kPa (SI) or psi (IP)
  pResid: number; // kPa (SI) or psi (IP)
  length: number; // m (SI) or ft (IP)
  fittingAllowance: number; // %
  elevation: number; // m (SI) or ft (IP)
  pipeMaterial: string; // C-Factor: "150", "130", "120"
  unitSystem: "SI" | "IP";
}

export interface PipeSize {
  nps: string;
  dn: string;
  id: number; // inches
}

export const PIPE_SIZES: PipeSize[] = [
  { nps: '¾"', dn: '20 mm', id: 0.811 },
  { nps: '1"', dn: '25 mm', id: 1.055 },
  { nps: '1¼"', dn: '32 mm', id: 1.265 },
  { nps: '1½"', dn: '40 mm', id: 1.505 },
  { nps: '2"', dn: '50 mm', id: 2.009 },
  { nps: '2½"', dn: '65 mm', id: 2.495 },
  { nps: '3"', dn: '80 mm', id: 3.035 },
  { nps: '4"', dn: '100 mm', id: 4.009 }
];

export const DEFAULT_INPUTS: SupplyPipeInputs = {
  flow: 1.58, // L/s (approx 25 GPM)
  pAvail: 413.7, // kPa (60 psi)
  pResid: 137.9, // kPa (20 psi)
  length: 36.6, // m (120 ft)
  fittingAllowance: 20, // %
  elevation: 6.1, // m (20 ft)
  pipeMaterial: "150", // Copper Type L (C = 150)
  unitSystem: "SI",
};


export function computeSupplyPipeCalculations(
  inputs: SupplyPipeInputs,
  isIP: boolean
) {
  const flowVal = Number(inputs.flow) || 0;
  const pAvailVal = Number(inputs.pAvail) || 0;
  const pResidVal = Number(inputs.pResid) || 0;
  const lengthVal = Number(inputs.length) || 0;
  const elevVal = Number(inputs.elevation) || 0;
  const fitPct = (Number(inputs.fittingAllowance) || 0) / 100;
  const C = Number(inputs.pipeMaterial) || 150;

  const Q_gpm = isIP ? flowVal : flowVal * 15.8503;
  const pAvail_psi = isIP ? pAvailVal : pAvailVal / 6.89476;
  const pResid_psi = isIP ? pResidVal : pResidVal / 6.89476;
  const L_ft = isIP ? lengthVal : lengthVal * 3.28084;
  const elev_ft = isIP ? elevVal : elevVal * 3.28084;

  const Leff = L_ft * (1 + fitPct);
  const elevLoss_psi = elev_ft / 2.31;
  const elevLoss_kpa = elevLoss_psi * 6.89476;

  const rows = PIPE_SIZES.map((s) => {
    // Hazen-Williams head loss equation:
    // hf (psi) = 4.52 * Leff * (Q^1.85) / (C^1.85 * d^4.87)
    const hf_psi = Q_gpm > 0 && s.id > 0
      ? (4.52 * Leff * Math.pow(Q_gpm, 1.85)) / (Math.pow(C, 1.85) * Math.pow(s.id, 4.87))
      : 0;
    const hf_kpa = hf_psi * 6.89476;

    // Velocity: v = Q / A
    const A_sqft = Math.PI * Math.pow(s.id / 12, 2) / 4;
    const v_fps = A_sqft > 0 ? (Q_gpm / 448.8) / A_sqft : 0;
    const v_ms = v_fps * 0.3048;

    // Residual Pressure at remote fixture:
    const resid_psi = pAvail_psi - hf_psi - elevLoss_psi;
    const resid_kpa = resid_psi * 6.89476;

    const isPressureOk = resid_psi >= pResid_psi;
    const isVelocityOk = v_fps >= 1.0 && v_fps <= 8.0; // 0.3 m/s to 2.4 m/s (IPC/ASPE)
    const ok = isPressureOk && isVelocityOk;

    return {
      ...s,
      hf_psi,
      hf_kpa,
      v_fps,
      v_ms,
      resid_psi,
      resid_kpa,
      ok,
      isPressureOk,
      isVelocityOk,
    };
  });

  // Find recommended size: smallest size that passes pressure and velocity, else smallest size that passes pressure
  const rec = rows.find((r) => r.ok) || rows.find((r) => r.isPressureOk) || rows[rows.length - 1];

  return {
    flowVal,
    pAvailVal,
    pResidVal,
    lengthVal,
    elevVal,
    Q_gpm,
    pAvail_psi,
    pResid_psi,
    L_ft,
    Leff,
    C,
    elev_ft,
    elevLoss_psi,
    elevLoss_kpa,
    rows,
    rec,
  };
}
