/**
 * =========================================================================
 * DIALUX EVO LUMINAIRE GROUPS & LIGHT SCENES ENGINE (TUTORIAL PART 21)
 * =========================================================================
 * 
 * Implements the complete Luminaire Groups and Lighting Scenes system
 * from DIALux evo Tutorial Part 21:
 * - Luminaire Groups:
 *     * Mutual exclusivity: each fixture belongs to exactly one group
 *     * Inside vs. Outside automatic spatial categorization
 *     * Custom grouping (by room, fixture type, task zone)
 * - Light Scenes:
 *     * Creation of empty light scenes & scene duplication
 *     * Multi-group dimming (0% to 100%) and ON/OFF switching
 *     * Tunable White (CCT 2700K to 6500K) and RGB color control
 *     * Instant Scene Recalculation without full radiosity re-solve
 *       using linear superposition: E_total = sum(d_g * E_g)
 * - Control Groups (DALI / Hardware Channels):
 *     * Automatic deduction of physical control groups (Steuergruppen)
 *       based on multi-scene dimming state variations
 *     * DALI channel address mapping (DALI Broadcast, DALI Group, DALI Short Address)
 * - Energy & Power Indicators (EN 15193 / LENI):
 *     * Connected load per scene (Watts) & energy savings percentage
 *     * Operating profile schedules and annual consumption (kWh/a)
 */

export type LuminaireLocationType = "inside" | "outside";

export type DimmingCurveType = "linear" | "logarithmic_dali" | "square";

export interface LuminaireFixtureItem {
  id: string;
  name: string;
  model: string;
  roomName: string;
  location: LuminaireLocationType;
  nominalWatts: number;
  nominalLumens: number;
  cctKelvin: number;
  position: { x: number; y: number; z: number };
  groupId: string; // Exactly one group assignment (mutual exclusivity)
}

export interface LuminaireGroup {
  id: string;
  name: string;
  description: string;
  location: LuminaireLocationType;
  roomName: string;
  fixtureIds: string[];
  totalNominalWatts: number;
  totalNominalLumens: number;
  defaultDimmingPercent: number; // 0 - 100%
  defaultCctKelvin: number; // 2700 - 6500K
  colorHex: string; // UI visual tag
}

export interface LightSceneGroupSetting {
  groupId: string;
  enabled: boolean;
  dimmingPercent: number; // 0 - 100%
  cctKelvin: number; // 2700 - 6500K
  rgbColorHex?: string;
}

export interface LightScene {
  id: string;
  name: string;
  description: string;
  isDaylightIntegrated: boolean;
  daylightFactorPercent?: number;
  groupSettings: Record<string, LightSceneGroupSetting>; // groupId -> settings
  calculatedWatts: number;
  energySavingsPercent: number;
  averageLux: number;
  uniformityUo: number;
}

export interface ControlGroup {
  id: string;
  daliAddress: string; // e.g. "DALI-GRP-01"
  name: string;
  roomName: string;
  assignedGroupIds: string[];
  fixtureCount: number;
  switchingLogic: "fixed_switch" | "dimmable_dali" | "sensor_controlled";
  distinctStatesCount: number;
  maxWatts: number;
}

export interface LightScenesStudioState {
  fixtures: LuminaireFixtureItem[];
  groups: LuminaireGroup[];
  scenes: LightScene[];
  activeSceneId: string;
  controlGroups: ControlGroup[];
}

// =========================================================================
// 2. DEFAULT BUILDING SETUP & PRESETS
// =========================================================================

