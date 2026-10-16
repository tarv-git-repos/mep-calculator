export type PresetOption = "class_a" | "class_b" | "class_c" | "custom";
export function computeFM200Calculations(
  area: number | "",
  height: number | "",
  preset: PresetOption,
  customConc: number | "",
  temp: number | "",
  useStandardS: boolean,
  safetyFactor: number | "",
  unitSystem: "si" | "ip"
) {
  const isSI = unitSystem === "si";
  const areaVal = area === "" ? 0 : area;
  const heightVal = height === "" ? 0 : height;
  const customConcVal = customConc === "" ? 0 : customConc;
  const tempVal = temp === "" ? 0 : temp;
  const safetyFactorVal = safetyFactor === "" ? 1.0 : safetyFactor;

  // Enclosure Volume
  const volume = areaVal * heightVal;

  // Concentration (C)
  let C = 6.857; // Default Class A
  if (preset === "class_b") {
    C = 8.7;
  } else if (preset === "class_c") {
    C = 7.0;
  } else if (preset === "custom") {
    C = customConcVal;
  }

  // Specific Volume (S)
  let S = 0.1473;
  if (useStandardS) {
    // Standard constant
    if (isSI) {
      S = 0.1473; // m³/kg
    } else {
      // IP equivalent of 0.1473 m³/kg is approx 2.3595 ft³/lb
      S = 2.3595; // ft³/lb
    }
  } else {
    // Temperature-dependent Specific Volume per NFPA 2001 formula
    if (isSI) {
      // T is in Celsius
      S = 0.1269 + 0.000513 * tempVal;
    } else {
      // T is in Fahrenheit
      S = 1.885 + 0.0046 * tempVal;
    }
  }

  // Agent Weight calculation (W)
  // W = (V / S) * (C / (100 - C)) * SafetyFactor
  let weight = 0;
  if (S > 0 && 100 - C > 0) {
    weight = (volume / S) * (C / (100 - C)) * safetyFactorVal;
  }

  // Warnings and limits based on NFPA 2001 guidelines
  const warnings: string[] = [];
  if (C > 9.0) {
    warnings.push("Design concentration exceeds the human exposure NOAEL limit of 9.0%. For occupied spaces, limit exposure time per NFPA 2001.");
  }
  if (C > 10.5) {
    warnings.push("Design concentration exceeds the human exposure LOAEL limit of 10.5%. Strictly restrict occupancy or ensure rapid evacuation.");
  }
  if (C < 5.8) {
    warnings.push("Design concentration is below the minimum UL/FM listing concentration of 5.8% for HFC-227ea systems.");
  }
  if (areaVal <= 0 || heightVal <= 0) {
    warnings.push("Area and height must be positive, non-zero values.");
  }

  return {
    volume,
    C,
    S,
    weight,
    warnings
  };
}
