export type StandardPreset =
  | "iop_bs"
  | "dubai"
  | "abudhabi"
  | "ipc_upc"
  | "as_nzs_3500"
  | "barrie"
  | "bs_806"
  | "bs_8558"
  | "iop_low"
  | "iop_med"
  | "iop_high"
  | "din_res"
  | "din_hosp"
  | "din_hotel"
  | "din_school"
  | "din_office"
  | "din_assisted"
  | "din_nursing"
  | "ipc"
  | "upc";

export interface LUSpace {
  id: number;
  desc: string;
  floor: string;
  qty: number;
  floorQty?: number;
  std: string;
  fixtures: Record<string, number>;
  comments?: any[];
  flagged?: boolean;
}

export function getLUSpaceValidation(s?: Partial<LUSpace>) {
  const warnings: string[] = [];
  if (!s) return { isFlagged: false, warnings: [] };

  const descEmpty = !s.desc || s.desc.trim() === "";
  const hasFixtures = s.fixtures && Object.values(s.fixtures).some(v => Number(v) > 0);
  const qtyZero = !s.qty || Number(s.qty) <= 0;

  const isCompletelyEmpty = descEmpty && !hasFixtures && qtyZero;

  if (!isCompletelyEmpty) {
    if (descEmpty) warnings.push("Space description is empty");
    if (qtyZero) warnings.push("Space quantity must be at least 1");
    if (!hasFixtures) warnings.push("No fixtures specified for this space");
  }

  const isAutoFlagged = warnings.length > 0;
  const isManualFlagged = s.flagged === true;
  const isFlagged = s.flagged !== undefined ? Boolean(s.flagged) : isAutoFlagged;

  return { isFlagged, isManualFlagged, isAutoFlagged, warnings };
}

export function calculateSpaceLU(space?: Partial<LUSpace>, weights: Record<string, number> = {}): number {
  if (!space || !space.fixtures) return 0;
  return Object.entries(space.fixtures).reduce((sum, [key, val]) => {
    const count = Number(val) || 0;
    const weight = weights[key] ?? 0;
    return sum + count * weight;
  }, 0);
}

export interface StandardCategoryOption {
  id: string;
  label: string;
}

export const STANDARD_CATEGORIES: Record<StandardPreset, StandardCategoryOption[]> = {
  iop_bs: [
    { id: "med", label: "Medium Frequency of Use (Commercial / Offices / Hotels)" },
    { id: "low", label: "Low Frequency of Use (Dwellings / Low Demand)" },
    { id: "high", label: "High Frequency of Use (Public Washrooms / Assembly / Sports)" }
  ],
  dubai: [
    { id: "med", label: "Medium Demand (Commercial / Offices / Hotels)" },
    { id: "low", label: "Low Demand (Dwellings / Private Residential)" },
    { id: "high", label: "High Demand (Public Washrooms / Schools / Sports)" }
  ],
  abudhabi: [
    { id: "med", label: "Medium / Standard Demand (Commercial)" },
    { id: "low", label: "Low / Private Demand (Residential)" },
    { id: "high", label: "High / Public Demand (Assembly / Public)" }
  ],
  ipc_upc: [
    { id: "ipc_total", label: "Total WSFU (IPC Table E103.3(2))" },
    { id: "ipc_cold", label: "Cold Water WSFU (IPC Table E103.3(2))" },
    { id: "ipc_hot", label: "Hot Water WSFU (IPC Table E103.3(2))" },
    { id: "low", label: "Private / Residential WSFU" },
    { id: "high", label: "Public / Assembly WSFU" }
  ],
  as_nzs_3500: [{ id: "std", label: "AS/NZS 3500 Standard Loading" }],
  barrie: [{ id: "std", label: "Barrie's Book Standard Loading" }],
  bs_806: [{ id: "std", label: "BS 806 / BS EN 806 Standard Loading" }],
  bs_8558: [{ id: "std", label: "BS 8558 Standard Loading" }],
  iop_low: [{ id: "std", label: "IoP / CIPHE Low Demand" }],
  iop_med: [{ id: "std", label: "IoP / CIPHE Medium Demand" }],
  iop_high: [{ id: "std", label: "IoP / CIPHE High Demand" }],
  din_res: [{ id: "std", label: "DIN 1988-300 Residential (a=1.48, b=0.19, c=0.94)" }],
  din_hosp: [{ id: "std", label: "DIN 1988-300 Hospital (a=0.75, b=0.44, c=0.18)" }],
  din_hotel: [{ id: "std", label: "DIN 1988-300 Hotel (a=0.70, b=0.48, c=0.13)" }],
  din_school: [{ id: "std", label: "DIN 1988-300 School (a=0.91, b=0.31, c=0.38)" }],
  din_office: [{ id: "std", label: "DIN 1988-300 Office (a=0.91, b=0.31, c=0.38)" }],
  din_assisted: [{ id: "std", label: "DIN 1988-300 Assisted Living (a=1.48, b=0.19, c=0.94)" }],
  din_nursing: [{ id: "std", label: "DIN 1988-300 Nursing Home (a=1.40, b=0.14, c=0.92)" }],
  ipc: [{ id: "std", label: "IPC Table E103.3 Standard Loading" }],
  upc: [{ id: "std", label: "UPC Standard Loading" }]
};

