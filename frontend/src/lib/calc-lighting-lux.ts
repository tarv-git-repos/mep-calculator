import { type CalculationPreviewData, type CalculationStep } from "@/components/calculator-framework/CalculationPreviewModal";

export interface LuxRow {
  id: string;
  location: string;
  lightType: string;
  ipRating: string;
  length: number;
  width: number;
  height: number;
  roomIndex: number;
  area: number;
  reqLux: number;
  lumen: number;
  mf: number;
  uf: number;
  reqQty: number;
  remarks: string;
  flagged?: boolean;
  comments?: any[];
  installedQty?: number;
  achievedLux?: number;
  source?: "bim" | "manual" | "excel";
  level?: string;
}

export interface LuxPreset {
  category: string;
  spaceType: string;
  standardLux: number;
  typicalLightType: string;
  ipRating: string;
  defaultMf: number;
  defaultUf: number;
  remarks: string;
}

export const CIBSE_LUX_PRESETS: LuxPreset[] = [
  { category: "Offices", spaceType: "General Office / Open Workspace", standardLux: 500, typicalLightType: "LED Panel 600x600", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.65, remarks: "CIBSE LG7 / EN 12464-1 standard" },
  { category: "Offices", spaceType: "Executive / Manager Office", standardLux: 500, typicalLightType: "LED Panel 600x600", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.6, remarks: "Task lighting recommended" },
  { category: "Offices", spaceType: "Conference / Meeting Room", standardLux: 500, typicalLightType: "LED Downlight 20W", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.55, remarks: "Dimmable controls suggested" },
  { category: "Offices", spaceType: "Drawing / CAD / Technical Office", standardLux: 750, typicalLightType: "High CRI LED Panel", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.65, remarks: "High visual accuracy required" },
  { category: "Circulation", spaceType: "Corridors & Passageways", standardLux: 150, typicalLightType: "LED Downlight 12W", ipRating: "IP20", defaultMf: 0.75, defaultUf: 0.5, remarks: "Emergency lighting route" },
  { category: "Circulation", spaceType: "Stairways & Escalators", standardLux: 150, typicalLightType: "Linear LED Surface", ipRating: "IP44", defaultMf: 0.75, defaultUf: 0.5, remarks: "Uniform step illumination" },
  { category: "Circulation", spaceType: "Entrance Hall / Reception", standardLux: 300, typicalLightType: "Architectural LED Linear", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.6, remarks: "Feature lighting" },
  { category: "Services & Support", spaceType: "Pantry & Breakroom", standardLux: 300, typicalLightType: "LED Panel 300x1200", ipRating: "IP44", defaultMf: 0.75, defaultUf: 0.6, remarks: "Moisture resistant fitting" },
  { category: "Services & Support", spaceType: "Toilets & Restrooms", standardLux: 200, typicalLightType: "IP65 Waterproof LED", ipRating: "IP65", defaultMf: 0.75, defaultUf: 0.55, remarks: "Vapor & splash proof" },
  { category: "Services & Support", spaceType: "Server / IT Equipment Room", standardLux: 500, typicalLightType: "Linear LED Batten", ipRating: "IP20", defaultMf: 0.8, defaultUf: 0.65, remarks: "High illumination for maintenance" },
  { category: "Services & Support", spaceType: "Electrical / Mechanical Plant Room", standardLux: 200, typicalLightType: "IP65 LED Batten", ipRating: "IP65", defaultMf: 0.75, defaultUf: 0.55, remarks: "Industrial heavy duty" },
  { category: "Storage & Industrial", spaceType: "General Storage / Archive", standardLux: 100, typicalLightType: "LED Batten 40W", ipRating: "IP20", defaultMf: 0.75, defaultUf: 0.5, remarks: "Low occupancy space" },
  { category: "Storage & Industrial", spaceType: "Warehouse / Highbay Racking", standardLux: 300, typicalLightType: "LED Highbay 150W", ipRating: "IP65", defaultMf: 0.75, defaultUf: 0.65, remarks: "High ceiling mounting" }
];

