/**
 * UAE Civil Defense Fire and Life Safety Code of Practice
 * Chapter 9: Application of Fire Protection Systems
 * 
 * Tables implemented:
 * - Table 9.18: Super Highrise Building Fire Protection Systems (> 90 m)
 * - Table 9.19: Highrise Building Fire Protection Systems (23 m to 90 m)
 * - Table 9.20.a: Midrise Building Fire Protection Systems (> 15 m to 23 m) - Assembly, Education, Healthcare A, etc.
 * - Table 9.20.b: Midrise Building Fire Protection Systems (> 15 m to 23 m) - Residential, Business, Healthcare B/C, etc.
 * - Table 9.20.c: Midrise Building Fire Protection Systems - Single Exit Stair & Ground Area <= 500 m² (15 m to 23 m)
 * - Table 9.20.d: Midrise Building Fire Protection Systems - Detention & Correctional
 * - Table 9.21.a: Lowrise Building Fire Protection Systems (<= 15 m) - Assembly, Education, Healthcare A, etc.
 * - Table 9.21.b: Lowrise Building Fire Protection Systems (<= 15 m) - Residential, Business, Healthcare B/C, etc.
 * - Table 9.21.c: Lowrise Building Fire Protection Systems - Single Exit Stair (<= 15 m)
 * - Table 9.21.d: Lowrise Building Fire Protection Systems - Converted Existing G+1 Villas
 * - Table 9.21.e: Lowrise Building Fire Protection Systems - Commercial Outlets on Villas / Mosques / Business
 */

export type CivilDefenseOccupancy =
  | "residential" // Apartments, labor acc., staff acc., hostel
  | "business" // Offices, banks, professional
  | "mercantile_ab" // Retail, malls, supermarkets
  | "mercantile_c_kiosk" // Kiosks
  | "hotel" // Hotels, motels, furnished apartments
  | "assembly" // Cinemas, theaters, exhibition, religious
  | "education" // Schools, universities, daycare centers
  | "healthcare_a" // Inpatient hospitals, care facilities
  | "healthcare_bc" // Outpatient clinics, diagnostics
  | "day_care" // Nurseries, child day care
  | "detention" // Jails, prisons, correctional
  | "animal_housing" // Stables, kennels, veterinary
  | "mosque_with_commercial" // Mosque having commercial outlet in plot
  | "converted_villa"; // Existing G+1 villa converted to commercial

export interface CivilDefenseBuilding {
  id: string;
  name: string;
  height: number; // meters
  floors: number; // above ground stories
  plotArea: number; // m²
  groundFloorArea: number; // m²
  occupancy: CivilDefenseOccupancy;
  standpipeCount: number; // count of risers/stairs (typically 1, 2, or >2)
  hasInfraHydrants60m: boolean; // infrastructure yard hydrants available within 60 m
  isSingleExitStair: boolean; // single exit stair complying with Chapter 3
  basementCount: number; // number of basements (determines high depth underground >=3)
  hasSecondExitStair?: boolean; // for converted villas (Table 9.21.d)
  notes?: string;
  // Manual Output Overrides (optional)
  overridePumpFlowGpm?: number;
  overridePumpPressureBar?: number;
  overrideTankDurationMin?: number;
  overrideNetStorageM3?: number;
}

export interface CivilDefenseEvaluation {
  tableRef: string;
  tableTitle: string;
  categoryCode: string;
  buildingClass: "Super Highrise" | "Highrise Tier 1 (>45m to <90m)" | "Highrise Tier 2 (>23m to <45m)" | "Midrise (>15m to 23m)" | "Lowrise (<=15m)";
  
  // Mandatory System Requirements
  sprinklerRequirement: string;
  sprinklerType: "wet" | "pre_action" | "none" | "optional";
  riserRequirement: string;
  riserType: "wet_riser" | "dry_riser" | "hose_reel_only" | "none";
  isZoned: boolean; // Looped High & Low zones
  riserInterconnection: string;
  hoseReelRequirement: string;
  yardHydrantRequirement: string;
  isYardHydrantRequired: boolean;
  isYardHydrantExempt: boolean;
  auxiliaryRoomProtection: string; // Table 9.30

  // Combined Fire Pump Set Capacities
  lowestFirePumpFlowGpm: number;
  lowestFirePumpFlowLpm: number;
  lowestFirePumpPressureBar: number;
  lowestFirePumpPressurePsi: number;
  lowestPumpRemarks: string;

  // Upper Level Multi-Stage Pump Sets (for Super Highrise > 90 m)
  requiresStagingPumps: boolean;
  stagingIntervalMeters: number;
  stagingLevelsCount: number;
  stagingPumpFlowGpm: number;
  stagingPumpFlowLpm: number;
  stagingPumpPressureBar: number;
  stagingPumpPressurePsi: number;
  stagingRemarks: string;

  // Fire Water Storage Tank Capacities
  mainTankDurationMin: number;
  mainTankNetVolumeGal: number;
  mainTankNetVolumeM3: number;
  mainTankGrossVolumeGal: number; // +10% ullage & dead storage
  mainTankGrossVolumeM3: number;
  mainTankAppurtenances: string;

  // Upper Level Intermediate Tanks (every 90 m for Super Highrise)
  stagingTankDurationMin: number;
  stagingTankNetVolumeGal: number;
  stagingTankNetVolumeM3: number;
  totalUpperTanksVolumeM3: number;
  stagingTankAppurtenances: string;

  // Total Site / Building Net Water Storage
  totalNetWaterStorageM3: number;
  totalGrossWaterStorageM3: number;

  // Hydraulics & Header sizing
  recommendedHeaderNps: number; // inches
  recommendedHeaderDn: number; // mm
  flowVelocityFps: number;

  // Code Reference Clauses
  clauses: string[];
}

// Standard NFPA 20 discharge header sizing (flow velocity <= 15 ft/s)
export function getRecommendedHeaderSize(gpm: number): { nps: number; dn: number; velocityFps: number } {
  if (gpm <= 0) return { nps: 0, dn: 0, velocityFps: 0 };
  const sizes = [
    { nps: 2.0, dn: 50, innerDInches: 2.067 },
    { nps: 2.5, dn: 65, innerDInches: 2.469 },
    { nps: 3.0, dn: 80, innerDInches: 3.068 },
    { nps: 4.0, dn: 100, innerDInches: 4.026 },
    { nps: 6.0, dn: 150, innerDInches: 6.065 },
    { nps: 8.0, dn: 200, innerDInches: 7.981 },
    { nps: 10.0, dn: 250, innerDInches: 10.02 },
    { nps: 12.0, dn: 300, innerDInches: 11.938 },
  ];

  for (const s of sizes) {
    const areaSqFt = (Math.PI * Math.pow(s.innerDInches / 12, 2)) / 4;
    const flowCfs = gpm / 448.831;
    const velocity = flowCfs / areaSqFt;
    if (velocity <= 15.0) {
      return { nps: s.nps, dn: s.dn, velocityFps: parseFloat(velocity.toFixed(2)) };
    }
  }

  return { nps: 12.0, dn: 300, velocityFps: 15.0 };
}

/**
 * Statutory Evaluation Engine implementing UAE Civil Defense Tables 9.18 to 9.21.e
 */