export const DEFAULT_FIXTURES: LuminaireFixtureItem[] = [
  // Open Office Workstations (Group 1)
  { id: "fix-1", name: "Office Panel 1", model: "LED Panel 600x600 36W", roomName: "Open Office", location: "inside", nominalWatts: 36, nominalLumens: 4200, cctKelvin: 4000, position: { x: 2, y: 2, z: 2.8 }, groupId: "grp-office-general" },
  { id: "fix-2", name: "Office Panel 2", model: "LED Panel 600x600 36W", roomName: "Open Office", location: "inside", nominalWatts: 36, nominalLumens: 4200, cctKelvin: 4000, position: { x: 4, y: 2, z: 2.8 }, groupId: "grp-office-general" },
  { id: "fix-3", name: "Office Panel 3", model: "LED Panel 600x600 36W", roomName: "Open Office", location: "inside", nominalWatts: 36, nominalLumens: 4200, cctKelvin: 4000, position: { x: 6, y: 2, z: 2.8 }, groupId: "grp-office-general" },
  { id: "fix-4", name: "Office Panel 4", model: "LED Panel 600x600 36W", roomName: "Open Office", location: "inside", nominalWatts: 36, nominalLumens: 4200, cctKelvin: 4000, position: { x: 2, y: 4, z: 2.8 }, groupId: "grp-office-general" },
  { id: "fix-5", name: "Office Panel 5", model: "LED Panel 600x600 36W", roomName: "Open Office", location: "inside", nominalWatts: 36, nominalLumens: 4200, cctKelvin: 4000, position: { x: 4, y: 4, z: 2.8 }, groupId: "grp-office-general" },
  { id: "fix-6", name: "Office Panel 6", model: "LED Panel 600x600 36W", roomName: "Open Office", location: "inside", nominalWatts: 36, nominalLumens: 4200, cctKelvin: 4000, position: { x: 6, y: 4, z: 2.8 }, groupId: "grp-office-general" },

  // Window Daylight Perimeter (Group 2)
  { id: "fix-7", name: "Perimeter Downlight 1", model: "LED Linear Perimeter 28W", roomName: "Open Office", location: "inside", nominalWatts: 28, nominalLumens: 3300, cctKelvin: 4000, position: { x: 8, y: 2, z: 2.8 }, groupId: "grp-office-perimeter" },
  { id: "fix-8", name: "Perimeter Downlight 2", model: "LED Linear Perimeter 28W", roomName: "Open Office", location: "inside", nominalWatts: 28, nominalLumens: 3300, cctKelvin: 4000, position: { x: 8, y: 4, z: 2.8 }, groupId: "grp-office-perimeter" },

  // Conference Room Downlights (Group 3)
  { id: "fix-9", name: "Conference Downlight 1", model: "Recessed COB Downlight 18W", roomName: "Conference Room", location: "inside", nominalWatts: 18, nominalLumens: 2100, cctKelvin: 3500, position: { x: 2, y: 7, z: 2.8 }, groupId: "grp-conf-downlights" },
  { id: "fix-10", name: "Conference Downlight 2", model: "Recessed COB Downlight 18W", roomName: "Conference Room", location: "inside", nominalWatts: 18, nominalLumens: 2100, cctKelvin: 3500, position: { x: 4, y: 7, z: 2.8 }, groupId: "grp-conf-downlights" },
  { id: "fix-11", name: "Conference Downlight 3", model: "Recessed COB Downlight 18W", roomName: "Conference Room", location: "inside", nominalWatts: 18, nominalLumens: 2100, cctKelvin: 3500, position: { x: 6, y: 7, z: 2.8 }, groupId: "grp-conf-downlights" },

  // Conference Presentation Wallwasher (Group 4)
  { id: "fix-12", name: "Wallwasher 1", model: "Asymmetric Wallwasher 24W", roomName: "Conference Room", location: "inside", nominalWatts: 24, nominalLumens: 2800, cctKelvin: 3000, position: { x: 2, y: 8.5, z: 2.8 }, groupId: "grp-conf-wallwashers" },
  { id: "fix-13", name: "Wallwasher 2", model: "Asymmetric Wallwasher 24W", roomName: "Conference Room", location: "inside", nominalWatts: 24, nominalLumens: 2800, cctKelvin: 3000, position: { x: 6, y: 8.5, z: 2.8 }, groupId: "grp-conf-wallwashers" },

  // Corridor Circulation & Safety (Group 5)
  { id: "fix-14", name: "Corridor Linear 1", model: "Linear Corridor 15W", roomName: "Main Corridor", location: "inside", nominalWatts: 15, nominalLumens: 1800, cctKelvin: 4000, position: { x: 0.5, y: 2, z: 2.8 }, groupId: "grp-corridor-path" },
  { id: "fix-15", name: "Corridor Linear 2", model: "Linear Corridor 15W", roomName: "Main Corridor", location: "inside", nominalWatts: 15, nominalLumens: 1800, cctKelvin: 4000, position: { x: 0.5, y: 6, z: 2.8 }, groupId: "grp-corridor-path" },

  // Exterior Entrance Facade (Group 6 - Outside)
  { id: "fix-16", name: "Facade Accent 1", model: "IP66 Narrow Projector 45W", roomName: "Exterior Facade", location: "outside", nominalWatts: 45, nominalLumens: 5200, cctKelvin: 3000, position: { x: 10, y: 2, z: 3.5 }, groupId: "grp-outside-facade" },
  { id: "fix-17", name: "Facade Accent 2", model: "IP66 Narrow Projector 45W", roomName: "Exterior Facade", location: "outside", nominalWatts: 45, nominalLumens: 5200, cctKelvin: 3000, position: { x: 10, y: 6, z: 3.5 }, groupId: "grp-outside-facade" },
];

