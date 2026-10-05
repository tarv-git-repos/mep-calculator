import {
  type CivilDefenseBuilding,
  type CivilDefenseOccupancy,
  type CivilDefenseEvaluation,
  evaluateCivilDefenseFireDemand,
  getRecommendedHeaderSize,
  CIVIL_DEFENSE_PRESETS,
  type CivilDefensePresetConfig
} from "./civilDefenseFireDemandCalc";

export const OCCUPANCY_OPTIONS: { value: CivilDefenseOccupancy; label: string; desc: string }[] = [
  { value: "residential", label: "Residential (Apartments / Labor / Staff)", desc: "Flats, staff accommodation, hostels, boarding houses" },
  { value: "business", label: "Business (Offices / Banks / Professional)", desc: "Corporate offices, service providers, civic buildings" },
  { value: "hotel", label: "Hotel & Hospitality", desc: "Hotels, motels, luxury furnished apartments, resorts" },
  { value: "mercantile_ab", label: "Mercantile Class A & B (Retail / Malls)", desc: "Shopping malls, supermarkets, department stores" },
  { value: "mercantile_c_kiosk", label: "Mercantile Class C / Kiosks", desc: "Small retail shops, kiosks, convenience booths" },
  { value: "assembly", label: "Assembly (Cinemas / Auditoriums / Clubs)", desc: "Theaters, convention centers, places of worship" },
  { value: "education", label: "Education (Schools / Universities)", desc: "Classrooms, libraries, laboratories, nurseries" },
  { value: "healthcare_a", label: "Healthcare Group A (Hospitals / Inpatient)", desc: "Hospitals with sleeping accommodations, ICUs" },
  { value: "healthcare_bc", label: "Healthcare Group B & C (Outpatient Clinics)", desc: "Day clinics, specialized medical consultation" },
  { value: "day_care", label: "Day Care Centers", desc: "Infant and child day care facilities" },
  { value: "detention", label: "Detention & Correctional", desc: "Prisons, correctional centers, reformatories" },
  { value: "animal_housing", label: "Animal Housing / Veterinary", desc: "Stables, veterinary clinics, kennels" },
  { value: "converted_villa", label: "Converted Existing G+1 Villa", desc: "Villas converted to commercial, educational, or medical use" },
  { value: "mosque_with_commercial", label: "Commercial Outlet on Villa / Mosque", desc: "Shops, cafes, or pharmacies attached to villas or mosques" },
];

export const INITIAL_BUILDINGS: CivilDefenseBuilding[] = [
  {
    id: "bld-tower-a",
    name: "Tower A (Super Highrise Hotel & Residences)",
    height: 110,
    floors: 32,
    plotArea: 14000,
    groundFloorArea: 1800,
    occupancy: "hotel",
    standpipeCount: 3,
    hasInfraHydrants60m: true,
    isSingleExitStair: false,
    basementCount: 2,
    notes: "Requires 1000 GPM @ 17 bar lowest pump + intermediate 1000 GPM @ 6.9 bar staging pump at +90m."
  },
  {
    id: "bld-block-b",
    name: "Block B (Highrise Commercial Offices)",
    height: 65,
    floors: 18,
    plotArea: 18000,
    groundFloorArea: 2200,
    occupancy: "business",
    standpipeCount: 2,
    hasInfraHydrants60m: true,
    isSingleExitStair: false,
    basementCount: 2,
    notes: "Standard Highrise Tier 1: 750 GPM @ 6.9 bar combined pump, 60-min dedicated water tank."
  },
  {
    id: "bld-podium-c",
    name: "Block C (Podium Retail Mall & Cineplex)",
    height: 14,
    floors: 3,
    plotArea: 24000,
    groundFloorArea: 4800,
    occupancy: "mercantile_ab",
    standpipeCount: 3,
    hasInfraHydrants60m: false,
    isSingleExitStair: false,
    basementCount: 1,
    notes: "Large plot (>20,000 mÂ²) without 60m infra hydrants: 1000 GPM @ 6.9 bar combined pump for yard hydrants."
  },
  {
    id: "bld-staff-d",
    name: "Block D (Staff Accommodation Lowrise)",
    height: 18,
    floors: 5,
    plotArea: 3500,
    groundFloorArea: 800,
    occupancy: "residential",
    standpipeCount: 1,
    hasInfraHydrants60m: true,
    isSingleExitStair: false,
    basementCount: 0,
    notes: "Midrise residential with GFA <= 900 mÂ²: 50 GPM @ 4.5 bar dry riser + hose reel system."
  }
];