export function evaluateCivilDefenseFireDemandRaw(b: CivilDefenseBuilding): CivilDefenseEvaluation {
  const height = Number(b.height) || 0;
  const plotArea = Number(b.plotArea) || 0;
  const gfa = Number(b.groundFloorArea) || 0;
  const standpipes = Number(b.standpipeCount) || 2;
  const hasInfraHydrants = Boolean(b.hasInfraHydrants60m);
  const isSingleStair = Boolean(b.isSingleExitStair);
  const basements = Number(b.basementCount) || 0;
  const isHighDepthUnderground = basements >= 3;
  const occ = b.occupancy || "business";

  const isPlotOver20k = plotArea > 20000;

  // 1. SUPER HIGHRISE (> 90 m) — Table 9.18
  if (height > 90) {
    const isCatA = isPlotOver20k && !hasInfraHydrants;
    const categoryCode = isCatA ? "Table 9.18 Cat. A" : isPlotOver20k ? "Table 9.18 Cat. C" : "Table 9.18 Cat. B";
    
    const lowestFirePumpFlowGpm = 1000;
    const lowestFirePumpPressureBar = 17.0; // 17 bar mandated at lowest level
    const lowestPumpRemarks = "1000 GPM at 17 bar at lowest level of building (irrespective of number of stairs and standpipes)";

    const stagingIntervalMeters = 90;
    const stagingLevelsCount = Math.max(1, Math.floor(height / stagingIntervalMeters));
    const stagingPumpFlowGpm = standpipes <= 2 ? 750 : 1000;
    const stagingPumpPressureBar = 6.9; // 6.9 bar at most remote landing valve
    const stagingRemarks = `Multi-level pump sets located vertically every 90 m: ${stagingPumpFlowGpm} GPM at pressure to satisfy 6.9 bar at most remote landing valve`;

    const mainTankDurationMin = 60;
    const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin; // 60,000 gal
    const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1)); // ~227.1 m³
    const mainTankGrossVolumeGal = Math.round(mainTankNetVolumeGal * 1.1);
    const mainTankGrossVolumeM3 = parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1));

    const stagingTankDurationMin = 30;
    const stagingTankNetVolumeGal = stagingPumpFlowGpm * stagingTankDurationMin; // 22,500 or 30,000 gal
    const stagingTankNetVolumeM3 = parseFloat((stagingTankNetVolumeGal * 0.00378541).toFixed(1));
    const totalUpperTanksVolumeM3 = parseFloat((stagingTankNetVolumeM3 * stagingLevelsCount).toFixed(1));

    const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

    return {
      tableRef: "Table 9.18",
      tableTitle: "Super Highrise Building Fire Protection Systems (Height > 90 m)",
      categoryCode,
      buildingClass: "Super Highrise",
      sprinklerRequirement: "Sprinklers throughout building including basements and podiums (open as well as closed) per Section 3.5",
      sprinklerType: "wet",
      riserRequirement: "Wet riser System throughout building with looped High & Low zones per Table 9.6.13",
      riserType: "wet_riser",
      isZoned: true,
      riserInterconnection: "Interconnected both at the lowest level and at the highest level of each zone",
      hoseReelRequirement: "Hose Reel system throughout building as per Section 3.3",
      yardHydrantRequirement: isPlotOver20k
        ? (hasInfraHydrants ? "Exempted: Infrastructure yard hydrants available within 60 m" : "Yard Fire Hydrants required per Section 3.11 (Plot Area > 20,000 m²)")
        : "Yard hydrants not required (Plot area < 20,000 m²)",
      isYardHydrantRequired: isPlotOver20k && !hasInfraHydrants,
      isYardHydrantExempt: isPlotOver20k && hasInfraHydrants,
      auxiliaryRoomProtection: "Protected as per Table 9.30",
      lowestFirePumpFlowGpm,
      lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
      lowestFirePumpPressureBar,
      lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
      lowestPumpRemarks,
      requiresStagingPumps: true,
      stagingIntervalMeters,
      stagingLevelsCount,
      stagingPumpFlowGpm,
      stagingPumpFlowLpm: Math.round(stagingPumpFlowGpm * 3.78541),
      stagingPumpPressureBar,
      stagingPumpPressurePsi: Math.round(stagingPumpPressureBar * 14.5038),
      stagingRemarks,
      mainTankDurationMin,
      mainTankNetVolumeGal,
      mainTankNetVolumeM3,
      mainTankGrossVolumeGal,
      mainTankGrossVolumeM3,
      mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refill, instantaneous utility refilling arrangement",
      stagingTankDurationMin,
      stagingTankNetVolumeGal,
      stagingTankNetVolumeM3,
      totalUpperTanksVolumeM3,
      stagingTankAppurtenances: "Automatic low water level detection, instantaneous refilling arrangement, pump and piping to refill from lower levels",
      totalNetWaterStorageM3: parseFloat((mainTankNetVolumeM3 + totalUpperTanksVolumeM3).toFixed(1)),
      totalGrossWaterStorageM3: parseFloat(((mainTankNetVolumeM3 + totalUpperTanksVolumeM3) * 1.1).toFixed(1)),
      recommendedHeaderNps: header.nps,
      recommendedHeaderDn: header.dn,
      flowVelocityFps: header.velocityFps,
      clauses: [
        "Table 9.18: Super Highrise Building Fire Protection Systems",
        "Section 3.4: Wet Riser System",
        "Section 3.5: Automatic Sprinkler System",
        "Section 3.11: Yard Fire Hydrants",
        "Table 9.6.13: Pressure Limitations & Multi-level Pump Arrangements",
        "Table 9.30: Auxiliary Rooms Fire Protection"
      ]
    };
  }

  // 2. HIGHRISE TIER 1 (> 45 m to < 90 m) — Table 9.19 Cat. A & B
  if (height > 45 && height <= 90) {
    const isCatA = isPlotOver20k && !hasInfraHydrants;
    const categoryCode = isCatA ? "Table 9.19 Cat. A" : "Table 9.19 Cat. B";
    
    const lowestFirePumpFlowGpm = isCatA ? 1000 : (standpipes <= 2 ? 750 : 1000);
    const lowestFirePumpPressureBar = 6.9; // 6.9 bar at most remote landing valve
    const lowestPumpRemarks = isCatA
      ? "1000 GPM (combined yard hydrants + internal systems, irrespective of number of stairs) to satisfy 6.9 bar at most remote landing valve"
      : `${lowestFirePumpFlowGpm} GPM (${standpipes <= 2 ? "2 standpipes" : ">2 standpipes"}) at pressure to satisfy 6.9 bar at most remote landing valve`;

    const mainTankDurationMin = 60;
    const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
    const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
    const mainTankGrossVolumeGal = Math.round(mainTankNetVolumeGal * 1.1);
    const mainTankGrossVolumeM3 = parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1));

    const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

    return {
      tableRef: "Table 9.19",
      tableTitle: "Highrise Building Fire Protection Systems (Height > 45 m to < 90 m)",
      categoryCode,
      buildingClass: "Highrise Tier 1 (>45m to <90m)",
      sprinklerRequirement: "Sprinklers throughout building including basements and podiums (open as well as closed) per Section 3.5",
      sprinklerType: "wet",
      riserRequirement: "Wet riser System throughout building with looped High & Low zones per Table 9.6.13",
      riserType: "wet_riser",
      isZoned: true,
      riserInterconnection: "Interconnected both at lowest level and at highest level of each zone",
      hoseReelRequirement: "Hose Reel system throughout building as per Section 3.3",
      yardHydrantRequirement: isPlotOver20k
        ? (hasInfraHydrants ? "Exempted: Infrastructure yard hydrants available within 60 m" : "Yard Fire Hydrants required per Section 3.11 (Plot Area > 20,000 m²)")
        : "Yard hydrants not required (Plot area < 20,000 m²)",
      isYardHydrantRequired: isPlotOver20k && !hasInfraHydrants,
      isYardHydrantExempt: isPlotOver20k && hasInfraHydrants,
      auxiliaryRoomProtection: "Protected as per Table 9.30",
      lowestFirePumpFlowGpm,
      lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
      lowestFirePumpPressureBar,
      lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
      lowestPumpRemarks,
      requiresStagingPumps: false,
      stagingIntervalMeters: 0,
      stagingLevelsCount: 0,
      stagingPumpFlowGpm: 0,
      stagingPumpFlowLpm: 0,
      stagingPumpPressureBar: 0,
      stagingPumpPressurePsi: 0,
      stagingRemarks: "Single pump set at lowest level is sufficient (Height <= 90 m)",
      mainTankDurationMin,
      mainTankNetVolumeGal,
      mainTankNetVolumeM3,
      mainTankGrossVolumeGal,
      mainTankGrossVolumeM3,
      mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility water refilling arrangement",
      stagingTankDurationMin: 0,
      stagingTankNetVolumeGal: 0,
      stagingTankNetVolumeM3: 0,
      totalUpperTanksVolumeM3: 0,
      stagingTankAppurtenances: "N/A",
      totalNetWaterStorageM3: mainTankNetVolumeM3,
      totalGrossWaterStorageM3: mainTankGrossVolumeM3,
      recommendedHeaderNps: header.nps,
      recommendedHeaderDn: header.dn,
      flowVelocityFps: header.velocityFps,
      clauses: [
        "Table 9.19 Cat. A/B: Highrise Building Fire Protection (45m–90m)",
        "Section 3.4: Wet Riser System",
        "Section 3.5: Automatic Sprinkler System",
        "Section 3.11: Yard Fire Hydrants (Plot > 20,000 m²)",
        "Table 9.30: Auxiliary Rooms Protection"
      ]
    };
  }

  // 3. HIGHRISE TIER 2 (> 23 m to < 45 m) — Table 9.19 Cat. C & D
  if (height > 23 && height <= 45) {
    const isCatC = isPlotOver20k && !hasInfraHydrants;
    const categoryCode = isCatC ? "Table 9.19 Cat. C" : "Table 9.19 Cat. D";

    const lowestFirePumpFlowGpm = isCatC ? 1000 : (standpipes <= 2 ? 750 : 1000);
    const lowestFirePumpPressureBar = 6.9; // 6.9 bar at most remote landing valve & yard hydrant
    const lowestPumpRemarks = isCatC
      ? "1000 GPM (combined yard hydrants + internal systems, irrespective of standpipes) to satisfy 6.9 bar at remote landing valve and yard hydrant"
      : `${lowestFirePumpFlowGpm} GPM (${standpipes <= 2 ? "2 standpipes" : ">2 standpipes"}) at pressure to satisfy 6.9 bar at most remote landing valve`;

    const mainTankDurationMin = 60;
    const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
    const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
    const mainTankGrossVolumeGal = Math.round(mainTankNetVolumeGal * 1.1);
    const mainTankGrossVolumeM3 = parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1));

    const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

    return {
      tableRef: "Table 9.19",
      tableTitle: "Highrise Building Fire Protection Systems (Height > 23 m to < 45 m)",
      categoryCode,
      buildingClass: "Highrise Tier 2 (>23m to <45m)",
      sprinklerRequirement: "Sprinklers throughout building including basements and podiums (open as well as closed) per Section 3.5",
      sprinklerType: "wet",
      riserRequirement: "Wet riser System throughout building as per Section 3.4",
      riserType: "wet_riser",
      isZoned: false,
      riserInterconnection: "Interconnected both at lowest level and at highest level of each zone",
      hoseReelRequirement: "Hose Reel system throughout building as per Section 3.3",
      yardHydrantRequirement: isPlotOver20k
        ? (hasInfraHydrants ? "Exempted: Infrastructure yard hydrants available within 60 m" : "Yard Fire Hydrants required per Section 3.11 (Plot Area > 20,000 m²)")
        : "Yard hydrants not required (Plot area < 20,000 m²)",
      isYardHydrantRequired: isPlotOver20k && !hasInfraHydrants,
      isYardHydrantExempt: isPlotOver20k && hasInfraHydrants,
      auxiliaryRoomProtection: "Protected as per Table 9.30",
      lowestFirePumpFlowGpm,
      lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
      lowestFirePumpPressureBar,
      lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
      lowestPumpRemarks,
      requiresStagingPumps: false,
      stagingIntervalMeters: 0,
      stagingLevelsCount: 0,
      stagingPumpFlowGpm: 0,
      stagingPumpFlowLpm: 0,
      stagingPumpPressureBar: 0,
      stagingPumpPressurePsi: 0,
      stagingRemarks: "Single pump set at lowest level is sufficient",
      mainTankDurationMin,
      mainTankNetVolumeGal,
      mainTankNetVolumeM3,
      mainTankGrossVolumeGal,
      mainTankGrossVolumeM3,
      mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility water refilling arrangement",
      stagingTankDurationMin: 0,
      stagingTankNetVolumeGal: 0,
      stagingTankNetVolumeM3: 0,
      totalUpperTanksVolumeM3: 0,
      stagingTankAppurtenances: "N/A",
      totalNetWaterStorageM3: mainTankNetVolumeM3,
      totalGrossWaterStorageM3: mainTankGrossVolumeM3,
      recommendedHeaderNps: header.nps,
      recommendedHeaderDn: header.dn,
      flowVelocityFps: header.velocityFps,
      clauses: [
        "Table 9.19 Cat. C/D: Highrise Building Fire Protection (23m–45m)",
        "Section 3.4: Wet Riser System",
        "Section 3.5: Automatic Sprinkler System",
        "Section 3.11: Yard Fire Hydrants (Plot > 20,000 m²)",
        "Table 9.30: Auxiliary Rooms Protection"
      ]
    };
  }

  // 4. MIDRISE BUILDINGS (> 15 m to 23 m) — Tables 9.20.a, 9.20.b, 9.20.c, 9.20.d
  if (height > 15 && height <= 23) {
    // 4.1. Single Exit Stair Special Exemption — Table 9.20.c
    if (isSingleStair && gfa <= 500 && (occ === "residential" || occ === "business" || occ === "animal_housing")) {
      const lowestFirePumpFlowGpm = 500;
      const lowestFirePumpPressureBar = 6.9;
      const mainTankDurationMin = 45;
      const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
      const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
      const mainTankGrossVolumeGal = Math.round(mainTankNetVolumeGal * 1.1);
      const mainTankGrossVolumeM3 = parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1));
      const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

      return {
        tableRef: "Table 9.20.c",
        tableTitle: "Midrise: Single Exit Stair & Ground Area <= 500 m²",
        categoryCode: "Table 9.20.c Case 1",
        buildingClass: "Midrise (>15m to 23m)",
        sprinklerRequirement: "Sprinklers throughout building including basements and podiums (open as well closed) per Section 3.5",
        sprinklerType: "wet",
        riserRequirement: "Wet riser System throughout building per Section 3.4",
        riserType: "wet_riser",
        isZoned: false,
        riserInterconnection: "Interconnected at highest level",
        hoseReelRequirement: "Hose Reel system throughout building as per Section 3.3",
        yardHydrantRequirement: "Not required for single exit stair midrise building",
        isYardHydrantRequired: false,
        isYardHydrantExempt: true,
        auxiliaryRoomProtection: "Protected as per Table 9.30",
        lowestFirePumpFlowGpm,
        lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
        lowestFirePumpPressureBar,
        lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
        lowestPumpRemarks: "500 GPM at pressure to satisfy 6.9 bar at most remote landing valve",
        requiresStagingPumps: false,
        stagingIntervalMeters: 0,
        stagingLevelsCount: 0,
        stagingPumpFlowGpm: 0,
        stagingPumpFlowLpm: 0,
        stagingPumpPressureBar: 0,
        stagingPumpPressurePsi: 0,
        stagingRemarks: "Single pump set at lowest level",
        mainTankDurationMin,
        mainTankNetVolumeGal,
        mainTankNetVolumeM3,
        mainTankGrossVolumeGal,
        mainTankGrossVolumeM3,
        mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility water refilling",
        stagingTankDurationMin: 0,
        stagingTankNetVolumeGal: 0,
        stagingTankNetVolumeM3: 0,
        totalUpperTanksVolumeM3: 0,
        stagingTankAppurtenances: "N/A",
        totalNetWaterStorageM3: mainTankNetVolumeM3,
        totalGrossWaterStorageM3: mainTankGrossVolumeM3,
        recommendedHeaderNps: header.nps,
        recommendedHeaderDn: header.dn,
        flowVelocityFps: header.velocityFps,
        clauses: [
          "Table 9.20.c: Midrise Single Exit Stair & Ground Area <= 500 m²",
          "Section 3.4: Wet Riser System (500 GPM @ 6.9 bar)",
          "Section 3.5: Automatic Sprinkler System",
          "Table 9.30: Auxiliary Rooms Protection"
        ]
      };
    }

    // 4.2. Detention and Correctional — Table 9.20.d
    if (occ === "detention") {
      const isCombinedHydrants = isPlotOver20k && !hasInfraHydrants;
      const lowestFirePumpFlowGpm = isCombinedHydrants ? 1000 : (standpipes <= 2 ? 750 : 1000);
      const lowestFirePumpPressureBar = 6.9;
      const mainTankDurationMin = 60;
      const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
      const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
      const mainTankGrossVolumeGal = Math.round(mainTankNetVolumeGal * 1.1);
      const mainTankGrossVolumeM3 = parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1));
      const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

      return {
        tableRef: "Table 9.20.d",
        tableTitle: "Midrise: Detention and Correctional Group A, B, C",
        categoryCode: isCombinedHydrants ? "Table 9.20.d (Combined Yard Hydrants)" : "Table 9.20.d (Internal Only)",
        buildingClass: "Midrise (>15m to 23m)",
        sprinklerRequirement: "Pre-action type sprinklers in cells/inmate areas (Sec 3.7); standard sprinklers in other areas (Sec 3.5)",
        sprinklerType: "pre_action",
        riserRequirement: "Wet riser System throughout building per Section 3.4",
        riserType: "wet_riser",
        isZoned: false,
        riserInterconnection: "Interconnected at highest level",
        hoseReelRequirement: "Hose Reel system throughout building as per Section 3.3",
        yardHydrantRequirement: isPlotOver20k
          ? (hasInfraHydrants ? "Exempted: Infrastructure yard hydrants available within 60 m" : "Yard Fire Hydrants required per Section 3.11")
          : "Yard hydrants not required (Plot area < 20,000 m²)",
        isYardHydrantRequired: isPlotOver20k && !hasInfraHydrants,
        isYardHydrantExempt: isPlotOver20k && hasInfraHydrants,
        auxiliaryRoomProtection: "Protected as per Table 9.30",
        lowestFirePumpFlowGpm,
        lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
        lowestFirePumpPressureBar,
        lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
        lowestPumpRemarks: `${lowestFirePumpFlowGpm} GPM at pressure to satisfy 6.9 bar at most remote landing valve ${isCombinedHydrants ? "and hydrant" : ""}`,
        requiresStagingPumps: false,
        stagingIntervalMeters: 0,
        stagingLevelsCount: 0,
        stagingPumpFlowGpm: 0,
        stagingPumpFlowLpm: 0,
        stagingPumpPressureBar: 0,
        stagingPumpPressurePsi: 0,
        stagingRemarks: "Single pump set at lowest level",
        mainTankDurationMin,
        mainTankNetVolumeGal,
        mainTankNetVolumeM3,
        mainTankGrossVolumeGal,
        mainTankGrossVolumeM3,
        mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling",
        stagingTankDurationMin: 0,
        stagingTankNetVolumeGal: 0,
        stagingTankNetVolumeM3: 0,
        totalUpperTanksVolumeM3: 0,
        stagingTankAppurtenances: "N/A",
        totalNetWaterStorageM3: mainTankNetVolumeM3,
        totalGrossWaterStorageM3: mainTankGrossVolumeM3,
        recommendedHeaderNps: header.nps,
        recommendedHeaderDn: header.dn,
        flowVelocityFps: header.velocityFps,
        clauses: [
          "Table 9.20.d: Detention & Correctional Group A, B, C",
          "Section 3.7: Pre-action Sprinklers for Inmates/Cells",
          "Section 3.4: Wet Riser System",
          "Table 9.30: Auxiliary Rooms Protection"
        ]
      };
    }

    // 4.3. Residential, Business, Healthcare B/C, Mercantile C (Kiosks), Animal Housing — Table 9.20.b
    const isGroupB = (
      occ === "residential" ||
      occ === "business" ||
      occ === "healthcare_bc" ||
      occ === "mercantile_c_kiosk" ||
      occ === "animal_housing"
    );

    if (isGroupB) {
      if (isPlotOver20k) {
        // Table 9.20.b Case 4
        const lowestFirePumpFlowGpm = 1000;
        const lowestFirePumpPressureBar = 6.9;
        const mainTankDurationMin = 60;
        const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
        const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
        const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

        return {
          tableRef: "Table 9.20.b",
          tableTitle: "Midrise: Residential / Business / Healthcare B/C (Plot > 20,000 m²)",
          categoryCode: "Table 9.20.b Case 4",
          buildingClass: "Midrise (>15m to 23m)",
          sprinklerRequirement: gfa > 900 ? "Sprinklers throughout building per Section 3.5" : "Sprinklers not mandatory for ground area <= 900 m²",
          sprinklerType: gfa > 900 ? "wet" : "none",
          riserRequirement: gfa > 3600 ? "Wet riser System per Section 3.4" : "Dry riser + Hose reel system per Section 3.2 & 3.3",
          riserType: gfa > 3600 ? "wet_riser" : "dry_riser",
          isZoned: false,
          riserInterconnection: "Interconnected at highest level",
          hoseReelRequirement: "Hose reel system throughout building per Section 3.3",
          yardHydrantRequirement: hasInfraHydrants ? "Exempted: Infrastructure yard hydrants available within 60 m" : "Yard Fire Hydrants required per Section 3.11",
          isYardHydrantRequired: !hasInfraHydrants,
          isYardHydrantExempt: hasInfraHydrants,
          auxiliaryRoomProtection: "Protected as per Table 9.30",
          lowestFirePumpFlowGpm,
          lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
          lowestFirePumpPressureBar,
          lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
          lowestPumpRemarks: "1000 GPM (combined yard hydrants + internal systems)",
          requiresStagingPumps: false,
          stagingIntervalMeters: 0,
          stagingLevelsCount: 0,
          stagingPumpFlowGpm: 0,
          stagingPumpFlowLpm: 0,
          stagingPumpPressureBar: 0,
          stagingPumpPressurePsi: 0,
          stagingRemarks: "Single pump set at lowest level",
          mainTankDurationMin,
          mainTankNetVolumeGal,
          mainTankNetVolumeM3,
          mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
          mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
          mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling",
          stagingTankDurationMin: 0,
          stagingTankNetVolumeGal: 0,
          stagingTankNetVolumeM3: 0,
          totalUpperTanksVolumeM3: 0,
          stagingTankAppurtenances: "N/A",
          totalNetWaterStorageM3: mainTankNetVolumeM3,
          totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
          recommendedHeaderNps: header.nps,
          recommendedHeaderDn: header.dn,
          flowVelocityFps: header.velocityFps,
          clauses: [
            "Table 9.20.b Case 4: Midrise Residential/Business (Plot > 20,000 m²)",
            "Section 3.11: Yard Fire Hydrants",
            "Table 9.30: Auxiliary Rooms Protection"
          ]
        };
      } else if (gfa <= 900) {
        // Table 9.20.b Case 1: GFA <= 900 m²
        const lowestFirePumpFlowGpm = 50;
        const lowestFirePumpPressureBar = 4.5;
        const mainTankDurationMin = 45;
        const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
        const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
        const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

        return {
          tableRef: "Table 9.20.b",
          tableTitle: "Midrise: Residential / Business / Healthcare B/C (GFA <= 900 m²)",
          categoryCode: "Table 9.20.b Case 1",
          buildingClass: "Midrise (>15m to 23m)",
          sprinklerRequirement: "Not required for ground floor area up to 900 m²",
          sprinklerType: "none",
          riserRequirement: "Dry riser + Hose Reel system throughout building per Section 3.2 & 3.3",
          riserType: "dry_riser",
          isZoned: false,
          riserInterconnection: "Interconnected at highest level",
          hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
          yardHydrantRequirement: "Not required (Plot area <= 20,000 m²)",
          isYardHydrantRequired: false,
          isYardHydrantExempt: true,
          auxiliaryRoomProtection: "Protected as per Table 9.30",
          lowestFirePumpFlowGpm,
          lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
          lowestFirePumpPressureBar,
          lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
          lowestPumpRemarks: "50 GPM at pressure to satisfy 4.5 bar at most remote Hose valve",
          requiresStagingPumps: false,
          stagingIntervalMeters: 0,
          stagingLevelsCount: 0,
          stagingPumpFlowGpm: 0,
          stagingPumpFlowLpm: 0,
          stagingPumpPressureBar: 0,
          stagingPumpPressurePsi: 0,
          stagingRemarks: "Single pump set",
          mainTankDurationMin,
          mainTankNetVolumeGal,
          mainTankNetVolumeM3,
          mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
          mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
          mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling",
          stagingTankDurationMin: 0,
          stagingTankNetVolumeGal: 0,
          stagingTankNetVolumeM3: 0,
          totalUpperTanksVolumeM3: 0,
          stagingTankAppurtenances: "N/A",
          totalNetWaterStorageM3: mainTankNetVolumeM3,
          totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
          recommendedHeaderNps: header.nps,
          recommendedHeaderDn: header.dn,
          flowVelocityFps: header.velocityFps,
          clauses: [
            "Table 9.20.b Case 1: Midrise Residential/Business (GFA <= 900 m²)",
            "Section 3.2: Dry Riser System",
            "Section 3.3: Hose Reel System (50 GPM @ 4.5 bar)"
          ]
        };
      } else if (gfa > 900 && gfa <= 3600) {
        // Table 9.20.b Case 2: GFA 901 to 3600 m²
        const lowestFirePumpFlowGpm = 300;
        const lowestFirePumpPressureBar = 4.5;
        const mainTankDurationMin = 45;
        const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
        const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
        const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

        return {
          tableRef: "Table 9.20.b",
          tableTitle: "Midrise: Residential / Business / Healthcare B/C (GFA 901–3600 m²)",
          categoryCode: "Table 9.20.b Case 2",
          buildingClass: "Midrise (>15m to 23m)",
          sprinklerRequirement: "Sprinklers throughout building including basements and podiums (open as well as closed) per Section 3.5",
          sprinklerType: "wet",
          riserRequirement: "Dry riser + Hose Reel system throughout building per Section 3.2 & 3.3",
          riserType: "dry_riser",
          isZoned: false,
          riserInterconnection: "Interconnected at highest level",
          hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
          yardHydrantRequirement: "Not required (Plot area <= 20,000 m²)",
          isYardHydrantRequired: false,
          isYardHydrantExempt: true,
          auxiliaryRoomProtection: "Protected as per Table 9.30",
          lowestFirePumpFlowGpm,
          lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
          lowestFirePumpPressureBar,
          lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
          lowestPumpRemarks: "300 GPM at pressure to satisfy 4.5 bar at most remote Hose reel",
          requiresStagingPumps: false,
          stagingIntervalMeters: 0,
          stagingLevelsCount: 0,
          stagingPumpFlowGpm: 0,
          stagingPumpFlowLpm: 0,
          stagingPumpPressureBar: 0,
          stagingPumpPressurePsi: 0,
          stagingRemarks: "Single pump set",
          mainTankDurationMin,
          mainTankNetVolumeGal,
          mainTankNetVolumeM3,
          mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
          mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
          mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling",
          stagingTankDurationMin: 0,
          stagingTankNetVolumeGal: 0,
          stagingTankNetVolumeM3: 0,
          totalUpperTanksVolumeM3: 0,
          stagingTankAppurtenances: "N/A",
          totalNetWaterStorageM3: mainTankNetVolumeM3,
          totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
          recommendedHeaderNps: header.nps,
          recommendedHeaderDn: header.dn,
          flowVelocityFps: header.velocityFps,
          clauses: [
            "Table 9.20.b Case 2: Midrise Residential/Business (GFA 901–3600 m²)",
            "Section 3.5: Automatic Sprinkler System",
            "Section 3.2: Dry Riser System",
            "Section 3.3: Hose Reel System (300 GPM @ 4.5 bar)"
          ]
        };
      } else {
        // Table 9.20.b Case 3: GFA > 3600 m²
        const lowestFirePumpFlowGpm = standpipes <= 2 ? 750 : 1000;
        const lowestFirePumpPressureBar = 6.9;
        const mainTankDurationMin = 45;
        const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
        const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
        const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

        return {
          tableRef: "Table 9.20.b",
          tableTitle: "Midrise: Residential / Business / Healthcare B/C (GFA > 3600 m²)",
          categoryCode: "Table 9.20.b Case 3",
          buildingClass: "Midrise (>15m to 23m)",
          sprinklerRequirement: "Sprinklers throughout building including basements and podiums (open as well as closed) per Section 3.5",
          sprinklerType: "wet",
          riserRequirement: "Wet riser System throughout building per Section 3.4",
          riserType: "wet_riser",
          isZoned: false,
          riserInterconnection: "Interconnected at highest level",
          hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
          yardHydrantRequirement: "Not required (Plot area <= 20,000 m²)",
          isYardHydrantRequired: false,
          isYardHydrantExempt: true,
          auxiliaryRoomProtection: "Protected as per Table 9.30",
          lowestFirePumpFlowGpm,
          lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
          lowestFirePumpPressureBar,
          lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
          lowestPumpRemarks: `${lowestFirePumpFlowGpm} GPM (${standpipes <= 2 ? "2 standpipes" : ">2 standpipes"}) at pressure to satisfy 6.9 bar at most remote Landing valve`,
          requiresStagingPumps: false,
          stagingIntervalMeters: 0,
          stagingLevelsCount: 0,
          stagingPumpFlowGpm: 0,
          stagingPumpFlowLpm: 0,
          stagingPumpPressureBar: 0,
          stagingPumpPressurePsi: 0,
          stagingRemarks: "Single pump set",
          mainTankDurationMin,
          mainTankNetVolumeGal,
          mainTankNetVolumeM3,
          mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
          mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
          mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling",
          stagingTankDurationMin: 0,
          stagingTankNetVolumeGal: 0,
          stagingTankNetVolumeM3: 0,
          totalUpperTanksVolumeM3: 0,
          stagingTankAppurtenances: "N/A",
          totalNetWaterStorageM3: mainTankNetVolumeM3,
          totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
          recommendedHeaderNps: header.nps,
          recommendedHeaderDn: header.dn,
          flowVelocityFps: header.velocityFps,
          clauses: [
            "Table 9.20.b Case 3: Midrise Residential/Business (GFA > 3600 m²)",
            "Section 3.5: Automatic Sprinkler System",
            "Section 3.4: Wet Riser System (750/1000 GPM @ 6.9 bar)",
            "Table 9.30: Auxiliary Rooms Protection"
          ]
        };
      }
    }

    // 4.4. Assembly, Education, Healthcare A, Mercantile A/B, Hotel, Day Care, Mixed, >=3 Basements — Table 9.20.a
    const isCat1 = !isPlotOver20k;
    const categoryCode = isCat1 ? "Table 9.20.a Case 1 (Plot <= 20,000 m²)" : "Table 9.20.a Case 2 (Plot > 20,000 m²)";
    const lowestFirePumpFlowGpm = isPlotOver20k ? 1000 : (standpipes <= 2 ? 750 : 1000);
    const lowestFirePumpPressureBar = 6.9;
    const mainTankDurationMin = isPlotOver20k ? 60 : 45;
    const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
    const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
    const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

    return {
      tableRef: "Table 9.20.a",
      tableTitle: "Midrise: Assembly / Education / Healthcare A / Hotel / Mercantile / Mixed (Height > 15m to 23m)",
      categoryCode,
      buildingClass: "Midrise (>15m to 23m)",
      sprinklerRequirement: "Sprinklers throughout building including basements and podiums (open as well as closed) per Section 3.5",
      sprinklerType: "wet",
      riserRequirement: "Wet riser System throughout building per Section 3.4",
      riserType: "wet_riser",
      isZoned: false,
      riserInterconnection: "Interconnected at highest level",
      hoseReelRequirement: "Hose Reel system throughout building as per Section 3.3",
      yardHydrantRequirement: isPlotOver20k
        ? (hasInfraHydrants ? "Exempted: Infrastructure yard hydrants available within 60 m" : "Yard Fire Hydrants required per Section 3.11 (Plot Area > 20,000 m²)")
        : "Yard hydrants not required (Plot area <= 20,000 m²)",
      isYardHydrantRequired: isPlotOver20k && !hasInfraHydrants,
      isYardHydrantExempt: isPlotOver20k && hasInfraHydrants,
      auxiliaryRoomProtection: "Protected as per Table 9.30",
      lowestFirePumpFlowGpm,
      lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
      lowestFirePumpPressureBar,
      lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
      lowestPumpRemarks: isPlotOver20k
        ? "1000 GPM (combined yard hydrants + internal systems, irrespective of standpipes)"
        : `${lowestFirePumpFlowGpm} GPM (${standpipes <= 2 ? "2 standpipes" : ">2 standpipes"}) at pressure to satisfy 6.9 bar at most remote landing valve`,
      requiresStagingPumps: false,
      stagingIntervalMeters: 0,
      stagingLevelsCount: 0,
      stagingPumpFlowGpm: 0,
      stagingPumpFlowLpm: 0,
      stagingPumpPressureBar: 0,
      stagingPumpPressurePsi: 0,
      stagingRemarks: "Single pump set at lowest level",
      mainTankDurationMin,
      mainTankNetVolumeGal,
      mainTankNetVolumeM3,
      mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
      mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling",
      stagingTankDurationMin: 0,
      stagingTankNetVolumeGal: 0,
      stagingTankNetVolumeM3: 0,
      totalUpperTanksVolumeM3: 0,
      stagingTankAppurtenances: "N/A",
      totalNetWaterStorageM3: mainTankNetVolumeM3,
      totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      recommendedHeaderNps: header.nps,
      recommendedHeaderDn: header.dn,
      flowVelocityFps: header.velocityFps,
      clauses: [
        "Table 9.20.a: Midrise Assembly/Education/Healthcare/Hotel/Mercantile",
        "Section 3.4: Wet Riser System",
        "Section 3.5: Automatic Sprinkler System",
        isPlotOver20k ? "Section 3.11: Yard Fire Hydrants (Plot > 20,000 m²)" : "Table 9.20.a Case 1: 45 min storage tank",
        "Table 9.30: Auxiliary Rooms Protection"
      ]
    };
  }

  // 5. LOWRISE BUILDINGS (Height <= 15 m) — Tables 9.21.a, 9.21.b, 9.21.c, 9.21.d, 9.21.e
  // 5.1. Converted G+1 Villas — Table 9.21.d
  if (occ === "converted_villa") {
    const has2ndStair = Boolean(b.hasSecondExitStair);
    if (gfa < 900 || has2ndStair) {
      return {
        tableRef: "Table 9.21.d",
        tableTitle: "Lowrise: Converted Existing Villas (G+1)",
        categoryCode: gfa < 900 ? "Table 9.21.d Case 1 (GFA < 900 m²)" : "Table 9.21.d Case 2 (2 Exit Stairs Available)",
        buildingClass: "Lowrise (<=15m)",
        sprinklerRequirement: "Not mandatory. Fire Extinguishers required as per Chapter 4.",
        sprinklerType: "none",
        riserRequirement: "Not required",
        riserType: "none",
        isZoned: false,
        riserInterconnection: "N/A",
        hoseReelRequirement: "Not mandatory. Portable Fire Extinguishers as per Chapter 4",
        yardHydrantRequirement: "Not required",
        isYardHydrantRequired: false,
        isYardHydrantExempt: true,
        auxiliaryRoomProtection: "Protected as per Table 9.30",
        lowestFirePumpFlowGpm: 0,
        lowestFirePumpFlowLpm: 0,
        lowestFirePumpPressureBar: 0,
        lowestFirePumpPressurePsi: 0,
        lowestPumpRemarks: "N/A (No fire pump set required for converted villa under this category)",
        requiresStagingPumps: false,
        stagingIntervalMeters: 0,
        stagingLevelsCount: 0,
        stagingPumpFlowGpm: 0,
        stagingPumpFlowLpm: 0,
        stagingPumpPressureBar: 0,
        stagingPumpPressurePsi: 0,
        stagingRemarks: "No fire pumps required",
        mainTankDurationMin: 0,
        mainTankNetVolumeGal: 0,
        mainTankNetVolumeM3: 0,
        mainTankGrossVolumeGal: 0,
        mainTankGrossVolumeM3: 0,
        mainTankAppurtenances: "N/A",
        stagingTankDurationMin: 0,
        stagingTankNetVolumeGal: 0,
        stagingTankNetVolumeM3: 0,
        totalUpperTanksVolumeM3: 0,
        stagingTankAppurtenances: "N/A",
        totalNetWaterStorageM3: 0,
        totalGrossWaterStorageM3: 0,
        recommendedHeaderNps: 0,
        recommendedHeaderDn: 0,
        flowVelocityFps: 0,
        clauses: [
          "Table 9.21.d: Converted Existing Villas (G+1)",
          "Chapter 4: Fire Extinguishers",
          "Table 9.30: Auxiliary Rooms Protection"
        ]
      };
    } else {
      // Table 9.21.d Case 3: GFA >= 900 m² and no second exit stair -> Sprinklers + Hose Reel
      const lowestFirePumpFlowGpm = 250;
      const lowestFirePumpPressureBar = 4.5;
      const mainTankDurationMin = 30;
      const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
      const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
      const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

      return {
        tableRef: "Table 9.21.d",
        tableTitle: "Lowrise: Converted Existing Villas (G+1) — No 2nd Exit Stair",
        categoryCode: "Table 9.21.d Case 3",
        buildingClass: "Lowrise (<=15m)",
        sprinklerRequirement: "Recommended: Automatic sprinkler system throughout building including basements per Section 3.5",
        sprinklerType: "wet",
        riserRequirement: "Hose Reel System per Section 3.3",
        riserType: "hose_reel_only",
        isZoned: false,
        riserInterconnection: "N/A",
        hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
        yardHydrantRequirement: "Not required",
        isYardHydrantRequired: false,
        isYardHydrantExempt: true,
        auxiliaryRoomProtection: "Protected as per Table 9.30",
        lowestFirePumpFlowGpm,
        lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
        lowestFirePumpPressureBar,
        lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
        lowestPumpRemarks: "250 GPM at pressure of 4.5 bar at most remote hose reel outlet (Roof installation permitted)",
        requiresStagingPumps: false,
        stagingIntervalMeters: 0,
        stagingLevelsCount: 0,
        stagingPumpFlowGpm: 0,
        stagingPumpFlowLpm: 0,
        stagingPumpPressureBar: 0,
        stagingPumpPressurePsi: 0,
        stagingRemarks: "Single pump set (permitted on roof)",
        mainTankDurationMin,
        mainTankNetVolumeGal,
        mainTankNetVolumeM3,
        mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
        mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
        mainTankAppurtenances: "Low water level detection and instantaneous refilling arrangement (Roof tank permitted)",
        stagingTankDurationMin: 0,
        stagingTankNetVolumeGal: 0,
        stagingTankNetVolumeM3: 0,
        totalUpperTanksVolumeM3: 0,
        stagingTankAppurtenances: "N/A",
        totalNetWaterStorageM3: mainTankNetVolumeM3,
        totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
        recommendedHeaderNps: header.nps,
        recommendedHeaderDn: header.dn,
        flowVelocityFps: header.velocityFps,
        clauses: [
          "Table 9.21.d Case 3: Converted Villa (GFA > 900 m², No 2nd Stair)",
          "Section 3.5: Automatic Sprinkler System",
          "Section 3.3: Hose Reel System (250 GPM @ 4.5 bar)",
          "Table 9.30: Auxiliary Rooms Protection"
        ]
      };
    }
  }

  // 5.2. Commercial Outlets Attached to Villas, Business, Mosques — Table 9.21.e
  if (occ === "mosque_with_commercial") {
    const isOver900 = gfa > 900;
    const lowestFirePumpFlowGpm = isOver900 ? 300 : 50;
    const lowestFirePumpPressureBar = 4.5;
    const mainTankDurationMin = 30;
    const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
    const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
    const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

    return {
      tableRef: "Table 9.21.e",
      tableTitle: "Lowrise: Commercial Outlets Attached to Villas / Mosques / Business",
      categoryCode: isOver900 ? "Table 9.21.e Case 2 (GFA > 900 m²)" : "Table 9.21.e Case 1 (GFA <= 900 m²)",
      buildingClass: "Lowrise (<=15m)",
      sprinklerRequirement: isOver900 ? "Sprinklers throughout building including basements per Section 3.5" : "Sprinklers not mandatory for commercial outlet <= 900 m²",
      sprinklerType: isOver900 ? "wet" : "none",
      riserRequirement: "Hose Reel system throughout per Section 3.3 (Dry landing valves not required)",
      riserType: "hose_reel_only",
      isZoned: false,
      riserInterconnection: "N/A",
      hoseReelRequirement: hasInfraHydrants ? "Exempted if infrastructure yard hydrants cover outlet" : "Hose Reel system throughout per Section 3.3",
      yardHydrantRequirement: "Not required on plot",
      isYardHydrantRequired: false,
      isYardHydrantExempt: true,
      auxiliaryRoomProtection: "Protected as per Table 9.30",
      lowestFirePumpFlowGpm,
      lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
      lowestFirePumpPressureBar,
      lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
      lowestPumpRemarks: `${lowestFirePumpFlowGpm} GPM at pressure to satisfy 4.5 bar at most remote Hose Outlet (Roof installation permitted)`,
      requiresStagingPumps: false,
      stagingIntervalMeters: 0,
      stagingLevelsCount: 0,
      stagingPumpFlowGpm: 0,
      stagingPumpFlowLpm: 0,
      stagingPumpPressureBar: 0,
      stagingPumpPressurePsi: 0,
      stagingRemarks: "Single pump set (permitted on roof)",
      mainTankDurationMin,
      mainTankNetVolumeGal,
      mainTankNetVolumeM3,
      mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
      mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling (Roof tank permitted)",
      stagingTankDurationMin: 0,
      stagingTankNetVolumeGal: 0,
      stagingTankNetVolumeM3: 0,
      totalUpperTanksVolumeM3: 0,
      stagingTankAppurtenances: "N/A",
      totalNetWaterStorageM3: mainTankNetVolumeM3,
      totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      recommendedHeaderNps: header.nps,
      recommendedHeaderDn: header.dn,
      flowVelocityFps: header.velocityFps,
      clauses: [
        `Table 9.21.e: Commercial Outlets Attached to Villas/Mosques/Business (${isOver900 ? "> 900 m²" : "<= 900 m²"})`,
        "Section 3.3: Hose Reel System (4.5 bar)",
        isOver900 ? "Section 3.5: Automatic Sprinkler System" : "Exemption: Dry landing valves not required",
        "Table 9.30: Auxiliary Rooms Protection"
      ]
    };
  }

  // 5.3. Lowrise Single Exit Stair Complying — Table 9.21.c
  if (isSingleStair && (occ === "residential" || occ === "business" || occ === "mercantile_ab" || occ === "hotel")) {
    const isOver500 = gfa > 500;
    const lowestFirePumpFlowGpm = isOver500 ? 300 : 50;
    const lowestFirePumpPressureBar = 4.5;
    const mainTankDurationMin = 30;
    const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
    const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
    const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

    return {
      tableRef: "Table 9.21.c",
      tableTitle: "Lowrise: Single Exit Stair Complying to Chapter 3 (Height <= 15 m)",
      categoryCode: isOver500 ? "Table 9.21.c Case 2 (GFA > 500 m²)" : "Table 9.21.c Case 1 (GFA <= 500 m²)",
      buildingClass: "Lowrise (<=15m)",
      sprinklerRequirement: isOver500 ? "Sprinklers throughout building including basements and podiums per Section 3.5" : "Sprinklers not mandatory for ground area up to 500 m²",
      sprinklerType: isOver500 ? "wet" : "none",
      riserRequirement: "Hose Reel system throughout per Section 3.3 (Dry landing valves not required)",
      riserType: "hose_reel_only",
      isZoned: false,
      riserInterconnection: "N/A",
      hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
      yardHydrantRequirement: "Not required",
      isYardHydrantRequired: false,
      isYardHydrantExempt: true,
      auxiliaryRoomProtection: "Protected as per Table 9.30",
      lowestFirePumpFlowGpm,
      lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
      lowestFirePumpPressureBar,
      lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
      lowestPumpRemarks: `${lowestFirePumpFlowGpm} GPM at pressure to satisfy 4.5 bar at most remote Hose Outlet (Roof installation permitted)`,
      requiresStagingPumps: false,
      stagingIntervalMeters: 0,
      stagingLevelsCount: 0,
      stagingPumpFlowGpm: 0,
      stagingPumpFlowLpm: 0,
      stagingPumpPressureBar: 0,
      stagingPumpPressurePsi: 0,
      stagingRemarks: "Single pump set (permitted on roof)",
      mainTankDurationMin,
      mainTankNetVolumeGal,
      mainTankNetVolumeM3,
      mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
      mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling (Roof tank permitted)",
      stagingTankDurationMin: 0,
      stagingTankNetVolumeGal: 0,
      stagingTankNetVolumeM3: 0,
      totalUpperTanksVolumeM3: 0,
      stagingTankAppurtenances: "N/A",
      totalNetWaterStorageM3: mainTankNetVolumeM3,
      totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      recommendedHeaderNps: header.nps,
      recommendedHeaderDn: header.dn,
      flowVelocityFps: header.velocityFps,
      clauses: [
        `Table 9.21.c: Lowrise Single Exit Stair (${isOver500 ? "> 500 m²" : "<= 500 m²"})`,
        "Section 3.3: Hose Reel System (4.5 bar)",
        isOver500 ? "Section 3.5: Automatic Sprinkler System" : "Exemption: Dry landing valves not required",
        "Table 9.30: Auxiliary Rooms Protection"
      ]
    };
  }

  // 5.4. Lowrise Residential, Healthcare B/C, Business, Animal Housing — Table 9.21.b
  const isLowriseGroupB = (
    occ === "residential" ||
    occ === "business" ||
    occ === "healthcare_bc" ||
    occ === "animal_housing"
  );

  if (isLowriseGroupB) {
    if (isPlotOver20k) {
      // Table 9.21.b Case 3: Plot Area > 20,000 m²
      const lowestFirePumpFlowGpm = 1000;
      const lowestFirePumpPressureBar = 6.9;
      const mainTankDurationMin = 60;
      const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
      const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
      const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

      return {
        tableRef: "Table 9.21.b",
        tableTitle: "Lowrise: Residential / Business / Healthcare B/C (Plot > 20,000 m²)",
        categoryCode: "Table 9.21.b Case 3",
        buildingClass: "Lowrise (<=15m)",
        sprinklerRequirement: gfa > 3600 ? "Sprinklers throughout building per Section 3.5" : "Sprinklers not mandatory for ground area <= 3,600 m²",
        sprinklerType: gfa > 3600 ? "wet" : "none",
        riserRequirement: gfa > 3600 ? "Wet riser System per Section 3.4" : "Hose Reel system throughout per Section 3.3",
        riserType: gfa > 3600 ? "wet_riser" : "hose_reel_only",
        isZoned: false,
        riserInterconnection: "Interconnected at highest level",
        hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
        yardHydrantRequirement: hasInfraHydrants ? "Exempted: Infrastructure yard hydrants available within 60 m" : "Yard Fire Hydrants required per Section 3.11",
        isYardHydrantRequired: !hasInfraHydrants,
        isYardHydrantExempt: hasInfraHydrants,
        auxiliaryRoomProtection: "Protected as per Table 9.30",
        lowestFirePumpFlowGpm,
        lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
        lowestFirePumpPressureBar,
        lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
        lowestPumpRemarks: "1000 GPM (combined yard hydrants + internal systems, irrespective of standpipes) @ 6.9 bar",
        requiresStagingPumps: false,
        stagingIntervalMeters: 0,
        stagingLevelsCount: 0,
        stagingPumpFlowGpm: 0,
        stagingPumpFlowLpm: 0,
        stagingPumpPressureBar: 0,
        stagingPumpPressurePsi: 0,
        stagingRemarks: "Single pump set",
        mainTankDurationMin,
        mainTankNetVolumeGal,
        mainTankNetVolumeM3,
        mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
        mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
        mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling",
        stagingTankDurationMin: 0,
        stagingTankNetVolumeGal: 0,
        stagingTankNetVolumeM3: 0,
        totalUpperTanksVolumeM3: 0,
        stagingTankAppurtenances: "N/A",
        totalNetWaterStorageM3: mainTankNetVolumeM3,
        totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
        recommendedHeaderNps: header.nps,
        recommendedHeaderDn: header.dn,
        flowVelocityFps: header.velocityFps,
        clauses: [
          "Table 9.21.b Case 3: Lowrise Residential/Business (Plot > 20,000 m²)",
          "Section 3.11: Yard Fire Hydrants",
          "Table 9.30: Auxiliary Rooms Protection"
        ]
      };
    } else if (gfa <= 3600) {
      // Table 9.21.b Case 1: GFA <= 3600 m²
      const lowestFirePumpFlowGpm = 50;
      const lowestFirePumpPressureBar = 4.5;
      const mainTankDurationMin = 30;
      const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
      const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
      const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

      return {
        tableRef: "Table 9.21.b",
        tableTitle: "Lowrise: Residential / Business / Healthcare B/C (GFA <= 3,600 m²)",
        categoryCode: "Table 9.21.b Case 1",
        buildingClass: "Lowrise (<=15m)",
        sprinklerRequirement: "Not mandatory for ground floor area up to 3,600 m²",
        sprinklerType: "none",
        riserRequirement: "Hose Reel System throughout per Section 3.3 (Dry landing valves not required)",
        riserType: "hose_reel_only",
        isZoned: false,
        riserInterconnection: "N/A",
        hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
        yardHydrantRequirement: "Not required (Plot area <= 20,000 m²)",
        isYardHydrantRequired: false,
        isYardHydrantExempt: true,
        auxiliaryRoomProtection: "Protected as per Table 9.30",
        lowestFirePumpFlowGpm,
        lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
        lowestFirePumpPressureBar,
        lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
        lowestPumpRemarks: "50 GPM at pressure to satisfy 4.5 bar at most remote Hose reel outlet valve (Roof installation permitted)",
        requiresStagingPumps: false,
        stagingIntervalMeters: 0,
        stagingLevelsCount: 0,
        stagingPumpFlowGpm: 0,
        stagingPumpFlowLpm: 0,
        stagingPumpPressureBar: 0,
        stagingPumpPressurePsi: 0,
        stagingRemarks: "Single pump set (permitted on roof)",
        mainTankDurationMin,
        mainTankNetVolumeGal,
        mainTankNetVolumeM3,
        mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
        mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
        mainTankAppurtenances: "Low water level detection and instantaneous refilling arrangement (Roof tank permitted)",
        stagingTankDurationMin: 0,
        stagingTankNetVolumeGal: 0,
        stagingTankNetVolumeM3: 0,
        totalUpperTanksVolumeM3: 0,
        stagingTankAppurtenances: "N/A",
        totalNetWaterStorageM3: mainTankNetVolumeM3,
        totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
        recommendedHeaderNps: header.nps,
        recommendedHeaderDn: header.dn,
        flowVelocityFps: header.velocityFps,
        clauses: [
          "Table 9.21.b Case 1: Lowrise Residential/Business (GFA <= 3600 m²)",
          "Section 3.3: Hose Reel System (50 GPM @ 4.5 bar)",
          "Exemption: Dry landing valves not required",
          "Table 9.30: Auxiliary Rooms Protection"
        ]
      };
    } else {
      // Table 9.21.b Case 2: GFA > 3600 m²
      const lowestFirePumpFlowGpm = standpipes <= 2 ? 750 : 1000;
      const lowestFirePumpPressureBar = 6.9;
      const mainTankDurationMin = 30;
      const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
      const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
      const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

      return {
        tableRef: "Table 9.21.b",
        tableTitle: "Lowrise: Residential / Business / Healthcare B/C (GFA > 3,600 m²)",
        categoryCode: "Table 9.21.b Case 2",
        buildingClass: "Lowrise (<=15m)",
        sprinklerRequirement: "Sprinklers throughout building including basements and podiums per Section 3.5",
        sprinklerType: "wet",
        riserRequirement: "Wet riser System throughout building per Section 3.4",
        riserType: "wet_riser",
        isZoned: false,
        riserInterconnection: "Interconnected at highest level",
        hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
        yardHydrantRequirement: "Not required (Plot area <= 20,000 m²)",
        isYardHydrantRequired: false,
        isYardHydrantExempt: true,
        auxiliaryRoomProtection: "Protected as per Table 9.30",
        lowestFirePumpFlowGpm,
        lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
        lowestFirePumpPressureBar,
        lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
        lowestPumpRemarks: `${lowestFirePumpFlowGpm} GPM (${standpipes <= 2 ? "2 standpipes" : ">2 standpipes"}) at pressure to satisfy 6.9 bar at most remote Landing Valve`,
        requiresStagingPumps: false,
        stagingIntervalMeters: 0,
        stagingLevelsCount: 0,
        stagingPumpFlowGpm: 0,
        stagingPumpFlowLpm: 0,
        stagingPumpPressureBar: 0,
        stagingPumpPressurePsi: 0,
        stagingRemarks: "Single pump set",
        mainTankDurationMin,
        mainTankNetVolumeGal,
        mainTankNetVolumeM3,
        mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
        mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
        mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling",
        stagingTankDurationMin: 0,
        stagingTankNetVolumeGal: 0,
        stagingTankNetVolumeM3: 0,
        totalUpperTanksVolumeM3: 0,
        stagingTankAppurtenances: "N/A",
        totalNetWaterStorageM3: mainTankNetVolumeM3,
        totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
        recommendedHeaderNps: header.nps,
        recommendedHeaderDn: header.dn,
        flowVelocityFps: header.velocityFps,
        clauses: [
          "Table 9.21.b Case 2: Lowrise Residential/Business (GFA > 3600 m²)",
          "Section 3.5: Automatic Sprinkler System",
          "Section 3.4: Wet Riser System (750/1000 GPM @ 6.9 bar)",
          "Table 9.30: Auxiliary Rooms Protection"
        ]
      };
    }
  }

  // 5.5. General Lowrise: Assembly, Education, Healthcare A, Mercantile, Hotel, Day Care, Detention, Mixed (<= 15 m) — Table 9.21.a
  if (isPlotOver20k) {
    // Table 9.21.a Case 4: Plot > 20,000 m²
    const lowestFirePumpFlowGpm = 1000;
    const lowestFirePumpPressureBar = 6.9;
    const mainTankDurationMin = 60;
    const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
    const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
    const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

    return {
      tableRef: "Table 9.21.a",
      tableTitle: "Lowrise: Assembly / Education / Healthcare A / Hotel / Mercantile (Plot > 20,000 m²)",
      categoryCode: "Table 9.21.a Case 4",
      buildingClass: "Lowrise (<=15m)",
      sprinklerRequirement: gfa > 500 ? "Sprinklers throughout building per Section 3.5" : "Sprinklers not mandatory for ground area <= 500 m²",
      sprinklerType: gfa > 500 ? "wet" : "none",
      riserRequirement: gfa > 3600 ? "Wet riser System per Section 3.4" : "Hose Reel system throughout per Section 3.3",
      riserType: gfa > 3600 ? "wet_riser" : "hose_reel_only",
      isZoned: false,
      riserInterconnection: "Interconnected at highest level",
      hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
      yardHydrantRequirement: hasInfraHydrants ? "Exempted: Infrastructure yard hydrants available within 60 m" : "Yard Fire Hydrants required per Section 3.11",
      isYardHydrantRequired: !hasInfraHydrants,
      isYardHydrantExempt: hasInfraHydrants,
      auxiliaryRoomProtection: "Protected as per Table 9.30",
      lowestFirePumpFlowGpm,
      lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
      lowestFirePumpPressureBar,
      lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
      lowestPumpRemarks: "1000 GPM (combined yard hydrants + internal systems, irrespective of standpipes) at pressure to satisfy 6.9 bar at remote landing valve and hydrant",
      requiresStagingPumps: false,
      stagingIntervalMeters: 0,
      stagingLevelsCount: 0,
      stagingPumpFlowGpm: 0,
      stagingPumpFlowLpm: 0,
      stagingPumpPressureBar: 0,
      stagingPumpPressurePsi: 0,
      stagingRemarks: "Single pump set",
      mainTankDurationMin,
      mainTankNetVolumeGal,
      mainTankNetVolumeM3,
      mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
      mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling",
      stagingTankDurationMin: 0,
      stagingTankNetVolumeGal: 0,
      stagingTankNetVolumeM3: 0,
      totalUpperTanksVolumeM3: 0,
      stagingTankAppurtenances: "N/A",
      totalNetWaterStorageM3: mainTankNetVolumeM3,
      totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      recommendedHeaderNps: header.nps,
      recommendedHeaderDn: header.dn,
      flowVelocityFps: header.velocityFps,
      clauses: [
        "Table 9.21.a Case 4: Lowrise Assembly/Education/Mercantile/Hotel (Plot > 20,000 m²)",
        "Section 3.11: Yard Fire Hydrants",
        "Table 9.30: Auxiliary Rooms Protection"
      ]
    };
  } else if (gfa <= 500) {
    // Table 9.21.a Case 1: GFA <= 500 m²
    const lowestFirePumpFlowGpm = 50;
    const lowestFirePumpPressureBar = 4.5;
    const mainTankDurationMin = 30;
    const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
    const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
    const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

    return {
      tableRef: "Table 9.21.a",
      tableTitle: "Lowrise: Assembly / Education / Healthcare A / Hotel / Mercantile (GFA <= 500 m²)",
      categoryCode: "Table 9.21.a Case 1",
      buildingClass: "Lowrise (<=15m)",
      sprinklerRequirement: "Not mandatory for ground floor area up to 500 m²",
      sprinklerType: "none",
      riserRequirement: "Hose Reel System throughout per Section 3.3 (Dry landing valves not required)",
      riserType: "hose_reel_only",
      isZoned: false,
      riserInterconnection: "N/A",
      hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
      yardHydrantRequirement: "Not required (Plot area <= 20,000 m²)",
      isYardHydrantRequired: false,
      isYardHydrantExempt: true,
      auxiliaryRoomProtection: "Protected as per Table 9.30",
      lowestFirePumpFlowGpm,
      lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
      lowestFirePumpPressureBar,
      lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
      lowestPumpRemarks: "50 GPM at pressure to satisfy 4.5 bar at most remote Hose reel outlet valve (Roof installation permitted)",
      requiresStagingPumps: false,
      stagingIntervalMeters: 0,
      stagingLevelsCount: 0,
      stagingPumpFlowGpm: 0,
      stagingPumpFlowLpm: 0,
      stagingPumpPressureBar: 0,
      stagingPumpPressurePsi: 0,
      stagingRemarks: "Single pump set (permitted on roof)",
      mainTankDurationMin,
      mainTankNetVolumeGal,
      mainTankNetVolumeM3,
      mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
      mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      mainTankAppurtenances: "Low water level detection and instantaneous refilling arrangement (Roof tank permitted)",
      stagingTankDurationMin: 0,
      stagingTankNetVolumeGal: 0,
      stagingTankNetVolumeM3: 0,
      totalUpperTanksVolumeM3: 0,
      stagingTankAppurtenances: "N/A",
      totalNetWaterStorageM3: mainTankNetVolumeM3,
      totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      recommendedHeaderNps: header.nps,
      recommendedHeaderDn: header.dn,
      flowVelocityFps: header.velocityFps,
      clauses: [
        "Table 9.21.a Case 1: Lowrise Assembly/Education/Mercantile/Hotel (GFA <= 500 m²)",
        "Section 3.3: Hose Reel System (50 GPM @ 4.5 bar)",
        "Exemption: Dry landing valves not required",
        "Table 9.30: Auxiliary Rooms Protection"
      ]
    };
  } else if (gfa > 500 && gfa <= 3600) {
    // Table 9.21.a Case 2: GFA 501 to 3600 m²
    const lowestFirePumpFlowGpm = 300;
    const lowestFirePumpPressureBar = 4.5;
    const mainTankDurationMin = 30;
    const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
    const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
    const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

    return {
      tableRef: "Table 9.21.a",
      tableTitle: "Lowrise: Assembly / Education / Healthcare A / Hotel / Mercantile (GFA 501–3600 m²)",
      categoryCode: "Table 9.21.a Case 2",
      buildingClass: "Lowrise (<=15m)",
      sprinklerRequirement: "Sprinklers throughout building including basements and podiums per Section 3.5",
      sprinklerType: "wet",
      riserRequirement: "Hose Reel system throughout per Section 3.3 (Dry landing valves not required)",
      riserType: "hose_reel_only",
      isZoned: false,
      riserInterconnection: "N/A",
      hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
      yardHydrantRequirement: "Not required (Plot area <= 20,000 m²)",
      isYardHydrantRequired: false,
      isYardHydrantExempt: true,
      auxiliaryRoomProtection: "Protected as per Table 9.30",
      lowestFirePumpFlowGpm,
      lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
      lowestFirePumpPressureBar,
      lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
      lowestPumpRemarks: "300 GPM at pressure to satisfy 4.5 bar at most remote Hose reel outlet valve",
      requiresStagingPumps: false,
      stagingIntervalMeters: 0,
      stagingLevelsCount: 0,
      stagingPumpFlowGpm: 0,
      stagingPumpFlowLpm: 0,
      stagingPumpPressureBar: 0,
      stagingPumpPressurePsi: 0,
      stagingRemarks: "Single pump set",
      mainTankDurationMin,
      mainTankNetVolumeGal,
      mainTankNetVolumeM3,
      mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
      mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      mainTankAppurtenances: "Low water level detection and instantaneous refilling arrangement",
      stagingTankDurationMin: 0,
      stagingTankNetVolumeGal: 0,
      stagingTankNetVolumeM3: 0,
      totalUpperTanksVolumeM3: 0,
      stagingTankAppurtenances: "N/A",
      totalNetWaterStorageM3: mainTankNetVolumeM3,
      totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      recommendedHeaderNps: header.nps,
      recommendedHeaderDn: header.dn,
      flowVelocityFps: header.velocityFps,
      clauses: [
        "Table 9.21.a Case 2: Lowrise Assembly/Education/Mercantile/Hotel (GFA 501–3600 m²)",
        "Section 3.5: Automatic Sprinkler System",
        "Section 3.3: Hose Reel System (300 GPM @ 4.5 bar)",
        "Table 9.30: Auxiliary Rooms Protection"
      ]
    };
  } else {
    // Table 9.21.a Case 3: GFA > 3600 m²
    const lowestFirePumpFlowGpm = standpipes <= 2 ? 750 : 1000;
    const lowestFirePumpPressureBar = 6.9;
    const mainTankDurationMin = 30;
    const mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
    const mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
    const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

    return {
      tableRef: "Table 9.21.a",
      tableTitle: "Lowrise: Assembly / Education / Healthcare A / Hotel / Mercantile (GFA > 3,600 m²)",
      categoryCode: "Table 9.21.a Case 3",
      buildingClass: "Lowrise (<=15m)",
      sprinklerRequirement: "Sprinklers throughout building including basements and podiums per Section 3.5",
      sprinklerType: "wet",
      riserRequirement: "Wet riser System throughout building per Section 3.4",
      riserType: "wet_riser",
      isZoned: false,
      riserInterconnection: "Interconnected at highest level",
      hoseReelRequirement: "Hose Reel system throughout building per Section 3.3",
      yardHydrantRequirement: "Not required (Plot area <= 20,000 m²)",
      isYardHydrantRequired: false,
      isYardHydrantExempt: true,
      auxiliaryRoomProtection: "Protected as per Table 9.30",
      lowestFirePumpFlowGpm,
      lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
      lowestFirePumpPressureBar,
      lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
      lowestPumpRemarks: `${lowestFirePumpFlowGpm} GPM (${standpipes <= 2 ? "2 standpipes" : ">2 standpipes"}) at pressure to satisfy 6.9 bar at most remote Landing Valve`,
      requiresStagingPumps: false,
      stagingIntervalMeters: 0,
      stagingLevelsCount: 0,
      stagingPumpFlowGpm: 0,
      stagingPumpFlowLpm: 0,
      stagingPumpPressureBar: 0,
      stagingPumpPressurePsi: 0,
      stagingRemarks: "Single pump set",
      mainTankDurationMin,
      mainTankNetVolumeGal,
      mainTankNetVolumeM3,
      mainTankGrossVolumeGal: Math.round(mainTankNetVolumeGal * 1.1),
      mainTankGrossVolumeM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      mainTankAppurtenances: "Low water level detection, dedicated direct breeching inlet for refilling, instantaneous utility refilling",
      stagingTankDurationMin: 0,
      stagingTankNetVolumeGal: 0,
      stagingTankNetVolumeM3: 0,
      totalUpperTanksVolumeM3: 0,
      stagingTankAppurtenances: "N/A",
      totalNetWaterStorageM3: mainTankNetVolumeM3,
      totalGrossWaterStorageM3: parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1)),
      recommendedHeaderNps: header.nps,
      recommendedHeaderDn: header.dn,
      flowVelocityFps: header.velocityFps,
      clauses: [
        "Table 9.21.a Case 3: Lowrise Assembly/Education/Mercantile/Hotel (GFA > 3600 m²)",
        "Section 3.5: Automatic Sprinkler System",
        "Section 3.4: Wet Riser System (750/1000 GPM @ 6.9 bar)",
        "Table 9.30: Auxiliary Rooms Protection"
      ]
    };
  }
}