/**
 * Utilization Factor (UF) based on Room Index (RI) standard CIBSE curve:
 * - RI <= 1.0 -> UF = 0.50
 * - 1.0 < RI <= 2.0 -> UF = 0.60
 * - RI > 2.0 -> UF = 0.65
 */
export function calculateUFFromRI(ri: number): number {
  if (ri <= 0) return 0.50;
  if (ri <= 1.0) return 0.50;
  if (ri <= 2.0) return 0.60;
  return 0.65;
}

export interface LightingClassificationResult {
  lightType: string;
  ipRating: string;
  standardLux: number;
  lumen: number;
  defaultMf: number;
  defaultUf: number;
  category: string;
  remarks: string;
}

/**
 * Source 2: AI & CIBSE Standards Lighting Classifier
 * Automatically assigns luminaire specifications and illumination requirements based on room semantics.
 */
export function classifySpaceLighting(
  spaceName: string,
  categoryHint?: string,
  fixtureFamilyHint?: string
): LightingClassificationResult {
  const name = (spaceName || "").toLowerCase().trim();
  const cat = (categoryHint || "").toLowerCase().trim();
  const text = `${name} ${cat}`;

  // 1. Drawing / Technical Office / CAD / Lab / Engineering
  if (/drawing|cad|technical|drafting|design\s*studio|laboratory|cleanroom|eng\b/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "High CRI LED Panel",
      ipRating: "IP20",
      standardLux: 750,
      lumen: 4000,
      defaultMf: 0.80,
      defaultUf: 0.65,
      category: "Offices - Technical",
      remarks: "CIBSE LG7 / EN 12464-1 High visual accuracy"
    };
  }

  // 2. Executive / Manager / Cabin
  if (/executive|manager|director|private\s*office|cabin|head/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "LED Panel 600x600",
      ipRating: "IP20",
      standardLux: 500,
      lumen: 3200,
      defaultMf: 0.80,
      defaultUf: 0.60,
      category: "Offices - Executive",
      remarks: "CIBSE LG7 Standard task illuminance"
    };
  }

  // 3. Conference / Meeting / Boardroom
  if (/conference|meeting|boardroom|seminar|huddle|interview/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "LED Downlight 20W",
      ipRating: "IP20",
      standardLux: 500,
      lumen: 2000,
      defaultMf: 0.80,
      defaultUf: 0.55,
      category: "Meeting & Presentation",
      remarks: "Dimmable presentation controls"
    };
  }

  // 4. Server / Data / IT / Telecom / UPS
  if (/server|data\s*center|it\s*room|telecom|ups|mdf|idf/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "Linear LED Batten",
      ipRating: "IP20",
      standardLux: 500,
      lumen: 3600,
      defaultMf: 0.80,
      defaultUf: 0.65,
      category: "Technical & Server",
      remarks: "High illumination for equipment maintenance"
    };
  }

  // 5. Entrance / Reception / Lobby / Foyer / Waiting
  if (/reception|entrance|foyer|main\s*lobby|waiting|atrium/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "Architectural LED Linear",
      ipRating: "IP20",
      standardLux: 300,
      lumen: 2400,
      defaultMf: 0.80,
      defaultUf: 0.60,
      category: "Circulation & Feature",
      remarks: "Feature entrance lighting"
    };
  }

  // 6. Pantry / Kitchen / Breakroom / Cafeteria / Canteen / Dining
  if (/pantry|kitchen|break|cafeteria|canteen|dining|coffee|tea/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "LED Panel 300x1200",
      ipRating: "IP44",
      standardLux: 300,
      lumen: 2800,
      defaultMf: 0.75,
      defaultUf: 0.60,
      category: "Services & Support",
      remarks: "Moisture resistant IP44 fitting"
    };
  }

  // 7. Toilets / Restroom / Washroom / WC / Powder / Bath / Shower
  if (/toilet|restroom|washroom|wc|bath|shower|powder|lavatory/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "IP65 Waterproof LED",
      ipRating: "IP65",
      standardLux: 200,
      lumen: 1600,
      defaultMf: 0.75,
      defaultUf: 0.55,
      category: "Wet Areas",
      remarks: "Vapor & splash proof IP65"
    };
  }

  // 8. Plant / Mechanical / Electrical / AHU / Pump / Generator / Substation
  if (/plant|mechanical|electrical|ahu|switchgear|pump|substation|boiler|chiller|generator|transformer/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "IP65 LED Batten",
      ipRating: "IP65",
      standardLux: 200,
      lumen: 4000,
      defaultMf: 0.70,
      defaultUf: 0.55,
      category: "Plant & Heavy Services",
      remarks: "Industrial heavy duty IP65"
    };
  }

  // 9. Stairs / Staircase / Stairway / Fire Exit
  if (/stair|steps|fire\s*exit/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "Linear LED Surface",
      ipRating: "IP44",
      standardLux: 150,
      lumen: 1800,
      defaultMf: 0.75,
      defaultUf: 0.50,
      category: "Circulation - Escape",
      remarks: "Uniform step illumination"
    };
  }

  // 10. Corridors / Passageways / Circulation / Lift Lobby / Hallway
  if (/corridor|hallway|passage|circulation|lift\s*lobby|elevator\s*lobby/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "LED Downlight 12W",
      ipRating: "IP20",
      standardLux: 150,
      lumen: 1200,
      defaultMf: 0.75,
      defaultUf: 0.50,
      category: "Circulation - Corridors",
      remarks: "Emergency route illumination"
    };
  }

  // 11. Storage / Archive / Janitor / Store / Utility / Linen
  if (/stor|archive|janitor|utility|linen|locker|closet/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "LED Batten 40W",
      ipRating: "IP20",
      standardLux: 100,
      lumen: 2200,
      defaultMf: 0.75,
      defaultUf: 0.50,
      category: "Storage",
      remarks: "Low occupancy space"
    };
  }

  // 12. Warehouse / Highbay / Logistics / Factory
  if (/warehouse|highbay|logistics|racking|factory|industrial\s*floor/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "LED Highbay 150W",
      ipRating: "IP65",
      standardLux: 300,
      lumen: 15000,
      defaultMf: 0.75,
      defaultUf: 0.65,
      category: "Industrial Highbay",
      remarks: "High ceiling mounting"
    };
  }

  // 13. Parking / Basement / Garage / Driveway
  if (/park|basement|garage|driveway|ramp/i.test(text)) {
    return {
      lightType: fixtureFamilyHint || "Vapour Proof LED Batten",
      ipRating: "IP65",
      standardLux: 100,
      lumen: 3600,
      defaultMf: 0.70,
      defaultUf: 0.50,
      category: "Vehicular Parking",
      remarks: "EN 12464-1 Covered Car Parks"
    };
  }

  // Default Office / Workspace
  return {
    lightType: fixtureFamilyHint || "LED Panel 600x600",
    ipRating: "IP20",
    standardLux: 500,
    lumen: 3200,
    defaultMf: 0.80,
    defaultUf: 0.60,
    category: "General Space",
    remarks: "CIBSE LG7 / EN 12464-1 Standard"
  };
}

