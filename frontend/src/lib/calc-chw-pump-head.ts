export const calculateCHWPumpHead = (sizingParams: any, ip: boolean) => {
  const flowGpm = sizingParams.flowUsgpm !== "" ? Number(sizingParams.flowUsgpm) : (ip ? 500 : 500);
  const vertL = sizingParams.vertLength !== "" ? Number(sizingParams.vertLength) : (ip ? 100 : 30);
  const horizL = sizingParams.horizLength !== "" ? Number(sizingParams.horizLength) : (ip ? 400 : 120);
  const ff = sizingParams.frictionFactor !== "" ? Number(sizingParams.frictionFactor) : (ip ? 1.77 : 0.4);
  const statH = sizingParams.staticHead !== "" ? Number(sizingParams.staticHead) : (ip ? 43.5 : 3.0);
  const resP = sizingParams.residualPressure !== "" ? Number(sizingParams.residualPressure) : (ip ? 29 : 2.0);
  const sucP = sizingParams.suctionPressure !== "" ? Number(sizingParams.suctionPressure) : 0.0;
  const sfPercent = sizingParams.safetyFactorHead !== "" ? Number(sizingParams.safetyFactorHead) : 5;
  const effPumpVal = sizingParams.effPump !== "" ? Number(sizingParams.effPump) : 70;
  const effMotorVal = sizingParams.effMotor !== "" ? Number(sizingParams.effMotor) : 85;

  // Normalized internal calculation values in Metric base (m, bar, L/s)
  const L_vert_m = ip ? vertL / 3.28084 : vertL;
  const L_horiz_m = ip ? horizL / 3.28084 : horizL;
  const Q_flow = (flowGpm * 3.78) / 60; // L/s

  // Elbows & Reducers and Isolation Valves calculated dynamically: (vertical + horizontal) * 0.3
  const L_elbows_m = (L_vert_m + L_horiz_m) * 0.3;
  const L_valves_m = (L_vert_m + L_horiz_m) * 0.3;

  // Safety factor for equivalent length is 5%
  const L_sum_m = L_vert_m + L_horiz_m + L_elbows_m + L_valves_m;
  const L_equiv_m = Math.ceil((L_sum_m * 1.05) / 10) * 10;

  const ff_metric = ip ? ff / 4.4207 : ff;
  const H_loss_bar = L_equiv_m * (ff_metric / 100);

  const H_static_bar = ip ? statH / 14.50377 : statH;
  const H_outlet_bar = ip ? resP / 14.50377 : resP;
  const H_suction_bar = ip ? sucP / 14.50377 : sucP;

  const H_pump_calc_bar = Math.max(0, (H_loss_bar + H_static_bar + H_outlet_bar) - H_suction_bar) * (1 + sfPercent / 100);

  // Selected Head
  const rawSelected = Number(sizingParams.selectedHead) || 0;
  const H_selected_bar = rawSelected > 0 
    ? (ip ? rawSelected / 14.50377 : rawSelected) 
    : H_pump_calc_bar;

  const F_flow = Q_flow; // kg/s (assuming water density = 1)
  const L_lift_kpa = H_selected_bar * 100; // kPa

  const eff_pump = (effPumpVal || 70) / 100;
  const eff_motor = (effMotorVal || 85) / 100;

  // Shaft Power = (Flow * Head Lift) / (1000 * Pump Efficiency)
  const P_shaft_kw = (F_flow * L_lift_kpa) / (1000 * (eff_pump || 0.7));
  const P_motor_kw = P_shaft_kw / (eff_motor || 0.85);
  const HP = P_motor_kw * 1.34102;

  // Convert display outputs based on unit system
  const displayLengthUnit = ip ? "ft" : "m";
  const displayHeadUnit = ip ? "psi" : "bar";
  const displayFlowUnit = ip ? "GPM" : "L/s";

  const toDisplayLength = (m: number) => ip ? m * 3.28084 : m;
  const toDisplayHead = (bar: number) => ip ? bar * 14.50377 : bar;
  const toDisplayFlow = (lps: number) => ip ? lps * 15.8503 : lps;

  return {
    flowRate: Q_flow,
    flowGpm,
    vertL,
    horizL,
    ff,
    statH,
    resP,
    sucP,
    sfPercent,
    effPumpVal,
    effMotorVal,
    L_vert_m,
    L_horiz_m,
    L_sum_m,
    L_equiv_m,
    H_loss_bar,
    H_static_bar,
    H_outlet_bar,
    H_suction_bar,
    H_pump_calc_bar,
    H_selected_bar,
    flowRateDisplay: ip ? flowGpm : toDisplayFlow(Q_flow),
    sumLengthsDisplay: toDisplayLength(L_sum_m),
    equivLengthDisplay: toDisplayLength(L_equiv_m),
    elbowsLengthDisplay: toDisplayLength(L_elbows_m),
    valvesLengthDisplay: toDisplayLength(L_valves_m),
    vertLengthDisplay: toDisplayLength(L_vert_m),
    horizLengthDisplay: toDisplayLength(L_horiz_m),
    frictionLossDisplay: toDisplayHead(H_loss_bar),
    staticHeadDisplay: toDisplayHead(H_static_bar),
    residualPressureDisplay: toDisplayHead(H_outlet_bar),
    outletHeadDisplay: toDisplayHead(H_outlet_bar),
    suctionPressureDisplay: toDisplayHead(H_suction_bar),
    suctionHeadDisplay: toDisplayHead(H_suction_bar),
    pumpHeadCalcDisplay: toDisplayHead(H_pump_calc_bar),
    pumpHeadSelectedDisplay: toDisplayHead(H_selected_bar),
    selectedHeadDisplay: toDisplayHead(H_selected_bar),
    massFlow: F_flow,
    liftKpa: L_lift_kpa,
    shaftPowerKw: P_shaft_kw,
    motorPowerKw: P_motor_kw,
    motorPowerHp: HP,
    lengthUnit: displayLengthUnit,
    headUnit: displayHeadUnit,
    flowUnit: displayFlowUnit,
  };
};
