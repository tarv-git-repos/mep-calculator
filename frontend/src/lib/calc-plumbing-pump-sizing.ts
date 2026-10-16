export const ipcTable = [
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
  let val = Math.max(0, Math.min(wsfu, 5000));
  for (let i = 0; i < ipcTable.length; i++) {
    if (ipcTable[i].wsfu === val) return ipcTable[i].gpm;
  }
  for (let i = 0; i < ipcTable.length - 1; i++) {
    const lower = ipcTable[i];
    const upper = ipcTable[i + 1];
    if (val > lower.wsfu && val < upper.wsfu) {
      const ratio = (val - lower.wsfu) / (upper.wsfu - lower.wsfu);
      return lower.gpm + ratio * (upper.gpm - lower.gpm);
    }
  }
  return 0;
}

export function wsfuToLPS(wsfu: number) {
  return wsfuToGPM(wsfu) * 0.06309;
}


export function computePumpSizingCalculations(
  pipeVert: string,
  pipeHoriz: string,
  fricFactor: string,
  pumpType: string,
  filtCarbon: boolean,
  filtMM: boolean,
  filtCuAg: boolean,
  filtSoftener: boolean,
  staticHead: string,
  presidHead: string,
  suctionHead: string,
  sfHead: string,
  selectedHead: string,
  manualFlow: string,
  effPump: string,
  effMotor: string,
  wsfuVal: string,
  reqVolume: string,
  fillTime: string,
  workingPumps: string
) {
  const vert = parseFloat(pipeVert) || 0;
  const horiz = parseFloat(pipeHoriz) || 0;
  const ff = parseFloat(fricFactor) || 0.4;
  
  const elbows = (vert + horiz) * 0.3;
  const valves = (vert + horiz) * 0.3;
  const L_sum = vert + horiz + elbows + valves;
  const equivLen = Math.ceil((L_sum * 1.05) / 10) * 10;
  const frictionLoss = equivLen * (ff / 100);
  
  let filterLoss = 0;
  if (pumpType === "transfer") {
    if (filtCarbon) filterLoss += 0.8;
    if (filtMM) filterLoss += 0.8;
    if (filtCuAg) filterLoss += 0.2;
    if (filtSoftener) filterLoss += 0.8;
  }
  
  const staticH = parseFloat(staticHead) || 0;
  const outletH = parseFloat(presidHead) || 0;
  const suctionH = parseFloat(suctionHead) || 0;
  const safetyMargin = (parseFloat(sfHead) || 0) / 100;
  
  const rawHead = Math.max(0, (frictionLoss + staticH + outletH) - suctionH) + filterLoss;
  const calcHead = rawHead * (1 + safetyMargin);
  const selHead = parseFloat(selectedHead) || calcHead;
  
  let flowLps = parseFloat(manualFlow) || 0;
  const wPumps = parseInt(workingPumps) || 1;
  
  if (pumpType === "booster" || pumpType === "transfer-booster") {
     const wsfu = parseFloat(wsfuVal) || 0;
     if (wsfu > 0) {
       flowLps = wsfuToLPS(wsfu) / Math.max(1, wPumps);
     }
  } else if (pumpType === "transfer") {
     const req = parseFloat(reqVolume) || 0;
     const time = parseFloat(fillTime) || 0;
     if (req > 0 && time > 0) {
       flowLps = req / (time * 3600);
     }
  }
  
  const liftKpa = selHead * 100;
  const pEff = (parseFloat(effPump) || 70) / 100;
  const mEff = (parseFloat(effMotor) || 85) / 100;
  
  const shaftPower = pEff > 0 ? (flowLps * liftKpa) / (1000 * pEff) : 0;
  const motorPower = mEff > 0 ? shaftPower / mEff : 0;
  const hp = motorPower * 1.34102;
  
  return {
    elbows,
    valves,
    totalLen: L_sum,
    equivLen,
    frictionLoss,
    filterLoss,
    calcHead,
    selectedHead: selHead,
    flowLps,
    liftKpa,
    shaftPower,
    motorPower,
    hp,
  };
}
