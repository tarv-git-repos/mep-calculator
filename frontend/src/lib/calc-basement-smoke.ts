export function calculateSmokeFlows(effArea: number, height: number, ip: boolean) {
  const vol = effArea * height;
  let f3 = 0, f6 = 0, f10 = 0;
  if (ip) {
    // CFM
    f3 = Math.ceil(vol * 3 / 60);
    f6 = Math.ceil(vol * 6 / 60);
    f10 = Math.ceil(vol * 10 / 60);
  } else {
    // L/s
    f3 = Math.ceil(vol * 3 / 3.6);
    f6 = Math.ceil(vol * 6 / 3.6);
    f10 = Math.ceil(vol * 10 / 3.6);
  }
  return { volume: vol, flow3ach: f3, flow6ach: f6, flow10ach: f10 };
}

export function calculateFanStatic(length: number, frictionFactor: number, louver: number, grille: number, sa: number) {
  const fittings = length * 0.6;
  const eqLen = length + fittings;
  const frictionLoss = eqLen * frictionFactor;
  const safety = (frictionLoss + louver + grille + sa) * 0.10;
  const totalStatic = Math.round((frictionLoss + louver + grille + sa + safety) / 10) * 10;
  return { fittings, eqLen, frictionLoss, safety, totalStatic };
}

export function calculateMakeupScaling(flow: number) {
  return Math.round(flow * 0.80);
}
