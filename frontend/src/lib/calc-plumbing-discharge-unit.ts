export interface FUSpace {
  id: number;
  desc: string;
  floor: string;
  std: string;
  fixtures: Record<string, number>;
  isFlagged?: boolean;
  isManualFloor?: boolean;
}

export function getFUSpaceValidation(s?: Partial<FUSpace>) {
  const warnings: string[] = [];
  if (!s) return { isFlagged: false, warnings: [], isAutoFlagged: false, isManualFlagged: false };

  const descEmpty = !s.desc || s.desc.trim() === "";
  
  if (descEmpty) warnings.push("Description is missing");

  const isAutoFlagged = warnings.length > 0;
  const isManualFlagged = s.isFlagged === true;
  const isFlagged = isManualFlagged || isAutoFlagged;

  return { isFlagged, warnings, isAutoFlagged, isManualFlagged };
}

export const IP_DISCHARGE_UNITS: Record<string, Record<string, number>> = {
  wc: { 'total-du': 4 },
  basin: { 'total-du': 1 },
  bibtap: { 'total-du': 1 },
  shower: { 'total-du': 5 },
  bath: { 'total-du': 10 },
  catchbasin: { 'total-du': 2 },
  urinal: { 'total-du': 0.3 },
  sink: { 'total-du': 3 },
  laundry: { 'total-du': 4 }
};

export const DU_FIXTURES_META = [
  { id: 'wc', short: 'Water Closet' },
  { id: 'urinal', short: 'Urinal' },
  { id: 'basin', short: 'Wash Basin' },
  { id: 'bath', short: 'Bath Tub' },
  { id: 'shower', short: 'Shower' },
  { id: 'sink', short: 'Sink' },
  { id: 'bibtap', short: 'BIB TAP' },
  { id: 'laundry', short: 'Washing Machine' },
  { id: 'catchbasin', short: 'Catch basin' }
];

const IPC_TABLE = [
  { wsfu: 0, gpm: 0 },
  { wsfu: 1, gpm: 3 },
  { wsfu: 2, gpm: 5 },
  { wsfu: 3, gpm: 6.5 },
  { wsfu: 5, gpm: 9.4 },
  { wsfu: 10, gpm: 14.6 },
  { wsfu: 15, gpm: 17.5 },
  { wsfu: 20, gpm: 19.6 },
  { wsfu: 25, gpm: 21.5 },
  { wsfu: 30, gpm: 23.3 },
  { wsfu: 40, gpm: 26.3 },
  { wsfu: 50, gpm: 29.1 },
  { wsfu: 60, gpm: 32 },
  { wsfu: 70, gpm: 35 },
  { wsfu: 80, gpm: 38 },
  { wsfu: 90, gpm: 41 },
  { wsfu: 100, gpm: 43.5 },
  { wsfu: 120, gpm: 48 },
  { wsfu: 140, gpm: 52.5 },
  { wsfu: 160, gpm: 57 },
  { wsfu: 180, gpm: 61 },
  { wsfu: 200, gpm: 65 },
  { wsfu: 225, gpm: 70 },
  { wsfu: 250, gpm: 75 },
  { wsfu: 275, gpm: 80 },
  { wsfu: 300, gpm: 85 },
  { wsfu: 400, gpm: 105 },
  { wsfu: 500, gpm: 124 },
  { wsfu: 750, gpm: 170 },
  { wsfu: 1000, gpm: 208 },
  { wsfu: 1250, gpm: 239 },
  { wsfu: 1500, gpm: 269 },
  { wsfu: 1750, gpm: 297 },
  { wsfu: 2000, gpm: 325 },
  { wsfu: 2500, gpm: 380 },
  { wsfu: 3000, gpm: 433 },
  { wsfu: 4000, gpm: 525 },
  { wsfu: 5000, gpm: 593 }
];

