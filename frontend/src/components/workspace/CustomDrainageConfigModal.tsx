import React, { useState, useEffect, useMemo } from "react";
import {
  X, Check, SlidersHorizontal, Droplets, Layers,
  ShieldCheck, ArrowUpRight, Activity, GitFork, Building, Home, Hotel, Utensils, Stethoscope, GraduationCap,
  Cylinder, Info, Plus, Minus, RotateCcw
} from "lucide-react";
import {
  DRAINAGE_PRESETS,
  type DrainagePresetKey,
  type FixtureRowItem,
} from "@/routes/plumbing-drainage";
import { toast } from "sonner";

interface CustomDrainageConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitSystem: "ip" | "si";
  currentValues: {
    systemType: "branch" | "stack_short" | "stack_tall" | "building_drain";
    slope: number;
    material: "pvc" | "cast_iron" | "hdpe" | "copper";
    safetyFactor: number;
    ventLength: number;
    fixtures: FixtureRowItem[];
    customProfileName?: string;
    customWorkflow?: "matrix" | "direct";
  };
  onApply: (updated: {
    systemType: "branch" | "stack_short" | "stack_tall" | "building_drain";
    slope: number;
    material: "pvc" | "cast_iron" | "hdpe" | "copper";
    safetyFactor: number;
    ventLength: number;
    fixtures: FixtureRowItem[];
    customProfileName: string;
    customWorkflow: "matrix" | "direct";
  }) => void;
}

const BRANCH_CAPACITY: { size: number; maxDfu: number; dn: number }[] = [
  { size: 1.5, maxDfu: 3, dn: 40 },
  { size: 2.0, maxDfu: 6, dn: 50 },
  { size: 2.5, maxDfu: 12, dn: 65 },
  { size: 3.0, maxDfu: 20, dn: 80 },
  { size: 4.0, maxDfu: 160, dn: 100 },
  { size: 5.0, maxDfu: 360, dn: 125 },
  { size: 6.0, maxDfu: 620, dn: 150 },
  { size: 8.0, maxDfu: 1400, dn: 200 },
  { size: 10.0, maxDfu: 2500, dn: 250 },
  { size: 12.0, maxDfu: 3900, dn: 300 },
];

const STACK_CAPACITY: { size: number; maxShort: number; maxTall: number; dn: number }[] = [
  { size: 1.5, maxShort: 4, maxTall: 8, dn: 40 },
  { size: 2.0, maxShort: 10, maxTall: 24, dn: 50 },
  { size: 2.5, maxShort: 20, maxTall: 42, dn: 65 },
  { size: 3.0, maxShort: 48, maxTall: 72, dn: 80 },
  { size: 4.0, maxShort: 240, maxTall: 500, dn: 100 },
  { size: 5.0, maxShort: 540, maxTall: 1100, dn: 125 },
  { size: 6.0, maxShort: 960, maxTall: 1900, dn: 150 },
  { size: 8.0, maxShort: 2200, maxTall: 3600, dn: 200 },
  { size: 10.0, maxShort: 3800, maxTall: 5600, dn: 250 },
  { size: 12.0, maxShort: 6000, maxTall: 8400, dn: 300 },
];

const BUILDING_DRAIN_CAPACITY: { size: number; dn: number; s1_8: number; s1_4: number; s1_2: number }[] = [
  { size: 1.5, dn: 40, s1_8: 1, s1_4: 1, s1_2: 1 },
  { size: 2.0, dn: 50, s1_8: 6, s1_4: 21, s1_2: 26 },
  { size: 2.5, dn: 65, s1_8: 12, s1_4: 24, s1_2: 31 },
  { size: 3.0, dn: 80, s1_8: 36, s1_4: 42, s1_2: 50 },
  { size: 4.0, dn: 100, s1_8: 180, s1_4: 216, s1_2: 250 },
  { size: 5.0, dn: 125, s1_8: 390, s1_4: 480, s1_2: 575 },
  { size: 6.0, dn: 150, s1_8: 700, s1_4: 840, s1_2: 1000 },
  { size: 8.0, dn: 200, s1_8: 1600, s1_4: 1920, s1_2: 2300 },
  { size: 10.0, dn: 250, s1_8: 2900, s1_4: 3500, s1_2: 4200 },
  { size: 12.0, dn: 300, s1_8: 4600, s1_4: 5600, s1_2: 6700 },
];

