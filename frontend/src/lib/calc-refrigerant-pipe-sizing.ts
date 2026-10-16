export type LineType = "suction" | "liquid" | "discharge";
export type RefrigerantType = "R410A" | "R32" | "R134a" | "R22" | "R407C" | "R404A" | "R1234ze" | "R290" | "R454B";

export interface RefrigerantParams {
  coolingCapacity: number | ""; // TR (IP) or kW (SI)
  refrigerant: RefrigerantType;
  lineType: LineType;
  pipeLength: number | ""; // m (SI) or ft (IP)
  fittingsAllowancePct: number | ""; // %
  evaporatingTemp: number | ""; // °C (SI) or °F (IP)
  condensingTemp: number | ""; // °C (SI) or °F (IP)
  designSafetyMargin: number | ""; // %
}

export interface PipeSizingTier {
  minCapTr: number;
  maxCapTr: number;
  odMm: number;
  odInches: string;
  idMm: number;
  idInches: number;
}

export const PIPE_SIZING_TABLES: Record<LineType, Record<string, { tiers: PipeSizingTier[]; minVelMps: number; maxVelMps: number; minVelFpm: number; maxVelFpm: number }>> = {
  suction: {
    R410A: {
      minVelMps: 4.5,
      maxVelMps: 20.0,
      minVelFpm: 900,
      maxVelFpm: 4000,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.5, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.5, maxCapTr: 3.0, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 3.0, maxCapTr: 6.0, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
        { minCapTr: 6.0, maxCapTr: 12.0, odMm: 19.05, odInches: '3/4"', idMm: 17.1, idInches: 0.673 },
        { minCapTr: 12.0, maxCapTr: 20.0, odMm: 22.22, odInches: '7/8"', idMm: 20.0, idInches: 0.787 },
        { minCapTr: 20.0, maxCapTr: 35.0, odMm: 28.58, odInches: '1-1/8"', idMm: 26.0, idInches: 1.024 },
        { minCapTr: 35.0, maxCapTr: 60.0, odMm: 34.93, odInches: '1-3/8"', idMm: 32.0, idInches: 1.260 },
        { minCapTr: 60.0, maxCapTr: 100.0, odMm: 41.28, odInches: '1-5/8"', idMm: 38.0, idInches: 1.496 },
        { minCapTr: 100.0, maxCapTr: 150.0, odMm: 53.98, odInches: '2-1/8"', idMm: 50.0, idInches: 1.969 },
        { minCapTr: 150.0, maxCapTr: 250.0, odMm: 66.68, odInches: '2-5/8"', idMm: 62.0, idInches: 2.441 },
      ]
    },
    R32: {
      minVelMps: 4.5,
      maxVelMps: 20.0,
      minVelFpm: 900,
      maxVelFpm: 4000,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.8, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.8, maxCapTr: 3.5, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 3.5, maxCapTr: 7.0, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
        { minCapTr: 7.0, maxCapTr: 14.0, odMm: 19.05, odInches: '3/4"', idMm: 17.1, idInches: 0.673 },
        { minCapTr: 14.0, maxCapTr: 24.0, odMm: 22.22, odInches: '7/8"', idMm: 20.0, idInches: 0.787 },
        { minCapTr: 24.0, maxCapTr: 40.0, odMm: 28.58, odInches: '1-1/8"', idMm: 26.0, idInches: 1.024 },
        { minCapTr: 40.0, maxCapTr: 70.0, odMm: 34.93, odInches: '1-3/8"', idMm: 32.0, idInches: 1.260 },
        { minCapTr: 70.0, maxCapTr: 115.0, odMm: 41.28, odInches: '1-5/8"', idMm: 38.0, idInches: 1.496 },
        { minCapTr: 115.0, maxCapTr: 175.0, odMm: 53.98, odInches: '2-1/8"', idMm: 50.0, idInches: 1.969 },
        { minCapTr: 175.0, maxCapTr: 300.0, odMm: 66.68, odInches: '2-5/8"', idMm: 62.0, idInches: 2.441 },
      ]
    },
    R134a: {
      minVelMps: 4.0,
      maxVelMps: 18.0,
      minVelFpm: 800,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.0, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.0, maxCapTr: 2.2, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 2.2, maxCapTr: 4.5, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
        { minCapTr: 4.5, maxCapTr: 9.0, odMm: 19.05, odInches: '3/4"', idMm: 17.1, idInches: 0.673 },
        { minCapTr: 9.0, maxCapTr: 16.0, odMm: 22.22, odInches: '7/8"', idMm: 20.0, idInches: 0.787 },
        { minCapTr: 16.0, maxCapTr: 28.0, odMm: 28.58, odInches: '1-1/8"', idMm: 26.0, idInches: 1.024 },
        { minCapTr: 28.0, maxCapTr: 48.0, odMm: 34.93, odInches: '1-3/8"', idMm: 32.0, idInches: 1.260 },
        { minCapTr: 48.0, maxCapTr: 80.0, odMm: 41.28, odInches: '1-5/8"', idMm: 38.0, idInches: 1.496 },
        { minCapTr: 80.0, maxCapTr: 130.0, odMm: 53.98, odInches: '2-1/8"', idMm: 50.0, idInches: 1.969 },
        { minCapTr: 130.0, maxCapTr: 200.0, odMm: 66.68, odInches: '2-5/8"', idMm: 62.0, idInches: 2.441 },
      ]
    },
    R22: {
      minVelMps: 4.5,
      maxVelMps: 18.0,
      minVelFpm: 900,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.2, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.2, maxCapTr: 2.5, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 2.5, maxCapTr: 5.5, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
        { minCapTr: 5.5, maxCapTr: 11.0, odMm: 19.05, odInches: '3/4"', idMm: 17.1, idInches: 0.673 },
        { minCapTr: 11.0, maxCapTr: 18.0, odMm: 22.22, odInches: '7/8"', idMm: 20.0, idInches: 0.787 },
        { minCapTr: 18.0, maxCapTr: 32.0, odMm: 28.58, odInches: '1-1/8"', idMm: 26.0, idInches: 1.024 },
        { minCapTr: 32.0, maxCapTr: 55.0, odMm: 34.93, odInches: '1-3/8"', idMm: 32.0, idInches: 1.260 },
        { minCapTr: 55.0, maxCapTr: 90.0, odMm: 41.28, odInches: '1-5/8"', idMm: 38.0, idInches: 1.496 },
        { minCapTr: 90.0, maxCapTr: 140.0, odMm: 53.98, odInches: '2-1/8"', idMm: 50.0, idInches: 1.969 },
      ]
    },
    R407C: {
      minVelMps: 4.5,
      maxVelMps: 18.0,
      minVelFpm: 900,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.3, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.3, maxCapTr: 2.7, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 2.7, maxCapTr: 5.8, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
        { minCapTr: 5.8, maxCapTr: 11.5, odMm: 19.05, odInches: '3/4"', idMm: 17.1, idInches: 0.673 },
        { minCapTr: 11.5, maxCapTr: 19.0, odMm: 22.22, odInches: '7/8"', idMm: 20.0, idInches: 0.787 },
        { minCapTr: 19.0, maxCapTr: 34.0, odMm: 28.58, odInches: '1-1/8"', idMm: 26.0, idInches: 1.024 },
        { minCapTr: 34.0, maxCapTr: 58.0, odMm: 34.93, odInches: '1-3/8"', idMm: 32.0, idInches: 1.260 },
      ]
    },
    R404A: {
      minVelMps: 4.5,
      maxVelMps: 18.0,
      minVelFpm: 900,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.2, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.2, maxCapTr: 2.6, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 2.6, maxCapTr: 5.6, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
        { minCapTr: 5.6, maxCapTr: 11.2, odMm: 19.05, odInches: '3/4"', idMm: 17.1, idInches: 0.673 },
        { minCapTr: 11.2, maxCapTr: 18.5, odMm: 22.22, odInches: '7/8"', idMm: 20.0, idInches: 0.787 },
        { minCapTr: 18.5, maxCapTr: 33.0, odMm: 28.58, odInches: '1-1/8"', idMm: 26.0, idInches: 1.024 },
      ]
    },
    R1234ze: {
      minVelMps: 4.0,
      maxVelMps: 17.0,
      minVelFpm: 800,
      maxVelFpm: 3300,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.0, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.0, maxCapTr: 2.0, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 2.0, maxCapTr: 4.2, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
        { minCapTr: 4.2, maxCapTr: 8.5, odMm: 19.05, odInches: '3/4"', idMm: 17.1, idInches: 0.673 },
      ]
    },
    R290: {
      minVelMps: 4.5,
      maxVelMps: 18.0,
      minVelFpm: 900,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.4, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.4, maxCapTr: 2.8, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 2.8, maxCapTr: 6.0, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
      ]
    },
    R454B: {
      minVelMps: 4.5,
      maxVelMps: 20.0,
      minVelFpm: 900,
      maxVelFpm: 4000,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.6, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.6, maxCapTr: 3.2, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 3.2, maxCapTr: 6.5, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
      ]
    }
  },
  liquid: {
    R410A: {
      minVelMps: 0.5,
      maxVelMps: 1.5,
      minVelFpm: 100,
      maxVelFpm: 300,
      tiers: [
        { minCapTr: 0, maxCapTr: 2.5, odMm: 6.35, odInches: '1/4"', idMm: 4.8, idInches: 0.189 },
        { minCapTr: 2.5, maxCapTr: 6.0, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 6.0, maxCapTr: 15.0, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 15.0, maxCapTr: 30.0, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
        { minCapTr: 30.0, maxCapTr: 60.0, odMm: 19.05, odInches: '3/4"', idMm: 17.1, idInches: 0.673 },
        { minCapTr: 60.0, maxCapTr: 110.0, odMm: 22.22, odInches: '7/8"', idMm: 20.0, idInches: 0.787 },
        { minCapTr: 110.0, maxCapTr: 200.0, odMm: 28.58, odInches: '1-1/8"', idMm: 26.0, idInches: 1.024 },
      ]
    },
    R32: {
      minVelMps: 0.5,
      maxVelMps: 1.5,
      minVelFpm: 100,
      maxVelFpm: 300,
      tiers: [
        { minCapTr: 0, maxCapTr: 3.0, odMm: 6.35, odInches: '1/4"', idMm: 4.8, idInches: 0.189 },
        { minCapTr: 3.0, maxCapTr: 7.0, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 7.0, maxCapTr: 18.0, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 18.0, maxCapTr: 36.0, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
        { minCapTr: 36.0, maxCapTr: 72.0, odMm: 19.05, odInches: '3/4"', idMm: 17.1, idInches: 0.673 },
      ]
    },
    R134a: {
      minVelMps: 0.4,
      maxVelMps: 1.2,
      minVelFpm: 80,
      maxVelFpm: 240,
      tiers: [
        { minCapTr: 0, maxCapTr: 2.0, odMm: 6.35, odInches: '1/4"', idMm: 4.8, idInches: 0.189 },
        { minCapTr: 2.0, maxCapTr: 5.0, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 5.0, maxCapTr: 12.0, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 12.0, maxCapTr: 25.0, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
      ]
    },
    R22: {
      minVelMps: 0.5,
      maxVelMps: 1.3,
      minVelFpm: 100,
      maxVelFpm: 260,
      tiers: [
        { minCapTr: 0, maxCapTr: 2.2, odMm: 6.35, odInches: '1/4"', idMm: 4.8, idInches: 0.189 },
        { minCapTr: 2.2, maxCapTr: 5.5, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 5.5, maxCapTr: 13.0, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
      ]
    },
    R407C: {
      minVelMps: 0.5,
      maxVelMps: 1.4,
      minVelFpm: 100,
      maxVelFpm: 280,
      tiers: [
        { minCapTr: 0, maxCapTr: 2.3, odMm: 6.35, odInches: '1/4"', idMm: 4.8, idInches: 0.189 },
        { minCapTr: 2.3, maxCapTr: 5.8, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 5.8, maxCapTr: 14.0, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
      ]
    },
    R404A: {
      minVelMps: 0.5,
      maxVelMps: 1.4,
      minVelFpm: 100,
      maxVelFpm: 280,
      tiers: [
        { minCapTr: 0, maxCapTr: 2.0, odMm: 6.35, odInches: '1/4"', idMm: 4.8, idInches: 0.189 },
        { minCapTr: 2.0, maxCapTr: 5.0, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
      ]
    },
    R1234ze: {
      minVelMps: 0.4,
      maxVelMps: 1.2,
      minVelFpm: 80,
      maxVelFpm: 240,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.8, odMm: 6.35, odInches: '1/4"', idMm: 4.8, idInches: 0.189 },
        { minCapTr: 1.8, maxCapTr: 4.5, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
      ]
    },
    R290: {
      minVelMps: 0.5,
      maxVelMps: 1.4,
      minVelFpm: 100,
      maxVelFpm: 280,
      tiers: [
        { minCapTr: 0, maxCapTr: 2.2, odMm: 6.35, odInches: '1/4"', idMm: 4.8, idInches: 0.189 },
        { minCapTr: 2.2, maxCapTr: 5.5, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
      ]
    },
    R454B: {
      minVelMps: 0.5,
      maxVelMps: 1.5,
      minVelFpm: 100,
      maxVelFpm: 300,
      tiers: [
        { minCapTr: 0, maxCapTr: 2.7, odMm: 6.35, odInches: '1/4"', idMm: 4.8, idInches: 0.189 },
        { minCapTr: 2.7, maxCapTr: 6.5, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
      ]
    }
  },
  discharge: {
    R410A: {
      minVelMps: 5.0,
      maxVelMps: 18.0,
      minVelFpm: 1000,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.8, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.8, maxCapTr: 4.0, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 4.0, maxCapTr: 8.0, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
        { minCapTr: 8.0, maxCapTr: 16.0, odMm: 19.05, odInches: '3/4"', idMm: 17.1, idInches: 0.673 },
        { minCapTr: 16.0, maxCapTr: 28.0, odMm: 22.22, odInches: '7/8"', idMm: 20.0, idInches: 0.787 },
        { minCapTr: 28.0, maxCapTr: 50.0, odMm: 28.58, odInches: '1-1/8"', idMm: 26.0, idInches: 1.024 },
      ]
    },
    R32: {
      minVelMps: 5.0,
      maxVelMps: 18.0,
      minVelFpm: 1000,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 2.2, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 2.2, maxCapTr: 4.8, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 4.8, maxCapTr: 9.5, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
        { minCapTr: 9.5, maxCapTr: 19.0, odMm: 19.05, odInches: '3/4"', idMm: 17.1, idInches: 0.673 },
      ]
    },
    R134a: {
      minVelMps: 4.5,
      maxVelMps: 16.0,
      minVelFpm: 900,
      maxVelFpm: 3200,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.4, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.4, maxCapTr: 3.2, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
        { minCapTr: 3.2, maxCapTr: 6.5, odMm: 15.88, odInches: '5/8"', idMm: 14.1, idInches: 0.555 },
      ]
    },
    R22: {
      minVelMps: 5.0,
      maxVelMps: 18.0,
      minVelFpm: 1000,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.6, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
        { minCapTr: 1.6, maxCapTr: 3.6, odMm: 12.7, odInches: '1/2"', idMm: 11.1, idInches: 0.437 },
      ]
    },
    R407C: {
      minVelMps: 5.0,
      maxVelMps: 18.0,
      minVelFpm: 1000,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.7, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
      ]
    },
    R404A: {
      minVelMps: 5.0,
      maxVelMps: 18.0,
      minVelFpm: 1000,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.5, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
      ]
    },
    R1234ze: {
      minVelMps: 4.5,
      maxVelMps: 16.0,
      minVelFpm: 900,
      maxVelFpm: 3200,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.3, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
      ]
    },
    R290: {
      minVelMps: 5.0,
      maxVelMps: 18.0,
      minVelFpm: 1000,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 1.8, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
      ]
    },
    R454B: {
      minVelMps: 5.0,
      maxVelMps: 18.0,
      minVelFpm: 1000,
      maxVelFpm: 3500,
      tiers: [
        { minCapTr: 0, maxCapTr: 2.0, odMm: 9.52, odInches: '3/8"', idMm: 8.0, idInches: 0.315 },
      ]
    }
  }
};

