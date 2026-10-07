import { type CalculationPreviewData } from "@/components/calculator-framework/CalculationPreviewModal";
import { getFloorRank } from "@/lib/bimViewerSpaceExtractor";

export interface LightFixture {
  id: string;
  type: string;
  watts: string;
  qty: string;
}

export interface LpdSpace {
  id: string;
  name: string;
  areaType?: string;
  areaSqM: string;
  baselineLpd: string;
  remarks: string;
  fixtures: LightFixture[];
  comments?: any[];
  flagged?: boolean;
}

export interface LpdGroup {
  id: string;
  name: string;
  isExpanded: boolean;
  spaces: LpdSpace[];
}

export interface LpdProject {
  id: string;
  name: string;
  type: "Internal" | "External";
  projectNo: string;
  client: string;
  endUser: string;
  calculationNo: string;
  revNo: string;
  date: string;
  internalGroups: LpdGroup[];
  externalGroups: LpdGroup[];
}

export const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 9);
};

export const LPD_AUTHORITY_MAPPING: Record<string, number> = {
  "drive way": 0.15,
  "passenger lift lobby": 0.65,
  "service lift lobby": 0.65,
  "lift lobby": 0.65,
  "electrical room": 0.43,
  "telephone room": 0.43,
  "gym": 0.90,
  "toilet": 0.90,
  "balcony": 0.61,
  "bath": 0.63,
  "Exterior/Landscape Area": 0.05,
  "Garden / Landscape (Exterior)": 0.05,
  "Walkway / Plaza (Exterior)": 0.10,
  "Parking Lot / Driveway (Exterior)": 0.08,
  "Balcony / Terrace (Exterior)": 0.15,
  "Building Façade / Canopy (Exterior)": 0.15,
  "Open Parking Garage (Exterior)": 0.15,
  "bedroom": 0.50,
  "bedroom-1": 0.50,
  "bedroom-3": 0.50,
  "chilled water pump room": 0.43,
  "circulation area": 0.41,
  "entrance": 0.84,
  "fahu rooms": 0.43,
  "fahu rooms (5 nos.)": 0.43,
  "fcc control room": 0.43,
  "generator room": 0.43,
  "gsm": 0.43,
  "garbage room": 0.38,
  "kitchen": 1.09,
  "lv room": 0.43,
  "living/ dining room": 0.60,
  "living/ dinning room": 0.60,
  "m. bath": 0.63,
  "m. bed room": 0.50,
  "m. dressing": 0.51,
  "mtr": 0.43,
  "maid room": 0.50,
  "powder room": 0.63,
  "rmu room": 0.43,
  "spa": 0.90,
  "staircase": 0.49,
  "store": 0.38,
  "swimming pool room": 0.43,
  "transformer room": 0.43,
  "waste room": 0.43,
  "water meter room": 0.43,
  "yoga lobby": 0.65,
  "yoga room": 0.90,
  "Building Area Typea - Automotive facility (Building Method)": 0.73,
  "Convention center (Building Method)": 0.64,
  "Courthouse (Building Method)": 0.75,
  "Dining: Bar lounge/leisure (Building Method)": 0.74,
  "Dining: Cafeteria/fast food (Building Method)": 0.7,
  "Dining: Family (Building Method)": 0.65,
  "Dormitory (Building Method)": 0.52,
  "Exercise center (Building Method)": 0.72,
  "Fire station (Building Method)": 0.56,
  "Gymnasium (Building Method)": 0.75,
  "Health care clinic (Building Method)": 0.77,
  "Hospital (Building Method)": 0.92,
  "Hotel/motel (Building Method)": 0.53,
  "Library (Building Method)": 0.83,
  "Manufacturing facility (Building Method)": 0.82,
  "Motion picture theater (Building Method)": 0.43,
  "Multifamily (Building Method)": 0.46,
  "Museum (Building Method)": 0.56,
  "Office (Building Method)": 0.62,
  "Parking garage (Building Method)": 0.17,
  "Penitentiary (Building Method)": 0.65,
  "Performing arts theater (Building Method)": 0.82,
  "Police station (Building Method)": 0.62,
  "Post office (Building Method)": 0.64,
  "Religious facility (Building Method)": 0.66,
  "Retail (Building Method)": 0.78,
  "School/university (Building Method)": 0.7,
  "Sports arena (Building Method)": 0.73,
  "Town hall (Building Method)": 0.67,
  "Transportation (Building Method)": 0.56,
  "Warehouse (Building Method)": 0.45,
  "Workshop (Building Method)": 0.86,
  "Atrium - <20 ft in height (Space Method)": 0.32,
  "20 ft and 40 ft in height (Space Method)": 0.41,
  ">40 ft in height (Space Method)": 0.51,
  "Audience Seating Area - Auditorium (Space Method)": 0.57,
  "Gymnasium (Space Method)": 0.23,
  "Motion picture theater (Space Method)": 0.2,
  "Performing arts theater (Space Method)": 1.21,
  "Sports arena (Space Method)": 0.27,
  "All other audience seating areas (Space Method)": 0.23,
  "Banking Activity Area (Space Method)": 0.56,
  "Classroom/Lecture Hall/Training Room - Shop classroom (Space Method)": 1.17,
  "All other classrooms/lecture halls/training rooms (Space Method)": 0.72,
  "Computer Room (Space Method)": 0.75,
  "Conference/Meeting/Multipurpose Rooms (Space Method)": 0.88,
  "Control/Editing Room or Booth (Space Method)": 0.73,
  "Copy/Print Room (Space Method)": 0.56,
  "Corridor (Space Method)": 0.44,
  "Courtroom (Space Method)": 1.08,
  "Dining Areas - Bar/lounge or leisure dining (Space Method)": 0.76,
  "food dining (Space Method)": 0.36,
  "Family dining (Space Method)": 0.52,
  "All other dining areas (Space Method)": 0.42,
  "Electrical/Mechanical Room (Space Method)": 0.71,
  "Emergency Vehicle Garage (Space Method)": 0.51,
  "Equipment Room (Space Method)": 0.73,
  "Food Preparation Area (Space Method)": 1.19,
  "Guest Room (Space Method)": 0.41,
  "Laboratory - In or as a classroom (Space Method)": 1.05,
  "All other laboratories (Space Method)": 1.21,
  "Laundry/Washing Area (Space Method)": 0.51,
  "Loading Dock, Interior (Space Method)": 0.87,
  "Lobby - Elevator (Space Method)": 0.64,
  "Hotel (Space Method)": 0.48,
  "All other lobbies (Space Method)": 0.8,
  "Locker Room (Space Method)": 0.43,
  "Lounge/Breakroom - Mother’s/wellness room (Space Method)": 0.68,
  "All other lounges/breakrooms (Space Method)": 0.55,
  "Office - Office 150 ft2 (Space Method)": 0.73,
  "Office >150 and 300 ft2 (Space Method)": 0.66,
  "Offices >300 ft2 (Space Method)": 0.56,
  "Parking Garage - Daylight transition zone (Space Method)": 1.06,
  "All other parking and drive areas (Space Method)": 0.11,
  "Pharmacy Area (Space Method)": 1.59,
  "Restroom (Space Method)": 0.74,
  "Sales Area (For accent lighting, see Section 9.5.2.2[b].) (Space Method)": 0.85,
  "Seating Area, General (Space Method)": 0.21,
  "Security Screening - Airport/bus/ship/train/transportation screening (Space Method)": 0.93,
  "Airport/bus/ship/train/transportation screening queue (Space Method)": 0.56,
  "General security screening (Space Method)": 0.64,
  "Stairwell (Space Method)": 0.47,
  "Storage Room - <50 ft2 (Space Method)": 0.49,
  "50 ft2 (Space Method)": 0.35,
  "Vehicular Maintenance Area (Space Method)": 0.59,
  "Workshop (including workshop classrooms) (Space Method)": 1.17,
  "Casino—Gaming Area - Betting/sportsbook/keno/bingo area (Space Method)": 0.82,
  "High-limit game area (Space Method)": 1.68,
  "Slot machine/digital gaming area (Space Method)": 0.54,
  "Table games area (Space Method)": 1.09,
  "Convention Center—Exhibit Space (Space Method)": 0.5,
  "Correctional Facilities - Audience seating area (Space Method)": 0.56,
  "Classroom/lecture hall/training room (Space Method)": 0.74,
  "Confinement cells (Space Method)": 0.6,
  "Dining area (Space Method)": 0.35,
  "Dormitory—Living Quarters (Space Method)": 0.48,
  "Chapel (used primarily by residents) (Space Method)": 0.58,
  "Corridor (used primarily by residents) (Space Method)": 0.71,
  "Dining (used primarily by residents) (Space Method)": 1.22,
  "Lobby (Space Method)": 1.44,
  "Recreation room/common living room  - (used primarily by residents) (Space Method)": 1.2,
  "Restroom (used primarily by residents) (Space Method)": 0.96,
  "Fire Station—Sleeping Quarters (Space Method)": 0.22,
  "Gymnasium/Fitness Center - Exercise area (Space Method)": 0.82,
  "Playing area (Space Method)": 0.82,
  "Health Care Facility - Control room (MRI/CT/radiology/PET) (Space Method)": 0.78,
  "Exam/treatment room (Space Method)": 1.33,
  "Hospital corridor (Space Method)": 0.61,
  "Imaging room (Space Method)": 0.94,
  "Lounge (Space Method)": 0.77,
  "Medical supply room (Space Method)": 0.56,
  "Nursery (Space Method)": 0.87,
  "Nurse’s station (Space Method)": 1.07,
  "Operating room (Space Method)": 2.31,
  "Patient room (Space Method)": 0.78,
  "Physical therapy room (Space Method)": 0.82,
  "Recovery room (Space Method)": 1.18,
  "Telemedicine (Space Method)": 1.44,
  "Library - Reading area (Space Method)": 0.86,
  "Stacks (Space Method)": 1.18,
  "Manufacturing Facility - Detailed manufacturing area (Space Method)": 0.75,
  "Extra-high bay area (>50 ft floor-to-ceiling height) (Space Method)": 1.36,
  "ceiling height) (Space Method)": 1.24,
  "Low bay area (<25 ft floor-to-ceiling height) (Space Method)": 0.85,
  "Museum - General exhibition area (Space Method)": 0.31,
  "Restoration area (Space Method)": 1.24,
  "Performing Arts Theater—Dressing Room (Space Method)": 0.39,
  "Post Office—Sorting Area (Space Method)": 0.71,
  "Religious Facility - Audience seating area (Space Method)": 0.72,
  "Fellowship hall (Space Method)": 0.5,
  "Worship/pulpit/choir area (Space Method)": 0.75,
  "Retail Facilities - Dressing/fitting room (Space Method)": 0.45,
  "Hair care (Space Method)": 0.65,
  "Mall concourse (Space Method)": 0.57,
  "Massage (Space Method)": 0.81,
  "Nail care (Space Method)": 0.75,
  "Sports Arena—Playing Area (Class of play as defined by ANSI/IES RP-6) - Class I facility (Space Method)": 2.86,
  "Class II facility (Space Method)": 1.47,
  "Class III facility (Space Method)": 0.99,
  "Class IV facility (Space Method)": 0.59,
  "Natatorium (Class of play as defined by IES RP-6) - Class I facility (Space Method)": 2.2,
  "Transportation Facility - Airport hanger (Space Method)": 1.36,
  "Baggage/carousel area (Space Method)": 0.28,
  "Concourse (Space Method)": 0.49,
  "Passenger loading area (Space Method)": 0.71,
  "Ticket counter (Space Method)": 0.4,
  "Warehouse—Storage Area - Medium-to-bulky, palletized items (Space Method)": 0.33,
  "Smaller items, picking areas (Space Method)": 0.69,
};