/**
 * 1-Click Converter: Transforms a 3D BIM Space into a complete 13-column LuxRow
 * utilizing the 3 distinct sources:
 * 1. 3D IFC Geometry (Location, L, W, H, Area)
 * 2. AI & CIBSE Standards (Light Type, IP, Req. Lux, Lumen, MF, UF)
 * 3. Real-Time Engine (RI, Req. Qty, Achieved Lux, Remarks, Compliance Flag)
 */
export function convertBimSpaceToLuxRow(space: any, index?: number): LuxRow {
  const name = String(space.name || `Space ${index !== undefined ? index + 1 : 1}`).trim();
  const area = parseFloat(String(space.area || 0)) || 0;
  let height = parseFloat(String(space.height || 2.8)) || 2.8;
  if (height > 100) height = height / 1000;

  // Extract or calculate room dimensions Length (L) and Width (W)
  let length = parseFloat(String(space.length || 0)) || 0;
  let width = parseFloat(String(space.width || 0)) || 0;

  if ((length <= 0 || width <= 0) && area > 0) {
    // Architectural space derivation with 1.25 standard aspect ratio
    length = parseFloat(Math.sqrt(area * 1.25).toFixed(2));
    width = parseFloat((area / length).toFixed(2));
  }

  // Source 2: AI & CIBSE Standards Matching
  const classification = classifySpaceLighting(name, space.category, space.lightFixtureType);

  // Source 3: Real-Time Engine (Mounting height Hm above 0.75m desk plane)
  const Hm = height > 0.75 ? height - 0.75 : height;
  let roomIndex = 0;
  if (Hm > 0 && (length + width) > 0) {
    roomIndex = parseFloat(((length * width) / (Hm * (length + width))).toFixed(2));
  }

  const uf = calculateUFFromRI(roomIndex);
  const mf = classification.defaultMf;
  const reqLux = classification.standardLux;
  const lumen = classification.lumen;

  const calcArea = area > 0 ? area : parseFloat((length * width).toFixed(2));
  let reqQty = 0;
  if (lumen > 0 && mf > 0 && uf > 0 && calcArea > 0) {
    reqQty = Math.ceil((reqLux * calcArea) / (lumen * mf * uf));
  }

  const installedQty = space.lightFixtureCount !== undefined ? space.lightFixtureCount : undefined;
  
  let remarks = classification.remarks;
  let flagged = false;

  // 3D Fixture Comparison & Auto-Flagging
  if (installedQty !== undefined && installedQty > 0) {
    const achievedLux = calcArea > 0 ? (installedQty * lumen * mf * uf) / calcArea : 0;
    if (installedQty >= reqQty) {
      remarks = `✅ Compliant (${installedQty} installed vs ${reqQty} req - Achieved: ${Math.round(achievedLux)} lx)`;
      flagged = false;
    } else {
      const deficit = reqQty - installedQty;
      remarks = `⚠️ Under-lit: Deficit of ${deficit} fixtures (${installedQty}/${reqQty} installed - Achieved: ${Math.round(achievedLux)} lx)`;
      flagged = true; // Red flag trigger!
    }
  }

  const row: LuxRow = {
    id: space.id ? `lux_${space.id}` : `lux_${Math.random().toString(36).slice(2, 9)}`,
    location: name,
    lightType: classification.lightType,
    ipRating: classification.ipRating,
    length: length,
    width: width,
    height: parseFloat(height.toFixed(2)),
    roomIndex: roomIndex,
    area: parseFloat(calcArea.toFixed(2)),
    reqLux: reqLux,
    lumen: lumen,
    mf: mf,
    uf: uf,
    reqQty: reqQty,
    remarks: remarks,
    flagged: flagged,
    installedQty: installedQty,
    source: "bim",
    level: space.level || space.storey || "Ground Floor"
  };

  return computeRowOutputs(row);
}