export const DEFAULT_PARAMS: RefrigerantParams = {
  coolingCapacity: 10,
  refrigerant: "R410A",
  lineType: "suction",
  pipeLength: 20,
  fittingsAllowancePct: 20,
  evaporatingTemp: 5,
  condensingTemp: 45,
  designSafetyMargin: 10,
};


export function computeRefrigerantPipeSizing(sizingParams: RefrigerantParams, unitSystem: "si" | "ip") {
  const isIp = unitSystem === "ip";
  const capInput = typeof sizingParams.coolingCapacity === "number" ? sizingParams.coolingCapacity : (isIp ? 10 : 35.17);
  const safetyPct = typeof sizingParams.designSafetyMargin === "number" ? sizingParams.designSafetyMargin : 10;
  const designCapTr = (isIp ? capInput : capInput / 3.51685) * (1 + safetyPct / 100);
  const designCapKw = designCapTr * 3.51685;

  const lenInput = typeof sizingParams.pipeLength === "number" ? sizingParams.pipeLength : (isIp ? 65.6 : 20);
  const fittingsPct = typeof sizingParams.fittingsAllowancePct === "number" ? sizingParams.fittingsAllowancePct : 20;
  const straightLenM = isIp ? lenInput * 0.3048 : lenInput;
  const equivLenM = straightLenM * (1 + fittingsPct / 100);
  const equivLenFt = equivLenM / 0.3048;

  const lineType = sizingParams.lineType;
  const ref = sizingParams.refrigerant;
  const tableData = PIPE_SIZING_TABLES[lineType][ref] || PIPE_SIZING_TABLES[lineType]["R410A"];

  let selectedTier = tableData.tiers[0];
  for (const tier of tableData.tiers) {
    if (designCapTr >= tier.minCapTr && designCapTr <= tier.maxCapTr) {
      selectedTier = tier;
      break;
    }
    if (designCapTr > tier.maxCapTr) {
      selectedTier = tier;
    }
  }

  const deltaHMap: Record<RefrigerantType, number> = {
    R410A: 160,
    R32: 260,
    R134a: 145,
    R22: 165,
    R407C: 155,
    R404A: 120,
    R1234ze: 135,
    R290: 290,
    R454B: 200,
  };
  const deltaH = deltaHMap[ref] || 160;
  const massFlowKgSec = designCapKw / deltaH;
  const massFlowLbMin = massFlowKgSec * 132.277;

  let densityKgM3 = 30.0;
  if (lineType === "liquid") {
    densityKgM3 = ref === "R32" ? 960 : ref === "R134a" ? 1180 : 1040;
  } else if (lineType === "discharge") {
    densityKgM3 = ref === "R32" ? 42 : ref === "R134a" ? 32 : 55;
  } else {
    densityKgM3 = ref === "R32" ? 22 : ref === "R134a" ? 14 : 31;
  }

  const idM = selectedTier.idMm / 1000;
  const areaM2 = (Math.PI * Math.pow(idM, 2)) / 4;
  const volFlowM3Sec = massFlowKgSec / densityKgM3;
  const velocityMps = Number((volFlowM3Sec / areaM2).toFixed(2));
  const velocityFpm = Number((velocityMps * 196.85).toFixed(0));

  let velocityStatus = "OPTIMAL (Self Oil-Return Compliant)";
  let isVelWarning = false;
  if (velocityMps < tableData.minVelMps) {
    velocityStatus = "LOW VELOCITY (Risk of Oil Trapping)";
    isVelWarning = true;
  } else if (velocityMps > tableData.maxVelMps) {
    velocityStatus = "HIGH VELOCITY (Excessive Noise / Pressure Drop)";
    isVelWarning = true;
  }

  const frictionFactor = 0.018; 
  const deltaPPa = frictionFactor * (equivLenM / idM) * (densityKgM3 * Math.pow(velocityMps, 2) / 2);
  const deltaPBar = Number((deltaPPa / 100000).toFixed(3));
  const deltaPPsi = Number((deltaPBar * 14.5038).toFixed(2));
  const deltaPKPa = Number((deltaPPa / 1000).toFixed(1));

  const satTempDropC = Number((deltaPBar * 1.8).toFixed(2));
  const satTempDropF = Number((satTempDropC * 1.8).toFixed(2));

  return {
    isIp,
    capInput,
    designCapTr: Number(designCapTr.toFixed(2)),
    designCapKw: Number(designCapKw.toFixed(2)),
    equivLenM: Number(equivLenM.toFixed(1)),
    equivLenFt: Number(equivLenFt.toFixed(1)),
    selectedTier,
    massFlowKgSec: Number(massFlowKgSec.toFixed(3)),
    massFlowLbMin: Number(massFlowLbMin.toFixed(2)),
    velocityMps,
    velocityFpm,
    minVelMps: tableData.minVelMps,
    maxVelMps: tableData.maxVelMps,
    minVelFpm: tableData.minVelFpm,
    maxVelFpm: tableData.maxVelFpm,
    velocityStatus,
    isVelWarning,
    deltaPBar,
    deltaPPsi,
    deltaPKPa,
    satTempDropC,
    satTempDropF,
  };
}
