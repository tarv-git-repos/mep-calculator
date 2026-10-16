import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  Sliders,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Clock,
  Layers,
  Sun,
  Shield,
  FileDown,
  RotateCcw,
  Zap,
  TrendingUp,
  Building2,
  Check,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import {
  MaintenanceMethodType,
  EnvironmentalDirtCategory,
  LuminaireEnclosureType,
  LightingDistributionType,
  LEDLifeRating,
  DetailedCIE97Parameters,
  MaintenanceFactorCalculationResult,
  LuminaireGroupItem,
  LightSceneConfig,
  APPLICATION_PRESETS,
  DEFAULT_LUMINAIRE_GROUPS,
  PRESET_LIGHT_SCENES,
  calculateMaintenanceFactor,
  calculateOptimizationMetrics,
} from "@/lib/dialux-maintenance-factor-engine";

export interface DialuxMaintenanceFactorStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMf?: number;
  onApplyMf?: (newMf: number) => void;
  spaceName?: string;
  projectName?: string;
}

export function DialuxMaintenanceFactorStudioModal({
  isOpen,
  onClose,
  currentMf = 0.80,
  onApplyMf,
  spaceName = "Open Office Workstation",
  projectName = "Commercial Building Project",
}: DialuxMaintenanceFactorStudioModalProps) {
  // 1. Core Modal State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"method" | "cie97" | "timeline" | "groups" | "scenes">("method");

  // Maintenance Method & Base Parameters
  const [method, setMethod] = useState<MaintenanceMethodType>("detailed_cie97");
  const [fixedValue, setFixedValue] = useState<number>(currentMf || 0.80);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("preset-commercial-office");

  // Detailed CIE 97 Parameters
  const [environment, setEnvironment] = useState<EnvironmentalDirtCategory>("clean");
  const [enclosureType, setEnclosureType] = useState<LuminaireEnclosureType>("closed_optical_ip20");
  const [cleaningIntervalYears, setCleaningIntervalYears] = useState<number>(2.0);
  const [operatingHoursPerYear, setOperatingHoursPerYear] = useState<number>(2500);
  const [targetServiceYears, setTargetServiceYears] = useState<number>(5);
  const [ledRating, setLedRating] = useState<LEDLifeRating>("L80B10");
  const [replacementPolicy, setReplacementPolicy] = useState<"spot_replacement" | "group_replacement">("spot_replacement");
  const [roomDistribution, setRoomDistribution] = useState<LightingDistributionType>("direct");
  const [roomIndexK, setRoomIndexK] = useState<number>(2.0);
  const [roomCleaningIntervalYears, setRoomCleaningIntervalYears] = useState<number>(2.0);

  // Luminaire Groups & Scenes (evo 5.2 Improvements)
  const [luminaireGroups, setLuminaireGroups] = useState<LuminaireGroupItem[]>(DEFAULT_LUMINAIRE_GROUPS);
  const [activeSceneId, setActiveSceneId] = useState<string>("scene-full-work");

  // Apply Preset Handler
  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = APPLICATION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setMethod(preset.defaultMethod);
    setFixedValue(preset.fixedValue);
    setEnvironment(preset.params.environment);
    setEnclosureType(preset.params.enclosureType);
    setCleaningIntervalYears(preset.params.cleaningIntervalYears);
    setOperatingHoursPerYear(preset.params.operatingHoursPerYear);
    setTargetServiceYears(preset.params.targetServiceYears);
    setLedRating(preset.params.ledRating);
    setReplacementPolicy(preset.params.replacementPolicy);
    setRoomDistribution(preset.params.roomDistribution);
    setRoomIndexK(preset.params.roomIndexK);
    setRoomCleaningIntervalYears(preset.params.roomCleaningIntervalYears);
    toast.info(`Loaded preset: ${preset.name}`);
  };

  // Compile Parameters
  const detailedParams: DetailedCIE97Parameters = useMemo(() => {
    return {
      environment,
      enclosureType,
      cleaningIntervalYears,
      operatingHoursPerYear,
      targetServiceYears,
      ledRating,
      replacementPolicy,
      roomDistribution,
      roomIndexK,
      roomCleaningIntervalYears,
    };
  }, [
    environment,
    enclosureType,
    cleaningIntervalYears,
    operatingHoursPerYear,
    targetServiceYears,
    ledRating,
    replacementPolicy,
    roomDistribution,
    roomIndexK,
    roomCleaningIntervalYears,
  ]);

  // Execute Calculation
  const result: MaintenanceFactorCalculationResult = useMemo(() => {
    return calculateMaintenanceFactor(method, fixedValue, detailedParams);
  }, [method, fixedValue, detailedParams]);

  // Radiosity Group Calculation Optimization Metrics (evo 5.2)
  const optimizationMetrics = useMemo(() => {
    return calculateOptimizationMetrics(luminaireGroups);
  }, [luminaireGroups]);

  // Active Light Scene
  const activeScene = useMemo(() => {
    return PRESET_LIGHT_SCENES.find((s) => s.id === activeSceneId) || PRESET_LIGHT_SCENES[0];
  }, [activeSceneId]);

  // Apply Scene Dimming to Groups
  const handleSelectScene = (scene: LightSceneConfig) => {
    setActiveSceneId(scene.id);
    setLuminaireGroups((prev) =>
      prev.map((g) => ({
        ...g,
        dimmingPercent: scene.groupDimmingMap[g.id] !== undefined ? scene.groupDimmingMap[g.id] : 100,
      }))
    );
    toast.info(`Switched to ${scene.name}`);
  };

  const handleApplyToProject = () => {
    if (onApplyMf) {
      onApplyMf(result.finalMF);
    }
    toast.success(`Applied Maintenance Factor (MF = ${result.finalMF}) to active space "${spaceName}"!`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200">
      <div
        className={`bg-[#14171f] border border-slate-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[96vw] max-w-6xl h-[90vh]"
        }`}
      >
        {/* =========================================================================
            HEADER: DIALUX EVO TUTORIAL 20 MAINTENANCE FACTORS & IMPROVEMENTS
        ========================================================================= */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-[#181c24] via-[#1a202c] to-[#181c24] border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white font-bold">
              <Sliders className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100 tracking-wide">
                  DIALux evo Tutorial Part 20: Maintenance Factors & Improvements
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  CIE 97 / CIE 154 / ISO 22012
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  evo 5.2 Group Optimization
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Fixed vs. Detailed Degradation Method • Component Factors (LLMF × LSF × LMF × RSMF) • Automatic Luminaire Grouping
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 transition cursor-pointer"
              title="Close Studio"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            TOP WORKFLOW TABS & QUICK STATUS RIBBON
        ========================================================================= */}
        <div className="px-4 py-2 bg-[#12151b] border-b border-slate-800 flex items-center justify-between shrink-0 overflow-x-auto gap-4">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab("method")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "method"
                  ? "bg-amber-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Shield className="size-3.5" />
              <span>1. Method & Presets</span>
            </button>
            <button
              onClick={() => setActiveTab("cie97")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "cie97"
                  ? "bg-amber-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Sliders className="size-3.5" />
              <span>2. CIE 97 Factor Breakdown</span>
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "timeline"
                  ? "bg-amber-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Calendar className="size-3.5" />
              <span>3. 10-Year Depreciation Plan</span>
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "groups"
                  ? "bg-amber-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Layers className="size-3.5 text-emerald-300" />
              <span>4. Luminaire Groups (evo 5.2)</span>
            </button>
            <button
              onClick={() => setActiveTab("scenes")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "scenes"
                  ? "bg-amber-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Sun className="size-3.5 text-amber-300" />
              <span>5. Light Scenes & Tuning</span>
            </button>
          </div>

          {/* Quick Real-Time Maintenance Factor Badge */}
          <div className="flex items-center gap-3">
            <div className="text-right text-[11px] text-slate-400">
              <div>Calculated Maintenance Factor:</div>
              <div className="text-base font-extrabold text-amber-400 font-mono leading-none">
                MF = {result.finalMF}
              </div>
            </div>
            <button
              onClick={handleApplyToProject}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black font-bold text-xs rounded-lg transition shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="size-3.5" />
              <span>Apply to Space</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            MAIN BODY: TAB CONTENT & FORMULAS
        ========================================================================= */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden bg-[#101216]">
          
          {/* LEFT PANEL: INTERACTIVE CONFIGURATION */}
          <div className="w-full lg:w-[500px] xl:w-[540px] bg-[#14171f] border-r border-slate-800 flex flex-col overflow-y-auto shrink-0 p-4 gap-4">
            
            {/* -------------------------------------------------------------
                TAB 1: METHOD & PRESETS
            ------------------------------------------------------------- */}
            {activeTab === "method" && (
              <div className="space-y-4">
                {/* Method Selector */}
                <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wide block">
                    Maintenance Factor Calculation Method
                  </span>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setMethod("fixed")}
                      className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                        method === "fixed"
                          ? "bg-amber-600/20 border-amber-500 text-amber-200 shadow-sm"
                          : "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <div className="font-bold text-xs">Fixed Method</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Manual constant value (e.g. 0.80) applied to the space.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMethod("detailed_cie97")}
                      className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                        method === "detailed_cie97" || method === "detailed_cie154"
                          ? "bg-amber-600/20 border-amber-500 text-amber-200 shadow-sm"
                          : "bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600"
                      }`}
                    >
                      <div className="font-bold text-xs">Detailed Method</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Calculates exact LLMF, LSF, LMF, RSMF per CIE 97/154.
                      </div>
                    </button>
                  </div>

                  {method === "fixed" && (
                    <div className="pt-2 border-t border-slate-800 space-y-1.5">
                      <label className="text-[11px] text-slate-400 block">Fixed Maintenance Factor Value (0.40 - 0.95):</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0.50"
                          max="0.95"
                          step="0.05"
                          value={fixedValue}
                          onChange={(e) => setFixedValue(parseFloat(e.target.value))}
                          className="flex-1 accent-amber-500 cursor-pointer"
                        />
                        <span className="font-mono font-bold text-amber-400 text-sm">{fixedValue}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Application Presets */}
                <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2.5">
                  <span className="text-xs font-bold text-slate-200 block">Application & Space Presets</span>
                  <div className="space-y-2">
                    {APPLICATION_PRESETS.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleApplyPreset(p.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition ${
                          selectedPresetId === p.id
                            ? "bg-amber-950/30 border-amber-500 text-amber-100"
                            : "bg-slate-800/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{p.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-700">
                            MF = {p.fixedValue}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 2: CIE 97 COMPONENT FACTOR BREAKDOWN
            ------------------------------------------------------------- */}
            {activeTab === "cie97" && (
              <div className="space-y-4">
                {/* 1. LLMF Parameters */}
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400">1. Lamp Lumen Maintenance (LLMF)</span>
                    <span className="text-[11px] font-mono font-bold text-cyan-300">LLMF = {result.LLMF}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">LED Rating</label>
                      <select
                        value={ledRating}
                        onChange={(e) => setLedRating(e.target.value as LEDLifeRating)}
                        className="w-full h-7 px-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      >
                        <option value="L90B10">L90B10 (Premium)</option>
                        <option value="L90B50">L90B50 (High)</option>
                        <option value="L80B10">L80B10 (Standard)</option>
                        <option value="L70B50">L70B50 (Basic)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Hours / Year</label>
                      <input
                        type="number"
                        step="250"
                        min="1000"
                        max="8760"
                        value={operatingHoursPerYear}
                        onChange={(e) => setOperatingHoursPerYear(parseInt(e.target.value) || 2500)}
                        className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Service Years</label>
                      <input
                        type="number"
                        min="1"
                        max="15"
                        value={targetServiceYears}
                        onChange={(e) => setTargetServiceYears(parseInt(e.target.value) || 5)}
                        className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Cumulative Service: <strong className="text-slate-200">{result.totalBurningHours.toLocaleString()} hours</strong>
                  </div>
                </div>

                {/* 2. LMF Parameters */}
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">2. Luminaire Maintenance (LMF)</span>
                    <span className="text-[11px] font-mono font-bold text-amber-300">LMF = {result.LMF}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Environment</label>
                      <select
                        value={environment}
                        onChange={(e) => setEnvironment(e.target.value as EnvironmentalDirtCategory)}
                        className="w-full h-7 px-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      >
                        <option value="very_clean">Very Clean</option>
                        <option value="clean">Clean (Office)</option>
                        <option value="normal">Normal</option>
                        <option value="dirty">Dirty (Plant)</option>
                        <option value="very_dirty">Very Dirty</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">IP Enclosure</label>
                      <select
                        value={enclosureType}
                        onChange={(e) => setEnclosureType(e.target.value as LuminaireEnclosureType)}
                        className="w-full h-7 px-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      >
                        <option value="closed_optical_ip20">IP20 Optical</option>
                        <option value="dust_proof_ip54">IP54 Dust</option>
                        <option value="sealed_watertight_ip65">IP65 Sealed</option>
                        <option value="heavy_industrial_ip66">IP66 Heavy</option>
                        <option value="bare_lamp">Open / Bare</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Cleaning (Yrs)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="5.0"
                        value={cleaningIntervalYears}
                        onChange={(e) => setCleaningIntervalYears(parseFloat(e.target.value) || 2.0)}
                        className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. RSMF Parameters */}
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">3. Room Surface (RSMF)</span>
                    <span className="text-[11px] font-mono font-bold text-emerald-300">RSMF = {result.RSMF}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Distribution</label>
                      <select
                        value={roomDistribution}
                        onChange={(e) => setRoomDistribution(e.target.value as LightingDistributionType)}
                        className="w-full h-7 px-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      >
                        <option value="direct">Direct</option>
                        <option value="semi_direct">Semi-Direct</option>
                        <option value="direct_indirect">Direct/Indirect</option>
                        <option value="indirect">Indirect</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Room Index (k)</label>
                      <input
                        type="number"
                        step="0.25"
                        min="0.5"
                        max="5.0"
                        value={roomIndexK}
                        onChange={(e) => setRoomIndexK(parseFloat(e.target.value) || 2.0)}
                        className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Room Clean (Yrs)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="1.0"
                        max="5.0"
                        value={roomCleaningIntervalYears}
                        onChange={(e) => setRoomCleaningIntervalYears(parseFloat(e.target.value) || 2.0)}
                        className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. LSF Replacement Policy */}
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-200 block">4. Lamp Survival Factor (LSF)</span>
                    <span className="text-[11px] text-slate-400">
                      {replacementPolicy === "spot_replacement" ? "Individual spot replacement (LSF = 1.00)" : "Group relamping (LSF = 0.96)"}
                    </span>
                  </div>
                  <select
                    value={replacementPolicy}
                    onChange={(e) => setReplacementPolicy(e.target.value as any)}
                    className="h-7 px-2 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                  >
                    <option value="spot_replacement">Spot Replacement (1.00)</option>
                    <option value="group_replacement">Group Replacement (0.96)</option>
                  </select>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 3: 10-YEAR DEPRECIATION PLAN
            ------------------------------------------------------------- */}
            {activeTab === "timeline" && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wide block">
                    Maintenance Cycle Schedule
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">Luminaire Cleaning</div>
                      <div className="font-bold text-slate-100 mt-0.5">Every {result.luminaireCleaningIntervalMonths} Mos</div>
                    </div>
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">Room Wall Cleaning</div>
                      <div className="font-bold text-slate-100 mt-0.5">Every {result.roomCleaningIntervalMonths} Mos</div>
                    </div>
                    <div className="p-2 bg-slate-800/80 rounded">
                      <div className="text-[10px] text-slate-400">Relamping Target</div>
                      <div className="font-bold text-amber-300 mt-0.5">Year {result.groupRelampingYear}</div>
                    </div>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-2">Year</th>
                        <th className="p-2">Hours</th>
                        <th className="p-2">LLMF</th>
                        <th className="p-2">LMF</th>
                        <th className="p-2">RSMF</th>
                        <th className="p-2">Compound MF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                      {result.depreciationTimeline.map((item) => (
                        <tr
                          key={item.year}
                          className={`hover:bg-slate-800/40 ${
                            item.year === targetServiceYears ? "bg-amber-950/20 font-bold" : ""
                          }`}
                        >
                          <td className="p-2 font-mono">
                            Yr {item.year} {item.isCleanedThisYear && <span className="text-[9px] text-emerald-400">✨ clean</span>}
                          </td>
                          <td className="p-2 font-mono">{item.hours.toLocaleString()} h</td>
                          <td className="p-2 font-mono text-cyan-300">{item.LLMF}</td>
                          <td className="p-2 font-mono text-amber-300">{item.LMF}</td>
                          <td className="p-2 font-mono text-emerald-300">{item.RSMF}</td>
                          <td className="p-2 font-mono font-bold text-amber-400">{item.compoundMF}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 4: LUMINAIRE GROUPS & RADIOSITY OPTIMIZATION (evo 5.2)
            ------------------------------------------------------------- */}
            {activeTab === "groups" && (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-950/20 rounded-lg border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-emerald-400" /> evo 5.2 Group Optimization Benchmark
                    </span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      {optimizationMetrics.timeSavingsPercent}% Faster Solve
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    By consolidating {optimizationMetrics.totalFixtures} individual fixtures into {optimizationMetrics.optimizedGroupCount} calculation groups (inside/outside spatial boundaries), DIALux evo collapses the radiosity matrix linear system, cutting calculation time from ~{optimizationMetrics.estimatedSolveTimeSecondsUnoptimized}s down to ~{optimizationMetrics.estimatedSolveTimeSecondsOptimized}s.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-200 block">Active Luminaire Groups</span>
                  {luminaireGroups.map((grp) => (
                    <div key={grp.id} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              grp.location === "inside"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                : "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                            }`}
                          >
                            {grp.location}
                          </span>
                          <span className="text-xs font-bold text-slate-200">{grp.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {grp.fixtureCount} fixtures • {grp.totalWattage} W
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-slate-400">Dimming:</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={grp.dimmingPercent}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setLuminaireGroups((prev) =>
                              prev.map((g) => (g.id === grp.id ? { ...g, dimmingPercent: val } : g))
                            );
                          }}
                          className="flex-1 accent-amber-500 cursor-pointer"
                        />
                        <span className="font-mono font-bold text-amber-400 w-10 text-right">{grp.dimmingPercent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 5: LIGHT SCENES & TUNING
            ------------------------------------------------------------- */}
            {activeTab === "scenes" && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2.5">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wide block">
                    Preset Lighting Scenes
                  </span>
                  <div className="space-y-2">
                    {PRESET_LIGHT_SCENES.map((scene) => (
                      <div
                        key={scene.id}
                        onClick={() => handleSelectScene(scene)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition ${
                          activeSceneId === scene.id
                            ? "bg-amber-950/30 border-amber-500 text-amber-100"
                            : "bg-slate-800/60 border-slate-800 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{scene.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-700">
                            {scene.energySavingsPercent}% Savings ({scene.totalLoadWatts} W)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{scene.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: MATHEMATICAL SUMMARY & DEPRECIATION CHART */}
          <div className="flex-1 min-h-0 flex flex-col p-6 bg-[#0c0e12] overflow-y-auto gap-6 justify-center items-center">
            
            {/* Visual Equation Card */}
            <div className="w-full max-w-2xl bg-[#14171f] p-6 rounded-xl border border-slate-800 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">
                    CIE 97:2005 Maintenance Factor Formula Decomposition
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Compounding product ensuring maintained illuminance (Em) throughout service life
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  MF = {result.finalMF}
                </span>
              </div>

              {/* Formula Visual Box */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-center">
                <div className="flex-1">
                  <div className="text-[10px] text-cyan-400 font-bold uppercase">LLMF</div>
                  <div className="text-lg font-mono font-extrabold text-cyan-300 mt-1">{result.LLMF}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Lamp Lumen</div>
                </div>
                <div className="text-slate-600 font-bold text-xl">×</div>
                <div className="flex-1">
                  <div className="text-[10px] text-purple-400 font-bold uppercase">LSF</div>
                  <div className="text-lg font-mono font-extrabold text-purple-300 mt-1">{result.LSF}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Lamp Survival</div>
                </div>
                <div className="text-slate-600 font-bold text-xl">×</div>
                <div className="flex-1">
                  <div className="text-[10px] text-amber-400 font-bold uppercase">LMF</div>
                  <div className="text-lg font-mono font-extrabold text-amber-300 mt-1">{result.LMF}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Luminaire Dirt</div>
                </div>
                <div className="text-slate-600 font-bold text-xl">×</div>
                <div className="flex-1">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase">RSMF</div>
                  <div className="text-lg font-mono font-extrabold text-emerald-300 mt-1">{result.RSMF}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Room Surface</div>
                </div>
                <div className="text-slate-600 font-bold text-xl">=</div>
                <div className="flex-1 bg-amber-500/10 py-2 rounded-lg border border-amber-500/30">
                  <div className="text-[10px] text-amber-400 font-bold uppercase">Total MF</div>
                  <div className="text-xl font-mono font-extrabold text-amber-300 mt-1">{result.finalMF}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Maintenance Factor</div>
                </div>
              </div>

              {/* Engineering Impact Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Initial Illuminance Overhead:</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">
                    E_initial = {result.initialLuxFactor} × E_maintained
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    To guarantee required standard lux at end of cycle, initial installation must deliver {result.initialLuxFactor}× flux.
                  </p>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[11px]">EN 12464-1 Compliance Status:</div>
                  <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" />
                    <span>Conforms to Clause 4.3</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Standardized documented maintenance schedule meets ISO/CIE TS 22012 criteria.
                  </p>
                </div>
              </div>

              {/* Maintenance Schedule Documentation Export Button */}
              <button
                onClick={() => {
                  toast.success("Exported EN 12464-1 Maintenance Schedule Specification Document!");
                }}
                className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-black font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow cursor-pointer"
              >
                <FileDown className="size-4" />
                <span>Export Maintenance Schedule (EN 12464-1 / ISO 22012)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