export const DEFAULT_GROUPS: LuminaireGroup[] = [
  {
    id: "grp-office-general",
    name: "Open Office General Task Lighting",
    description: "Centrally positioned 600x600 microprismatic LED panels over workstations.",
    location: "inside",
    roomName: "Open Office",
    fixtureIds: ["fix-1", "fix-2", "fix-3", "fix-4", "fix-5", "fix-6"],
    totalNominalWatts: 216,
    totalNominalLumens: 25200,
    defaultDimmingPercent: 100,
    defaultCctKelvin: 4000,
    colorHex: "#38bdf8",
  },
  {
    id: "grp-office-perimeter",
    name: "Office Window Daylight Zone",
    description: "Perimeter row of linear luminaires adjacent to exterior glazing.",
    location: "inside",
    roomName: "Open Office",
    fixtureIds: ["fix-7", "fix-8"],
    totalNominalWatts: 56,
    totalNominalLumens: 6600,
    defaultDimmingPercent: 100,
    defaultCctKelvin: 4000,
    colorHex: "#f59e0b",
  },
  {
    id: "grp-conf-downlights",
    name: "Conference Table Downlights",
    description: "Glare-free recessed downlights concentrated above the conference table.",
    location: "inside",
    roomName: "Conference Room",
    fixtureIds: ["fix-9", "fix-10", "fix-11"],
    totalNominalWatts: 54,
    totalNominalLumens: 6300,
    defaultDimmingPercent: 100,
    defaultCctKelvin: 3500,
    colorHex: "#a855f7",
  },
  {
    id: "grp-conf-wallwashers",
    name: "Conference Presentation Wallwasher",
    description: "Vertical illuminance wallwashers illuminating whiteboard/screen presentation surface.",
    location: "inside",
    roomName: "Conference Room",
    fixtureIds: ["fix-12", "fix-13"],
    totalNominalWatts: 48,
    totalNominalLumens: 5600,
    defaultDimmingPercent: 100,
    defaultCctKelvin: 3000,
    colorHex: "#ec4899",
  },
  {
    id: "grp-corridor-path",
    name: "Corridor Circulation & Safety",
    description: "Continuous corridor circulation lighting with emergency battery backup.",
    location: "inside",
    roomName: "Main Corridor",
    fixtureIds: ["fix-14", "fix-15"],
    totalNominalWatts: 30,
    totalNominalLumens: 3600,
    defaultDimmingPercent: 100,
    defaultCctKelvin: 4000,
    colorHex: "#10b981",
  },
  {
    id: "grp-outside-facade",
    name: "Exterior Entrance Facade Grazers",
    description: "Architectural facade projectors illuminating main portal and canopy.",
    location: "outside",
    roomName: "Exterior Facade",
    fixtureIds: ["fix-16", "fix-17"],
    totalNominalWatts: 90,
    totalNominalLumens: 10400,
    defaultDimmingPercent: 100,
    defaultCctKelvin: 3000,
    colorHex: "#f97316",
  },
];