export const DEFAULT_CATEGORY_FOR_PRESET: Record<StandardPreset, string> = {
  iop_bs: "med",
  dubai: "med",
  abudhabi: "med",
  ipc_upc: "ipc_total",
  as_nzs_3500: "std",
  barrie: "std",
  bs_806: "std",
  bs_8558: "std",
  iop_low: "std",
  iop_med: "std",
  iop_high: "std",
  din_res: "std",
  din_hosp: "std",
  din_hotel: "std",
  din_school: "std",
  din_office: "std",
  din_assisted: "std",
  din_nursing: "std",
  ipc: "std",
  upc: "std"
};

export const EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD: Record<string, Record<string, number>> = {
  as_nzs_3500: { wc: 2, handspray: 3, basin: 1, sink: 2, shower: 2, washer: 3, servicesink: 3, hose_bibb: 8, dishwasher: 3, hose_bibb_1: 8, bath: 8, bidet: 1, urinal: 2, bedpan: 3, beverage: 2, birthing: 16, cleaners: 3, fountain: 1, flushing_rim: 3, laundry: 3 },
  barrie: { wc: 2, handspray: 3, basin: 1, sink: 3, shower: 3, washer: 3, servicesink: 3, hose_bibb: 8, dishwasher: 3, hose_bibb_1: 8, bath: 8, bidet: 1, urinal: 2, bedpan: 3, beverage: 3, birthing: 16, cleaners: 3, fountain: 1, flushing_rim: 3, laundry: 3 },
  bs_806: { wc: 1, handspray: 2, basin: 1, sink: 2, shower: 2, washer: 2, servicesink: 2, hose_bibb: 5, dishwasher: 2, hose_bibb_1: 5, bath: 4, bidet: 1, urinal: 3, bedpan: 2, beverage: 2, birthing: 8, cleaners: 2, fountain: 1, flushing_rim: 2, laundry: 2 },
  bs_8558: { wc: 2, handspray: 3, basin: 1.5, sink: 3, shower: 3, washer: 3, servicesink: 3, hose_bibb: 3, dishwasher: 3, hose_bibb_1: 3, bath: 10, bidet: 1, urinal: 2, bedpan: 5, beverage: 3, birthing: 22, cleaners: 3, fountain: 2, flushing_rim: 5, laundry: 3 },
  iop_low: { wc: 1, handspray: 2, basin: 1, sink: 2, shower: 2, washer: 2, servicesink: 2, hose_bibb: 2, dishwasher: 2, hose_bibb_1: 2, bath: 4, bidet: 1, urinal: 1, bedpan: 5, beverage: 2, birthing: 16, cleaners: 2, fountain: 2, flushing_rim: 5, laundry: 2 },
  iop_med: { wc: 2, handspray: 5, basin: 2, sink: 5, shower: 3, washer: 2, servicesink: 5, hose_bibb: 5, dishwasher: 2, hose_bibb_1: 5, bath: 8, bidet: 1, urinal: 1, bedpan: 5, beverage: 5, birthing: 16, cleaners: 5, fountain: 5, flushing_rim: 5, laundry: 5 },
  iop_high: { wc: 5, handspray: 10, basin: 4, sink: 10, shower: 6, washer: 2, servicesink: 10, hose_bibb: 10, dishwasher: 2, hose_bibb_1: 10, bath: 16, bidet: 2, urinal: 1, bedpan: 5, beverage: 10, birthing: 16, cleaners: 10, fountain: 10, flushing_rim: 5, laundry: 10 },
  din_res: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_hosp: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_hotel: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_school: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_office: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_assisted: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_nursing: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  ipc: { wc: 2.5, handspray: 2.25, basin: 1, sink: 1.5, shower: 2, washer: 4, servicesink: 3, hose_bibb: 2.5, dishwasher: 1.5, hose_bibb_1: 2.5, bath: 4, bidet: 2, urinal: 2, bedpan: 3, beverage: 3, birthing: 16, cleaners: 3, fountain: 0.5, flushing_rim: 3, laundry: 1.5 },
  upc: { wc: 2.5, handspray: 3, basin: 1, sink: 1.5, shower: 2, washer: 4, servicesink: 3, hose_bibb: 2.5, dishwasher: 1.5, hose_bibb_1: 2.5, bath: 4, bidet: 2, urinal: 2, bedpan: 3, beverage: 1.5, birthing: 16, cleaners: 3, fountain: 0.5, flushing_rim: 3, laundry: 1.5 }
};

export const STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY: Record<
  StandardPreset,
  Record<string, Record<string, number>>