export const LIGHT_TYPE_MAPPING: Record<string, number> = {
  W3: 40,
  "TR-3": 10.5,
  D1: 10,
  L2: 26,
  L3: 26,
  D10: 35,
  "TR-3, COVE": 20.5,
};

export const DEFAULT_AUTHORITY_MAPPING_SQM: Record<string, number> = Object.fromEntries(
  Object.entries(LPD_AUTHORITY_MAPPING).map(([k, v]) => [k, v * 10.76391])
);

export const defaultFixture = (): LightFixture => ({
  id: generateId(),
  type: "W3",
  watts: "40",
  qty: "1",
});

export const defaultSpace = (name = ""): LpdSpace => ({
  id: generateId(),
  name,
  areaType: "",
  areaSqM: "",
  baselineLpd: "0.43",
  remarks: "",
  fixtures: [defaultFixture()],
  comments: [],
  flagged: false,
});

export const defaultGroup = (name = "GROUND FLOOR"): LpdGroup => ({
  id: generateId(),
  name,
  isExpanded: true,
  spaces: [defaultSpace()],
});

export const defaultProject = (): LpdProject => ({
  id: generateId(),
  name: "New LPD Project",
  type: "Internal",
  projectNo: "",
  client: "",
  endUser: "",
  calculationNo: "",
  revNo: "00",
  date: new Date().toISOString().split("T")[0],
  internalGroups: [defaultGroup("GROUND FLOOR"), defaultGroup("FIRST FLOOR")],
  externalGroups: [defaultGroup("EXTERNAL AREA")],
});


