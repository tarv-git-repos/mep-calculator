export interface TierDimensions {
  length: number;
  breadth: number;
  width: number;
}

export interface AHUDimensionEntry {
  sr_no: number;
  cfm: number;
  l_s: number;
  single_tier: TierDimensions;
  two_tier: TierDimensions;
}

export const AHU_DIMENSIONS_DATA: AHUDimensionEntry[] = [
  {
    sr_no: 1,
    cfm: 790,
    l_s: 373,
    single_tier: { length: 770, breadth: 2578, width: 670 },
    two_tier: { length: 1440, breadth: 2958, width: 970 }
  },
  {
    sr_no: 2,
    cfm: 1245,
    l_s: 588,
    single_tier: { length: 670, breadth: 2578, width: 820 },
    two_tier: { length: 1440, breadth: 2958, width: 1120 }
  },
  {
    sr_no: 3,
    cfm: 1662,
    l_s: 784,
    single_tier: { length: 740, breadth: 920, width: 970 },
    two_tier: { length: 1590, breadth: 2958, width: 1120 }
  },
  {
    sr_no: 4,
    cfm: 2000,
    l_s: 944,
    single_tier: { length: 920, breadth: 2078, width: 1120 },
    two_tier: { length: 1740, breadth: 3258, width: 1120 }
  },
  {
    sr_no: 5,
    cfm: 2585,
    l_s: 1220,
    single_tier: { length: 920, breadth: 2878, width: 1270 },
    two_tier: { length: 1740, breadth: 3258, width: 1270 }
  },
  {
    sr_no: 6,
    cfm: 3075,
    l_s: 1451,
    single_tier: { length: 1220, breadth: 2878, width: 1120 },
    two_tier: { length: 2040, breadth: 3258, width: 1420 }
  },
  {
    sr_no: 7,
    cfm: 3526,
    l_s: 1664,
    single_tier: { length: 1220, breadth: 3028, width: 1270 },
    two_tier: { length: 2190, breadth: 3408, width: 1420 }
  },
  {
    sr_no: 8,
    cfm: 4222,
    l_s: 1992,
    single_tier: { length: 1370, breadth: 3028, width: 1270 },
    two_tier: { length: 2190, breadth: 3558, width: 1570 }
  },
  {
    sr_no: 9,
    cfm: 5110,
    l_s: 2412,
    single_tier: { length: 1220, breadth: 3178, width: 1570 },
    two_tier: { length: 2190, breadth: 3558, width: 1720 }
  },
  {
    sr_no: 10,
    cfm: 6286,
    l_s: 2966,
    single_tier: { length: 1370, breadth: 3328, width: 1570 },
    two_tier: { length: 2490, breadth: 3708, width: 1870 }
  },
  {
    sr_no: 11,
    cfm: 7379,
    l_s: 3482,
    single_tier: { length: 1370, breadth: 3328, width: 1720 },
    two_tier: { length: 2640, breadth: 3858, width: 2020 }
  },
  {
    sr_no: 12,
    cfm: 8629,
    l_s: 4072,
    single_tier: { length: 1670, breadth: 3478, width: 1720 },
    two_tier: { length: 2790, breadth: 4008, width: 2020 }
  },
  {
    sr_no: 13,
    cfm: 9996,
    l_s: 4714,
    single_tier: { length: 1820, breadth: 3478, width: 1720 },
    two_tier: { length: 2940, breadth: 4158, width: 2320 }
  },
  {
    sr_no: 14,
    cfm: 11499,
    l_s: 5427,
    single_tier: { length: 1820, breadth: 3628, width: 1870 },
    two_tier: { length: 3090, breadth: 4308, width: 2320 }
  },
  {
    sr_no: 15,
    cfm: 13002,
    l_s: 6136,
    single_tier: { length: 1820, breadth: 3778, width: 2170 },
    two_tier: { length: 3240, breadth: 4458, width: 2320 }
  },
  {
    sr_no: 16,
    cfm: 15367,
    l_s: 7252,
    single_tier: { length: 2010, breadth: 3928, width: 2170 },
    two_tier: { length: 3580, breadth: 4801, width: 2620 }
  },
  {
    sr_no: 17,
    cfm: 17143,
    l_s: 8090,
    single_tier: { length: 2010, breadth: 4078, width: 2320 },
    two_tier: { length: 3580, breadth: 5058, width: 2770 }
  },
  {
    sr_no: 18,
    cfm: 19126,
    l_s: 9026,
    single_tier: { length: 2310, breadth: 4078, width: 2320 },
    two_tier: { length: 3880, breadth: 5058, width: 2770 }
  },
  {
    sr_no: 19,
    cfm: 21108,
    l_s: 9961,
    single_tier: { length: 2310, breadth: 4228, width: 2470 },
    two_tier: { length: 4180, breadth: 5358, width: 3070 }
  },
  {
    sr_no: 20,
    cfm: 23090,
    l_s: 10897,
    single_tier: { length: 2310, breadth: 4228, width: 2770 },
    two_tier: { length: 4330, breadth: 5358, width: 3070 }
  },
  {
    sr_no: 21,
    cfm: 25072,
    l_s: 11832,
    single_tier: { length: 2310, breadth: 4228, width: 2920 },
    two_tier: { length: 4330, breadth: 5428, width: 3070 }
  },
  {
    sr_no: 22,
    cfm: 27658,
    l_s: 13052,
    single_tier: { length: 2460, breadth: 4378, width: 2920 },
    two_tier: { length: 4480, breadth: 5658, width: 3370 }
  },
  {
    sr_no: 23,
    cfm: 29845,
    l_s: 14084,
    single_tier: { length: 2460, breadth: 4378, width: 3070 },
    two_tier: { length: 4480, breadth: 5808, width: 3670 }
  },
  {
    sr_no: 24,
    cfm: 32031,
    l_s: 15116,
    single_tier: { length: 2460, breadth: 4378, width: 3370 },
    two_tier: { length: 4630, breadth: 5958, width: 3670 }
  },
  {
    sr_no: 25,
    cfm: 34218,
    l_s: 16148,
    single_tier: { length: 2460, breadth: 4378, width: 3520 },
    two_tier: { length: 4630, breadth: 5958, width: 3820 }
  },
  {
    sr_no: 26,
    cfm: 36404,
    l_s: 17180,
    single_tier: { length: 2460, breadth: 4378, width: 3670 },
    two_tier: { length: 4630, breadth: 5958, width: 3820 }
  },
  {
    sr_no: 27,
    cfm: 38591,
    l_s: 18212,
    single_tier: { length: 2460, breadth: 4528, width: 3970 },
    two_tier: { length: 4780, breadth: 5958, width: 3970 }
  },
  {
    sr_no: 28,
    cfm: 40654,
    l_s: 19185,
    single_tier: { length: 2610, breadth: 4528, width: 3970 },
    two_tier: { length: 4930, breadth: 5958, width: 3970 }
  },
  {
    sr_no: 29,
    cfm: 42977,
    l_s: 20282,
    single_tier: { length: 2610, breadth: 4828, width: 4120 },
    two_tier: { length: 4930, breadth: 6258, width: 4270 }
  },
  {
    sr_no: 30,
    cfm: 45300,
    l_s: 21378,
    single_tier: { length: 2610, breadth: 4828, width: 4270 },
    two_tier: { length: 4930, breadth: 6258, width: 4420 }
  }
];