> = {
  // ðŸ‡¬ðŸ‡§ IoP PESDG Table 15 / BS EN 806 (Loading Units - LU)
  iop_bs: {
    low: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_low,
    med: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_med,
    high: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_high,
  },
  // ðŸ‡¦ðŸ‡ª Dubai Standard (DBC 2021 / BS EN 806-3 / CIBSE Guide G)
  dubai: {
    low: { wc: 1.5, wc_tank: 1.5, wc_valve: 15.0, handspray: 1.0, basin: 1.0, sink: 1.5, shower: 1.5, washer: 2.0, servicesink: 2.0, hose_bibb: 1.5, dishwasher: 1.5, hose_bibb_1: 1.0, bath: 4.0, bibtap: 1.5 },
    med: { wc: 2.5, wc_tank: 2.0, wc_valve: 28.0, handspray: 1.0, basin: 1.0, sink: 1.5, shower: 2.0, washer: 3.0, servicesink: 3.0, hose_bibb: 2.5, dishwasher: 1.5, hose_bibb_1: 1.0, bath: 10.0, bibtap: 2.5 },
    high: { wc: 2.5, wc_tank: 2.5, wc_valve: 28.0, handspray: 2.0, basin: 2.0, sink: 5.0, shower: 4.0, washer: 4.0, servicesink: 5.0, hose_bibb: 5.0, dishwasher: 4.0, hose_bibb_1: 2.5, bath: 12.0, bibtap: 5.0 }
  },
  // ðŸ‡¦ðŸ‡ª Abu Dhabi Standard (ADM Table 6-7 / Table 6-9)
  abudhabi: {
    low: { wc: 2.5, wc_tank: 2.5, wc_valve: 3.5, handspray: 0.75, basin: 0.75, sink: 1.125, shower: 1.5, washer: 1.5, servicesink: 2.25, hose_bibb: 1.5, dishwasher: 1.4, hose_bibb_1: 1.0, bath: 1.4, bibtap: 1.5 },
    med: { wc: 2.5, wc_tank: 2.5, wc_valve: 5.0, handspray: 1.0, basin: 1.0, sink: 1.5, shower: 2.0, washer: 3.0, servicesink: 3.0, hose_bibb: 2.5, dishwasher: 1.5, hose_bibb_1: 1.0, bath: 1.4, bibtap: 2.5 },
    high: { wc: 3.5, wc_tank: 3.5, wc_valve: 8.0, handspray: 2.0, basin: 2.0, sink: 2.0, shower: 4.0, washer: 4.0, servicesink: 3.0, hose_bibb: 3.0, dishwasher: 3.0, hose_bibb_1: 2.0, bath: 3.0, bibtap: 3.0 }
  },
  // ðŸŒ International IPC / UPC Standard (IPC Table E103.3(2))
  ipc_upc: {
    ipc_total: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc,
    ipc_cold: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc,
    ipc_hot: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc,
    low: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc,
    high: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc
  },
  as_nzs_3500: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.as_nzs_3500 },
  barrie: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.barrie },
  bs_806: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.bs_806 },
  bs_8558: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.bs_8558 },
  iop_low: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_low },
  iop_med: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_med },
  iop_high: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_high },
  din_res: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_res },
  din_hosp: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_hosp },
  din_hotel: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_hotel },
  din_school: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_school },
  din_office: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_office },
  din_assisted: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_assisted },
  din_nursing: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_nursing },
  ipc: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc },
  upc: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.upc }
};

export const STANDARD_FIXTURE_WEIGHTS: Record<StandardPreset, Record<string, number>> = {
  iop_bs: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.iop_bs.med,
  dubai: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.dubai.med,
  abudhabi: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.abudhabi.med,
  ipc_upc: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.ipc_upc.ipc_total,
  as_nzs_3500: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.as_nzs_3500,
  barrie: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.barrie,
  bs_806: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.bs_806,
  bs_8558: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.bs_8558,
  iop_low: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_low,
  iop_med: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_med,
  iop_high: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_high,
  din_res: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_res,
  din_hosp: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_hosp,
  din_hotel: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_hotel,
  din_school: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_school,
  din_office: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_office,
  din_assisted: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_assisted,
  din_nursing: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_nursing,
  ipc: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc,
  upc: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.upc
};

export const LU_FIXTURES_META = [
  { id: 'wc', key: 'wc', label: 'W/C', short: 'W/C' },
  { id: 'handspray', key: 'handspray', label: 'Hand Spray', short: 'Hand Spray (Bibb)' },
  { id: 'basin', key: 'basin', label: 'WASH BASIN', short: 'WASH BASIN' },
  { id: 'sink', key: 'sink', label: 'Sink Kitchen', short: 'Sink Kitchen' },
  { id: 'shower', key: 'shower', label: 'Shower', short: 'Shower' },
  { id: 'washer', key: 'washer', label: 'WASHING MACHINE', short: 'WASHING MACHINE' },
  { id: 'servicesink', key: 'servicesink', label: 'Service Sink', short: 'Service Sink' },
  { id: 'hose_bibb', key: 'hose_bibb', label: 'Hose Bibb', short: 'Hose Bibb' },
  { id: 'dishwasher', key: 'dishwasher', label: 'DISH WASHER', short: 'DISH WASHER' },
  { id: 'hose_bibb_1', key: 'hose_bibb_1', label: 'Bib Tap', short: 'Bib Tap' }
];

