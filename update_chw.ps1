$path = "frontend\src\routes\chw-pipe-sizer.tsx"
$text = [IO.File]::ReadAllText($path)

$target1 = @"
const pipeTable: Record<string, number> = {
  0.5: 15.80, 0.75: 20.93, 1.0: 26.64, 1.25: 35.05, 1.5: 40.89,
  2.0: 52.50, 2.5: 62.71, 3.0: 77.93, 3.5: 90.12, 4.0: 102.26,
  5.0: 128.19, 6.0: 154.05, 8.0: 202.72, 10.0: 254.46, 12.0: 303.23
};

const GLYCOL_VISC: Record<string, number> = { chw: 1, cw: 1, g25: 1.8, g40: 2.6 };
const GLYCOL_DENS: Record<string, number> = { chw: 1, cw: 1, g25: 1.03, g40: 1.05 };

function colebrook(Re: number, relR: number): number {
  if (Re <= 0) return 0.1;
  if (Re < 2300) return 64 / Re;
  let f = 0.25 / Math.pow(Math.log(relR / 3.7 + 5.74 / Math.pow(Re, 0.9)) / Math.LN10, 2);
  for (let i = 0; i < 80; i++) {
    const r = -2 * Math.log((relR / 3.7) + (2.51 / (Re * Math.sqrt(f)))) / Math.LN10;
    const fn = 1 / (r * r);
    if (Math.abs(fn - f) < 1e-10) {
      f = fn;
      break;
    }
    f = fn;
  }
  return f;
}

function waterDens(tC: number): number {
  return 999.842594 + 6.793952e-2 * tC - 9.09529e-3 * Math.pow(tC, 2) + 1.001685e-4 * Math.pow(tC, 3) - 1.120083e-6 * Math.pow(tC, 4) + 6.536332e-9 * Math.pow(tC, 5);
}

function waterVisc(tC: number): number {
  return 2.414e-5 * Math.pow(10, 247.8 / (tC + 406.15));
}

function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}
"@

$target2 = @"
  const calculatedData = useMemo(() => {
    const flowVal = sizingParams.flowRate !== "" ? Number(sizingParams.flowRate) : (ip ? 80 : 5.0);
    const Q = ip ? flowVal * 6.30902e-5 : flowVal * 1e-3; // m³/s
    const tRaw = sizingParams.temperature !== "" ? Number(sizingParams.temperature) : (ip ? 44 : 6.7);
    const tC = ip ? fToC(tRaw) : tRaw;
    const eps = Number(sizingParams.materialRoughness) || 0.000046;
    
    const dpRaw = sizingParams.targetDp !== "" ? Number(sizingParams.targetDp) : (ip ? 4.0 : 40);
    const targetDpPaM = ip ? dpRaw * 22.62 : dpRaw;

    const rho = waterDens(tC) * GLYCOL_DENS[sizingParams.fluidType];
    const mu = waterVisc(tC) * GLYCOL_VISC[sizingParams.fluidType];

    let chosen: any = null;
    const allPipes: any[] = [];

    for (const [nps, idMm] of Object.entries(pipeTable)) {
      const D = idMm / 1000;
      const A = (Math.PI * D * D) / 4;
      const v = Q / A;
      const Re = (rho * v * D) / mu;
      const f = colebrook(Re, eps / D);
      const dp = (f * rho * v * v) / (2 * D);
      const dpFt = dp / 22.62;
      const vFps = v / 0.3048;
      const isCompliant = dp <= targetDpPaM * 1.05;

      const rowObj = {
        nps: Number(nps),
        idMm,
        D,
        A,
        v,
        vFps,
        Re,
        f,
        dp,
        dpFt,
        isCompliant
      };
      allPipes.push(rowObj);

      if (!chosen && isCompliant) {
        chosen = rowObj;
      }
    }

    if (!chosen && allPipes.length > 0) {
      chosen = allPipes[allPipes.length - 1];
    }

    const flowDisplay = ip ? `${flowVal.toFixed(1)} GPM` : `${flowVal.toFixed(2)} L/s`;
    const tempDisplay = ip ? `${tRaw.toFixed(1)} °F` : `${tRaw.toFixed(1)} °C`;
    const targetDpDisplay = ip ? `${dpRaw.toFixed(2)} psi/100ft` : `${dpRaw.toFixed(0)} Pa/m`;

    return {
      flowVal,
      flowDisplay,
      Q,
      tRaw,
      tC,
      tempDisplay,
      dpRaw,
      targetDpDisplay,
      rho,
      mu,
      chosen,
      allPipes
    };
  }, [sizingParams, unitSystem, ip]);
"@

$replacement1 = 'import { calculateCHWPipeSize } from "@/lib/calc-chw-pipe";'
$replacement2 = '  const calculatedData = useMemo(() => calculateCHWPipeSize(sizingParams, ip), [sizingParams, unitSystem, ip]);'

$text = $text.Replace($target1, $replacement1)
$text = $text.Replace($target2, $replacement2)

[IO.File]::WriteAllText($path, $text)
Write-Host "Replacement Complete."