export function getLuxRowValidation(row: LuxRow) {
  const warnings: string[] = [];
  
  if (!row.location || !row.location.trim()) {
    warnings.push("Location name empty");
  }
  if (!row.length || row.length <= 0) {
    warnings.push("Length (L) missing/zero");
  }
  if (!row.width || row.width <= 0) {
    warnings.push("Width (W) missing/zero");
  }
  if (!row.reqLux || row.reqLux <= 0) {
    warnings.push("Req Lux (LL) missing/zero");
  }
  if (!row.lumen || row.lumen <= 0) {
    warnings.push("Lumen output 0");
  }
  if (!row.height || row.height <= 0) {
    warnings.push("Height (H) missing/zero");
  }
  if (!row.mf || row.mf <= 0) {
    warnings.push("MF missing/zero");
  }
  if (!row.uf || row.uf <= 0) {
    warnings.push("UF missing/zero");
  }
  if (row.installedQty !== undefined && row.installedQty < (row.reqQty || 0)) {
    warnings.push(`Under-lit: ${row.installedQty} installed < ${row.reqQty} required`);
  }
  
  const hasWarnings = warnings.length > 0;
  const isExplicitlyUnflagged = row.flagged === false;
  const isExplicitlyFlagged = row.flagged === true;

  // A row is flagged if user explicitly flagged it, or if it has auto warnings and wasn't explicitly unflagged
  const isFlagged = isExplicitlyFlagged || (!isExplicitlyUnflagged && hasWarnings);
  const isAutoFlagged = !isExplicitlyFlagged && hasWarnings && !isExplicitlyUnflagged;

  return { isAutoFlagged, isManuallyFlagged: isExplicitlyFlagged, isFlagged, warnings };
}