// UPC Abu Dhabi / UBC Table 6-9 Lookup Table (WSFU -> L/min)
const ADM_TABLE_6_9 = [
  { wsfu: 1, lmin: 0 },
  { wsfu: 2, lmin: 3.8 },
  { wsfu: 3, lmin: 11 },
  { wsfu: 4, lmin: 15 },
  { wsfu: 5, lmin: 19 },
  { wsfu: 6, lmin: 23 },
  { wsfu: 8, lmin: 25 },
  { wsfu: 10, lmin: 30 },
  { wsfu: 12, lmin: 34 },
  { wsfu: 14, lmin: 42 },
  { wsfu: 16, lmin: 45 },
  { wsfu: 18, lmin: 49 },
  { wsfu: 20, lmin: 53 },
  { wsfu: 25, lmin: 64 },
  { wsfu: 30, lmin: 76 },
  { wsfu: 35, lmin: 87 },
  { wsfu: 40, lmin: 95 },
  { wsfu: 45, lmin: 102 },
  { wsfu: 50, lmin: 110 },
  { wsfu: 60, lmin: 121 },
  { wsfu: 70, lmin: 132 },
  { wsfu: 80, lmin: 144 },
  { wsfu: 90, lmin: 155 },
  { wsfu: 100, lmin: 167 },
  { wsfu: 120, lmin: 182 },
  { wsfu: 140, lmin: 201 },
  { wsfu: 160, lmin: 216 },
  { wsfu: 180, lmin: 231 },
  { wsfu: 200, lmin: 246 },
  { wsfu: 225, lmin: 265 },
  { wsfu: 250, lmin: 284 },
  { wsfu: 275, lmin: 303 },
  { wsfu: 300, lmin: 322 },
  { wsfu: 400, lmin: 397 },
  { wsfu: 500, lmin: 473 },
  { wsfu: 750, lmin: 643 },
  { wsfu: 1000, lmin: 787 },
  { wsfu: 1250, lmin: 908 },
  { wsfu: 1500, lmin: 1011 },
  { wsfu: 1750, lmin: 1113 },
  { wsfu: 2000, lmin: 1215 },
  { wsfu: 2250, lmin: 1317 },
  { wsfu: 2500, lmin: 1419 },
  { wsfu: 2750, lmin: 1522 },
  { wsfu: 3000, lmin: 1635 },
  { wsfu: 4000, lmin: 1987 },
  { wsfu: 5000, lmin: 2245 },
  { wsfu: 6000, lmin: 2434 },
  { wsfu: 7000, lmin: 2593 },
  { wsfu: 8000, lmin: 2718 },
  { wsfu: 9000, lmin: 2820 },
  { wsfu: 10000, lmin: 2911 }
];

// Reference Lookup Tables & Empirical Calculations (from CIPHE, BS 8558, BS EN 806, IPC, UPC, AS/NZS 3500 & DIN 1988-300)

export const BS_8558_IOP_LOOKUP: Record<number, number> = {
  0: 0.00, 1: 0.09, 3: 0.15, 5: 0.20, 10: 0.30, 15: 0.38,
  20: 0.44, 30: 0.56, 40: 0.67, 50: 0.77, 80: 1.06, 100: 1.25,
  150: 1.68, 200: 2.11, 250: 2.44, 300: 2.80, 400: 3.55, 500: 4.10,
  700: 5.25, 1000: 6.76, 2000: 11.30, 3000: 15.10, 4000: 18.50,
  5000: 22.50, 6000: 25.20, 7000: 28.00, 7750: 30.00
};

export const BS_EN_806_LOOKUP: Record<number, number> = {
  1: 0.10, 2: 0.20, 3: 0.24, 4: 0.27, 5: 0.29, 6: 0.32, 7: 0.34,
  8: 0.36, 9: 0.38, 10: 0.40, 15: 0.46, 20: 0.52, 30: 0.62, 40: 0.70,
  50: 0.78, 60: 0.83, 70: 0.90, 80: 0.95, 90: 1.00, 100: 1.05,
  150: 1.25, 200: 1.40, 300: 1.70, 400: 2.00, 500: 2.30, 600: 2.60,
  700: 2.80, 800: 3.00, 900: 3.20, 1000: 3.40, 2000: 5.25, 3000: 6.75,
  5000: 9.00, 6000: 9.91, 7000: 10.87, 8000: 11.79, 9000: 12.66, 10000: 13.49
};

