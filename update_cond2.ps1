$path = "frontend\src\routes\condensate-drain.tsx"
$text = [IO.File]::ReadAllText($path)

$targetMath = @"
  // Sizing calculation logic
  const calculateDrainResults = (mode: CondMode, tr: number, lat: number, qty: number, length: number, isIp: boolean) => {
    let trVal = mode === "tr" ? (isIp ? tr : kwToTr(tr)) : 0;
    let latBTU = 0;
    if (mode === "tr") {
      latBTU = trVal * 12000 * 0.3;
    } else {
      latBTU = isIp ? lat : kwToBtu(lat);
    }

    const galPerHrSingle = latBTU / (1075 * 8.34);
    const galPerHr = galPerHrSingle * qty;
    const lPerMin = galPerHr * 0.063;

    let pipeSize = "";
    let minSlope = "";
    let totalDrop = "";

    if (galPerHr < 5) {
      pipeSize = '3/4" (19mm)';
      minSlope = isIp ? '1/4" per ft (2.0%)' : "2.0% (1:50)";
      const d = 0.25 * length;
      totalDrop = isIp ? `${d.toFixed(2)} in` : `${(length * 0.02 * 1000).toFixed(0)} mm`;
    } else if (galPerHr < 20) {
      pipeSize = '1" (25mm)';
      minSlope = isIp ? '1/4" per ft (2.0%)' : "2.0% (1:50)";
      const d = 0.25 * length;
      totalDrop = isIp ? `${d.toFixed(2)} in` : `${(length * 0.02 * 1000).toFixed(0)} mm`;
    } else {
      pipeSize = '1-1/4" (32mm)';
      minSlope = isIp ? '1/8" per ft (1.0%)' : "1.0% (1:100)";
      const d = 0.125 * length;
      totalDrop = isIp ? `${d.toFixed(2)} in` : `${(length * 0.01 * 1000).toFixed(0)} mm`;
    }

    return {
      trVal,
      latBTU,
      galPerHrSingle,
      galPerHr,
      lPerMin,
      flowRateDisplay: isIp ? `${galPerHr.toFixed(2)} gal/hr` : `${lPerMin.toFixed(3)} L/min`,
      pipeSize,
      minSlope,
      totalDrop,
    };
  };

  const calculatedData = useMemo(() => {
    return calculateDrainResults(condMode, trLoad, latentLoad, unitsQty, drainLength, ip);
  }, [condMode, trLoad, latentLoad, unitsQty, drainLength, ip]);
"@

$replacementMath = @"
  const calculatedData = useMemo(() => {
    return calculateDrainResults(condMode, trLoad, latentLoad, unitsQty, drainLength, ip, kwToTr, kwToBtu);
  }, [condMode, trLoad, latentLoad, unitsQty, drainLength, ip]);
"@

$text = $text.Replace($targetMath, $replacementMath)

$text = "import { calculateDrainResults, type CondMode } from `"@/lib/calc-condensate-drain`";`n" + $text
$text = $text -replace "type CondMode = `"tr`" | `"lat`";", ""

[IO.File]::WriteAllText($path, $text)
Write-Host "Replacement Complete."
