export interface CheckResult {
  id: string;
  label: string;
  value: string;
  status: "pass" | "warn";
  range: string;
  desc: string;
  category: "air" | "hydronic" | "plant";
}

// Standard Application Presets (Referenced from Reference MEP Calculator)
export const SANITY_PRESETS = {
  commercial_office: {
    label: "Commercial Office",
    desc: "Baseline HVAC & hydronic design parameters for typical office space.",
    valuesIP: { ductVel: 1500, ductFr: 0.08, esp: 0.5, pipeVel: 4.0, pumpHead: 50, cfmTr: 400, supTemp: 55, chwDt: 10, chillerEff: 0.65 },
    valuesSI: { ductVel: 7.62, ductFr: 0.65, esp: 124, pipeVel: 1.22, pumpHead: 149, cfmTr: 47.2, supTemp: 12.8, chwDt: 5.6, chillerEff: 5.41 },
  },
  vav_main_riser: {
    label: "VAV Main Riser",
    desc: "Main supply shafts and high-pressure ductwork with VAV fan loops.",
    valuesIP: { ductVel: 2200, ductFr: 0.12, esp: 1.2, pipeVel: 6.0, pumpHead: 75, cfmTr: 420, supTemp: 53, chwDt: 12, chillerEff: 0.58 },
    valuesSI: { ductVel: 11.18, ductFr: 0.98, esp: 298, pipeVel: 1.83, pumpHead: 224, cfmTr: 49.6, supTemp: 11.7, chwDt: 6.7, chillerEff: 6.06 },
  },
  low_noise_quiet: {
    label: "Low-Noise Quiet Zone",
    desc: "Acoustically sensitive zones requiring reduced air speed and low pipe friction.",
    valuesIP: { ductVel: 1100, ductFr: 0.05, esp: 0.3, pipeVel: 3.0, pumpHead: 35, cfmTr: 380, supTemp: 57, chwDt: 10, chillerEff: 0.62 },
    valuesSI: { ductVel: 5.59, ductFr: 0.41, esp: 75, pipeVel: 0.91, pumpHead: 105, cfmTr: 44.8, supTemp: 13.9, chwDt: 5.6, chillerEff: 5.67 },
  },
  leed_green_building: {
    label: "LEED Green Building",
    desc: "Energy-optimized design with high chiller COP and low pressure drops.",
    valuesIP: { ductVel: 1300, ductFr: 0.06, esp: 0.4, pipeVel: 3.5, pumpHead: 40, cfmTr: 400, supTemp: 55, chwDt: 14, chillerEff: 0.52 },
    valuesSI: { ductVel: 6.60, ductFr: 0.49, esp: 100, pipeVel: 1.07, pumpHead: 119, cfmTr: 47.2, supTemp: 12.8, chwDt: 7.8, chillerEff: 6.76 },
  },
};