export const IPC_LOOKUP: Record<number, number> = {
  1: 0.1892706, 2: 0.315451, 3: 0.4100863, 4: 0.5047216, 5: 0.59304788, 6: 0.67506514,
  7: 0.74446436, 8: 0.80755456, 9: 0.86433574, 10: 0.92111692, 11: 0.97158908, 12: 1.0094432,
  13: 1.0409883, 14: 1.0725334, 15: 1.1040785, 16: 1.1356236, 17: 1.16085968, 18: 1.18609576,
  19: 1.21133184, 20: 1.23656792, 25: 1.3564393, 30: 1.47000166, 35: 1.57094598, 40: 1.65927226,
  45: 1.74759854, 50: 1.83592482, 60: 2.0188864, 70: 2.208157, 80: 2.3974276, 90: 2.5866982,
  100: 2.7444237, 120: 3.0283296, 140: 3.3122355, 160: 3.5961414, 180: 3.8485022, 200: 4.100863,
  225: 4.416314, 250: 4.731765, 275: 5.047216, 300: 5.362667, 400: 6.624471, 500: 7.8231848,
  750: 10.725334, 1000: 13.1227616, 1250: 15.0785578, 1500: 16.9712638, 1750: 18.7378894, 2000: 20.504315,
  2500: 23.974276, 3000: 27.3180566, 4000: 33.122355, 5000: 37.4124886
};

export const UPC_LOOKUP: Record<number, number> = {
  0: 0.00, 10: 0.5047216, 20: 0.946353, 40: 1.577255, 60: 2.0819766, 80: 2.3974276,
  100: 2.7128786, 120: 3.0283296, 140: 3.3437806, 160: 3.5961414, 180: 3.785412,
  200: 4.0377728, 220: 4.2270434, 240: 4.4794042, 250: 4.6055846, 500: 7.886275,
  750: 10.725334, 1000: 13.1227616, 1500: 17.034354, 2000: 20.504315, 2500: 23.8480956,
  3000: 27.128786
};

export const AS_NZS_3500_LOOKUP: Record<number, number> = {
  1: 0.09, 2: 0.12, 3: 0.14, 4: 0.16, 5: 0.18, 6: 0.20, 7: 0.22,
  8: 0.24, 9: 0.25, 10: 0.26, 11: 0.28, 12: 0.29, 13: 0.30, 14: 0.31,
  15: 0.33, 16: 0.34, 17: 0.35, 18: 0.36, 19: 0.37, 20: 0.38, 21: 0.39,
  22: 0.40, 23: 0.41, 24: 0.42, 25: 0.43, 26: 0.43, 27: 0.44, 28: 0.45,
  29: 0.46, 30: 0.47, 31: 0.48, 32: 0.49, 33: 0.49, 34: 0.50, 35: 0.51,
  36: 0.52, 37: 0.52, 38: 0.53, 39: 0.54, 40: 0.55, 41: 0.55, 42: 0.56,
  43: 0.57, 44: 0.58, 45: 0.58, 46: 0.59, 47: 0.60, 48: 0.60, 49: 0.61,
  50: 0.62, 51: 0.62, 52: 0.63, 53: 0.64, 54: 0.64, 55: 0.65, 56: 0.65,
  57: 0.66, 58: 0.67, 59: 0.67, 60: 0.68, 100: 1.20, 150: 1.35, 200: 1.45,
  250: 1.60, 300: 1.70, 350: 1.85, 400: 2.00, 450: 2.15, 500: 2.35, 550: 2.50,
  600: 2.60, 650: 2.75, 700: 2.85, 750: 2.95, 800: 3.05, 850: 3.20, 900: 3.30,
  950: 3.40, 1000: 3.50, 1200: 3.80, 1400: 4.20, 1600: 4.60, 1800: 4.90, 2000: 5.25,
  2200: 5.50, 2400: 5.75, 2600: 6.00, 2800: 6.35, 3000: 6.70, 3500: 7.25, 4000: 7.75,
  4500: 8.40, 5000: 9.00
};