export function computeFireWaterProjectSummary(evaluatedBuildings: { building: CivilDefenseBuilding; evaluation: CivilDefenseEvaluation }[]) {

    let maxPumpFlowGpm = 0;
    let maxPumpPressureBar = 0;
    let totalNetStorageM3 = 0;
    let totalGrossStorageM3 = 0;
    let superHighriseCount = 0;
    let yardHydrantRequiredCount = 0;

    for (const item of evaluatedBuildings) {
      const ev = item.evaluation;
      if (ev.lowestFirePumpFlowGpm > maxPumpFlowGpm) {
        maxPumpFlowGpm = ev.lowestFirePumpFlowGpm;
        maxPumpPressureBar = ev.lowestFirePumpPressureBar;
      } else if (ev.lowestFirePumpFlowGpm === maxPumpFlowGpm) {
        if (ev.lowestFirePumpPressureBar > maxPumpPressureBar) {
          maxPumpPressureBar = ev.lowestFirePumpPressureBar;
        }
      }
      totalNetStorageM3 += ev.totalNetWaterStorageM3;
      totalGrossStorageM3 += ev.totalGrossWaterStorageM3;
      if (ev.requiresStagingPumps) superHighriseCount++;
      if (ev.isYardHydrantRequired) yardHydrantRequiredCount++;
    }

    const header = getRecommendedHeaderSize(maxPumpFlowGpm);

    return {
      buildingCount: evaluatedBuildings.length,
      maxPumpFlowGpm,
      maxPumpFlowLpm: Math.round(maxPumpFlowGpm * 3.78541),
      maxPumpPressureBar,
      maxPumpPressurePsi: Math.round(maxPumpPressureBar * 14.5038),
      totalNetStorageM3: parseFloat(totalNetStorageM3.toFixed(1)),
      totalNetStorageGal: Math.round(totalNetStorageM3 / 0.00378541),
      totalGrossStorageM3: parseFloat(totalGrossStorageM3.toFixed(1)),
      totalGrossStorageGal: Math.round(totalGrossStorageM3 / 0.00378541),
      superHighriseCount,
      yardHydrantRequiredCount,
      governingHeaderNps: header.nps,
      governingHeaderDn: header.dn,
      governingHeaderVelocity: header.velocityFps,
    };
  
}

export function computeActiveTankSizing(
  activeItem: { building: CivilDefenseBuilding; evaluation: CivilDefenseEvaluation } | null,
  tankLength: number,
  tankWidth: number,
  tankFreeboard: number,
  tankDeadVolumeDepth: number,
  cityMainRefillFlowGpm: number
) {

    if (!activeItem) return null;
    const netM3 = activeItem.evaluation.mainTankNetVolumeM3;
    const l = Math.max(1.0, tankLength);
    const w = Math.max(1.0, tankWidth);
    const floorArea = l * w;

    const effectiveDepth = floorArea > 0 ? netM3 / floorArea : 0;
    const totalHeight = effectiveDepth + tankFreeboard + tankDeadVolumeDepth;
    const grossVolumeM3 = floorArea * totalHeight;
    const grossVolumeGal = Math.round(grossVolumeM3 / 0.00378541);

    const refillLpm = cityMainRefillFlowGpm * 3.78541;
    const refillM3h = (refillLpm * 60) / 1000;
    const fillTimeHours = refillM3h > 0 ? netM3 / refillM3h : 0;

    return {
      floorArea: parseFloat(floorArea.toFixed(2)),
      effectiveDepth: parseFloat(effectiveDepth.toFixed(2)),
      totalHeight: parseFloat(totalHeight.toFixed(2)),
      grossVolumeM3: parseFloat(grossVolumeM3.toFixed(1)),
      grossVolumeGal,
      fillTimeHours: parseFloat(fillTimeHours.toFixed(1)),
      waterWavePercent: totalHeight > 0 ? Math.min(85, Math.max(15, (effectiveDepth / totalHeight) * 100)) : 50,
    };
  
}