/**
 * Main Evaluation Engine implementing UAE Civil Defense Tables 9.18 to 9.21.e
 * Supports optional user manual overrides while strictly preserving standard code formulas by default.
 */
export function evaluateCivilDefenseFireDemand(b: CivilDefenseBuilding): CivilDefenseEvaluation {
  const ev = evaluateCivilDefenseFireDemandRaw(b);

  let { lowestFirePumpFlowGpm, lowestFirePumpPressureBar, mainTankDurationMin, mainTankNetVolumeM3 } = ev;
  let hasFlowOverride = false;
  let hasDurationOverride = false;

  if (b.overridePumpFlowGpm !== undefined && b.overridePumpFlowGpm > 0) {
    lowestFirePumpFlowGpm = Number(b.overridePumpFlowGpm);
    hasFlowOverride = true;
  }
  if (b.overridePumpPressureBar !== undefined && b.overridePumpPressureBar > 0) {
    lowestFirePumpPressureBar = Number(b.overridePumpPressureBar);
  }
  if (b.overrideTankDurationMin !== undefined && b.overrideTankDurationMin > 0) {
    mainTankDurationMin = Number(b.overrideTankDurationMin);
    hasDurationOverride = true;
  }

  let mainTankNetVolumeGal = ev.mainTankNetVolumeGal;
  if (b.overrideNetStorageM3 !== undefined && b.overrideNetStorageM3 > 0) {
    mainTankNetVolumeM3 = Number(b.overrideNetStorageM3);
    mainTankNetVolumeGal = Math.round(mainTankNetVolumeM3 / 0.00378541);
  } else if (hasFlowOverride || hasDurationOverride) {
    mainTankNetVolumeGal = lowestFirePumpFlowGpm * mainTankDurationMin;
    mainTankNetVolumeM3 = parseFloat((mainTankNetVolumeGal * 0.00378541).toFixed(1));
  }

  const mainTankGrossVolumeGal = Math.round(mainTankNetVolumeGal * 1.1);
  const mainTankGrossVolumeM3 = parseFloat((mainTankNetVolumeM3 * 1.1).toFixed(1));

  const totalNetWaterStorageM3 = parseFloat((mainTankNetVolumeM3 + ev.totalUpperTanksVolumeM3).toFixed(1));
  const totalGrossWaterStorageM3 = parseFloat(((mainTankNetVolumeM3 + ev.totalUpperTanksVolumeM3) * 1.1).toFixed(1));

  const header = getRecommendedHeaderSize(lowestFirePumpFlowGpm);

  return {
    ...ev,
    lowestFirePumpFlowGpm,
    lowestFirePumpFlowLpm: Math.round(lowestFirePumpFlowGpm * 3.78541),
    lowestFirePumpPressureBar,
    lowestFirePumpPressurePsi: Math.round(lowestFirePumpPressureBar * 14.5038),
    mainTankDurationMin,
    mainTankNetVolumeGal,
    mainTankNetVolumeM3,
    mainTankGrossVolumeGal,
    mainTankGrossVolumeM3,
    totalNetWaterStorageM3,
    totalGrossWaterStorageM3,
    recommendedHeaderNps: header.nps,
    recommendedHeaderDn: header.dn,
    flowVelocityFps: header.velocityFps,
  };
}