export const BARRIES_BOOK_LOOKUP: Record<number, number> = {
  1: 0.1, 2: 0.12, 3: 0.15, 4: 0.18, 5: 0.21, 6: 0.23, 7: 0.24, 8: 0.25, 9: 0.26, 10: 0.27,
  11: 0.28, 12: 0.29, 13: 0.3, 14: 0.31, 15: 0.32, 16: 0.33, 17: 0.34, 18: 0.35, 19: 0.36, 20: 0.38,
  30: 0.42, 40: 0.45, 50: 0.52, 60: 0.64, 70: 0.73, 80: 0.83, 90: 0.92, 100: 1, 110: 1.1, 120: 1.2,
  130: 1.27, 140: 1.35, 150: 1.42, 160: 1.5, 170: 1.57, 180: 1.65, 190: 1.72, 200: 1.8, 240: 1.97,
  280: 2.2, 320: 2.42, 360: 2.57, 400: 2.73, 440: 2.95, 480: 3.1, 520: 3.26, 560: 3.41, 600: 3.48,
  640: 3.64, 680: 3.79, 720: 3.86, 760: 4.01, 800: 4.09, 840: 4.17, 880: 4.32, 920: 4.39, 960: 4.47,
  1000: 4.54, 1040: 4.7, 1080: 4.77, 1120: 4.85, 1160: 5, 1200: 5.07, 1240: 5.15, 1280: 5.23, 1320: 5.38,
  1360: 5.45, 1400: 5.53, 1440: 5.6, 1480: 5.68, 1520: 5.76, 1560: 5.91, 1600: 5.98, 1640: 6.06, 1680: 6.13,
  1720: 6.29, 1760: 6.36, 1800: 6.44, 1840: 6.51, 1880: 6.66, 1920: 6.74, 1960: 6.82, 2000: 6.89, 2040: 7.04,
  2080: 7.12, 2120: 7.19, 2160: 7.27, 2200: 7.42, 2240: 7.5, 2280: 7.57, 2320: 7.65, 2360: 7.8, 2400: 7.88,
  2440: 7.95, 2480: 8.03, 2520: 8.18, 2560: 8.25, 2600: 8.33, 2640: 8.48, 2680: 8.56, 2720: 8.63, 2760: 8.71,
  2800: 8.78, 2840: 8.94, 2880: 9.01, 2920: 9.09, 2960: 9.24, 3000: 9.31, 3040: 9.39, 3080: 9.47, 3120: 9.54,
  3160: 9.69, 3200: 9.77, 3240: 9.84, 3280: 9.92, 3320: 10, 3360: 10.15, 3400: 10.22, 3440: 10.3, 3480: 10.45,
  3520: 10.53, 3560: 10.6, 3600: 10.68, 3640: 10.83, 3680: 10.91, 3720: 10.98, 3760: 11.06, 3800: 11.13,
  3840: 11.28, 3880: 11.36, 3920: 11.44, 3960: 11.51, 4000: 11.66, 4500: 12.83, 5000: 14.11, 5500: 15.52,
  6000: 16.92, 6500: 18.44, 7000: 20.10, 7500: 21.91, 8000: 23.66, 8500: 25.55, 9000: 27.60, 9500: 29.80, 10000: 31.89
};

export const DIN_1988_COEFFS: Record<string, { a: number; b: number; c: number }> = {
  residential: { a: 1.48, b: 0.19, c: 0.94 },
  hospital: { a: 0.75, b: 0.44, c: 0.18 },
  hotel: { a: 0.70, b: 0.48, c: 0.13 },
  school: { a: 0.91, b: 0.31, c: 0.38 },
  office: { a: 0.91, b: 0.31, c: 0.38 },
  assisted_living: { a: 1.48, b: 0.19, c: 0.94 },
  nursing_home: { a: 1.40, b: 0.14, c: 0.92 }
};

// Floor / Step Lookup (returns key_max <= totalLU) matching extracted app.js lookupTableValue
export function lookupTableStep(totalLU: number, tableObj: Record<number, number>): number {
  if (totalLU <= 0) return 0;
  const keys = Object.keys(tableObj).map(Number).sort((a, b) => a - b);
  let closestKey = 0;
  for (const key of keys) {
    if (key <= totalLU) {
      closestKey = key;
    } else {
      break;
    }
  }
  return closestKey in tableObj ? tableObj[closestKey] : 0;
}

// Continuous Linear Interpolation between lookup table keys
export function lookupTableInterpolated(totalLU: number, tableObj: Record<number, number>): number {
  if (totalLU <= 0) return 0;
  const keys = Object.keys(tableObj).map(Number).sort((a, b) => a - b);
  if (totalLU <= keys[0]) return tableObj[keys[0]] * (totalLU / keys[0]);
  for (let i = 0; i < keys.length - 1; i++) {
    const k1 = keys[i];
    const k2 = keys[i + 1];
    if (totalLU >= k1 && totalLU <= k2) {
      const v1 = tableObj[k1];
      const v2 = tableObj[k2];
      return v1 + ((totalLU - k1) / (k2 - k1)) * (v2 - v1);
    }
  }
  const lastKey = keys[keys.length - 1];
  const secondLastKey = keys[keys.length - 2];
  const lastVal = tableObj[lastKey];
  const secondLastVal = tableObj[secondLastKey];
  const slope = (lastVal - secondLastVal) / (lastKey - secondLastKey);
  return lastVal + (totalLU - lastKey) * slope;
}

export function calcDinFlowRate(totalLU: number, buildingType: string = "residential"): number {
  if (totalLU <= 0) return 0;
  if (totalLU <= 0.2) return totalLU;
  const coeff = DIN_1988_COEFFS[buildingType] || DIN_1988_COEFFS.residential;
  return Math.max(0, coeff.a * Math.pow(totalLU, coeff.b) - coeff.c);
}

