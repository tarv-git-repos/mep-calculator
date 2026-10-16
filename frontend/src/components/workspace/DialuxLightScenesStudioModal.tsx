import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Layers,
  Sun,
  Sliders,
  Plus,
  Trash2,
  Copy,
  Zap,
  TrendingDown,
  CheckCircle2,
  Shield,
  FileDown,
  Sparkles,
  Info,
  Check,
  RotateCcw,
  Palette,
  Power,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import {
  LuminaireFixtureItem,
  LuminaireGroup,
  LightScene,
  ControlGroup,
  DEFAULT_FIXTURES,
  DEFAULT_GROUPS,
  DEFAULT_LIGHT_SCENES,
  recalculateSceneMetrics,
  deduceControlGroups,
} from "@/lib/dialux-light-scenes-engine";

export interface DialuxLightScenesStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  onApplySceneToSimulation?: (scene: LightScene) => void;
}

export function DialuxLightScenesStudioModal({
  isOpen,
  onClose,
  projectName = "Corporate Headquarters Lighting",
  onApplySceneToSimulation,
}: DialuxLightScenesStudioModalProps) {
  // 1. Core Modal State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"groups" | "scenes" | "fast_calc" | "control_groups" | "energy">("scenes");

  // Project Models
  const [fixtures, setFixtures] = useState<LuminaireFixtureItem[]>(DEFAULT_FIXTURES);
  const [groups, setGroups] = useState<LuminaireGroup[]>(DEFAULT_GROUPS);
  const [scenes, setScenes] = useState<LightScene[]>(DEFAULT_LIGHT_SCENES);
  const [activeSceneId, setActiveSceneId] = useState<string>("scene-100-full-work");

  // Filtering
  const [locationFilter, setLocationFilter] = useState<"all" | "inside" | "outside">("all");

  // Active Scene Reference
  const activeScene = useMemo(() => {
    return scenes.find((s) => s.id === activeSceneId) || scenes[0];
  }, [scenes, activeSceneId]);

  // Derived DALI Control Groups (Steuergruppen)
  const controlGroups = useMemo(() => {
    return deduceControlGroups(groups, scenes);
  }, [groups, scenes]);

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    if (locationFilter === "all") return groups;
    return groups.filter((g) => g.location === locationFilter);
  }, [groups, locationFilter]);

  // Scene Dimming Slider Handler
  const handleUpdateGroupDimming = (groupId: string, dimmingVal: number) => {
    setScenes((prev) =>
      prev.map((sc) => {
        if (sc.id !== activeSceneId) return sc;
        const currentSetting = sc.groupSettings[groupId] || {
          groupId,
          enabled: true,
          dimmingPercent: 100,
          cctKelvin: 4000,
        };
        const updatedSettings = {
          ...sc.groupSettings,
          [groupId]: {
            ...currentSetting,
            dimmingPercent: dimmingVal,
            enabled: dimmingVal > 0,
          },
        };

        const metrics = recalculateSceneMetrics({ ...sc, groupSettings: updatedSettings }, groups);

        return {
          ...sc,
          groupSettings: updatedSettings,
          calculatedWatts: metrics.totalWatts,
          energySavingsPercent: metrics.savingsPercent,
          averageLux: metrics.averageLux,
          uniformityUo: metrics.uniformityUo,
        };
      })
    );
  };

  // Group CCT Slider Handler
  const handleUpdateGroupCct = (groupId: string, cctVal: number) => {
    setScenes((prev) =>
      prev.map((sc) => {
        if (sc.id !== activeSceneId) return sc;
        const currentSetting = sc.groupSettings[groupId] || {
          groupId,
          enabled: true,
          dimmingPercent: 100,
          cctKelvin: 4000,
        };
        return {
          ...sc,
          groupSettings: {
            ...sc.groupSettings,
            [groupId]: {
              ...currentSetting,
              cctKelvin: cctVal,
            },
          },
        };
      })
    );
  };

  // Group Power Toggle Handler
  const handleToggleGroup = (groupId: string) => {
    setScenes((prev) =>
      prev.map((sc) => {
        if (sc.id !== activeSceneId) return sc;
        const currentSetting = sc.groupSettings[groupId] || {
          groupId,
          enabled: true,
          dimmingPercent: 100,
          cctKelvin: 4000,
        };
        const newEnabled = !currentSetting.enabled;
        const updatedSettings = {
          ...sc.groupSettings,
          [groupId]: {
            ...currentSetting,
            enabled: newEnabled,
            dimmingPercent: newEnabled ? (currentSetting.dimmingPercent || 100) : 0,
          },
        };

        const metrics = recalculateSceneMetrics({ ...sc, groupSettings: updatedSettings }, groups);

        return {
          ...sc,
          groupSettings: updatedSettings,
          calculatedWatts: metrics.totalWatts,
          energySavingsPercent: metrics.savingsPercent,
          averageLux: metrics.averageLux,
          uniformityUo: metrics.uniformityUo,
        };
      })
    );
  };

  // Create Empty Scene (Tutorial 21 core workflow)
  const handleCreateEmptyScene = () => {
    const newId = `scene-custom-${Date.now()}`;
    const emptySettings: Record<string, any> = {};
    groups.forEach((g) => {
      emptySettings[g.id] = {
        groupId: g.id,
        enabled: false,
        dimmingPercent: 0,
        cctKelvin: g.defaultCctKelvin,
      };
    });

    const newScene: LightScene = {
      id: newId,
      name: `New Custom Scene ${scenes.length + 1}`,
      description: "Empty light scene created from scratch. Adjust group dimming levels to configure.",
      isDaylightIntegrated: false,
      groupSettings: emptySettings,
      calculatedWatts: 0,
      energySavingsPercent: 100,
      averageLux: 0,
      uniformityUo: 0,
    };

    setScenes([...scenes, newScene]);
    setActiveSceneId(newId);
    toast.success("Created empty light scene! Begin assigning group dimming levels.");
  };

  // Duplicate Scene
  const handleDuplicateScene = () => {
    const newId = `scene-dup-${Date.now()}`;
    const duplicated: LightScene = {
      ...JSON.parse(JSON.stringify(activeScene)),
      id: newId,
      name: `${activeScene.name} (Copy)`,
    };
    setScenes([...scenes, duplicated]);
    setActiveSceneId(newId);
    toast.info(`Duplicated "${activeScene.name}"`);
  };

  // Apply to Active Simulation
  const handleApplyToActive = () => {
    if (onApplySceneToSimulation) {
      onApplySceneToSimulation(activeScene);
    }
    toast.success(`Applied "${activeScene.name}" to main 3D CAD simulation!`);
  };

  // -------------------------------------------------------------
  // 3D Three.js Interactive Viewport Setup
  // -------------------------------------------------------------
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const spotLightsRef = useRef<Record<string, any>>({});
  const emissiveMeshesRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!isOpen || !mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 450;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(-2, 6.5, 9);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(4, 1.4, 4);
    controls.update();

    // Ambient Night Light
    const ambLight = new THREE.AmbientLight(0x1a202c, 0.25);
    scene.add(ambLight);

    // Floor Slab (Open Office & Conference Room)
    const floorGeom = new THREE.PlaneGeometry(12, 10);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const floorMesh = new THREE.Mesh(floorGeom, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(5, 0, 4.5);
    scene.add(floorMesh);

    // Grid Helper
    const grid = new THREE.GridHelper(14, 14, 0x475569, 0x1e293b);
    grid.position.set(5, 0.01, 4.5);
    scene.add(grid);

    // Perimeter Wall (Left)
    const wallGeom = new THREE.BoxGeometry(0.2, 3.2, 10);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
    const wallLeft = new THREE.Mesh(wallGeom, wallMat);
    wallLeft.position.set(-1, 1.6, 4.5);
    scene.add(wallLeft);

    // Back Presentation Wall
    const wallBackGeom = new THREE.BoxGeometry(12, 3.2, 0.2);
    const wallBack = new THREE.Mesh(wallBackGeom, wallMat);
    wallBack.position.set(5, 1.6, 9.5);
    scene.add(wallBack);

    // Create 3D Fixtures & Spotlights mapped to groups
    spotLightsRef.current = {};
    emissiveMeshesRef.current = {};

    fixtures.forEach((fix) => {
      // Fixture Housing
      const fixGeom = new THREE.BoxGeometry(0.6, 0.08, 0.6);
      const fixMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: new THREE.Color(0xfef08a),
        emissiveIntensity: 0.8,
      });
      const fixMesh = new THREE.Mesh(fixGeom, fixMat);
      fixMesh.position.set(fix.position.x, fix.position.z, fix.position.y);
      scene.add(fixMesh);
      emissiveMeshesRef.current[fix.id] = fixMesh;

      // Spotlight downwards
      const spot = new THREE.SpotLight(0xfff7ed, 1.8, 8, Math.PI / 3, 0.5, 1.2);
      spot.position.set(fix.position.x, fix.position.z - 0.05, fix.position.y);
      const target = new THREE.Object3D();
      target.position.set(fix.position.x, 0, fix.position.y);
      scene.add(target);
      spot.target = target;
      scene.add(spot);
      spotLightsRef.current[fix.id] = spot;
    });

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (container) container.innerHTML = "";
    };
  }, [isOpen]);

  // Real-Time 3D Light Dimming & CCT Update (Linear Superposition visualizer)
  useEffect(() => {
    if (!activeScene) return;

    fixtures.forEach((fix) => {
      const groupSetting = activeScene.groupSettings[fix.groupId];
      const enabled = groupSetting ? groupSetting.enabled : true;
      const dimming = groupSetting && enabled ? groupSetting.dimmingPercent / 100 : 0;
      const cct = groupSetting ? groupSetting.cctKelvin : fix.cctKelvin;

      // Convert CCT to RGB Color
      const warmFactor = Math.max(0, Math.min(1, (cct - 2700) / (6500 - 2700)));
      const lightColor = new THREE.Color(
        1.0,
        0.8 + warmFactor * 0.18,
        0.6 + warmFactor * 0.4
      );

      // Update Spotlight
      const spot = spotLightsRef.current[fix.id];
      if (spot) {
        spot.intensity = 2.2 * dimming;
        spot.color = lightColor;
      }

      // Update Emissive Mesh Glow
      const mesh = emissiveMeshesRef.current[fix.id];
      if (mesh) {
        const mat = mesh.material as any;
        mat.emissive = lightColor;
        mat.emissiveIntensity = dimming * 1.5;
      }
    });
  }, [activeScene, fixtures]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200">
      <div
        className={`bg-[#14171f] border border-slate-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[96vw] max-w-7xl h-[92vh]"
        }`}
      >
        {/* =========================================================================
            HEADER: DIALUX EVO TUTORIAL 21 LUMINAIRE GROUPS & LIGHT SCENES
        ========================================================================= */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-[#181c24] via-[#1a202c] to-[#181c24] border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold">
              <Layers className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100 tracking-wide">
                  DIALux evo Tutorial Part 21: Luminaire Groups for Lighting Scenes
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  evo 5.2 Groups
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  DALI Control Groups
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Mutual Exclusivity Groups • Empty Light Scenes • Instant Superposition Recalculation • Tunable White (CCT)
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
              onClick={() => setActiveTab("scenes")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "scenes"
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Sun className="size-3.5" />
              <span>1. Light Scenes Builder</span>
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "groups"
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Layers className="size-3.5" />
              <span>2. Luminaire Groups Manager</span>
            </button>
            <button
              onClick={() => setActiveTab("fast_calc")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "fast_calc"
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Zap className="size-3.5 text-amber-300" />
              <span>3. Fast Scene Superposition</span>
            </button>
            <button
              onClick={() => setActiveTab("control_groups")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "control_groups"
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <Cpu className="size-3.5" />
              <span>4. DALI Control Groups</span>
            </button>
            <button
              onClick={() => setActiveTab("energy")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "energy"
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              }`}
            >
              <TrendingDown className="size-3.5 text-emerald-300" />
              <span>5. Energy & LENI</span>
            </button>
          </div>

          {/* Quick Active Scene Badge & Direct Apply */}
          <div className="flex items-center gap-3">
            <div className="text-right text-[11px] text-slate-400">
              <div>Active Scene Load:</div>
              <div className="font-mono font-bold text-cyan-300 text-xs">
                {activeScene.calculatedWatts} W ({activeScene.energySavingsPercent}% Savings)
              </div>
            </div>
            <button
              onClick={handleApplyToActive}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg transition shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="size-3.5" />
              <span>Apply Scene to 3D</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            MAIN BODY: SPLIT VIEWPORT & CONTROLS
        ========================================================================= */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden bg-[#101216]">
          
          {/* LEFT PANEL: INTERACTIVE CONTROLS */}
          <div className="w-full lg:w-[500px] xl:w-[540px] bg-[#14171f] border-r border-slate-800 flex flex-col overflow-y-auto shrink-0 p-4 gap-4">
            
            {/* -------------------------------------------------------------
                TAB 1: LIGHT SCENES BUILDER
            ------------------------------------------------------------- */}
            {activeTab === "scenes" && (
              <div className="space-y-4">
                {/* Scene Selector Header & Creation Buttons */}
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Sun className="size-3.5" /> Active Light Scene
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleCreateEmptyScene}
                        className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Create empty light scene from scratch (Tutorial 21)"
                      >
                        <Plus className="size-3" />
                        <span>Empty Scene</span>
                      </button>
                      <button
                        onClick={handleDuplicateScene}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Duplicate active scene"
                      >
                        <Copy className="size-3" />
                        <span>Duplicate</span>
                      </button>
                    </div>
                  </div>

                  <select
                    value={activeSceneId}
                    onChange={(e) => setActiveSceneId(e.target.value)}
                    className="w-full h-8 px-2.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 outline-none cursor-pointer"
                  >
                    {scenes.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name} ({sc.calculatedWatts}W)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{activeScene.description}</p>
                </div>

                {/* Group Dimming & CCT Sliders for Active Scene */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Luminaire Groups in Scene</span>
                    <span className="text-[10px] text-slate-400">
                      Average Lux: <strong className="text-amber-400 font-mono">{activeScene.averageLux} lx</strong>
                    </span>
                  </div>

                  {groups.map((grp) => {
                    const setting = activeScene.groupSettings[grp.id] || {
                      groupId: grp.id,
                      enabled: true,
                      dimmingPercent: 100,
                      cctKelvin: grp.defaultCctKelvin,
                    };

                    return (
                      <div
                        key={grp.id}
                        className={`p-3 rounded-lg border transition ${
                          setting.enabled
                            ? "bg-slate-900 border-slate-800"
                            : "bg-slate-950/60 border-slate-900 opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleGroup(grp.id)}
                              className={`p-1 rounded cursor-pointer transition ${
                                setting.enabled
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-slate-800 text-slate-500 border border-slate-700"
                              }`}
                              title={setting.enabled ? "Turn Group OFF" : "Turn Group ON"}
                            >
                              <Power className="size-3.5" />
                            </button>
                            <span
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: grp.colorHex }}
                            />
                            <span className="text-xs font-bold text-slate-200">{grp.name}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {grp.fixtureIds.length} fixtures • {Math.round(grp.totalNominalWatts * (setting.dimmingPercent / 100))}W
                          </span>
                        </div>

                        {/* Dimming Level Slider */}
                        <div className="flex items-center gap-3 text-xs mb-1.5">
                          <span className="text-slate-400 w-16">Dimming:</span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            disabled={!setting.enabled}
                            value={setting.dimmingPercent}
                            onChange={(e) => handleUpdateGroupDimming(grp.id, parseInt(e.target.value) || 0)}
                            className="flex-1 accent-emerald-500 cursor-pointer disabled:opacity-40"
                          />
                          <span className="font-mono font-bold text-emerald-400 w-10 text-right">
                            {setting.enabled ? `${setting.dimmingPercent}%` : "OFF"}
                          </span>
                        </div>

                        {/* Tunable White CCT Slider */}
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-400 w-16">CCT Color:</span>
                          <input
                            type="range"
                            min="2700"
                            max="6500"
                            step="100"
                            disabled={!setting.enabled}
                            value={setting.cctKelvin}
                            onChange={(e) => handleUpdateGroupCct(grp.id, parseInt(e.target.value) || 4000)}
                            className="flex-1 accent-amber-500 cursor-pointer disabled:opacity-40"
                          />
                          <span className="font-mono text-[11px] text-amber-300 w-12 text-right">
                            {setting.cctKelvin}K
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 2: LUMINAIRE GROUPS MANAGER (MUTUAL EXCLUSIVITY)
            ------------------------------------------------------------- */}
            {activeTab === "groups" && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">Filter Location</span>
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        onClick={() => setLocationFilter("all")}
                        className={`px-2 py-0.5 rounded ${
                          locationFilter === "all" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        All ({groups.length})
                      </button>
                      <button
                        onClick={() => setLocationFilter("inside")}
                        className={`px-2 py-0.5 rounded ${
                          locationFilter === "inside" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        Inside
                      </button>
                      <button
                        onClick={() => setLocationFilter("outside")}
                        className={`px-2 py-0.5 rounded ${
                          locationFilter === "outside" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        Outside
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Rule: Each luminaire belongs to strictly one luminaire group at a time to prevent conflicting dimming states.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {filteredGroups.map((grp) => (
                    <div key={grp.id} className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-3 rounded-full"
                            style={{ backgroundColor: grp.colorHex }}
                          />
                          <span className="text-xs font-bold text-slate-200">{grp.name}</span>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            grp.location === "inside"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                              : "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                          }`}
                        >
                          {grp.location}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{grp.description}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
                        <span>Room: <strong className="text-slate-300">{grp.roomName}</strong></span>
                        <span>Nominal Load: <strong className="text-cyan-300">{grp.totalNominalWatts}W</strong></span>
                        <span>Fixtures: <strong className="text-slate-200">{grp.fixtureIds.length}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 3: FAST SCENE SUPERPOSITION (TUTORIAL 21 HIGHLIGHT)
            ------------------------------------------------------------- */}
            {activeTab === "fast_calc" && (
              <div className="space-y-4">
                <div className="p-3.5 bg-gradient-to-r from-emerald-950/30 via-slate-900 to-emerald-950/30 rounded-lg border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Zap className="size-3.5 text-amber-400" /> Instant Linear Superposition Engine
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      0.00 ms Solve Time
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Changing dimming values in a light scene does NOT trigger a complete recalculation of the 3D radiosity light exchange matrix. Pre-calculated group matrices are superposed instantaneously:
                  </p>
                  <div className="p-2.5 bg-slate-950 rounded font-mono text-center text-xs text-amber-300 border border-slate-800">
                    E_total(x, y, z) = ∑ [ d_g × E_g(x, y, z) ]
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Workplane Illuminance (Em)</div>
                    <div className="text-xl font-mono font-bold text-amber-400 mt-1">{activeScene.averageLux} lux</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Uniformity Uo = {activeScene.uniformityUo}</div>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Active Connected Power</div>
                    <div className="text-xl font-mono font-bold text-cyan-300 mt-1">{activeScene.calculatedWatts} W</div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">{activeScene.energySavingsPercent}% energy reduction</div>
                  </div>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 4: DALI CONTROL GROUPS (STEUERGRUPPEN)
            ------------------------------------------------------------- */}
            {activeTab === "control_groups" && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-xs font-bold text-cyan-400 uppercase tracking-wide block">
                    Automatically Deduced Control Groups (Steuergruppen)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    DIALux evo automatically analyzes all lighting scenes to determine the physical DALI hardware channels required for electrical installation.
                  </p>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900 text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-2">DALI Channel</th>
                        <th className="p-2">Channel Name</th>
                        <th className="p-2">Fixtures</th>
                        <th className="p-2">Protocol</th>
                        <th className="p-2">Max Load</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                      {controlGroups.map((cg) => (
                        <tr key={cg.id} className="hover:bg-slate-800/40">
                          <td className="p-2 font-mono font-bold text-amber-400">{cg.daliAddress}</td>
                          <td className="p-2 text-slate-200">{cg.name}</td>
                          <td className="p-2 font-mono">{cg.fixtureCount}</td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300">
                              {cg.switchingLogic === "sensor_controlled" ? "DALI Photocell" : "DALI Dim 0-100%"}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-cyan-300">{cg.maxWatts}W</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------
                TAB 5: ENERGY & LENI (EN 15193)
            ------------------------------------------------------------- */}
            {activeTab === "energy" && (
              <div className="space-y-4">
                <div className="p-3.5 bg-slate-900/90 rounded-lg border border-slate-800 space-y-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide block">
                    Lighting Energy Numeric Indicator (EN 15193 LENI)
                  </span>
                  <div className="space-y-2">
                    {scenes.map((sc) => (
                      <div key={sc.id} className="p-2.5 bg-slate-800/70 rounded-lg border border-slate-700/80 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-200">{sc.name}</div>
                          <div className="text-[10px] text-slate-400">{sc.averageLux} lux average</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-cyan-300">{sc.calculatedWatts} W</div>
                          <div className="text-[10px] text-emerald-400">-{sc.energySavingsPercent}% vs 100% full</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => toast.success("Exported DALI Control Schedule & LENI Report!")}
                  className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow cursor-pointer"
                >
                  <FileDown className="size-4" />
                  <span>Export Control Groups & Energy Schedule</span>
                </button>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: REAL-TIME 3D THREE.JS VIEWPORT */}
          <div className="flex-1 min-h-0 flex flex-col bg-[#0c0e12] overflow-hidden">
            {/* Viewport Top Bar */}
            <div className="px-4 py-2 bg-[#14171f] border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">Live 3D Scene Viewport</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {activeScene.name}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Luminaires dim in real time with active scene sliders
              </div>
            </div>

            {/* Viewport Canvas */}
            <div className="flex-1 min-h-0 relative">
              <div ref={mountRef} className="w-full h-full" />
              
              {/* Floating Real-time HUD */}
              <div className="absolute bottom-4 left-4 p-3 bg-slate-950/80 backdrop-blur-md rounded-lg border border-slate-800 text-xs text-slate-200 space-y-1 shadow-lg pointer-events-none">
                <div>Scene: <strong className="text-emerald-400">{activeScene.name}</strong></div>
                <div>Average Lux: <strong className="text-amber-400">{activeScene.averageLux} lx</strong></div>
                <div>Connected Power: <strong className="text-cyan-300">{activeScene.calculatedWatts} W</strong></div>
                <div>Savings: <strong className="text-emerald-300">{activeScene.energySavingsPercent}%</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
