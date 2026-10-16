export type UnitSystem = "metric" | "imperial";

export interface UnitDefinition {
  id: string;
  name: string;
  symbol: string;
  type: "power" | "length" | "area" | "temperature" | "current" | "voltage";
  toBaseFactor: number;
}

export interface UnitConversion {
  value: number;
  fromUnit: string;
  toUnit: string;
}
