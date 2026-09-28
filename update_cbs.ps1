$path = "frontend\src\routes\central-battery-sizing.tsx"
$text = [IO.File]::ReadAllText($path)

$targetInterface = @"
interface CBSRow {
  id: string;
  description: string;
  emLightQty: number;
  emLightW: number;
  exitLightQty: number;
  exitLightW: number;
  remarks: string;
  flagged?: boolean;
}
"@

$targetConst = @"
const STANDARD_CBS_SIZES = [
  5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 160, 200, 250, 315, 400
];
"@

$targetCalc = @"
  // Sizing Calculations Engine
  const calculatedData = useMemo(() => {
    let totalConnectedW = 0;

    rows.forEach((r) => {
      const emQty = r.emLightQty || 0;
      const emW = r.emLightW || 0;
      const exitQty = r.exitLightQty || 0;
      const exitW = r.exitLightW || 0;

      const rowConnected = (emQty * emW) + (exitQty * exitW);
      totalConnectedW += rowConnected;
    });

    const totalConnectedKw = totalConnectedW / 1000;
    
    const safeLF = loadingFactor <= 0 ? 0.9 : loadingFactor;
    const totalLoadAfterLFFactorKw = totalConnectedKw / safeLF;

    const safePF = powerFactor <= 0 ? 0.8 : powerFactor;
    const batteryRatingKva = totalLoadAfterLFFactorKw / safePF;

    const finalRecommendedKva = batteryRatingKva * (1 + spareCapacity / 100);

    // Recommend standard size
    const recStandardSize = STANDARD_CBS_SIZES.find(size => size >= finalRecommendedKva) || 400;

    return {
      totalConnectedW,
      totalConnectedKw,
      totalLoadAfterLFFactorKw,
      batteryRatingKva,
      finalRecommendedKva,
      recStandardSize
    };
  }, [rows, loadingFactor, powerFactor, spareCapacity]);
"@

$replacementCalc = @"
  // Sizing Calculations Engine
  const calculatedData = useMemo(() => calculateCentralBattery(rows, loadingFactor, powerFactor, spareCapacity), [rows, loadingFactor, powerFactor, spareCapacity]);
"@

$text = $text.Replace($targetInterface, 'import { CBSRow, STANDARD_CBS_SIZES, calculateCentralBattery } from "@/lib/calc-central-battery";')
$text = $text.Replace($targetConst, "")
$text = $text.Replace($targetCalc, $replacementCalc)

[IO.File]::WriteAllText($path, $text)
Write-Host "Replacement Complete."