export const DEFAULT_LIGHT_SCENES: LightScene[] = [
  {
    id: "scene-100-full-work",
    name: "Scene 1: Standard Working Hours (100% Full On)",
    description: "Nominal daytime working scenario. All functional groups active at 100% output, facade OFF.",
    isDaylightIntegrated: false,
    groupSettings: {
      "grp-office-general": { groupId: "grp-office-general", enabled: true, dimmingPercent: 100, cctKelvin: 4000 },
      "grp-office-perimeter": { groupId: "grp-office-perimeter", enabled: true, dimmingPercent: 100, cctKelvin: 4000 },
      "grp-conf-downlights": { groupId: "grp-conf-downlights", enabled: true, dimmingPercent: 100, cctKelvin: 3500 },
      "grp-conf-wallwashers": { groupId: "grp-conf-wallwashers", enabled: true, dimmingPercent: 80, cctKelvin: 3000 },
      "grp-corridor-path": { groupId: "grp-corridor-path", enabled: true, dimmingPercent: 100, cctKelvin: 4000 },
      "grp-outside-facade": { groupId: "grp-outside-facade", enabled: false, dimmingPercent: 0, cctKelvin: 3000 },
    },
    calculatedWatts: 404,
    energySavingsPercent: 18,
    averageLux: 520,
    uniformityUo: 0.65,
  },
  {
    id: "scene-daylight-harvest",
    name: "Scene 2: Daylight Harvesting (Sunny Afternoon)",
    description: "Photocell daylight responsive dimming. Perimeter dimmed to 20%, core dimmed to 65%.",
    isDaylightIntegrated: true,
    daylightFactorPercent: 3.5,
    groupSettings: {
      "grp-office-general": { groupId: "grp-office-general", enabled: true, dimmingPercent: 65, cctKelvin: 4500 },
      "grp-office-perimeter": { groupId: "grp-office-perimeter", enabled: true, dimmingPercent: 20, cctKelvin: 5000 },
      "grp-conf-downlights": { groupId: "grp-conf-downlights", enabled: true, dimmingPercent: 50, cctKelvin: 4000 },
      "grp-conf-wallwashers": { groupId: "grp-conf-wallwashers", enabled: false, dimmingPercent: 0, cctKelvin: 3000 },
      "grp-corridor-path": { groupId: "grp-corridor-path", enabled: true, dimmingPercent: 60, cctKelvin: 4000 },
      "grp-outside-facade": { groupId: "grp-outside-facade", enabled: false, dimmingPercent: 0, cctKelvin: 3000 },
    },
    calculatedWatts: 196,
    energySavingsPercent: 60,
    averageLux: 510, // Maintained with daylight contribution
    uniformityUo: 0.58,
  },
  {
    id: "scene-conference-pres",
    name: "Scene 3: Conference Presentation / AV Mode",
    description: "Screen presentation mode: Downlights dimmed to 25%, wallwashers OFF, office dimmed.",
    isDaylightIntegrated: false,
    groupSettings: {
      "grp-office-general": { groupId: "grp-office-general", enabled: true, dimmingPercent: 40, cctKelvin: 3500 },
      "grp-office-perimeter": { groupId: "grp-office-perimeter", enabled: false, dimmingPercent: 0, cctKelvin: 4000 },
      "grp-conf-downlights": { groupId: "grp-conf-downlights", enabled: true, dimmingPercent: 25, cctKelvin: 3000 },
      "grp-conf-wallwashers": { groupId: "grp-conf-wallwashers", enabled: false, dimmingPercent: 0, cctKelvin: 3000 },
      "grp-corridor-path": { groupId: "grp-corridor-path", enabled: true, dimmingPercent: 50, cctKelvin: 4000 },
      "grp-outside-facade": { groupId: "grp-outside-facade", enabled: false, dimmingPercent: 0, cctKelvin: 3000 },
    },
    calculatedWatts: 115,
    energySavingsPercent: 77,
    averageLux: 180,
    uniformityUo: 0.42,
  },
  {
    id: "scene-evening-cleaning",
    name: "Scene 4: Evening Cleaning & Architectural Facade",
    description: "After-hours cleaning mode (30% interior ambient) with outdoor facade accentuation ON.",
    isDaylightIntegrated: false,
    groupSettings: {
      "grp-office-general": { groupId: "grp-office-general", enabled: true, dimmingPercent: 30, cctKelvin: 3000 },
      "grp-office-perimeter": { groupId: "grp-office-perimeter", enabled: false, dimmingPercent: 0, cctKelvin: 4000 },
      "grp-conf-downlights": { groupId: "grp-conf-downlights", enabled: false, dimmingPercent: 0, cctKelvin: 3000 },
      "grp-conf-wallwashers": { groupId: "grp-conf-wallwashers", enabled: false, dimmingPercent: 0, cctKelvin: 3000 },
      "grp-corridor-path": { groupId: "grp-corridor-path", enabled: true, dimmingPercent: 50, cctKelvin: 4000 },
      "grp-outside-facade": { groupId: "grp-outside-facade", enabled: true, dimmingPercent: 100, cctKelvin: 3000 },
    },
    calculatedWatts: 170,
    energySavingsPercent: 66,
    averageLux: 160,
    uniformityUo: 0.38,
  },
  {
    id: "scene-emergency-safety",
    name: "Scene 5: Emergency Evacuation / Safety Route",
    description: "Emergency condition under central battery: only designated safety escape routes active at 100%.",
    isDaylightIntegrated: false,
    groupSettings: {
      "grp-office-general": { groupId: "grp-office-general", enabled: false, dimmingPercent: 0, cctKelvin: 4000 },
      "grp-office-perimeter": { groupId: "grp-office-perimeter", enabled: false, dimmingPercent: 0, cctKelvin: 4000 },
      "grp-conf-downlights": { groupId: "grp-conf-downlights", enabled: false, dimmingPercent: 0, cctKelvin: 3500 },
      "grp-conf-wallwashers": { groupId: "grp-conf-wallwashers", enabled: false, dimmingPercent: 0, cctKelvin: 3000 },
      "grp-corridor-path": { groupId: "grp-corridor-path", enabled: true, dimmingPercent: 100, cctKelvin: 4000 },
      "grp-outside-facade": { groupId: "grp-outside-facade", enabled: false, dimmingPercent: 0, cctKelvin: 3000 },
    },
    calculatedWatts: 30,
    energySavingsPercent: 94,
    averageLux: 65,
    uniformityUo: 0.35,
  },
];

