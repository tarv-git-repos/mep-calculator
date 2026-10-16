
export function computeSmokeExtractFanData(
  area: number | "",
  height: number | "",
  acph: number | "",
  fanQty: number | "",
  ductLength: number | "",
  frictionFactor: number | "",
  louverLoss: number | "",
  fanLoss: number | "",
  effMotor: number | "",
  effFan: number | "",
  numFansMotor: number | ""
) {
  const areaVal = area !== "" ? Number(area) : 100;
  const heightVal = height !== "" ? Number(height) : 3.0;
  const acphVal = acph !== "" ? Number(acph) : 10;
  const fanQtyVal = fanQty !== "" ? Number(fanQty) : 1;
  const ductLenVal = ductLength !== "" ? Number(ductLength) : 20;
  const ffVal = frictionFactor !== "" ? Number(frictionFactor) : 1.0;
  const louverVal = louverLoss !== "" ? Number(louverLoss) : 50;
  const fanLossVal = fanLoss !== "" ? Number(fanLoss) : 20;
  const effMotorVal = effMotor !== "" ? Number(effMotor) : 90;
  const effFanVal = effFan !== "" ? Number(effFan) : 75;
  const numFansVal = numFansMotor !== "" ? Number(numFansMotor) : (fanQtyVal || 1);

  const volume = areaVal * heightVal;
  const smokeExtractRate = (volume * acphVal) / 3600; // m³/s
  const flowEachM3s = smokeExtractRate / (fanQtyVal || 1);
  const flowEachLsRound = Math.ceil((flowEachM3s * 1000) / 5) * 5;

  const fittingsEqLen = ductLenVal * 0.6;
  const totalEqLen = ductLenVal + fittingsEqLen;
  const frictionLoss = ffVal * totalEqLen;
  const baseLosses = frictionLoss + louverVal + fanLossVal;
  const safetyHead = baseLosses * 0.1;
  const totalHead = baseLosses + safetyHead;
  const headRound = Math.round(totalHead / 10) * 10;

  const effM = effMotorVal / 100;
  const effF = effFanVal / 100;

  const powerEach = (flowEachM3s * headRound) / ((effM * effF || 1) * 1000); // kW
  const powerEachRound = Math.ceil(powerEach * 100) / 100; // nearest 0.01 kW
  const totalMotorPower = powerEachRound * 1.1 * numFansVal;

  return {
    volume,
    smokeExtractRate,
    flowEachM3s,
    flowEachLsRound,
    fittingsEqLen,
    totalEqLen,
    frictionLoss,
    totalHead,
    headRound,
    powerEachRound,
    totalMotorPower
  };
}