export function computeRowOutputs(row: LuxRow): LuxRow {
  const L = row.length || 0;
  const W = row.width || 0;
  const H = row.height || 0;
  
  const area = (L > 0 && W > 0) ? parseFloat((L * W).toFixed(2)) : (row.area || 0);
  
  // Working plane is 0.75m above floor (or full height if H <= 0.75)
  const Hm = H > 0.75 ? H - 0.75 : (H > 0 ? H : 2.05);
  let roomIndex = 0;
  if (Hm > 0 && (L + W) > 0) {
    roomIndex = parseFloat(((L * W) / (Hm * (L + W))).toFixed(2));
  }

  const LL = row.reqLux || 0;
  const lumen = row.lumen || 0;
  const mf = row.mf || 0;
  
  // Dynamic UF from Room Index curve if not set
  let uf = row.uf;
  if (!uf || uf <= 0) {
    uf = calculateUFFromRI(roomIndex);
  }
  
  let reqQty = 0;
  if (lumen > 0 && mf > 0 && uf > 0 && area > 0) {
    reqQty = Math.ceil((LL * area) / (lumen * mf * uf));
  }

  const effectiveQty = (row.installedQty !== undefined && row.installedQty > 0) ? row.installedQty : reqQty;
  const achievedLux = area > 0 ? (effectiveQty * lumen * mf * uf) / area : 0;

  let remarks = row.remarks;
  let flagged = row.flagged;

  if (row.installedQty !== undefined && row.installedQty > 0) {
    if (row.installedQty >= reqQty) {
      if (!remarks || remarks.includes("Deficit") || remarks.includes("Compliant")) {
        remarks = `✅ Compliant (${row.installedQty} installed vs ${reqQty} req - Achieved: ${Math.round(achievedLux)} lx)`;
      }
    } else {
      const deficit = reqQty - row.installedQty;
      if (!remarks || remarks.includes("Deficit") || remarks.includes("Compliant")) {
        remarks = `⚠️ Under-lit: Deficit of ${deficit} fixtures (${row.installedQty}/${reqQty} installed - Achieved: ${Math.round(achievedLux)} lx)`;
      }
      if (row.flagged === undefined) {
        flagged = true;
      }
    }
  }

  return {
    ...row,
    area: area,
    roomIndex: roomIndex,
    uf: parseFloat(uf.toFixed(2)),
    reqQty: reqQty,
    achievedLux: Math.round(achievedLux),
    remarks: remarks,
    flagged: flagged
  };
}