export function getFlowLPS(
  totalLU: number,
  standard: StandardPreset,
  mode: "interpolated" | "step" = "step"
): number {
  if (totalLU <= 0) return 0;

  const lookupFn = mode === "interpolated" ? lookupTableInterpolated : lookupTableStep;

  switch (standard) {
    case "as_nzs_3500":
      return lookupFn(totalLU, AS_NZS_3500_LOOKUP);
    case "barrie":
      return lookupFn(totalLU, BARRIES_BOOK_LOOKUP);
    case "bs_806":
      return lookupFn(totalLU, BS_EN_806_LOOKUP);
    case "bs_8558":
    case "iop_bs":
    case "iop_low":
    case "iop_med":
    case "iop_high":
      return lookupFn(totalLU, BS_8558_IOP_LOOKUP);
    case "din_res":
      return calcDinFlowRate(totalLU, "residential");
    case "din_hosp":
      return calcDinFlowRate(totalLU, "hospital");
    case "din_hotel":
      return calcDinFlowRate(totalLU, "hotel");
    case "din_school":
      return calcDinFlowRate(totalLU, "school");
    case "din_office":
      return calcDinFlowRate(totalLU, "office");
    case "din_assisted":
      return calcDinFlowRate(totalLU, "assisted_living");
    case "din_nursing":
      return calcDinFlowRate(totalLU, "nursing_home");
    case "ipc":
    case "ipc_upc":
      return lookupFn(totalLU, IPC_LOOKUP);
    case "upc":
      return lookupFn(totalLU, UPC_LOOKUP);
    case "dubai":
      return 0.1 * Math.sqrt(totalLU);
    case "abudhabi": {
      for (let i = 0; i < ADM_TABLE_6_9.length - 1; i++) {
        const curr = ADM_TABLE_6_9[i];
        const next = ADM_TABLE_6_9[i + 1];
        if (totalLU >= curr.wsfu && totalLU <= next.wsfu) {
          const lmin = curr.lmin + ((totalLU - curr.wsfu) / (next.wsfu - curr.wsfu)) * (next.lmin - curr.lmin);
          return lmin / 60; // Convert L/min to L/s
        }
      }
      if (totalLU > 10000) return (2911 + (totalLU - 10000) * 0.2) / 60;
      return 0;
    }
    default:
      return lookupFn(totalLU, BS_8558_IOP_LOOKUP);
  }
}

export function convertFlowRate(
  flowLPS: number,
  targetUnit: "l-sec" | "l-min" | "m3-h" | "gpm"
): { val: number; formatted: string } {
  switch (targetUnit) {
    case "l-min": {
      const val = flowLPS * 60;
      return { val, formatted: `${val.toFixed(2)} L/min` };
    }
    case "l-sec": {
      const val = flowLPS;
      return { val, formatted: `${val.toFixed(3)} L/s` };
    }
    case "m3-h": {
      const val = flowLPS * 3.6;
      return { val, formatted: `${val.toFixed(3)} mÂ³/h` };
    }
    case "gpm": {
      const val = flowLPS * 15.850323074;
      return { val, formatted: `${val.toFixed(2)} GPM` };
    }
    default: {
      const val = flowLPS;
      return { val, formatted: `${val.toFixed(3)} L/s` };
    }
  }
}

// Recommended Pipe Sizing Table (15mm to 200mm) matching Table from Image 2
export const PIPE_SIZING_TABLE = [
  { sizeMM: 15, wsfuRange: "1 to 3", luMax: 3, flowMax: 0.18, q4fps: 0.21372, q5fps: 0.26494, q6fps: 0.32146 },
  { sizeMM: 20, wsfuRange: "3.5 to 6", luMax: 6, flowMax: 0.38, q4fps: 0.37994, q5fps: 0.47100, q6fps: 0.57148 },
  { sizeMM: 25, wsfuRange: "6.5 to 14", luMax: 14, flowMax: 0.70, q4fps: 0.59366, q5fps: 0.73594, q6fps: 0.89294 },
  { sizeMM: 32, wsfuRange: "14.5 to 25", luMax: 25, flowMax: 1.07, q4fps: 0.97265, q5fps: 1.20576, q6fps: 1.46299 },
  { sizeMM: 40, wsfuRange: "25.5 to 30", luMax: 30, flowMax: 1.27, q4fps: 1.51976, q5fps: 1.88400, q6fps: 2.28592 },
  { sizeMM: 50, wsfuRange: "30.5 to 80", luMax: 80, flowMax: 2.40, q4fps: 2.37463, q5fps: 2.94375, q6fps: 3.57175 },
  { sizeMM: 65, wsfuRange: "80.5 to 275", luMax: 275, flowMax: 5.05, q4fps: 4.013116, q5fps: 4.974938, q6fps: 6.036258 },
  { sizeMM: 80, wsfuRange: "275.5 to 500", luMax: 500, flowMax: 7.88, q4fps: 6.07904, q5fps: 7.53600, q6fps: 9.14368 },
  { sizeMM: 100, wsfuRange: "501 to 750", luMax: 750, flowMax: 10.72, q4fps: 9.49850, q5fps: 11.77500, q6fps: 14.28700 },
  { sizeMM: 150, wsfuRange: "750 to 4000", luMax: 4000, flowMax: 33.12, q4fps: 21.371625, q5fps: 26.49375, q6fps: 32.14575 },
  { sizeMM: 200, wsfuRange: "4001 to 10000", luMax: 10000, flowMax: 48.52, q4fps: 37.99400, q5fps: 47.10000, q6fps: 57.14800 }
];