export interface EquipmentSizingResult {
  tierName: "Tier 1" | "Tier 2";
  tierType: "single_tier" | "two_tier";
  matchedLoadLs: number;
  matchedCfm: number;
  srNo: number;
  dimensions: TierDimensions;
  formattedDimensions: string; // e.g., "770 × 2578 × 670 mm"
  displayText: string; // e.g., "Tier 1 (770 × 2578 × 670 mm)"
}

/**
 * Calculates equipment tier and dimensions based on assigned loads.
 * Rules:
 * - Single Tier (Tier 1): Used when equipment is assigned ONLY Fresh Air OR ONLY Extract Air.
 * - Two Tier (Tier 2): Used when equipment is assigned BOTH Fresh Air AND Extract Air.
 * - Sizing Load: If single load, use that load. If both, use Math.max(totalFA, totalEA).
 * - Matches the bracket in data where entry.l_s >= sizingLoad.
 */
export function getEquipmentTierAndDimensions(
  totalFA: number = 0,
  totalEA: number = 0
): EquipmentSizingResult | null {
  const fa = Math.max(0, totalFA || 0);
  const ea = Math.max(0, totalEA || 0);

  if (fa === 0 && ea === 0) {
    return null;
  }

  const isBoth = fa > 0 && ea > 0;
  const tierType: "single_tier" | "two_tier" = isBoth ? "two_tier" : "single_tier";
  const tierName: "Tier 1" | "Tier 2" = isBoth ? "Tier 2" : "Tier 1";

  const sizingLoad = isBoth ? Math.max(fa, ea) : fa > 0 ? fa : ea;

  // Find bracket entry: first entry where entry.l_s >= sizingLoad
  let matchedEntry = AHU_DIMENSIONS_DATA.find((entry) => entry.l_s >= sizingLoad);

  // If sizing load exceeds max entry in table, fallback to max entry (Sr. No. 30)
  if (!matchedEntry) {
    matchedEntry = AHU_DIMENSIONS_DATA[AHU_DIMENSIONS_DATA.length - 1];
  }

  const dims = matchedEntry[tierType];
  const formattedDimensions = `${dims.length} × ${dims.breadth} × ${dims.width} mm`;
  const displayText = `${tierName} (${formattedDimensions})`;

  return {
    tierName,
    tierType,
    matchedLoadLs: matchedEntry.l_s,
    matchedCfm: matchedEntry.cfm,
    srNo: matchedEntry.sr_no,
    dimensions: dims,
    formattedDimensions,
    displayText,
  };
}