// Step-by-Step Calculation Preview generator
export const getLpdCalculationPreview = (space: LpdSpace, unitSystem: "si" | "ip", groupName?: string): CalculationPreviewData => {
  const isIp = unitSystem === "ip";
  const fixtures = space.fixtures || [];
  const totalWatts = fixtures.reduce((sum, f) => {
    const w = parseFloat(String(f.watts)) || 0;
    const q = parseFloat(String(f.qty)) || 0;
    return sum + w * q;
  }, 0);

  const rawArea = parseFloat(String(space.areaSqM)) || 0;
  const sqM = isIp ? rawArea / 10.76391 : rawArea;
  const sqF = isIp ? rawArea : rawArea * 10.76391;
  const primaryArea = isIp ? sqF : sqM;
  const secondaryArea = isIp ? sqM : sqF;
  const primaryUnit = isIp ? "sq.ft" : "m²";
  const secondaryUnit = isIp ? "m²" : "sq.ft";
  const lpdUnit = isIp ? "W/sq.ft" : "W/m²";

  const proposedLpd = primaryArea > 0 ? totalWatts / primaryArea : 0;
  const baselineLpd = parseFloat(String(space.baselineLpd)) || 0;
  const isCompliant = primaryArea > 0 && baselineLpd > 0 ? proposedLpd <= baselineLpd : null;
  const diff = proposedLpd - baselineLpd;
  const savingsPct =
    baselineLpd > 0 && proposedLpd <= baselineLpd
      ? ((baselineLpd - proposedLpd) / baselineLpd) * 100
      : baselineLpd > 0
      ? ((proposedLpd - baselineLpd) / baselineLpd) * 100
      : 0;

  const fixtureSummary =
    fixtures.length > 0
      ? fixtures
          .map(
            (f, i) =>
              `${f.type || `Fixture #${i + 1}`} (${f.watts || 0}W × ${f.qty || 1} = ${(parseFloat(String(f.watts)) || 0) * (parseFloat(String(f.qty)) || 1)}W)`
          )
          .join(", ")
      : "No fixtures assigned";

  return {
    title: "Lighting Power Density (LPD) Calculation",
    itemName: space.name || "Untitled Space",
    itemCode: space.areaType || "General Space",
    standardReference: "ASHRAE 90.1 / IECC Building Energy Code",
    inputs: [
      { label: "Floor Group", value: groupName || "Default Floor" },
      { label: "Space Name", value: space.name || "Untitled Space" },
      { label: "Area Category / Type", value: space.areaType || "Unassigned" },
      { label: `Primary Area (${primaryUnit})`, value: primaryArea.toFixed(2), unit: primaryUnit },
      { label: `Secondary Area (${secondaryUnit})`, value: secondaryArea.toFixed(2), unit: secondaryUnit },
      { label: "Total Luminaires / Fixtures", value: `${fixtures.length} type(s)` },
      { label: "Fixtures Schedule", value: fixtureSummary },
      { label: `Baseline Code Limit (${lpdUnit})`, value: baselineLpd > 0 ? baselineLpd.toFixed(3) : "Not set", unit: lpdUnit },
    ],
    steps: [
      {
        stepNumber: 1,
        label: "Total Connected Lighting Load (W_total)",
        formula: "W_total = Σ (Watts_i × Qty_i)",
        substitution:
          fixtures.length > 0
            ? fixtures
                .map((f) => `(${parseFloat(String(f.watts)) || 0}W × ${parseFloat(String(f.qty)) || 1})`)
                .join(" + ") + ` = ${totalWatts} W`
            : "0 W",
        result: `${totalWatts.toLocaleString()} W (${(totalWatts / 1000).toFixed(3)} kW)`,
        unit: "W",
        status: "info",
        description: `Total connected electrical power drawn by all installed luminaires in ${space.name || "this space"}.`,
      },
      {
        stepNumber: 2,
        label: `Lit Floor Area (A in ${primaryUnit})`,
        formula: isIp ? "Area_IP = Area_m² × 10.7639" : "Area_SI = Direct Input (m²)",
        substitution:
          primaryArea > 0
            ? `${primaryArea.toFixed(2)} ${primaryUnit} (${secondaryArea.toFixed(2)} ${secondaryUnit})`
            : "0.00",
        result: primaryArea > 0 ? `${primaryArea.toFixed(2)} ${primaryUnit}` : "Missing Area",
        unit: primaryUnit,
        status: primaryArea > 0 ? "pass" : "warning",
        description:
          primaryArea > 0
            ? `Net lit floor area used for the density calculation: ${primaryArea.toFixed(2)} ${primaryUnit}.`
            : "Floor area is required to calculate the proposed Lighting Power Density.",
      },
      {
        stepNumber: 3,
        label: "Proposed Lighting Power Density (LPD_proposed)",
        formula: "LPD_proposed = W_total / Area",
        substitution:
          primaryArea > 0
            ? `${totalWatts} W / ${primaryArea.toFixed(2)} ${primaryUnit}`
            : `${totalWatts} W / 0 ${primaryUnit}`,
        result: proposedLpd.toFixed(3),
        unit: lpdUnit,
        status: isCompliant === true ? "pass" : isCompliant === false ? "warning" : "info",
        description: `Calculated design lighting power density: ${proposedLpd.toFixed(3)} ${lpdUnit}.`,
      },
      {
        stepNumber: 4,
        label: "Code Baseline LPD Limit (LPD_baseline)",
        formula: `ASHRAE 90.1 / Building Energy Code Limit for "${space.areaType || "General Area"}"`,
        substitution: `Baseline maximum allowable density = ${baselineLpd.toFixed(3)} ${lpdUnit}`,
        result: baselineLpd > 0 ? baselineLpd.toFixed(3) : "No Baseline",
        unit: lpdUnit,
        status: "info",
        description: "Energy conservation code maximum allowable lighting power density.",
      },
      {
        stepNumber: 5,
        label: "Compliance & Energy Savings Analysis",
        formula: "Margin = LPD_baseline - LPD_proposed",
        substitution:
          baselineLpd > 0 && primaryArea > 0
            ? `${baselineLpd.toFixed(3)} - ${proposedLpd.toFixed(3)} = ${(baselineLpd - proposedLpd).toFixed(3)} ${lpdUnit}`
            : "Baseline or Area missing",
        result:
          primaryArea === 0
            ? "Pending Area"
            : baselineLpd === 0
            ? "No Baseline Set"
            : isCompliant
            ? `PASS (${savingsPct.toFixed(1)}% savings below code)`
            : `EXCEEDS CODE (+${diff.toFixed(2)} ${lpdUnit})`,
        unit: lpdUnit,
        status: isCompliant === true ? "pass" : isCompliant === false ? "warning" : "info",
        description:
          primaryArea === 0
            ? "Enter space floor area to determine compliance."
            : isCompliant === true
            ? `Space meets the energy conservation code with a ${savingsPct.toFixed(1)}% safety margin.`
            : isCompliant === false
            ? `Space exceeds baseline allowance by +${diff.toFixed(2)} ${lpdUnit} (+${savingsPct.toFixed(1)}% over limit). Consider high-efficiency LED luminaires or dimming controls.`
            : "Baseline code limit is not specified for this space.",
      },
    ],
    finalResultLabel: "Proposed LPD",
    finalResultValue: proposedLpd.toFixed(3),
    finalResultUnit: lpdUnit,
    complianceNote:
      primaryArea === 0
        ? "Floor area is required to evaluate compliance."
        : isCompliant === true
        ? `COMPLIANT: Design LPD (${proposedLpd.toFixed(3)} ${lpdUnit}) is well within the code limit (${baselineLpd.toFixed(3)} ${lpdUnit}).`
        : isCompliant === false
        ? `NON-COMPLIANT: Design LPD (${proposedLpd.toFixed(3)} ${lpdUnit}) exceeds code limit (${baselineLpd.toFixed(3)} ${lpdUnit}) by +${diff.toFixed(2)} ${lpdUnit}.`
        : `Design LPD: ${proposedLpd.toFixed(3)} ${lpdUnit}. Baseline limit not set.`,
  };
};