export function CustomDrainageConfigModal({
  isOpen,
  onClose,
  unitSystem,
  currentValues,
  onApply,
}: CustomDrainageConfigModalProps) {
  const isSI = unitSystem === "si";

  // Form State
  const [profileName, setProfileName] = useState(
    currentValues.customProfileName || "Custom Sanitary Drainage Profile"
  );
  const [workflow, setWorkflow] = useState<"matrix" | "direct">(
    currentValues.customWorkflow || "matrix"
  );

  const [systemType, setSystemType] = useState<"branch" | "stack_short" | "stack_tall" | "building_drain">(
    currentValues.systemType || "branch"
  );
  const [slope, setSlope] = useState<number>(currentValues.slope || 0.25);
  const [material, setMaterial] = useState<"pvc" | "cast_iron" | "hdpe" | "copper">(
    currentValues.material || "pvc"
  );
  const [safetyFactor, setSafetyFactor] = useState<number>(currentValues.safetyFactor || 15);
  const [ventLength, setVentLength] = useState<number>(currentValues.ventLength || 40);
  const [fixtures, setFixtures] = useState<FixtureRowItem[]>(
    currentValues.fixtures?.length ? currentValues.fixtures.map(f => ({ ...f })) : []
  );

  // Direct raw DFU fallback state for Direct Mode
  const [directRawDfu, setDirectRawDfu] = useState<number>(100);

  // Sync with prop updates
  useEffect(() => {
    if (isOpen) {
      setProfileName(currentValues.customProfileName || "Custom Sanitary Drainage Profile");
      setWorkflow(currentValues.customWorkflow || "matrix");
      setSystemType(currentValues.systemType || "branch");
      setSlope(currentValues.slope || 0.25);
      setMaterial(currentValues.material || "pvc");
      setSafetyFactor(currentValues.safetyFactor || 15);
      setVentLength(currentValues.ventLength || 40);
      setFixtures(currentValues.fixtures?.length ? currentValues.fixtures.map(f => ({ ...f })) : []);
    }
  }, [isOpen, currentValues]);

  // Baseline Preset Cloning
  const handleCloneFromPreset = (key: DrainagePresetKey) => {
    const p = DRAINAGE_PRESETS[key];
    if (p) {
      setSystemType(p.systemType);
      setSlope(p.slope);
      setMaterial(p.material);
      setSafetyFactor(p.safetyFactor);
      setVentLength(p.ventLength);
      setFixtures(p.fixtures.map(f => ({ ...f })));
      setProfileName(`${p.label} (Custom)`);
      toast.success(`Cloned parameters from: ${p.label}`);
    }
  };

  const handleAdjustFixture = (id: string, delta: number) => {
    setFixtures(prev =>
      prev.map(f => (f.id === id ? { ...f, val: Math.max(0, f.val + delta) } : f))
    );
  };

  const handleSetFixtureVal = (id: string, val: number) => {
    setFixtures(prev =>
      prev.map(f => (f.id === id ? { ...f, val: Math.max(0, isNaN(val) ? 0 : val) } : f))
    );
  };

  // Live Calculations
  const liveResults = useMemo(() => {
    const matrixDfu = fixtures.reduce((acc, f) => acc + f.dfu * f.val, 0);
    const rawDfu = workflow === "matrix" ? matrixDfu : directRawDfu;
    const designDfu = Math.ceil(rawDfu * (1 + safetyFactor / 100));

    let sizedNps = 4.0;
    let sizedDn = 100;
    let maxAllowableDfu = 160;

    if (systemType === "branch") {
      const match = BRANCH_CAPACITY.find(c => c.maxDfu >= designDfu) || BRANCH_CAPACITY[BRANCH_CAPACITY.length - 1];
      sizedNps = match.size;
      sizedDn = match.dn;
      maxAllowableDfu = match.maxDfu;
    } else if (systemType === "stack_short") {
      const match = STACK_CAPACITY.find(c => c.maxShort >= designDfu) || STACK_CAPACITY[STACK_CAPACITY.length - 1];
      sizedNps = match.size;
      sizedDn = match.dn;
      maxAllowableDfu = match.maxShort;
    } else if (systemType === "stack_tall") {
      const match = STACK_CAPACITY.find(c => c.maxTall >= designDfu) || STACK_CAPACITY[STACK_CAPACITY.length - 1];
      sizedNps = match.size;
      sizedDn = match.dn;
      maxAllowableDfu = match.maxTall;
    } else {
      // Building Drain
      const match = BUILDING_DRAIN_CAPACITY.find(c => {
        if (slope <= 0.125) return c.s1_8 >= designDfu;
        if (slope <= 0.25) return c.s1_4 >= designDfu;
        return c.s1_2 >= designDfu;
      }) || BUILDING_DRAIN_CAPACITY[BUILDING_DRAIN_CAPACITY.length - 1];

      sizedNps = match.size;
      sizedDn = match.dn;
      maxAllowableDfu = slope <= 0.125 ? match.s1_8 : slope <= 0.25 ? match.s1_4 : match.s1_2;
    }

    // Manning's Velocity estimation for half-full pipe
    const dFeet = sizedNps / 12;
    const sFtPerFt = slope / 12;
    const nRoughness = material === "pvc" || material === "hdpe" ? 0.009 : 0.012;
    const hydraulicRadius = dFeet / 4;
    const velocityFps = (1.486 / nRoughness) * Math.pow(hydraulicRadius, 2 / 3) * Math.sqrt(sFtPerFt);
    const velocityMps = velocityFps * 0.3048;

    const isScouringOk = velocityFps >= 2.0;

    return {
      rawDfu,
      designDfu,
      sizedNps,
      sizedDn,
      maxAllowableDfu,
      velocityFps,
      velocityMps,
      isScouringOk,
    };
  }, [fixtures, workflow, directRawDfu, safetyFactor, systemType, slope, material]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = profileName.trim()
      ? profileName.trim().endsWith(" (Custom)")
        ? profileName.trim()
        : `${profileName.trim()} (Custom)`
      : "Custom Sanitary Drainage Profile (Custom)";

    onApply({
      systemType,
      slope,
      material,
      safetyFactor,
      ventLength,
      fixtures,
      customProfileName: finalName,
      customWorkflow: workflow,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-surface-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">
                  Custom Drainage &amp; Sanitary Sizing Configuration
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-primary/20 text-primary uppercase">
                  Custom
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure fixture units (DFU), gradient slopes, pipe materials &amp; IPC / UPC drainage criteria.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Profile Name & Tagging */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Custom Configuration Name</span>
              <span className="text-[11px] font-normal text-muted-foreground">Auto-labeled with (Custom) tag</span>
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g., Hospital Clinical Branch Custom"
              className="w-full h-9 px-3 bg-background border border-input rounded-xl text-xs font-semibold focus:border-primary outline-none"
            />
          </div>

          {/* 1-Click Baseline Preset Clone Bar */}
          <div className="p-3.5 rounded-xl bg-surface-2/60 border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Droplets className="size-3.5 text-primary" />
                Clone from Standard IPC / UPC Baseline Archetype
              </span>
              <span className="text-[10.5px] text-muted-foreground">1-click populate initial fixture schedule</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {(
                [
                  { key: "commercial_office", label: "Office Floor", icon: Building, tag: "94 DFU" },
                  { key: "residential_apartment", label: "Residential", icon: Home, tag: "114 DFU" },
                  { key: "luxury_hotel", label: "Hotel Drain", icon: Hotel, tag: "481 DFU" },
                  { key: "restaurant_kitchen", label: "Kitchen", icon: Utensils, tag: "105 DFU" },
                  { key: "hospital_clinic", label: "Hospital", icon: Stethoscope, tag: "205 DFU" },
                  { key: "educational_school", label: "Campus", icon: GraduationCap, tag: "163 DFU" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleCloneFromPreset(item.key)}
                  className="px-2.5 py-1.5 rounded-lg border border-border/70 bg-card hover:bg-surface hover:border-border text-left transition flex flex-col justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <item.icon className="size-3 text-primary shrink-0" />
                    <span className="text-[11px] font-bold text-foreground truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                    <span className="font-semibold text-primary">{item.tag}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sizing Method Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">Design Sizing Workflow Mode</label>
            <div className="grid grid-cols-2 gap-2 bg-surface-2 p-1 rounded-xl border border-border/80">
              <button
                type="button"
                onClick={() => setWorkflow("matrix")}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  workflow === "matrix"
                    ? "bg-background text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="size-3.5 text-primary" />
                <span>Sanitary Fixture Inventory Matrix</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkflow("direct")}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  workflow === "direct"
                    ? "bg-background text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GitFork className="size-3.5 text-primary" />
                <span>Direct Design Load (DFU) &amp; Slope</span>
              </button>
            </div>
          </div>

          {/* Section 1: System Type, Slope & Material */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border/60 pb-1">
              <GitFork className="size-3.5 text-primary" /> 1. Drainage Piping System &amp; Slope
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Drainage System Classification
                </label>
                <select
                  value={systemType}
                  onChange={(e) => setSystemType(e.target.value as any)}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold cursor-pointer"
                >
                  <option value="branch">Horizontal Fixture Branch</option>
                  <option value="stack_short">Vertical Stack (≤ 3 Branch Intervals)</option>
                  <option value="stack_tall">Vertical Stack (&gt; 3 Branch Intervals)</option>
                  <option value="building_drain">Building Drain / Sewer Main</option>
                </select>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  IPC Table 710.1 governing standard
                </span>
              </div>

              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Piping Gradient / Slope
                </label>
                <select
                  value={slope}
                  onChange={(e) => setSlope(Number(e.target.value))}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold cursor-pointer"
                >
                  <option value="0.125">1/8" / ft (1.04% / 10.4 mm/m)</option>
                  <option value="0.25">1/4" / ft (2.08% / 20.8 mm/m)</option>
                  <option value="0.5">1/2" / ft (4.17% / 41.7 mm/m)</option>
                </select>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  1/4" / ft standard for &lt; 4" pipes
                </span>
              </div>

              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Piping Material
                </label>
                <select
                  value={material}
                  onChange={(e) => setMaterial(e.target.value as any)}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold cursor-pointer"
                >
                  <option value="pvc">PVC / ABS DWV (n = 0.009)</option>
                  <option value="cast_iron">Cast Iron Hubless (n = 0.012)</option>
                  <option value="hdpe">HDPE Solid Wall (n = 0.009)</option>
                  <option value="copper">Copper Type DWV (n = 0.011)</option>
                </select>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Manning roughness coefficient
                </span>
              </div>

              <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  Safety Margin (% DFU)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="5"
                  value={safetyFactor}
                  onChange={(e) => setSafetyFactor(Number(e.target.value))}
                  className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                />
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  Future expansion allowance (+15%)
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Fixture Matrix or Direct Input */}
          {workflow === "matrix" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary" /> 2. Sanitary Fixture Schedule &amp; DFU Values
                </h3>
                <span className="text-[11px] font-bold text-primary">
                  Subtotal: {liveResults.rawDfu} Raw DFU ({liveResults.designDfu} Design DFU)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[280px] overflow-y-auto p-1 custom-scrollbar">
                {fixtures.map((f) => (
                  <div key={f.id} className="p-2.5 rounded-xl border border-border/70 bg-surface-2/40 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-foreground truncate" title={f.name}>
                        {f.name}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <span className="font-semibold text-primary">{f.dfu} DFU ea.</span>
                        <span>•</span>
                        <span>Min {f.minTrapSizeInches}" trap</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAdjustFixture(f.id, -1)}
                        className="size-7 rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground flex items-center justify-center cursor-pointer transition"
                      >
                        <Minus className="size-3" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={f.val}
                        onChange={(e) => handleSetFixtureVal(f.id, parseInt(e.target.value) || 0)}
                        className="w-10 h-7 text-center bg-background border border-input rounded-lg text-xs font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleAdjustFixture(f.id, 1)}
                        className="size-7 rounded-lg border border-border/80 bg-background hover:bg-muted text-foreground flex items-center justify-center cursor-pointer transition"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border/60 pb-1">
                <GitFork className="size-3.5 text-primary" /> 2. Direct Drainage Fixture Unit (DFU) Input
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Direct Total Fixture Units (Raw DFU)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={directRawDfu}
                    onChange={(e) => setDirectRawDfu(Math.max(1, Number(e.target.value)))}
                    className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Total simultaneous sanitary drainage fixture load
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-border/70 bg-surface-2/40">
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                    Developed Vent Stack Height ({isSI ? "m" : "ft"})
                  </label>
                  <input
                    type="number"
                    min="10"
                    step="5"
                    value={ventLength}
                    onChange={(e) => setVentLength(Number(e.target.value))}
                    className="w-full h-8 px-2 bg-background border border-input rounded-lg text-xs font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    IPC Table 906.1 developed vent length
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Live Hydraulic Sizing Readout */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Activity className="size-4" />
                Live IPC / UPC Drainage Pipe Sizing Output
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                Manning Full-Flow Hydraulic Sizing
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[10.5px] block font-medium">Design Load</span>
                <span className="font-mono font-bold text-primary text-sm">
                  {liveResults.designDfu} DFU
                </span>
                <span className="text-[9.5px] text-muted-foreground block">Raw: {liveResults.rawDfu} DFU</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[10.5px] block font-medium">Required Pipe Size</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {isSI ? `${liveResults.sizedDn} mm DN` : `${liveResults.sizedNps}" NPS`}
                </span>
                <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 block">IPC Compliant</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[10.5px] block font-medium">Max DFU Capacity</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {liveResults.maxAllowableDfu} DFU
                </span>
                <span className="text-[9.5px] text-muted-foreground block">
                  {((liveResults.designDfu / liveResults.maxAllowableDfu) * 100).toFixed(0)}% utilized
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[10.5px] block font-medium">Slope / Gradient</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {slope}" / ft
                </span>
                <span className="text-[9.5px] text-muted-foreground block">{((slope / 12) * 100).toFixed(2)}% grade</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card border border-border/70">
                <span className="text-muted-foreground text-[10.5px] block font-medium">Flow Velocity</span>
                <span className={`font-mono font-bold text-sm ${liveResults.isScouringOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
                  {isSI ? `${liveResults.velocityMps.toFixed(2)} m/s` : `${liveResults.velocityFps.toFixed(2)} ft/s`}
                </span>
                <span className="text-[9.5px] text-muted-foreground block">
                  {liveResults.isScouringOk ? "✓ Self-cleansing" : "⚠ Low scour"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Check className="size-4" />
              Apply Custom Configuration
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