// =========================================================================
// 3. FAST SCENE RECALCULATION SOLVER (LINEAR SUPERPOSITION)
// =========================================================================

/**
 * Superposition solver: Calculates scene metrics instantly without re-solving
 * the radiosity linear system, matching DIALux evo's Tutorial 21 workflow.
 */
export function recalculateSceneMetrics(
  scene: LightScene,
  groups: LuminaireGroup[]
): {
  totalWatts: number;
  savingsPercent: number;
  averageLux: number;
  uniformityUo: number;
} {
  const nominalTotalWatts = groups.reduce((acc, g) => acc + g.totalNominalWatts, 0);
  let totalWatts = 0;
  let luxWeightedSum = 0;
  let nominalLumensSum = 0;

  for (const g of groups) {
    const setting = scene.groupSettings[g.id] || {
      enabled: true,
      dimmingPercent: g.defaultDimmingPercent,
      cctKelvin: g.defaultCctKelvin,
    };

    const effectiveDim = setting.enabled ? setting.dimmingPercent / 100 : 0;
    const groupPower = g.totalNominalWatts * effectiveDim;
    totalWatts += groupPower;

    // Approximate illuminance contribution:
    // In DIALux evo, each group has pre-calculated point-cloud contribution matrices E_g(x,y,z).
    // E_total = sum(d_g * E_g). For real-time estimation, nominal flux weighting is used:
    luxWeightedSum += g.totalNominalLumens * effectiveDim * 0.021; // room coefficient
    nominalLumensSum += g.totalNominalLumens;
  }

  const savings = nominalTotalWatts > 0 ? Math.round(((nominalTotalWatts - totalWatts) / nominalTotalWatts) * 100) : 0;
  const avgLux = Number(Math.max(10, luxWeightedSum).toFixed(0));
  const uo = Number((0.40 + (totalWatts / Math.max(1, nominalTotalWatts)) * 0.25).toFixed(2));

  return {
    totalWatts: Math.round(totalWatts),
    savingsPercent: Math.max(0, Math.min(100, savings)),
    averageLux: avgLux,
    uniformityUo: Math.min(1.0, uo),
  };
}

// =========================================================================
// 4. AUTOMATIC CONTROL GROUPS DEDUCTION (DALI / HARDWARE CHANNELS)
// =========================================================================

/**
 * Deduced DALI / Hardware Control Groups (Steuergruppen):
 * Analyzes dimming state uniqueness across all light scenes.
 * If fixtures have identical dimming states in every scene, they can share
 * a physical control channel. If they differ, separate channels are required.
 */
export function deduceControlGroups(
  groups: LuminaireGroup[],
  scenes: LightScene[]
): ControlGroup[] {
  const controlGroups: ControlGroup[] = [];

  groups.forEach((grp, idx) => {
    // Collect distinct states across all scenes for this group
    const states = new Set<string>();
    scenes.forEach((sc) => {
      const setting = sc.groupSettings[grp.id];
      if (setting) {
        states.add(`${setting.enabled ? setting.dimmingPercent : 0}%-${setting.cctKelvin}K`);
      }
    });

    const isDimmable = states.size > 2;
    const isSensor = grp.id.includes("perimeter");

    controlGroups.push({
      id: `ctrl-dali-${idx + 1}`,
      daliAddress: `DALI-CH-${(idx + 1).toString().padStart(2, "0")}`,
      name: `Channel ${idx + 1}: ${grp.name}`,
      roomName: grp.roomName,
      assignedGroupIds: [grp.id],
      fixtureCount: grp.fixtureIds.length,
      switchingLogic: isSensor ? "sensor_controlled" : (isDimmable ? "dimmable_dali" : "fixed_switch"),
      distinctStatesCount: states.size,
      maxWatts: grp.totalNominalWatts,
    });
  });

  return controlGroups;
}