export function getCalculationPreview(row: LuxRow, unitSystem: "si" | "ip"): CalculationPreviewData {
  const L = row.length || 0;
  const W = row.width || 0;
  const H = row.height || 0;
  const Hm = H > 0.75 ? H - 0.75 : (H > 0 ? H : 2.05);
  const area = row.area || (L * W);
  const roomIndex = row.roomIndex || (Hm > 0 && (L + W) > 0 ? parseFloat(((L * W) / (Hm * (L + W))).toFixed(2)) : 0);
  const reqLux = row.reqLux || 0;
  const lumen = row.lumen || 0;
  const mf = row.mf || 0;
  const uf = row.uf || 0;
  const reqQty = row.reqQty || (lumen > 0 && mf > 0 && uf > 0 ? Math.ceil((reqLux * area) / (lumen * mf * uf)) : 0);

  const dimUnit = unitSystem === "ip" ? "ft" : "m";
  const areaUnit = unitSystem === "ip" ? "sq ft" : "m²";
  const luxUnit = unitSystem === "ip" ? "fc" : "Lux";

  const totalRequiredLumen = (mf > 0 && uf > 0) ? (reqLux * area) / (mf * uf) : 0;
  const effectiveQty = (row.installedQty !== undefined && row.installedQty > 0) ? row.installedQty : reqQty;
  const totalInstalledLumen = effectiveQty * lumen;
  const achievedLux = area > 0 ? (totalInstalledLumen * mf * uf) / area : 0;
  const isSatisfied = achievedLux >= reqLux - 0.05 && effectiveQty > 0;

  const has3DFixtures = row.installedQty !== undefined && row.installedQty > 0;
  const isDeficit = has3DFixtures && (row.installedQty! < reqQty);

  const steps: CalculationStep[] = [
    {
      stepNumber: 1,
      label: "Room Surface Area (A)",
      formula: "A = Length (L) × Width (W)",
      substitution: `${L} ${dimUnit} × ${W} ${dimUnit} = ${area.toFixed(2)} ${areaUnit}`,
      result: area.toFixed(2),
      unit: areaUnit,
      status: area > 0 ? "pass" : "warning",
      description: area > 0 ? "Effective working plane surface area (Source: 3D IFC Geometry)." : "Specify non-zero room length and width.",
    },
    {
      stepNumber: 2,
      label: "Room Index (RI / K)",
      formula: "RI = (L × W) / [H_m × (L + W)]",
      substitution: Hm > 0 && (L + W) > 0 ? `(${L} × ${W}) / [${Hm.toFixed(2)} × (${L} + ${W})] = ${roomIndex}` : "Mounting height or dimensions zero",
      result: roomIndex,
      status: roomIndex > 0 ? "pass" : "info",
      description: `Geometric index with H_m = ${Hm.toFixed(2)} ${dimUnit} (0.75 ${dimUnit} desk height offset). Used to derive Utilization Factor UF = ${uf}.`,
    },
    {
      stepNumber: 3,
      label: "Total Luminous Flux Required (Φ_total)",
      formula: "Φ_total = (E_req × A) / (MF × UF)",
      substitution: mf > 0 && uf > 0 ? `(${reqLux} ${luxUnit} × ${area.toFixed(2)} ${areaUnit}) / (${mf} × ${uf}) = ${Math.round(totalRequiredLumen).toLocaleString()} lm` : "MF or UF is zero",
      result: Math.round(totalRequiredLumen).toLocaleString(),
      unit: "Lumens (lm)",
      status: "info",
      description: "Total raw lamp lumens required to maintain target illuminance under depreciation (Source: CIBSE Standards).",
    },
    {
      stepNumber: 4,
      label: "Required Luminaire Quantity (N_req)",
      formula: "N = ⌈ Φ_total / Φ_lamp ⌉",
      substitution: lumen > 0 ? `⌈ ${Math.round(totalRequiredLumen).toLocaleString()} / ${lumen} lm ⌉ = ${reqQty}` : "Lumens per fitting missing",
      result: reqQty,
      unit: "Fittings",
      status: reqQty > 0 ? "pass" : "warning",
      description: "Calculated minimum luminaire quantity (rounded up to nearest integer).",
    },
    {
      stepNumber: 5,
      label: has3DFixtures ? "Maintained Illuminance & 3D Audit" : "Maintained Illuminance Achieved (E_achieved)",
      formula: "E_achieved = (N × Φ_lamp × MF × UF) / A",
      substitution: area > 0 ? `(${effectiveQty} × ${lumen} × ${mf} × ${uf}) / ${area.toFixed(2)} = ${achievedLux.toFixed(1)} ${luxUnit}` : "Area is zero",
      result: achievedLux.toFixed(1),
      unit: luxUnit,
      status: isSatisfied && !isDeficit ? "pass" : effectiveQty === 0 ? "info" : "warning",
      description: has3DFixtures
        ? (isDeficit 
            ? `⚠️ UNDER-LIT: Model has ${row.installedQty} fixtures installed vs ${reqQty} required (Deficit: ${reqQty - row.installedQty!} units).`
            : `✅ COMPLIANT: Model has ${row.installedQty} fixtures installed (>= ${reqQty} req). Maintained illuminance: ${achievedLux.toFixed(0)} ${luxUnit}.`)
        : (isSatisfied
            ? `Meets CIBSE target illuminance of ${reqLux} ${luxUnit} (+${(achievedLux - reqLux).toFixed(1)} margin).`
            : `Target illuminance is ${reqLux} ${luxUnit}. Consider increasing luminaire count or lumen package.`),
    }
  ];

  return {
    title: "Lighting LUX Calculation Preview",
    itemName: row.location || `Space ${row.id}`,
    itemCode: `${row.lightType || "Standard Luminaire"} • ${row.ipRating || "IP20"}${has3DFixtures ? ` • ${row.installedQty} 3D Installed` : ""}`,
    standardReference: "CIBSE Code for Lighting / EN 12464-1 / IESNA",
    inputs: [
      { label: "Target Illuminance (LL)", value: reqLux, unit: luxUnit },
      { label: "Room Length (L)", value: L, unit: dimUnit },
      { label: "Room Width (W)", value: W, unit: dimUnit },
      { label: "Ceiling Height (H)", value: H, unit: dimUnit },
      { label: "Fitting Lumen Output", value: lumen, unit: "lm" },
      { label: "Maintenance Factor (MF)", value: mf },
      { label: "Utilization Factor (UF)", value: uf },
      { label: "Fitting IP Rating", value: row.ipRating || "IP20" },
      ...(has3DFixtures ? [{ label: "3D Installed Fixtures", value: row.installedQty!, unit: "Units" }] : [])
    ],
    steps,
    finalResultLabel: has3DFixtures ? "Design Status" : "Required Luminaire Quantity",
    finalResultValue: has3DFixtures ? (isDeficit ? `⚠️ ${reqQty - row.installedQty!} Deficit` : `✅ Compliant (${row.installedQty})`) : `${reqQty} Units`,
    finalResultUnit: row.lightType || "Luminaires",
    complianceNote: isDeficit
      ? `DEFICIT DETECTED: 3D model contains ${row.installedQty} fixtures, providing only ${achievedLux.toFixed(0)} ${luxUnit}. Required is ${reqQty} fixtures (${reqLux} ${luxUnit}). Deficit of ${reqQty - row.installedQty!} fixtures.`
      : isSatisfied
      ? `COMPLIANT: Design satisfies the required illuminance of ${reqLux} ${luxUnit} with ${effectiveQty} luminaires yielding an average maintained illuminance of ${achievedLux.toFixed(0)} ${luxUnit}.`
      : `ATTENTION: Specified luminaire layout yields ${achievedLux.toFixed(0)} ${luxUnit}, which is below the target ${reqLux} ${luxUnit}.`
  };
}