export function getStandardDemandHeaderTitle(standardPreset: StandardPreset): string {
  switch (standardPreset) {
    case "abudhabi":
      return "MEDIUM FREQUENCY APPLICATION";
    case "dubai":
      return "BUILDING WATER DEMAND (DBC / BS EN 806)";
    case "iop_bs":
    case "iop_low":
    case "iop_med":
    case "iop_high":
    case "bs_8558":
    case "bs_806":
      return "INSTITUTE OF PLUMBING DEMAND (IoP PESDG / BS 6700)";
    case "din_res":
    case "din_hosp":
    case "din_hotel":
    case "din_school":
    case "din_office":
    case "din_assisted":
    case "din_nursing":
      return "GERMAN STANDARD DIN 1988-300 DEMAND";
    case "as_nzs_3500":
      return "AUSTRALIAN / NZ STANDARD AS/NZS 3500 DEMAND";
    case "barrie":
      return "BARRIE'S BOOK WATER DEMAND";
    case "ipc":
    case "upc":
    case "ipc_upc":
      return "INTERNATIONAL PLUMBING CODE DEMAND";
    default:
      return "INTERNATIONAL PLUMBING CODE DEMAND";
  }
}

export function getRecommendedPipeSize(lu: number, flowLPS: number): { sizeMM: number; maxFlowLPS: number } {
  for (const entry of PIPE_SIZING_TABLE) {
    if (lu <= entry.luMax || flowLPS <= entry.flowMax) {
      return { sizeMM: entry.sizeMM, maxFlowLPS: entry.flowMax };
    }
  }
  return { sizeMM: 200, maxFlowLPS: 48.52 };
}


export function computeLoadingUnitCalculations(
  iopSpaces: LUSpace[],
  standardPreset: StandardPreset,
  selectedCategory: string,
  weightOverrides: Record<string, number>,
  ip: boolean,
  showSpaceQty: boolean,
  showFloorsCol: boolean
) {
  let totalLU = 0;
  const spaceUnitLU: Record<number, number> = {};
  const spaceTotalsLU: Record<number, number> = {};
  const catDict = STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY[standardPreset];
  const defaultCat = DEFAULT_CATEGORY_FOR_PRESET[standardPreset];

  iopSpaces.forEach(s => {
    const cat = s.std && catDict[s.std] ? s.std : selectedCategory;
    const baseWeights = catDict[cat] || catDict[defaultCat] || STANDARD_FIXTURE_WEIGHTS[standardPreset];
    // Include custom user overrides for active category
    const weights = (!s.std || s.std === selectedCategory)
      ? { ...baseWeights, ...weightOverrides }
      : baseWeights;

    let unitLU = 0;
    LU_FIXTURES_META.forEach(f => {
      const count = s.fixtures[f.id] || 0;
      if (count > 0) {
        const w = weights[f.id] ?? 0;
        unitLU += count * w;
      }
    });

    const qty = showSpaceQty ? (s.qty || 1) : 1;
    const floorQty = showFloorsCol ? (s.floorQty || 1) : 1;
    const spaceTotal = unitLU * qty * floorQty;

    spaceUnitLU[s.id] = unitLU;
    spaceTotalsLU[s.id] = spaceTotal;
    totalLU += spaceTotal;
  });

  const flowLPS = getFlowLPS(totalLU, standardPreset);
  const flowGPM = flowLPS * 15.8503;
  const selectedFlowLPS = Math.ceil(flowLPS * 2) / 2; // CEILING to nearest 0.5 L/s
  const isWsfu = standardPreset === "abudhabi" || standardPreset === "ipc_upc" || standardPreset === "ipc" || standardPreset === "upc";
  const unitLabel = isWsfu ? "WSFU" : "LU";
  const pipeSizing = getRecommendedPipeSize(totalLU, flowLPS);

  return {
    totalLU,
    spaceUnitLU,
    spaceTotalsLU,
    flowLPS,
    flowGPM,
    selectedFlowLPS,
    pipeSizing,
    unitLabel,
    displayFlow: ip ? `${flowGPM.toFixed(1)} GPM` : `${flowLPS.toFixed(3)} L/s`,
    displaySelectedFlow: ip ? `${(selectedFlowLPS * 15.8503).toFixed(1)} GPM` : `${selectedFlowLPS.toFixed(1)} L/s`
  };
}