export interface BimSpaceForLpd {
  id: string;
  name: string;
  level?: string;
  zone?: string;
  category?: string;
  area: number;
  height?: number;
  fixtures?: string;
  lightFixtureCount?: number;
  lightFixtureType?: string;
  isExternal?: boolean;
}

/**
 * Determines whether a BIM space is an external / outdoor area
 */
export function isBimSpaceExternal(s: BimSpaceForLpd): boolean {
  if (s.isExternal === true) return true;
  const text = `${s.name || ""} ${s.category || ""} ${s.zone || ""}`.toLowerCase();
  return /garden|landscape|patio|courtyard|terrace|balcony|deck|parking|outdoor|exterior|canopy|porch|plaza|walkway|facade|driveway|pergola/i.test(text);
}

export interface BimLpdGroupsSplit {
  internalGroups: LpdGroup[];
  externalGroups: LpdGroup[];
  internalSpacesCount: number;
  externalSpacesCount: number;
}

export function convertBimSpacesToLpdGroups(
  spaces: BimSpaceForLpd[],
  options?: { isExternal?: boolean }
): LpdGroup[] {
  if (!spaces || spaces.length === 0) return [];

  // 1. Group spaces by floor / level
  const floorMap = new Map<string, BimSpaceForLpd[]>();
  for (const s of spaces) {
    const rawFloor = s.level?.trim() || "GROUND FLOOR";
    let floorKey = rawFloor.toUpperCase();
    if (options?.isExternal && !/EXTERIOR|EXTERNAL|OUTDOOR|GROUNDS|LANDSCAPE/i.test(floorKey)) {
      floorKey = `${floorKey} (EXTERIOR)`;
    }
    if (!floorMap.has(floorKey)) {
      floorMap.set(floorKey, []);
    }
    floorMap.get(floorKey)!.push(s);
  }

  // Sort floors floor-wise (Basement -> Ground -> 1st -> 2nd -> Roof -> Exterior)
  const sortedFloorNames = Array.from(floorMap.keys()).sort((a, b) => {
    const rankA = getFloorRank(a);
    const rankB = getFloorRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });

  const groups: LpdGroup[] = [];

  sortedFloorNames.forEach((floorName) => {
    const floorSpaces = floorMap.get(floorName) || [];
    // Filter out architectural micro-slivers (< 1.0 m² / ~10.7 sq.ft) which are Revit Area Separation Line boundary artifacts
    const validSpaces = floorSpaces.filter((s) => (s.area || 0) >= 1.0);
    const targetSpaces = validSpaces.length > 0 ? validSpaces : floorSpaces;

    // Sort spaces alphabetically by name within this floor (as shown in standard BIM schedule)
    targetSpaces.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" }));

    const lpdSpaces: LpdSpace[] = targetSpaces.map((s, idx) => {
      const nameLower = s.name.toLowerCase();
      const catLower = (s.category || "").toLowerCase();
      const text = `${nameLower} ${catLower}`;
      const isExt = options?.isExternal || isBimSpaceExternal(s);

      let areaType = "Office >150 and 300 ft2 (Space Method)";
      let fixtureType = "LED Panel 600x600";
      let watts = "36";
      let qty = "4";

      if (isExt) {
        // Exterior space typing & ASHRAE 90.1 baselines
        if (/garden|landscape/i.test(text)) {
          areaType = "Garden / Landscape (Exterior)";
          fixtureType = "LED Garden Bollard / Spike 15W";
          watts = "15";
          qty = Math.max(2, Math.round(s.area / 35)).toString();
        } else if (/walkway|plaza|pathway|sidewalk/i.test(text)) {
          areaType = "Walkway / Plaza (Exterior)";
          fixtureType = "LED Post-Top / Path Light 25W";
          watts = "25";
          qty = Math.max(2, Math.round(s.area / 25)).toString();
        } else if (/parking|driveway/i.test(text)) {
          areaType = "Parking Lot / Driveway (Exterior)";
          fixtureType = "LED Pole Mount Luminaire 60W";
          watts = "60";
          qty = Math.max(1, Math.round(s.area / 50)).toString();
        } else if (/balcony|terrace|patio|deck|veranda|porch/i.test(text)) {
          areaType = "Balcony / Terrace (Exterior)";
          fixtureType = "LED Wall Pack / Downlight 18W";
          watts = "18";
          qty = Math.max(1, Math.round(s.area / 15)).toString();
        } else if (/canopy|facade/i.test(text)) {
          areaType = "Building Façade / Canopy (Exterior)";
          fixtureType = "LED Canopy Luminaire 30W";
          watts = "30";
          qty = Math.max(1, Math.round(s.area / 20)).toString();
        } else {
          areaType = "Exterior/Landscape Area";
          fixtureType = "LED Exterior Luminaire 20W";
          watts = "20";
          qty = Math.max(2, Math.round(s.area / 30)).toString();
        }
      } else if (/corridor|circulation|passage|hallway/i.test(text)) {
        areaType = "Corridor (Space Method)";
        fixtureType = "LED Downlight 12W";
        watts = "12";
        qty = Math.max(1, Math.round(s.area / 6)).toString();
      } else if (/conference|meeting|boardroom/i.test(text)) {
        areaType = "Conference/Meeting/Multipurpose Rooms (Space Method)";
        fixtureType = "LED Downlight 18W";
        watts = "18";
        qty = Math.max(2, Math.round(s.area / 4.5)).toString();
      } else if (/bathroom|toilet|restroom|washroom|wc|bath/i.test(text)) {
        areaType = "Restroom (Space Method)";
        fixtureType = "LED Downlight 15W";
        watts = "15";
        qty = Math.max(1, Math.round(s.area / 5)).toString();
      } else if (/electrical|plant|ahu|pump|transformer|switch/i.test(text)) {
        areaType = "Electrical/Mechanical Room (Space Method)";
        fixtureType = "Linear LED Batten 40W";
        watts = "40";
        qty = Math.max(1, Math.round(s.area / 8)).toString();
      } else if (/storage|store|warehouse/i.test(text)) {
        areaType = "Storage Room - 50 ft2 (Space Method)";
        fixtureType = "Linear LED Batten 28W";
        watts = "28";
        qty = Math.max(1, Math.round(s.area / 10)).toString();
      } else if (/stair|staircase|stairwell/i.test(text)) {
        areaType = "Stairwell (Space Method)";
        fixtureType = "LED Bulkhead 16W";
        watts = "16";
        qty = "2";
      } else if (/lobby|reception|foyer/i.test(text)) {
        areaType = "Lobby - Elevator (Space Method)";
        fixtureType = "Architectural LED Linear 30W";
        watts = "30";
        qty = Math.max(2, Math.round(s.area / 6)).toString();
      } else if (/dining|canteen|cafeteria/i.test(text)) {
        areaType = "All other dining areas (Space Method)";
        fixtureType = "LED Panel 600x600 36W";
        watts = "36";
        qty = Math.max(2, Math.round(s.area / 7)).toString();
      } else if (/class|lecture|training/i.test(text)) {
        areaType = "All other classrooms/lecture halls/training rooms (Space Method)";
        fixtureType = "LED Panel 600x600 36W";
        watts = "36";
        qty = Math.max(2, Math.round(s.area / 5)).toString();
      } else {
        // General Office sizing
        if (s.area <= 14) {
          areaType = "Office - Office 150 ft2 (Space Method)";
          fixtureType = "LED Panel 600x600 36W";
          watts = "36";
          qty = Math.max(1, Math.round(s.area / 6)).toString();
        } else if (s.area <= 28) {
          areaType = "Office >150 and 300 ft2 (Space Method)";
          fixtureType = "LED Panel 600x600 36W";
          watts = "36";
          qty = Math.max(2, Math.round(s.area / 6)).toString();
        } else {
          areaType = "Offices >300 ft2 (Space Method)";
          fixtureType = "LED Panel 600x600 36W";
          watts = "36";
          qty = Math.max(4, Math.round(s.area / 6)).toString();
        }
      }

      // Check if 3D model had actual light fixtures placed
      if (s.lightFixtureCount && s.lightFixtureCount > 0) {
        qty = s.lightFixtureCount.toString();
        if (s.lightFixtureType) {
          fixtureType = s.lightFixtureType;
        }
      }

      const baselineVal = DEFAULT_AUTHORITY_MAPPING_SQM[areaType] || (isExt ? 0.54 : 7.1);

      return {
        id: `lpd-sp-${Date.now()}-${idx}`,
        name: s.name,
        areaType,
        areaSqM: s.area > 0 ? s.area.toFixed(2) : "25.00",
        baselineLpd: baselineVal.toFixed(2),
        remarks: "",
        flagged: false,
        fixtures: [
          {
            id: `fix-${Date.now()}-${idx}`,
            type: fixtureType,
            watts,
            qty,
          },
        ],
      };
    });

    groups.push({
      id: `lpd-grp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: floorName,
      isExpanded: true,
      spaces: lpdSpaces,
    });
  });

  return groups;
}

/**
 * Splits BIM spaces into Internal and External groups according to building envelope logic
 */
export function convertBimSpacesToLpdGroupsSplit(spaces: BimSpaceForLpd[]): BimLpdGroupsSplit {
  const internalSpaces: BimSpaceForLpd[] = [];
  const externalSpaces: BimSpaceForLpd[] = [];

  for (const s of spaces) {
    if (isBimSpaceExternal(s)) {
      externalSpaces.push(s);
    } else {
      internalSpaces.push(s);
    }
  }

  const internalGroups = convertBimSpacesToLpdGroups(internalSpaces, { isExternal: false });
  const externalGroups = convertBimSpacesToLpdGroups(externalSpaces, { isExternal: true });

  const internalSpacesCount = internalGroups.reduce((acc, g) => acc + (g.spaces?.length || 0), 0);
  const externalSpacesCount = externalGroups.reduce((acc, g) => acc + (g.spaces?.length || 0), 0);

  return {
    internalGroups,
    externalGroups,
    internalSpacesCount,
    externalSpacesCount,
  };
}