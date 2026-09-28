$path = "frontend\src\routes\conductor-sizing.tsx"
$text = [IO.File]::ReadAllText($path)

$targetConst = @"
const CABLE_DATABASE = [
  { size: 1.5, ampacityCuPVC_1Ph: 19.5, ampacityCuPVC_3Ph: 17.5, ampacityCuXLPE_1Ph: 24, ampacityCuXLPE_3Ph: 22, ampacityAlPVC_1Ph: 0, ampacityAlPVC_3Ph: 0, ampacityAlXLPE_1Ph: 0, ampacityAlXLPE_3Ph: 0, rCuPVC: 14.8, rCuXLPE: 15.4, rAlPVC: 24.4, rAlXLPE: 25.3, x: 0.09 },
  { size: 2.5, ampacityCuPVC_1Ph: 27, ampacityCuPVC_3Ph: 24, ampacityCuXLPE_1Ph: 33, ampacityCuXLPE_3Ph: 30, ampacityAlPVC_1Ph: 0, ampacityAlPVC_3Ph: 0, ampacityAlXLPE_1Ph: 0, ampacityAlXLPE_3Ph: 0, rCuPVC: 8.87, rCuXLPE: 9.24, rAlPVC: 14.6, rAlXLPE: 15.1, x: 0.09 },
  { size: 4, ampacityCuPVC_1Ph: 36, ampacityCuPVC_3Ph: 32, ampacityCuXLPE_1Ph: 45, ampacityCuXLPE_3Ph: 40, ampacityAlPVC_1Ph: 0, ampacityAlPVC_3Ph: 0, ampacityAlXLPE_1Ph: 0, ampacityAlXLPE_3Ph: 0, rCuPVC: 5.54, rCuXLPE: 5.77, rAlPVC: 9.15, rAlXLPE: 9.5, x: 0.085 },
  { size: 6, ampacityCuPVC_1Ph: 46, ampacityCuPVC_3Ph: 41, ampacityCuXLPE_1Ph: 58, ampacityCuXLPE_3Ph: 52, ampacityAlPVC_1Ph: 0, ampacityAlPVC_3Ph: 0, ampacityAlXLPE_1Ph: 0, ampacityAlXLPE_3Ph: 0, rCuPVC: 3.69, rCuXLPE: 3.84, rAlPVC: 6.09, rAlXLPE: 6.32, x: 0.082 },
  { size: 10, ampacityCuPVC_1Ph: 63, ampacityCuPVC_3Ph: 57, ampacityCuXLPE_1Ph: 80, ampacityCuXLPE_3Ph: 71, ampacityAlPVC_1Ph: 0, ampacityAlPVC_3Ph: 0, ampacityAlXLPE_1Ph: 0, ampacityAlXLPE_3Ph: 0, rCuPVC: 2.19, rCuXLPE: 2.28, rAlPVC: 3.61, rAlXLPE: 3.75, x: 0.078 },
  { size: 16, ampacityCuPVC_1Ph: 85, ampacityCuPVC_3Ph: 76, ampacityCuXLPE_1Ph: 107, ampacityCuXLPE_3Ph: 96, ampacityAlPVC_1Ph: 66, ampacityAlPVC_3Ph: 59, ampacityAlXLPE_1Ph: 83, ampacityAlXLPE_3Ph: 74, rCuPVC: 1.38, rCuXLPE: 1.44, rAlPVC: 2.27, rAlXLPE: 2.36, x: 0.077 },
  { size: 25, ampacityCuPVC_1Ph: 112, ampacityCuPVC_3Ph: 101, ampacityCuXLPE_1Ph: 138, ampacityCuXLPE_3Ph: 127, ampacityAlPVC_1Ph: 87, ampacityAlPVC_3Ph: 78, ampacityAlXLPE_1Ph: 107, ampacityAlXLPE_3Ph: 98, rCuPVC: 0.884, rCuXLPE: 0.927, rAlPVC: 1.46, rAlXLPE: 1.52, x: 0.076 },
  { size: 35, ampacityCuPVC_1Ph: 138, ampacityCuPVC_3Ph: 125, ampacityCuXLPE_1Ph: 171, ampacityCuXLPE_3Ph: 155, ampacityAlPVC_1Ph: 108, ampacityAlPVC_3Ph: 97, ampacityAlXLPE_1Ph: 133, ampacityAlXLPE_3Ph: 120, rCuPVC: 0.638, rCuXLPE: 0.669, rAlPVC: 1.05, rAlXLPE: 1.09, x: 0.075 },
  { size: 50, ampacityCuPVC_1Ph: 169, ampacityCuPVC_3Ph: 151, ampacityCuXLPE_1Ph: 209, ampacityCuXLPE_3Ph: 190, ampacityAlPVC_1Ph: 131, ampacityAlPVC_3Ph: 117, ampacityAlXLPE_1Ph: 162, ampacityAlXLPE_3Ph: 147, rCuPVC: 0.471, rCuXLPE: 0.494, rAlPVC: 0.778, rAlXLPE: 0.81, x: 0.074 },
  { size: 70, ampacityCuPVC_1Ph: 213, ampacityCuPVC_3Ph: 192, ampacityCuXLPE_1Ph: 269, ampacityCuXLPE_3Ph: 240, ampacityAlPVC_1Ph: 166, ampacityAlPVC_3Ph: 149, ampacityAlXLPE_1Ph: 209, ampacityAlXLPE_3Ph: 189, rCuPVC: 0.328, rCuXLPE: 0.343, rAlPVC: 0.541, rAlXLPE: 0.563, x: 0.074 },
  { size: 95, ampacityCuPVC_1Ph: 258, ampacityCuPVC_3Ph: 232, ampacityCuXLPE_1Ph: 326, ampacityCuXLPE_3Ph: 292, ampacityAlPVC_1Ph: 202, ampacityAlPVC_3Ph: 180, ampacityAlXLPE_1Ph: 253, ampacityAlXLPE_3Ph: 229, rCuPVC: 0.235, rCuXLPE: 0.246, rAlPVC: 0.388, rAlXLPE: 0.404, x: 0.073 },
  { size: 120, ampacityCuPVC_1Ph: 299, ampacityCuPVC_3Ph: 269, ampacityCuXLPE_1Ph: 379, ampacityCuXLPE_3Ph: 340, ampacityAlPVC_1Ph: 235, ampacityAlPVC_3Ph: 209, ampacityAlXLPE_1Ph: 294, ampacityAlXLPE_3Ph: 267, rCuPVC: 0.186, rCuXLPE: 0.195, rAlPVC: 0.307, rAlXLPE: 0.32, x: 0.073 },
  { size: 150, ampacityCuPVC_1Ph: 344, ampacityCuPVC_3Ph: 309, ampacityCuXLPE_1Ph: 436, ampacityCuXLPE_3Ph: 391, ampacityAlPVC_1Ph: 270, ampacityAlPVC_3Ph: 240, ampacityAlXLPE_1Ph: 338, ampacityAlXLPE_3Ph: 307, rCuPVC: 0.151, rCuXLPE: 0.158, rAlPVC: 0.25, rAlXLPE: 0.26, x: 0.073 },
  { size: 185, ampacityCuPVC_1Ph: 392, ampacityCuPVC_3Ph: 353, ampacityCuXLPE_1Ph: 500, ampacityCuXLPE_3Ph: 448, ampacityAlPVC_1Ph: 309, ampacityAlPVC_3Ph: 275, ampacityAlXLPE_1Ph: 388, ampacityAlXLPE_3Ph: 352, rCuPVC: 0.122, rCuXLPE: 0.128, rAlPVC: 0.201, rAlXLPE: 0.21, x: 0.073 },
  { size: 240, ampacityCuPVC_1Ph: 461, ampacityCuPVC_3Ph: 415, ampacityCuXLPE_1Ph: 590, ampacityCuXLPE_3Ph: 528, ampacityAlPVC_1Ph: 364, ampacityAlPVC_3Ph: 324, ampacityAlXLPE_1Ph: 457, ampacityAlXLPE_3Ph: 415, rCuPVC: 0.095, rCuXLPE: 0.099, rAlPVC: 0.157, rAlXLPE: 0.163, x: 0.072 },
  { size: 300, ampacityCuPVC_1Ph: 530, ampacityCuPVC_3Ph: 477, ampacityCuXLPE_1Ph: 678, ampacityCuXLPE_3Ph: 608, ampacityAlPVC_1Ph: 419, ampacityAlPVC_3Ph: 373, ampacityAlXLPE_1Ph: 526, ampacityAlXLPE_3Ph: 478, rCuPVC: 0.077, rCuXLPE: 0.081, rAlPVC: 0.128, rAlXLPE: 0.133, x: 0.072 },
  { size: 400, ampacityCuPVC_1Ph: 625, ampacityCuPVC_3Ph: 563, ampacityCuXLPE_1Ph: 800, ampacityCuXLPE_3Ph: 718, ampacityAlPVC_1Ph: 494, ampacityAlPVC_3Ph: 441, ampacityAlXLPE_1Ph: 621, ampacityAlXLPE_3Ph: 564, rCuPVC: 0.061, rCuXLPE: 0.064, rAlPVC: 0.101, rAlXLPE: 0.105, x: 0.072 },
  { size: 500, ampacityCuPVC_1Ph: 720, ampacityCuPVC_3Ph: 648, ampacityCuXLPE_1Ph: 922, ampacityCuXLPE_3Ph: 827, ampacityAlPVC_1Ph: 570, ampacityAlPVC_3Ph: 508, ampacityAlXLPE_1Ph: 716, ampacityAlXLPE_3Ph: 651, rCuPVC: 0.05, rCuXLPE: 0.052, rAlPVC: 0.083, rAlXLPE: 0.086, x: 0.072 },
  { size: 630, ampacityCuPVC_1Ph: 830, ampacityCuPVC_3Ph: 747, ampacityCuXLPE_1Ph: 1060, ampacityCuXLPE_3Ph: 952, ampacityAlPVC_1Ph: 657, ampacityAlPVC_3Ph: 586, ampacityAlXLPE_1Ph: 826, ampacityAlXLPE_3Ph: 751, rCuPVC: 0.041, rCuXLPE: 0.043, rAlPVC: 0.068, rAlXLPE: 0.071, x: 0.072 }
];
"@