export function wsfuToGPM(wsfu: number) {
  const clamped = Math.max(0, Math.min(wsfu, 5000));
  for (let i = 0; i < IPC_TABLE.length; i++) {
    if (IPC_TABLE[i].wsfu === clamped) {
      return IPC_TABLE[i].gpm;
    }
  }
  for (let i = 0; i < IPC_TABLE.length - 1; i++) {
    const lower = IPC_TABLE[i];
    const upper = IPC_TABLE[i + 1];
    if (clamped > lower.wsfu && clamped < upper.wsfu) {
      const ratio = (clamped - lower.wsfu) / (upper.wsfu - lower.wsfu);
      return lower.gpm + ratio * (upper.gpm - lower.gpm);
    }
  }
  return 0;
}

export function wsfuToLPS(wsfu: number) {
  return wsfuToGPM(wsfu) * 0.06309;
}

export function extractFloorFU(name: string) {
  const match = name.match(/^([0-9]|B|G|LG|UG|SF|RF|M|P)[FLfli]?/i);
  return match ? match[0].toUpperCase().replace(/L$/i, 'F') : 'G';
}


export function getEffectiveUnitFU(fixtureId: string, spaceStd: string, headerStd: string, weightOverrides: Record<string, number>) {
  if (spaceStd === headerStd && weightOverrides[fixtureId] !== undefined) {
    return weightOverrides[fixtureId];
  }
  return IP_DISCHARGE_UNITS[fixtureId]?.[spaceStd] ?? 0;
}

export function computePlumbingDischargeCalculations(
  fuSpaces: FUSpace[],
  headerStd: string,
  weightOverrides: Record<string, number>,
  ip: boolean
) {
  let totalDU = 0;
  let blackTotalDU = 0;
  let greyTotalDU = 0;
  const spaceTotals: Record<number, number> = {};
  const spaceBlackTotals: Record<number, number> = {};
  const spaceGreyTotals: Record<number, number> = {};
  const breakdown: string[] = [];
  const detailedSteps: any[] = [];

  fuSpaces.forEach(s => {
    let spaceDU = 0;
    let spaceBlack = 0;
    let spaceGrey = 0;
    const spaceParts: string[] = [];
    const spaceStd = s.std;

    DU_FIXTURES_META.forEach(f => {
      const qty = s.fixtures[f.id] || 0;
      if (qty > 0) {
        const unitFU = getEffectiveUnitFU(f.id, spaceStd, headerStd, weightOverrides);
        const subTotal = qty * unitFU;
        spaceDU += subTotal;
        if (f.id === 'wc' || f.id === 'urinal') {
          blackTotalDU += subTotal;
          spaceBlack += subTotal;
        } else {
          greyTotalDU += subTotal;
          spaceGrey += subTotal;
        }
        spaceParts.push(`${f.short} (${qty} × ${unitFU})`);
      }
    });

    spaceTotals[s.id] = spaceDU;
    spaceBlackTotals[s.id] = spaceBlack;
    spaceGreyTotals[s.id] = spaceGrey;
    totalDU += spaceDU;

    if (spaceDU > 0) {
      const stdLabel = spaceStd.replace("ipc-", "").toUpperCase();
      breakdown.push(`${s.desc} [${stdLabel}]: ${spaceDU.toFixed(1)} D.U.`);
      detailedSteps.push({
        title: `Area: ${s.desc} (${stdLabel})`,
        expr: spaceParts.join(" + ") + ` = ${spaceDU.toFixed(1)} D.U.`
      });
    }
  });

  const flowGPM = wsfuToGPM(totalDU);
  const flowLPS = wsfuToLPS(totalDU);

  return {
    totalDU,
    blackTotalDU,
    greyTotalDU,
    spaceTotals,
    spaceBlackTotals,
    spaceGreyTotals,
    breakdown,
    detailedSteps,
    displayFlow: ip ? `${flowGPM.toFixed(1)} GPM` : `${flowLPS.toFixed(2)} L/s`
  };
}