export function computeSanityCheckResults(
  isSI: boolean,
  ductVel: number,
  ductFr: number,
  esp: number,
  pipeVel: number,
  pumpHead: number,
  cfmTr: number,
  supTemp: number,
  chwDt: number,
  chillerEff: number
): CheckResult[] {
  if (isSI) {
    // SI Checks
    const velOk = ductVel >= 5.0 && ductVel <= 12.7;
    const frOk = ductFr >= 0.4 && ductFr <= 1.2;
    const espOk = esp >= 50 && esp <= 500;
    const pipeVelOk = pipeVel >= 0.6 && pipeVel <= 2.4;
    const pumpHeadOk = pumpHead >= 60 && pumpHead <= 300;
    const cfmTrOk = cfmTr >= 47.0 && cfmTr <= 60.0;
    const satOk = supTemp >= 10.0 && supTemp <= 15.0;
    const chwdtOk = chwDt >= 4.4 && chwDt <= 7.7;
    const kwtrOk = chillerEff >= 4.4 && chillerEff <= 7.0; // COP range

    return [
      {
        id: "ductVel",
        label: "Supply Main Duct Velocity",
        value: `${ductVel.toFixed(2)} m/s`,
        status: velOk ? "pass" : "warn",
        range: "5.0 – 12.7 m/s",
        desc: velOk ? "Velocity within recommended SMACNA main riser limit." : "Velocity outside standard noise/pressure drop range (5.0–12.7 m/s).",
        category: "air",
      },
      {
        id: "ductFr",
        label: "Duct Friction Rate",
        value: `${ductFr.toFixed(2)} Pa/m`,
        status: frOk ? "pass" : "warn",
        range: "0.40 – 1.20 Pa/m",
        desc: frOk ? "Friction rate aligns with equal friction design method." : "Friction rate high/low (Target equal friction: ~0.8 Pa/m).",
        category: "air",
      },
      {
        id: "esp",
        label: "Total External Static Pressure",
        value: `${Math.round(esp)} Pa`,
        status: espOk ? "pass" : "warn",
        range: "50 – 500 Pa",
        desc: espOk ? "Fan ESP reasonable for commercial AHU/VAV loops." : "Fan ESP unusually high/low for standard commercial system.",
        category: "air",
      },
      {
        id: "pipeVel",
        label: "CHW Main Pipe Velocity",
        value: `${pipeVel.toFixed(2)} m/s`,
        status: pipeVelOk ? "pass" : "warn",
        range: "0.60 – 2.40 m/s",
        desc: pipeVelOk ? "Pipe velocity avoids erosion noise and high pump head." : "Velocity outside CIBSE/ASHRAE hydronic range (0.6–2.4 m/s).",
        category: "hydronic",
      },
      {
        id: "pumpHead",
        label: "Pump Total Head",
        value: `${Math.round(pumpHead)} kPa`,
        status: pumpHeadOk ? "pass" : "warn",
        range: "60 – 300 kPa",
        desc: pumpHeadOk ? "Pump dynamic head consistent with medium building circuit." : "Pump head abnormally high or low for standard distribution.",
        category: "hydronic",
      },
      {
        id: "cfmTr",
        label: "Airflow per Cooling Load",
        value: `${cfmTr.toFixed(1)} L/s/kW`,
        status: cfmTrOk ? "pass" : "warn",
        range: "47.0 – 60.0 L/s/kW",
        desc: cfmTrOk ? "Airflow density complies with sensible load ratio." : "Airflow ratio off baseline (Standard: 47.0–60.0 L/s/kW).",
        category: "plant",
      },
      {
        id: "supTemp",
        label: "Supply Air Temperature",
        value: `${supTemp.toFixed(1)} °C`,
        status: satOk ? "pass" : "warn",
        range: "10.0 – 15.0 °C",
        desc: satOk ? "Supply air temperature within non-condensing zone." : "Supply air temp creates condensation or humidity risk.",
        category: "air",
      },
      {
        id: "chwDt",
        label: "CHW ΔT (Supply to Return)",
        value: `${chwDt.toFixed(1)} °C`,
        status: chwdtOk ? "pass" : "warn",
        range: "4.4 – 7.7 °C",
        desc: chwdtOk ? "Hydronic temperature differential optimal for delta P valves." : "ΔT low (risk of low delta-T syndrome) or high.",
        category: "hydronic",
      },
      {
        id: "chillerEff",
        label: "Chiller Efficiency (COP)",
        value: `${chillerEff.toFixed(2)} COP`,
        status: kwtrOk ? "pass" : "warn",
        range: "4.40 – 7.00 COP",
        desc: kwtrOk ? "Chiller COP satisfies ASHRAE 90.1 energy baseline." : "Chiller COP lower than energy code compliance threshold.",
        category: "plant",
      },
    ];
  } else {
    // IP Checks
    const velOk = ductVel >= 1000 && ductVel <= 2500;
    const frOk = ductFr >= 0.05 && ductFr <= 0.15;
    const espOk = esp >= 0.2 && esp <= 2.0;
    const pipeVelOk = pipeVel >= 2.0 && pipeVel <= 8.0;
    const pumpHeadOk = pumpHead >= 20 && pumpHead <= 100;
    const cfmTrOk = cfmTr >= 350 && cfmTr <= 450;
    const satOk = supTemp >= 50 && supTemp <= 60;
    const chwdtOk = chwDt >= 8 && chwDt <= 14;
    const kwtrOk = chillerEff >= 0.5 && chillerEff <= 0.8; // kW/TR range

    return [
      {
        id: "ductVel",
        label: "Supply Main Duct Velocity",
        value: `${Math.round(ductVel)} FPM`,
        status: velOk ? "pass" : "warn",
        range: "1,000 – 2,500 FPM",
        desc: velOk ? "Velocity within recommended SMACNA main riser limit." : "Velocity outside standard noise/pressure drop range (1,000–2,500 FPM).",
        category: "air",
      },
      {
        id: "ductFr",
        label: "Duct Friction Rate",
        value: `${ductFr.toFixed(2)} in w.g./100ft`,
        status: frOk ? "pass" : "warn",
        range: "0.05 – 0.15 in w.g./100ft",
        desc: frOk ? "Friction rate aligns with equal friction design method." : "Friction rate high/low (Target equal friction: ~0.08 in w.g./100ft).",
        category: "air",
      },
      {
        id: "esp",
        label: "Total External Static Pressure",
        value: `${esp.toFixed(2)} in w.g.`,
        status: espOk ? "pass" : "warn",
        range: "0.20 – 2.00 in w.g.",
        desc: espOk ? "Fan ESP reasonable for commercial AHU/VAV loops." : "Fan ESP unusually high/low for standard commercial system.",
        category: "air",
      },
      {
        id: "pipeVel",
        label: "CHW Main Pipe Velocity",
        value: `${pipeVel.toFixed(1)} fps`,
        status: pipeVelOk ? "pass" : "warn",
        range: "2.0 – 8.0 fps",
        desc: pipeVelOk ? "Pipe velocity avoids erosion noise and high pump head." : "Velocity outside CIBSE/ASHRAE hydronic range (2.0–8.0 fps).",
        category: "hydronic",
      },
      {
        id: "pumpHead",
        label: "Pump Total Head",
        value: `${Math.round(pumpHead)} ft w.g.`,
        status: pumpHeadOk ? "pass" : "warn",
        range: "20 – 100 ft w.g.",
        desc: pumpHeadOk ? "Pump dynamic head consistent with medium building circuit." : "Pump head abnormally high or low for standard distribution.",
        category: "hydronic",
      },
      {
        id: "cfmTr",
        label: "Airflow per TR",
        value: `${Math.round(cfmTr)} CFM/TR`,
        status: cfmTrOk ? "pass" : "warn",
        range: "350 – 450 CFM/TR",
        desc: cfmTrOk ? "Airflow density complies with sensible load ratio." : "Airflow ratio off baseline (Standard: 350–450 CFM/TR).",
        category: "plant",
      },
      {
        id: "supTemp",
        label: "Supply Air Temperature",
        value: `${supTemp.toFixed(1)} °F`,
        status: satOk ? "pass" : "warn",
        range: "50.0 – 60.0 °F",
        desc: satOk ? "Supply air temperature within non-condensing zone." : "Supply air temp creates condensation or humidity risk.",
        category: "air",
      },
      {
        id: "chwDt",
        label: "CHW ΔT (Supply to Return)",
        value: `${chwDt.toFixed(1)} °F`,
        status: chwdtOk ? "pass" : "warn",
        range: "8.0 – 14.0 °F",
        desc: chwdtOk ? "Hydronic temperature differential optimal for delta P valves." : "ΔT low (risk of low delta-T syndrome) or high.",
        category: "hydronic",
      },
      {
        id: "chillerEff",
        label: "Chiller Efficiency",
        value: `${chillerEff.toFixed(2)} kW/TR`,
        status: kwtrOk ? "pass" : "warn",
        range: "0.50 – 0.80 kW/TR",
        desc: kwtrOk ? "Chiller kW/TR satisfies ASHRAE 90.1 energy baseline." : "Chiller kW/TR higher than energy code compliance threshold.",
        category: "plant",
      },
    ];
  }
}