$targetRows = @"
  const calculatedRows = useMemo(() => {
    return rows.map((r, index) => {
      const srNo = index + 1;
      const loadKw = r.connectedLoad === "" ? 0 : Number(r.connectedLoad);
      const v = r.voltage === "" ? 0 : Number(r.voltage);
      const runs = r.parallelRuns === "" || Number(r.parallelRuns) <= 0 ? 1 : Number(r.parallelRuns);
      const length = r.length === "" ? 0 : Number(r.length);
      let designCurrent = 0;
      if (loadKw > 0 && v > 0 && r.phase !== "") {
        if (r.phase === "Single Phase") designCurrent = (loadKw * 1e3) / (v * globalPf);
        else if (r.phase === "Three Phase") designCurrent = (loadKw * 1e3) / (Math.sqrt(3) * v * globalPf);
      }
      let minCableSize = 0;
      let baseAmpacity = 0;
      let deratedAmpacity = 0;
      let vdV = 0;
      let vdPercent = 0;
      let utilization = 0;
      let status = "Pass";
      let notes = "";
      if (designCurrent > 0 && r.material !== "" && r.type !== "" && r.phase !== "") {
        let found = false;
        for (const spec of CABLE_DATABASE) {
          if (r.material === "Aluminium" && spec.size < 16) continue;
          let baseAmp = 0;
          if (r.material === "Copper") {
            if (r.type === "PVC") baseAmp = r.phase === "Single Phase" ? spec.ampacityCuPVC_1Ph : spec.ampacityCuPVC_3Ph;
            else baseAmp = r.phase === "Single Phase" ? spec.ampacityCuXLPE_1Ph : spec.ampacityCuXLPE_3Ph;
          } else {
            if (r.type === "PVC") baseAmp = r.phase === "Single Phase" ? spec.ampacityAlPVC_1Ph : spec.ampacityAlPVC_3Ph;
            else baseAmp = r.phase === "Single Phase" ? spec.ampacityAlXLPE_1Ph : spec.ampacityAlXLPE_3Ph;
          }
          const deratedAmp = baseAmp * globalDerating * runs;
          if (deratedAmp >= designCurrent) {
            const rVal = r.material === "Copper" ? (r.type === "PVC" ? spec.rCuPVC : spec.rCuXLPE) : (r.type === "PVC" ? spec.rAlPVC : spec.rAlXLPE);
            const xVal = spec.x;
            const cosPhi = globalPf;
            const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
            let calculatedVd = 0;
            const currentPerRun = designCurrent / runs;
            if (r.phase === "Single Phase") calculatedVd = (2 * currentPerRun * length * (rVal * cosPhi + xVal * sinPhi)) / 1e3;
            else calculatedVd = (Math.sqrt(3) * currentPerRun * length * (rVal * cosPhi + xVal * sinPhi)) / 1e3;
            const calculatedVdPercent = v > 0 ? (calculatedVd / v) * 100 : 0;
            if (calculatedVdPercent <= globalVdLimit) {
              minCableSize = spec.size;
              baseAmpacity = baseAmp;
              deratedAmpacity = deratedAmp;
              vdV = calculatedVd;
              vdPercent = calculatedVdPercent;
              utilization = (designCurrent / deratedAmp) * 100;
              found = true;
              break;
            }
          }
        }
        if (!found) {
          status = "Fail";
          notes = "No standard cable size satisfies both voltage drop and derated ampacity criteria.";
        } else if (utilization > 95) {
          status = "Warning";
          notes = "Cable utilization is very high (> 95%). Consider upgrading to a larger size.";
        }
      } else {
        status = "Error";
        notes = "Missing Connected Load or Voltage parameters.";
      }
      return {
        ...r,
        srNo,
        designCurrent: Number(designCurrent.toFixed(2)),
        minCableSize,
        baseAmpacity: Number(baseAmpacity.toFixed(1)),
        deratedAmpacity: Number(deratedAmpacity.toFixed(1)),
        vdV: Number(vdV.toFixed(2)),
        vdPercent: Number(vdPercent.toFixed(2)),
        utilization: Number(utilization.toFixed(1)),
        status,
        notes
      };
    });
  }, [rows, globalDerating, globalVdLimit, globalPf]);
"@

$replacementRows = @"
  const calculatedRows = useMemo(() => calculateConductorRows(rows, globalDerating, globalVdLimit, globalPf), [rows, globalDerating, globalVdLimit, globalPf]);
"@

$text = $text.Replace($targetRows, $replacementRows)
$text = $text.Replace($targetConst, "")
$text = "import { CABLE_DATABASE, calculateConductorRows } from `"@/lib/calc-conductor`";`n" + $text

[IO.File]::WriteAllText($path, $text)
Write-Host "Replacement Complete."
