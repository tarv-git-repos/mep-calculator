$path = "frontend\src\routes\duct-sizer.tsx"
$text = [IO.File]::ReadAllText($path)

$targetConsts = @"
const CFM_TO_LPS = 0.471947;
const LPS_TO_CFM = 2.11888;
const INWG_TO_PAM = 8.16828;
const PAM_TO_INWG = 1 / 8.16828;
const FPM_TO_MPS = 0.00508;
const MPS_TO_FPM = 196.85;
const IN_TO_MM = 25.4;
const MM_TO_IN = 1 / 25.4;

// Colebrook friction factor solved iteratively
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
"@

$targetMath = @"
  // ==========================================
  const calcResults = useMemo(() => {
    const qCfm = typeof airflow === "number" && airflow > 0 ? airflow : 2500;
    const frInWg = typeof targetFr === "number" && targetFr > 0 ? targetFr : 0.08;
    const AR = typeof aspectRatio === "number" && aspectRatio >= 1 ? aspectRatio : 1.5;

    // Airflow Q in m³/s
    const Q = qCfm * 4.71947e-4;
    const frPaM = frInWg * INWG_TO_PAM;
    const rho = 1.204; // kg/m³ standard air density
    const mu = 1.81e-5; // Pa·s dynamic viscosity
    const eps = 0.00009; // m absolute roughness for galvanized steel sheet (0.09 mm)

    // 1. Iteratively solve circular equivalent diameter for target friction rate
    let lo = 0.05, hi = 2.5;
    for (let i = 0; i < 100; i++) {
      const D = (lo + hi) / 2;
      const A = (Math.PI * D * D) / 4;
      const v = Q / A;
      const Re = (rho * v * D) / mu;
      const f = colebrook(Re, eps / D);
      const dP = (f * rho * v * v) / (2 * D);
      if (dP > frPaM) lo = D;
      else hi = D;
      if (hi - lo < 0.00005) break;
    }
    const exactDiameterM = (lo + hi) / 2;
    const exactDiameterIn = exactDiameterM / 0.0254;

    if (ductShape === "round") {
      // Standard Round Duct Sizes (inches & mm)
      const stdSizesIn = [4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60];
      const selectedIn = stdSizesIn.find(d => d >= exactDiameterIn) || Math.ceil(exactDiameterIn);
      const selectedM = selectedIn * 0.0254;
      const selectedMm = Math.round(selectedM * 1000);

      const areaM2 = (Math.PI * selectedM * selectedM) / 4;
      const areaSqFt = areaM2 * 10.7639;
      const velocityMs = Q / areaM2;
      const velocityFpm = velocityMs / FPM_TO_MPS;

      const Re = (rho * velocityMs * selectedM) / mu;
      const f = colebrook(Re, eps / selectedM);
      const actualFrPaM = (f * rho * velocityMs * velocityMs) / (2 * selectedM);
      const actualFrInWg = actualFrPaM * PAM_TO_INWG;

      const velPressPa = (rho * velocityMs * velocityMs) / 2;
      const velPressInWg = Math.pow(velocityFpm / 4005, 2);

      const perimeterM = Math.PI * selectedM;
      const perimeterIn = Math.PI * selectedIn;

      return {
        qCfm,
        qLps: qCfm * CFM_TO_LPS,
        targetFrInWg: frInWg,
        targetFrPaM: frPaM,
        ductShape: "round" as const,
        aspectRatio: 1.0,
        exactDiameterIn,
        exactDiameterMm: exactDiameterM * 1000,
        selectedWidthIn: selectedIn,
        selectedHeightIn: selectedIn,
        selectedWidthMm: selectedMm,
        selectedHeightMm: selectedMm,
        sizeDisplay: isSI ? `Ø ${selectedMm} mm` : `Ø ${selectedIn}" NPS`,
        sizeFullText: isSI ? `Circular Duct Ø ${selectedMm} mm` : `Circular Spiral Duct Ø ${selectedIn} in.`,
        deqIn: selectedIn,
        deqMm: selectedMm,
        hydraulicDiaIn: selectedIn,
        hydraulicDiaMm: selectedMm,
        areaM2,
        areaSqFt,
        velocityMs,
        velocityFpm,
        actualFrPaM,
        actualFrInWg,
        velPressPa,
        velPressInWg,
        reynolds: Re,
        frictionFactor: f,
        perimeterM,
        perimeterIn,
        flowRegime: Re > 4000 ? "Turbulent (Colebrook)" : Re > 2300 ? "Transitional" : "Laminar",
      };
    } else {
      // Rectangular Duct: Huebscher Equivalent Diameter Formulation:
      // De = 1.30 * ( (a*b)^0.625 / (a+b)^0.25 )
      // With b = a / AR => De = 1.30 * ( (a^2/AR)^0.625 / (a*(1 + 1/AR))^0.25 )
      //                       = 1.30 * a^1.25 / (AR^0.625 * a^0.25 * (1 + 1/AR)^0.25)
      //                       = 1.30 * a / (AR^0.625 * ((AR+1)/AR)^0.25)
      //                       = 1.30 * a * AR^(0.25 - 0.625) / (AR+1)^0.25
      //                       = 1.30 * a / (AR^0.375 * (AR+1)^0.25)
      // => a = De * (AR^0.375 * (AR+1)^0.25) / 1.30
      const numeratorFactor = Math.pow(AR, 0.375) * Math.pow(AR + 1, 0.25);
      const exactWidthIn = (exactDiameterIn * numeratorFactor) / 1.30;
      const exactHeightIn = exactWidthIn / AR;

      // Round width and height to nearest even integer (inches) or 25mm (SI)
      const selectedWidthIn = Math.max(4, Math.round(exactWidthIn / 2) * 2);
      const selectedHeightIn = Math.max(4, Math.round(exactHeightIn / 2) * 2);

      const selectedWidthM = selectedWidthIn * 0.0254;
      const selectedHeightM = selectedHeightIn * 0.0254;

      const selectedWidthMm = Math.round(selectedWidthM * 1000);
      const selectedHeightMm = Math.round(selectedHeightM * 1000);

      const areaM2 = selectedWidthM * selectedHeightM;
      const areaSqFt = areaM2 * 10.7639;
      const velocityMs = Q / areaM2;
      const velocityFpm = velocityMs / FPM_TO_MPS;

      const perimeterM = 2 * (selectedWidthM + selectedHeightM);
      const perimeterIn = 2 * (selectedWidthIn + selectedHeightIn);

      const hydraulicDiaM = (4 * areaM2) / perimeterM;
      const hydraulicDiaIn = hydraulicDiaM / 0.0254;
      const hydraulicDiaMm = hydraulicDiaM * 1000;

      // Equivalent circular diameter Deq from Huebscher
      const deqIn = 1.30 * Math.pow(selectedWidthIn * selectedHeightIn, 0.625) / Math.pow(selectedWidthIn + selectedHeightIn, 0.25);
      const deqM = deqIn * 0.0254;
      const deqMm = deqM * 1000;

      const Re = (rho * velocityMs * hydraulicDiaM) / mu;
      const f = colebrook(Re, eps / hydraulicDiaM);
      const actualFrPaM = (f * rho * velocityMs * velocityMs) / (2 * hydraulicDiaM);
      const actualFrInWg = actualFrPaM * PAM_TO_INWG;

      const velPressPa = (rho * velocityMs * velocityMs) / 2;
      const velPressInWg = Math.pow(velocityFpm / 4005, 2);

      return {
        qCfm,
        qLps: qCfm * CFM_TO_LPS,
        targetFrInWg: frInWg,
        targetFrPaM: frPaM,
        ductShape: "rect" as const,
        aspectRatio: AR,
        exactDiameterIn,
        exactDiameterMm: exactDiameterM * 1000,
        selectedWidthIn,
        selectedHeightIn,
        selectedWidthMm,
        selectedHeightMm,
        sizeDisplay: isSI ? `${selectedWidthMm} × ${selectedHeightMm} mm` : `${selectedWidthIn}" × ${selectedHeightIn}"`,
        sizeFullText: isSI ? `Rectangular Duct ${selectedWidthMm} mm (W) × ${selectedHeightMm} mm (H)` : `Rectangular ${selectedWidthIn}" (W) × ${selectedHeightIn}" (H)`,
        deqIn,
        deqMm,
        hydraulicDiaIn,
        hydraulicDiaMm,
        areaM2,
        areaSqFt,
        velocityMs,
        velocityFpm,
        actualFrPaM,
        actualFrInWg,
        velPressPa,
        velPressInWg,
        reynolds: Re,
        frictionFactor: f,
        perimeterM,
        perimeterIn,
        flowRegime: Re > 4000 ? "Turbulent (Colebrook)" : Re > 2300 ? "Transitional" : "Laminar",
      };
    }
  }, [airflow, targetFr, ductShape, aspectRatio, unitSystem, isSI]);

  // SMACNA Warning checks
  const warnings = useMemo(() => {
    const list: { type: "info" | "warning" | "success"; text: string }[] = [];
    const vFpm = calcResults.velocityFpm;

    if (vFpm > 2500) {
      list.push({
        type: "warning",
        text: "High Velocity (> 2500 FPM). Risk of aerodynamic noise and high operating pressure drop. Consider larger duct or double-wall construction.",
      });
    } else if (vFpm > 1800) {
      list.push({
        type: "info",
        text: "Medium Velocity (1800 - 2500 FPM). Suitable for main supply shafts. Not recommended for branch runouts to diffusers.",
      });
    }

    if (calcResults.ductShape === "rect") {
      if (calcResults.aspectRatio > 4) {
        list.push({
          type: "warning",
          text: "Aspect Ratio > 4:1. High friction, high fabrication cost, and risk of \"oil canning\" drumming noise. Tie-rods required.",
        });
      } else if (calcResults.aspectRatio > 3) {
        list.push({
          type: "info",
          text: "Aspect Ratio > 3:1. Higher sheet metal usage than optimal.",
        });
      }
    }
    return list;
  }, [calcResults]);
"@

$replacementMath = @"
  // ==========================================
  const calcResults = useMemo(() => calculateDuctSize(airflow, targetFr, ductShape, aspectRatio, unitSystem, isSI), [airflow, targetFr, ductShape, aspectRatio, unitSystem, isSI]);
  const warnings = useMemo(() => calculateSMACNAWarnings(calcResults), [calcResults]);
"@

$text = $text.Replace($targetMath, $replacementMath)
$text = $text.Replace($targetConsts, "")
$text = "import { calculateDuctSize, calculateSMACNAWarnings, CFM_TO_LPS, LPS_TO_CFM, INWG_TO_PAM, PAM_TO_INWG, FPM_TO_MPS, MPS_TO_FPM, IN_TO_MM, MM_TO_IN } from `"@/lib/calc-duct-sizer`";`n" + $text

[IO.File]::WriteAllText($path, $text)
Write-Host "Replacement Complete."
