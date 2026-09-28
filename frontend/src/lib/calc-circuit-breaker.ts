import { STANDARD_BREAKER_RATINGS_A } from "@/core/standards/breakers";

export interface BreakerRow {
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

export const calculateCircuitBreakers = (rows: BreakerRow[]) => {
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
};
