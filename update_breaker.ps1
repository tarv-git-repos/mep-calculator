$path = "frontend\src\routes\circuit-breaker-sizing.tsx"
$text = [IO.File]::ReadAllText($path)

$targetInterface = @"
interface BreakerRow {
  id: string;
  selected?: boolean;
  description: string;
  connectedLoad: number | "";
  voltage: number | "";
  phase: "Select..." | "Single Phase" | "Three Phase";
  powerFactor: number | "";
  demandFactor: number | "";
  remarks: string;
}
"@

$targetCalc = @"
  // Calculations
  const calculatedData = useMemo(() => {
    let totalConnectedKw = 0;
    let totalDesignLoadKw = 0;
    let maxDesignCurrentA = 0;

    const rowDetails = rows.map(row => {
      const load = Number(row.connectedLoad) || 0;
      const volt = Number(row.voltage) || 0;
      const pf = Number(row.powerFactor) || 0.8;
      const df = Number(row.demandFactor) || 1.0;

      const designLoad = load * df;
      let designCurrent = 0;

      if (volt > 0 && pf > 0) {
        if (row.phase === "Single Phase") {
          designCurrent = (designLoad * 1000) / (volt * pf);
        } else if (row.phase === "Three Phase") {
          designCurrent = (designLoad * 1000) / (1.7320508 * volt * pf);
        }
      }

      const recBreaker = STANDARD_BREAKER_RATINGS_A.find(r => r >= designCurrent) || STANDARD_BREAKER_RATINGS_A[STANDARD_BREAKER_RATINGS_A.length - 1];

      totalConnectedKw += load;
      totalDesignLoadKw += designLoad;
      if (designCurrent > maxDesignCurrentA) {
        maxDesignCurrentA = designCurrent;
      }

      return {
        ...row,
        designLoad,
        designCurrent,
        recBreaker
      };
    });

    const recSummaryBreaker = STANDARD_BREAKER_RATINGS_A.find(r => r >= maxDesignCurrentA) || STANDARD_BREAKER_RATINGS_A[STANDARD_BREAKER_RATINGS_A.length - 1];
    const breakerUtilization = recSummaryBreaker > 0 ? (maxDesignCurrentA / recSummaryBreaker) * 100 : 0;

    return {
      rowDetails,
      totalConnectedKw,
      totalDesignLoadKw,
      maxDesignCurrentA,
      recSummaryBreaker,
      breakerUtilization: isNaN(breakerUtilization) ? 0 : breakerUtilization,
    };
  }, [rows]);
"@

$replacementCalc = @"
  // Calculations
  const calculatedData = useMemo(() => calculateCircuitBreakers(rows), [rows]);
"@

$text = $text.Replace($targetInterface, 'import { BreakerRow, calculateCircuitBreakers } from "@/lib/calc-circuit-breaker";')
$text = $text.Replace($targetCalc, $replacementCalc)

[IO.File]::WriteAllText($path, $text)
Write-Host "Replacement Complete."