/**
 * Standard Presets based on Civil Defense Code Tables
 */
export interface CivilDefensePresetConfig {
  key: string;
  label: string;
  category: string;
  tableRef: string;
  description: string;
  defaultBuilding: Omit<CivilDefenseBuilding, "id">;
}

export const CIVIL_DEFENSE_PRESETS: CivilDefensePresetConfig[] = [
  {
    key: "super_highrise_tower",
    label: "Super Highrise Tower (> 90 m)",
    category: "Table 9.18",
    tableRef: "Table 9.18",
    description: "Towers > 90 m requiring 1000 GPM @ 17 bar base pump, 60-min tank, plus multi-level 90m intermediate pumps and 30-min upper tanks.",
    defaultBuilding: {
      name: "Main Super Highrise Tower",
      height: 180,
      floors: 50,
      plotArea: 25000,
      groundFloorArea: 2400,
      occupancy: "hotel",
      standpipeCount: 4,
      hasInfraHydrants60m: false,
      isSingleExitStair: false,
      basementCount: 3,
    }
  },
  {
    key: "highrise_tier1_large_plot",
    label: "Highrise 45m–90m (Plot > 20,000 m²)",
    category: "Table 9.19 Cat. A",
    tableRef: "Table 9.19 Cat. A",
    description: "Highrise 45m to 90m on large plot. Combined 1000 GPM pump for yard hydrants + internal systems, 60-min tank.",
    defaultBuilding: {
      name: "Highrise Commercial Tower",
      height: 75,
      floors: 22,
      plotArea: 24000,
      groundFloorArea: 3200,
      occupancy: "business",
      standpipeCount: 3,
      hasInfraHydrants60m: false,
      isSingleExitStair: false,
      basementCount: 2,
    }
  },
  {
    key: "highrise_tier1_standard",
    label: "Highrise 45m–90m (Plot <= 20,000 m²)",
    category: "Table 9.19 Cat. B",
    tableRef: "Table 9.19 Cat. B",
    description: "Highrise 45m to 90m without yard hydrants. 750 GPM (2 standpipes) or 1000 GPM (>2 standpipes), 60-min tank.",
    defaultBuilding: {
      name: "Highrise Residential Block",
      height: 65,
      floors: 18,
      plotArea: 12000,
      groundFloorArea: 2000,
      occupancy: "residential",
      standpipeCount: 2,
      hasInfraHydrants60m: true,
      isSingleExitStair: false,
      basementCount: 2,
    }
  },
  {
    key: "highrise_tier2_23m_45m",
    label: "Highrise 23m–45m (Residential / Office)",
    category: "Table 9.19 Cat. D",
    tableRef: "Table 9.19 Cat. D",
    description: "Highrise 23m to 45m: Sprinklers throughout, wet riser system, 750/1000 GPM pump, 60-min water tank.",
    defaultBuilding: {
      name: "Urban Residential Tower",
      height: 38,
      floors: 11,
      plotArea: 8000,
      groundFloorArea: 1800,
      occupancy: "residential",
      standpipeCount: 2,
      hasInfraHydrants60m: true,
      isSingleExitStair: false,
      basementCount: 1,
    }
  },
  {
    key: "midrise_assembly_hotel",
    label: "Midrise Hotel / Mall / Assembly",
    category: "Table 9.20.a",
    tableRef: "Table 9.20.a",
    description: "Midrise (>15m to 23m) Assembly/Hotel/Mercantile. Wet risers + sprinklers, 750/1000 GPM pump, 45-min water tank.",
    defaultBuilding: {
      name: "Boutique Hotel & Convention",
      height: 21,
      floors: 6,
      plotArea: 15000,
      groundFloorArea: 2800,
      occupancy: "hotel",
      standpipeCount: 2,
      hasInfraHydrants60m: true,
      isSingleExitStair: false,
      basementCount: 1,
    }
  },
  {
    key: "midrise_residential_small",
    label: "Midrise Residential (GFA <= 900 m²)",
    category: "Table 9.20.b Case 1",
    tableRef: "Table 9.20.b Case 1",
    description: "Midrise residential with compact ground floor (<=900 m²). Dry riser + hose reel system, 50 GPM @ 4.5 bar, 45-min tank.",
    defaultBuilding: {
      name: "Staff Accommodation Block",
      height: 18,
      floors: 5,
      plotArea: 3500,
      groundFloorArea: 750,
      occupancy: "residential",
      standpipeCount: 1,
      hasInfraHydrants60m: true,
      isSingleExitStair: false,
      basementCount: 0,
    }
  },
  {
    key: "midrise_single_stair",
    label: "Midrise Single Exit Stair (Area <= 500 m²)",
    category: "Table 9.20.c",
    tableRef: "Table 9.20.c",
    description: "Height 15m to 23m with single exit stair and ground area <= 500 m². Wet riser + sprinklers, 500 GPM @ 6.9 bar, 45-min tank.",
    defaultBuilding: {
      name: "Single-Stair Residential Building",
      height: 20,
      floors: 6,
      plotArea: 2000,
      groundFloorArea: 420,
      occupancy: "residential",
      standpipeCount: 1,
      hasInfraHydrants60m: true,
      isSingleExitStair: true,
      basementCount: 0,
    }
  },
  {
    key: "lowrise_commercial_mall",
    label: "Lowrise Shopping Mall / School (GFA > 3600 m²)",
    category: "Table 9.21.a Case 3",
    tableRef: "Table 9.21.a Case 3",
    description: "Lowrise large ground floor area (>3,600 m²). Sprinklers + wet riser, 750/1000 GPM @ 6.9 bar, 30-min tank.",
    defaultBuilding: {
      name: "Community Retail Center",
      height: 12,
      floors: 3,
      plotArea: 18000,
      groundFloorArea: 5200,
      occupancy: "mercantile_ab",
      standpipeCount: 3,
      hasInfraHydrants60m: true,
      isSingleExitStair: false,
      basementCount: 1,
    }
  },
  {
    key: "lowrise_residential_block",
    label: "Lowrise Residential (GFA <= 3600 m²)",
    category: "Table 9.21.b Case 1",
    tableRef: "Table 9.21.b Case 1",
    description: "Lowrise residential/office <= 3,600 m² ground area. Hose reel only (no dry landing valves), 50 GPM @ 4.5 bar, 30-min tank.",
    defaultBuilding: {
      name: "Lowrise Apartment Complex",
      height: 14,
      floors: 4,
      plotArea: 4800,
      groundFloorArea: 1600,
      occupancy: "residential",
      standpipeCount: 1,
      hasInfraHydrants60m: true,
      isSingleExitStair: false,
      basementCount: 0,
    }
  },
  {
    key: "lowrise_outlet_on_villa",
    label: "Commercial Outlet Attached to Villa / Mosque",
    category: "Table 9.21.e",
    tableRef: "Table 9.21.e",
    description: "Villas, business or mosques with commercial outlets attached. 50 GPM or 300 GPM @ 4.5 bar, 30-min tank.",
    defaultBuilding: {
      name: "Villa with Pharmacy / Cafe",
      height: 9,
      floors: 2,
      plotArea: 2500,
      groundFloorArea: 450,
      occupancy: "mosque_with_commercial",
      standpipeCount: 1,
      hasInfraHydrants60m: true,
      isSingleExitStair: false,
      basementCount: 0,
    }
  }
];
