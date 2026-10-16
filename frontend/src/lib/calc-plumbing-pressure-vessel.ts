export interface PressureVesselInputs {
  importedFlow: number | "";
  importedHead: number | "";
  qLmin: number; // L/min (SI) or GPM (IP)
  bandFactor: number; // e.g. 0.20
  ppVal: number; // Cut-out stop pressure: bar (SI) or psi (IP)
  paVal: number; // Cut-in start pressure: bar (SI) or psi (IP)
  zmax: number; // Max starts per hour (#/hr)
  unitSystem: "SI" | "IP";
}

export const DEFAULT_INPUTS: PressureVesselInputs = {
  importedFlow: "",
  importedHead: "",
  qLmin: 78.0, // L/min (approx 20.6 GPM)
  bandFactor: 0.20,
  ppVal: 8.52, // bar (approx 123.6 psi)
  paVal: 5.68, // bar (approx 82.4 psi)
  zmax: 60, // starts/hr
  unitSystem: "SI",
};

// Conversion Constants
export const GAL_TO_L = 3.78541;
export const GPM_TO_LMIN = 3.78541;
export const PSI_TO_BAR = 0.0689476;


export function computePressureVesselCalculations(inputs: PressureVesselInputs, isIP: boolean) {
  const q_native = Number(inputs.qLmin) || 0;
  const pp_native = Number(inputs.ppVal) || 0;
  const pa_native = Number(inputs.paVal) || 0;
  const z = Number(inputs.zmax) || 60;

  // Convert to SI for standard formula calculation:
  // Formula: V (Litres) = 16.5 * (Q [L/min] * Pp [bar] * Pa [bar]) / (Zmax * (Pp - Pa) * Pc)
  const q_lmin = isIP ? q_native * GPM_TO_LMIN : q_native;
  const pp_bar = isIP ? pp_native * PSI_TO_BAR : pp_native;
  const pa_bar = isIP ? pa_native * PSI_TO_BAR : pa_native;
  const pc_bar = Math.max(0.1, pa_bar - 0.2); // Preload: Pa - 0.2 bar

  const deltaP_bar = Math.max(0.01, pp_bar - pa_bar);
  const constant = 16.5;

  let volume_litres = 0;
  if (z > 0 && deltaP_bar > 0 && pc_bar > 0 && q_lmin > 0) {
    volume_litres = constant * ((q_lmin * pp_bar * pa_bar) / (z * deltaP_bar * pc_bar));
  }

  const volume_disp = isIP ? volume_litres / GAL_TO_L : volume_litres;
  const pc_disp = isIP ? pc_bar / PSI_TO_BAR : pc_bar;
  const deltaP_disp = isIP ? deltaP_bar / PSI_TO_BAR : deltaP_bar;

  const isAdequate = volume_litres > 0 && pp_bar > pa_bar;

  return {
    q_native,
    pp_native,
    pa_native,
    q_lmin,
    pp_bar,
    pa_bar,
    pc_bar,
    deltaP_bar,
    z,
    volume_litres,
    volume_disp,
    pc_disp,
    deltaP_disp,
    isAdequate,
  };
}
