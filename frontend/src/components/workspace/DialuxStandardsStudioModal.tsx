import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Globe2,
  Shield,
  Layers,
  Building2,
  Plus,
  Copy,
  Trash2,
  CheckCircle2,
  Eye,
  Camera,
  Activity,
  Box,
  Compass,
  FileDown,
  Upload,
  Check,
  RotateCcw,
  Info,
  Sliders,
  Sparkles,
  Grid,
  Sun,
  AlertTriangle,
  Award,
  BookOpen,
  Filter,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  StandardRegionCode,
  UniformityMetricType,
  GlareMetricType,
  LightingStandardDefinition,
  StandardProfile,
  RoomPhotometricData,
  StandardComplianceReport,
  LIGHTING_STANDARDS,
  BUILTIN_PROFILES,
  duplicateStandardProfile,
  evaluateStandardCompliance,
  crossCompareAllStandards,
  luxToFootcandle,
  footcandleToLux,
} from "@/lib/dialux-standards-engine";

export interface DialuxStandardsStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  onApplyStandardToSimulation?: (standardId: string, profile: StandardProfile) => void;
}

export function DialuxStandardsStudioModal({
  isOpen,
  onClose,
  projectName = "Campus Facility & Multi-Regional Lighting",
  onApplyStandardToSimulation,
}: DialuxStandardsStudioModalProps) {
  // 1. Core State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "viewport" | "standards_library" | "editor" | "cross_comparison" | "assignments"
  >("viewport");

  // Standards & Profiles Repository State
  const [profiles, setProfiles] = useState<StandardProfile[]>(BUILTIN_PROFILES);
  const [activeStandardId, setActiveStandardId] = useState<string>("EN_12464_1");
  const [activeProfileId, setActiveProfileId] = useState<string>("en_office_general");
  const [selectedEditorProfileId, setSelectedEditorProfileId] = useState<string>("en_office_general");

  // Filters for Standards Library Tab
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterEnvironment, setFilterEnvironment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Simulated Room Photometrics Data (e.g. 10m x 8m x 3.2m Office with ceiling downlights)
  const [roomData, setRoomData] = useState<RoomPhotometricData>({
    lengthM: 10.0,
    widthM: 8.0,
    heightM: 3.2,
    calculatedAvgLux: 512,
    calculatedMinLux: 320,
    calculatedMaxLux: 640,
    calculatedUGR: 17.8,
    calculatedGR: 38,
    calculatedCRI: 84,
    calculatedWallAvgLux: 165,
    calculatedCeilingAvgLux: 110,
    calculatedCylindricalEz: 160,
  });

  // Project Spaces Scope Assignments
  const [spaceAssignments, setSpaceAssignments] = useState<
    { id: string; name: string; type: string; assignedProfileId: string }[]
  >([
    { id: "sp_1", name: "Executive Open Office", type: "office", assignedProfileId: "en_office_general" },
    { id: "sp_2", name: "Boardroom & Conference", type: "conference", assignedProfileId: "en_conference_room" },
    { id: "sp_3", name: "Main Corridor Transit", type: "corridor", assignedProfileId: "en_corridor_circulation" },
    { id: "sp_4", name: "Training & Lecture Hall", type: "classroom", assignedProfileId: "en_classroom_education" },
    { id: "sp_5", name: "Visitor Outdoor Parking", type: "parking", assignedProfileId: "en_parking_outdoor" },
  ]);

  // 3D Viewport Toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showFixtures, setShowFixtures] = useState(true);
  const [showGridPoints, setShowGridPoints] = useState(true);
  const [showWalls, setShowWalls] = useState(true);

  // Active Standard & Profile Objects
  const activeStandard = useMemo(() => {
    return LIGHTING_STANDARDS[activeStandardId] || LIGHTING_STANDARDS["EN_12464_1"];
  }, [activeStandardId]);

  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.id === activeProfileId) || profiles[0];
  }, [profiles, activeProfileId]);

  const editorProfile = useMemo(() => {
    return profiles.find((p) => p.id === selectedEditorProfileId) || profiles[0];
  }, [profiles, selectedEditorProfileId]);

  // Live Compliance Report for active profile
  const activeCompliance = useMemo(() => {
    return evaluateStandardCompliance(roomData, activeProfile);
  }, [roomData, activeProfile]);

  // Multi-Standard Comparison across all matching office standards
  const crossComparisonReports = useMemo(() => {
    return crossCompareAllStandards(roomData, "office", profiles);
  }, [roomData, profiles]);

  // 3D Scene Refs
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Helper: Duplicate profile
  const handleDuplicate = (prof: StandardProfile) => {
    const duplicated = duplicateStandardProfile(prof);
    setProfiles((prev) => [duplicated, ...prev]);
    setSelectedEditorProfileId(duplicated.id);
    setActiveProfileId(duplicated.id);
    setActiveTab("editor");
    toast.success(`Duplicated "${prof.name}". You can now customize all parameters.`);
  };

  // Helper: Delete custom profile
  const handleDeleteCustom = (id: string) => {
    const target = profiles.find((p) => p.id === id);
    if (!target) return;
    if (target.isProtected) {
      toast.error("Standard templates are protected and cannot be deleted.");
      return;
    }
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (activeProfileId === id) setActiveProfileId("en_office_general");
    if (selectedEditorProfileId === id) setSelectedEditorProfileId("en_office_general");
    toast.info("Custom profile deleted");
  };

  // Helper: Update profile field
  const handleUpdateEditor = (patch: Partial<StandardProfile>) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === editorProfile.id ? { ...p, ...patch } : p))
    );
  };

  // Helper: Export profiles to JSON
  const handleExportJson = () => {
    const exportData = {
      project: projectName,
      standardControlCenter: "DIALux evo Tutorial Part 26 — Using Different Standards",
      timestamp: new Date().toISOString(),
      profiles,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DIALux_Standards_Library_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported standards library to JSON.");
  };

  // 3D Initialization
  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(12, 14, 16);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.2, 0);
    controlsRef.current = controls;

    // Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(15, 25, 15);
    scene.add(dirLight);

    // Floor Grid
    const grid = new THREE.GridHelper(30, 30, 0x334155, 0x1e293b);
    grid.position.y = -0.01;
    scene.add(grid);

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (rendererRef.current?.domElement) rendererRef.current.dispose();
      container.innerHTML = "";
    };
  }, [isOpen]);

  // Re-render dynamic objects when standard/profile/toggles change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove previous dynamic objects
    const toRemove: any[] = [];
    scene.traverse((obj: any) => {
      if (obj.userData?.isDynamic) toRemove.push(obj);
    });
    toRemove.forEach((obj) => scene.remove(obj));

    const roomL = roomData.lengthM;
    const roomW = roomData.widthM;
    const roomH = roomData.heightM;
    const hOffset = activeProfile.defaultWorkplaneHeightM;

    // 1. Room Box Wireframe
    if (showWalls) {
      const roomGeo = new THREE.BoxGeometry(roomL, roomH, roomW);
      const roomEdges = new THREE.EdgesGeometry(roomGeo);
      const roomLine = new THREE.LineSegments(
        roomEdges,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 })
      );
      roomLine.position.set(0, roomH / 2, 0);
      roomLine.userData = { isDynamic: true };
      scene.add(roomLine);

      // Floor slab
      const floorGeo = new THREE.PlaneGeometry(roomL, roomW);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.7,
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.userData = { isDynamic: true };
      scene.add(floor);
    }

    // 2. Working Plane (Surface with isolux heatmap)
    const wpGeo = new THREE.PlaneGeometry(roomL, roomW);
    const wpColor = activeCompliance.isCompliant ? 0x10b981 : 0xef4444;

    const wpMat = new THREE.MeshStandardMaterial({
      color: wpColor,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const wpMesh = new THREE.Mesh(wpGeo, wpMat);
    wpMesh.rotation.x = -Math.PI / 2;
    wpMesh.position.set(0, hOffset, 0);
    wpMesh.userData = { isDynamic: true };
    scene.add(wpMesh);

    // Working Plane Perimeter Line
    const wpEdges = new THREE.EdgesGeometry(wpGeo);
    const wpLine = new THREE.LineSegments(
      wpEdges,
      new THREE.LineBasicMaterial({ color: wpColor, linewidth: 2 })
    );
    wpLine.rotation.x = -Math.PI / 2;
    wpLine.position.set(0, hOffset + 0.005, 0);
    wpLine.userData = { isDynamic: true };
    scene.add(wpLine);

    // Wall Margin line (Randzone exclusion)
    if (activeProfile.defaultWallMarginM > 0) {
      const margin = activeProfile.defaultWallMarginM;
      const inL = Math.max(0.1, roomL - 2 * margin);
      const inW = Math.max(0.1, roomW - 2 * margin);
      const marginGeo = new THREE.PlaneGeometry(inL, inW);
      const marginEdges = new THREE.EdgesGeometry(marginGeo);
      const marginLine = new THREE.LineSegments(
        marginEdges,
        new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.9 })
      );
      marginLine.rotation.x = -Math.PI / 2;
      marginLine.position.set(0, hOffset + 0.008, 0);
      marginLine.userData = { isDynamic: true };
      scene.add(marginLine);
    }

    // False-Color Isolux Overlay
    if (showHeatmap) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
        if (activeCompliance.isCompliant) {
          grad.addColorStop(0, "rgba(16, 185, 129, 0.45)");
          grad.addColorStop(0.5, "rgba(56, 189, 248, 0.35)");
          grad.addColorStop(1, "rgba(59, 130, 246, 0.2)");
        } else {
          grad.addColorStop(0, "rgba(239, 68, 68, 0.5)");
          grad.addColorStop(0.5, "rgba(245, 158, 11, 0.35)");
          grad.addColorStop(1, "rgba(59, 130, 246, 0.2)");
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);

        const tex = new THREE.CanvasTexture(canvas);
        const heatMat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        });
        const heatMesh = new THREE.Mesh(wpGeo, heatMat);
        heatMesh.rotation.x = -Math.PI / 2;
        heatMesh.position.set(0, hOffset + 0.01, 0);
        heatMesh.userData = { isDynamic: true };
        scene.add(heatMesh);
      }
    }

    // 3. Grid Measurement Points
    if (showGridPoints) {
      const group = new THREE.Group();
      group.userData = { isDynamic: true };
      const cols = 8;
      const rows = 6;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const px = -roomL / 2 + ((c + 0.5) / cols) * roomL;
          const pz = -roomW / 2 + ((r + 0.5) / rows) * roomW;
          const sphereGeo = new THREE.SphereGeometry(0.06, 8, 8);
          const sphereMat = new THREE.MeshBasicMaterial({
            color: activeCompliance.isCompliant ? 0x34d399 : 0xf87171,
          });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          sphere.position.set(px, hOffset + 0.02, pz);
          group.add(sphere);
        }
      }
      scene.add(group);
    }

    // 4. Ceiling Luminaires Array
    if (showFixtures) {
      const fixPositions = [
        [-2.5, roomH, -2.0],
        [2.5, roomH, -2.0],
        [-2.5, roomH, 2.0],
        [2.5, roomH, 2.0],
      ];

      fixPositions.forEach(([fx, fy, fz]) => {
        // Luminaire housing
        const fixGeo = new THREE.BoxGeometry(0.8, 0.08, 0.4);
        const fixMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const fix = new THREE.Mesh(fixGeo, fixMat);
        fix.position.set(fx, fy - 0.04, fz);
        fix.userData = { isDynamic: true };
        scene.add(fix);

        // Light cone
        const coneGeo = new THREE.ConeGeometry(2.2, 2.8, 16, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(fx, fy - 1.4, fz);
        cone.userData = { isDynamic: true };
        scene.add(cone);
      });
    }
  }, [
    activeProfile,
    activeCompliance,
    roomData,
    showHeatmap,
    showFixtures,
    showGridPoints,
    showWalls,
  ]);

  if (!isOpen) return null;

  // Filtered standards profiles for Library tab
  const filteredProfiles = profiles.filter((p) => {
    const std = LIGHTING_STANDARDS[p.standardId];
    if (filterRegion !== "all" && std?.region !== filterRegion) return false;
    if (filterEnvironment !== "all" && p.environment !== filterEnvironment) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.standardId.toLowerCase().includes(q) ||
        p.spaceType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4">
      <div
        className={`bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[96vw] max-w-7xl h-[92vh]"
        }`}
      >
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 via-sky-600 to-emerald-600 rounded-lg shadow-sm text-white">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  DIALux evo Norm Control Centre & Standards
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-950 text-sky-400 border border-sky-700/50">
                  Tutorial Part 26
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-700/50">
                  {activeStandard.shortName}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-Regional Lighting Standards (EN 12464-1/2, IESNA, AS/NZS, CIBSE, JIS), Profile Duplication & Matrix Cross-Check
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-600/80 transition"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center justify-between px-5 py-2 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab("viewport")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "viewport"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              1. 3D Viewport & Standards Heatmap
            </button>

            <button
              onClick={() => setActiveTab("standards_library")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "standards_library"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              2. Norm Control Centre ({profiles.length})
            </button>

            <button
              onClick={() => setActiveTab("editor")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "editor"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              3. Profile Customizer & Duplication
            </button>

            <button
              onClick={() => setActiveTab("cross_comparison")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "cross_comparison"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              4. Multi-Standard Cross-Check
            </button>

            <button
              onClick={() => setActiveTab("assignments")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "assignments"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              5. Project Scope & Overrides
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium border border-slate-700 transition"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export Library
            </button>
            <button
              onClick={() => {
                if (onApplyStandardToSimulation) {
                  onApplyStandardToSimulation(activeStandardId, activeProfile);
                }
                toast.success(`Applied [${activeProfile.name}] as active simulation standard!`);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              Apply to Simulation
            </button>
          </div>
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1 overflow-hidden relative flex">
          {/* TAB 1: 3D VIEWPORT & MULTI-STANDARD HEATMAP */}
          {activeTab === "viewport" && (
            <div className="flex-1 flex flex-col md:flex-row h-full">
              {/* Main 3D Canvas */}
              <div className="flex-1 h-full relative bg-slate-950 flex flex-col">
                <div ref={mountRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

                {/* Quick Standard Switcher Overlay Bar (Top Center) */}
                <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-full px-3 py-1.5 shadow-xl flex items-center gap-2 z-10">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1 pl-1">
                    <Globe2 className="w-3.5 h-3.5 text-sky-400" />
                    Standard:
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { id: "EN_12464_1", profId: "en_office_general", label: "EN 12464-1 (EU)" },
                      { id: "IES_RP_8_RP_1", profId: "ies_office_general", label: "IESNA RP-1 (US)" },
                      { id: "AS_NZS_1680", profId: "asnzs_office_general", label: "AS/NZS 1680 (AU)" },
                      { id: "CIBSE_LG7", profId: "cibse_office_lg7", label: "CIBSE LG7 (UK)" },
                      { id: "JIS_C_7612", profId: "jis_office_class_a", label: "JIS C 7612 (JP)" },
                    ].map((item) => {
                      const isSel = activeStandardId === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveStandardId(item.id);
                            setActiveProfileId(item.profId);
                            toast.info(`Switched design standard to ${item.label}`);
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                            isSel
                              ? "bg-sky-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-white hover:bg-slate-800"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Left 3D Controls HUD */}
                <div className="absolute top-14 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-2.5 shadow-lg flex flex-col gap-2 max-w-xs">
                  <span className="text-[11px] font-bold text-slate-200 border-b border-slate-700 pb-1 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-sky-400" />
                    Viewport Layers
                  </span>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showHeatmap}
                      onChange={(e) => setShowHeatmap(e.target.checked)}
                      className="rounded border-slate-700 text-sky-500 focus:ring-0"
                    />
                    Isolux False-Color Heatmap
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGridPoints}
                      onChange={(e) => setShowGridPoints(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    Grid Calculation Markers
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showFixtures}
                      onChange={(e) => setShowFixtures(e.target.checked)}
                      className="rounded border-slate-700 text-yellow-400 focus:ring-0"
                    />
                    Luminaires & Light Distribution Cones
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showWalls}
                      onChange={(e) => setShowWalls(e.target.checked)}
                      className="rounded border-slate-700 text-cyan-400 focus:ring-0"
                    />
                    Room Boundary Shell
                  </label>
                </div>

                {/* Bottom Status Legend */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-900/85 backdrop-blur-md border border-slate-700 rounded-lg px-4 py-2.5 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-white">Active Profile: {activeProfile.name}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700 font-mono text-[10px]">
                      {activeStandard.currentEdition}
                    </span>
                    <span>
                      Target:{" "}
                      <strong className="text-emerald-400 font-mono">
                        {activeProfile.targetMaintainedLux} lx
                      </strong>{" "}
                      ({luxToFootcandle(activeProfile.targetMaintainedLux)} fc)
                    </span>
                    <span>
                      Calculated Avg:{" "}
                      <strong className="text-white font-mono">{roomData.calculatedAvgLux} lx</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span>
                      Uniformity: <strong className="text-sky-300 font-mono">{activeCompliance.details.actualUniformity}</strong>
                    </span>
                    <span>
                      Glare: <strong className="text-amber-300 font-mono">{activeCompliance.details.actualGlare}</strong>
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        activeCompliance.isCompliant
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-700"
                          : "bg-rose-950 text-rose-400 border border-rose-700"
                      }`}
                    >
                      {activeCompliance.isCompliant ? "COMPLIANT" : "TARGET NOT MET"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Quick Inspector Pane */}
              <div className="w-full md:w-80 bg-slate-800/90 border-l border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Standard Audit Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Live verification against normative thresholds.
                  </p>
                </div>

                {/* Audit Items */}
                <div className="space-y-2">
                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-750 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Maintained Illuminance</span>
                      <span className="text-white font-mono font-bold">
                        {roomData.calculatedAvgLux} lx / req. ≥ {activeProfile.targetMaintainedLux} lx
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        activeCompliance.isLuxMet ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"
                      }`}
                    >
                      {activeCompliance.isLuxMet ? "PASS" : "FAIL"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-750 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Uniformity Ratio</span>
                      <span className="text-white font-mono font-bold">
                        {activeCompliance.details.actualUniformity} / req. {activeCompliance.details.requiredUniformity}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        activeCompliance.isUniformityMet ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"
                      }`}
                    >
                      {activeCompliance.isUniformityMet ? "PASS" : "FAIL"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-750 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Discomfort Glare</span>
                      <span className="text-white font-mono font-bold">
                        {activeCompliance.details.actualGlare} / req. {activeCompliance.details.requiredGlare}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        activeCompliance.isGlareMet ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"
                      }`}
                    >
                      {activeCompliance.isGlareMet ? "PASS" : "FAIL"}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-750 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Color Rendering Index</span>
                      <span className="text-white font-mono font-bold">
                        Ra {roomData.calculatedCRI} / req. ≥ {activeProfile.minCRI}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        activeCompliance.isCRIMet ? "bg-emerald-950 text-emerald-400" : "bg-rose-950 text-rose-400"
                      }`}
                    >
                      {activeCompliance.isCRIMet ? "PASS" : "FAIL"}
                    </span>
                  </div>
                </div>

                {/* Geometry Defaults Card */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-750 text-xs text-slate-300 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Normative Geometry</span>
                  <div className="flex justify-between">
                    <span>Workplane Height:</span>
                    <strong className="text-sky-400 font-mono">{activeProfile.defaultWorkplaneHeightM.toFixed(2)} m</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Wall Margin Zone:</span>
                    <strong className="text-amber-400 font-mono">{activeProfile.defaultWallMarginM.toFixed(2)} m</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Reflectances (C/W/F):</span>
                    <strong className="text-slate-200 font-mono">
                      {Math.round(activeProfile.reflectanceCeiling * 100)}% /{" "}
                      {Math.round(activeProfile.reflectanceWalls * 100)}% /{" "}
                      {Math.round(activeProfile.reflectanceFloor * 100)}%
                    </strong>
                  </div>
                </div>

                {/* Action button: Duplicate */}
                <button
                  onClick={() => handleDuplicate(activeProfile)}
                  className="w-full py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded text-xs font-bold transition shadow flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate & Customize Profile
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: NORM CONTROL CENTRE (LIBRARY) */}
          {activeTab === "standards_library" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              {/* Top Filters & Search */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">Region:</span>
                    <select
                      value={filterRegion}
                      onChange={(e) => setFilterRegion(e.target.value)}
                      className="bg-transparent outline-none text-white cursor-pointer"
                    >
                      <option value="all">All Regions</option>
                      <option value="EU_INT">Europe / Int (EN 12464)</option>
                      <option value="US_NA">North America (IESNA)</option>
                      <option value="AU_NZ">Australia & NZ (AS/NZS)</option>
                      <option value="UK">United Kingdom (CIBSE)</option>
                      <option value="JP">Japan (JIS C 7612)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white">
                    <span className="text-slate-400">Domain:</span>
                    <select
                      value={filterEnvironment}
                      onChange={(e) => setFilterEnvironment(e.target.value)}
                      className="bg-transparent outline-none text-white cursor-pointer"
                    >
                      <option value="all">All Domains</option>
                      <option value="interior">Interior Rooms</option>
                      <option value="exterior">Exterior Grounds</option>
                    </select>
                  </div>
                </div>

                <div className="w-full md:w-72">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search standard or space..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Profiles Table */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-700">
                        <th className="py-3 px-4 font-semibold">Standard & Profile Name</th>
                        <th className="py-3 px-4 font-semibold">Region</th>
                        <th className="py-3 px-4 font-semibold">Domain</th>
                        <th className="py-3 px-4 font-semibold">Target Illuminance</th>
                        <th className="py-3 px-4 font-semibold">Uniformity</th>
                        <th className="py-3 px-4 font-semibold">Glare Limit</th>
                        <th className="py-3 px-4 font-semibold">CRI (Ra)</th>
                        <th className="py-3 px-4 font-semibold">Protection</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 text-slate-300">
                      {filteredProfiles.map((prof) => {
                        const std = LIGHTING_STANDARDS[prof.standardId];
                        const isSelected = prof.id === activeProfileId;

                        return (
                          <tr
                            key={prof.id}
                            onClick={() => {
                              setActiveProfileId(prof.id);
                              setActiveStandardId(prof.standardId);
                            }}
                            className={`cursor-pointer transition ${
                              isSelected
                                ? "bg-sky-950/40 border-l-4 border-sky-500"
                                : "hover:bg-slate-800/50"
                            }`}
                          >
                            <td className="py-3 px-4 font-medium text-white">
                              <div>{prof.name}</div>
                              <span className="text-[10px] text-slate-400">{std?.name}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-700 uppercase">
                                {std?.region}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  prof.environment === "interior"
                                    ? "bg-sky-950 text-sky-400 border border-sky-800"
                                    : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                }`}
                              >
                                {prof.environment}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-white">
                              {prof.targetMaintainedLux} lx{" "}
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({luxToFootcandle(prof.targetMaintainedLux)} fc)
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-sky-300">
                              {prof.uniformityMetric === "U0_MIN_AVG"
                                ? `U0 ≥ ${prof.minUniformityValue}`
                                : `${prof.uniformityMetric} ${prof.minUniformityValue}`}
                            </td>
                            <td className="py-3 px-4 font-mono text-amber-300">
                              {prof.glareMetric} ≤ {prof.maxGlareValue}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">≥ {prof.minCRI}</td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  prof.isProtected
                                    ? "bg-slate-900 text-slate-400 border border-slate-700"
                                    : "bg-emerald-950 text-emerald-400 border border-emerald-700"
                                }`}
                              >
                                {prof.isProtected ? "Protected Standard" : "Custom Editable"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicate(prof);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition"
                                  title="Duplicate Profile"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                {!prof.isProtected && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCustom(prof.id);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition"
                                    title="Delete Custom Profile"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM PROFILE EDITOR */}
          {activeTab === "editor" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-sky-400" />
                    Custom Profile Editor & Duplication Rules
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Official DIALux standards templates are protected to ensure regulatory audit integrity.
                    When modifying values, duplicate a template to create a custom profile for your firm or project.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedEditorProfileId}
                    onChange={(e) => setSelectedEditorProfileId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.isProtected ? "[Protected] " : "[Custom] "}
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {editorProfile.isProtected && (
                    <button
                      onClick={() => handleDuplicate(editorProfile)}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Make Editable Copy
                    </button>
                  )}
                </div>
              </div>

              {/* Editor Form */}
              <div
                className={`bg-slate-800 border rounded-xl p-5 flex flex-col gap-5 ${
                  editorProfile.isProtected ? "border-slate-700 opacity-80" : "border-sky-500/50"
                }`}
              >
                {editorProfile.isProtected && (
                  <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      This profile is a protected built-in standard. Click <strong>Make Editable Copy</strong> to modify targets.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Profile Title
                    </label>
                    <input
                      type="text"
                      disabled={editorProfile.isProtected}
                      value={editorProfile.name}
                      onChange={(e) => handleUpdateEditor({ name: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white disabled:bg-slate-950 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Governing Standard
                    </label>
                    <select
                      disabled={editorProfile.isProtected}
                      value={editorProfile.standardId}
                      onChange={(e) => handleUpdateEditor({ standardId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white disabled:bg-slate-950 disabled:text-slate-500"
                    >
                      {Object.values(LIGHTING_STANDARDS).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shortName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Target Maintained Illuminance (Lux)
                    </label>
                    <input
                      type="number"
                      disabled={editorProfile.isProtected}
                      value={editorProfile.targetMaintainedLux}
                      onChange={(e) => handleUpdateEditor({ targetMaintainedLux: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white disabled:bg-slate-950 disabled:text-slate-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Equivalent: {luxToFootcandle(editorProfile.targetMaintainedLux)} footcandles (fc)
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Uniformity Metric & Threshold
                    </label>
                    <div className="flex gap-2">
                      <select
                        disabled={editorProfile.isProtected}
                        value={editorProfile.uniformityMetric}
                        onChange={(e) => handleUpdateEditor({ uniformityMetric: e.target.value as UniformityMetricType })}
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white disabled:bg-slate-950 disabled:text-slate-500"
                      >
                        <option value="U0_MIN_AVG">U0 (Emin/Eavg)</option>
                        <option value="AVG_MIN">Avg/Min (IES)</option>
                        <option value="MAX_MIN">Max/Min</option>
                        <option value="U1_MIN_MAX">U1 (Emin/Emax)</option>
                      </select>
                      <input
                        type="number"
                        step="0.05"
                        disabled={editorProfile.isProtected}
                        value={editorProfile.minUniformityValue}
                        onChange={(e) => handleUpdateEditor({ minUniformityValue: parseFloat(e.target.value) || 0 })}
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white disabled:bg-slate-950 disabled:text-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Glare Metric & Maximum Limit
                    </label>
                    <div className="flex gap-2">
                      <select
                        disabled={editorProfile.isProtected}
                        value={editorProfile.glareMetric}
                        onChange={(e) => handleUpdateEditor({ glareMetric: e.target.value as GlareMetricType })}
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white disabled:bg-slate-950 disabled:text-slate-500"
                      >
                        <option value="UGR">UGR Limit</option>
                        <option value="GR">GR Limit</option>
                        <option value="VCP">VCP % (IES)</option>
                      </select>
                      <input
                        type="number"
                        disabled={editorProfile.isProtected}
                        value={editorProfile.maxGlareValue}
                        onChange={(e) => handleUpdateEditor({ maxGlareValue: parseFloat(e.target.value) || 0 })}
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white disabled:bg-slate-950 disabled:text-slate-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Workplane Height Offset (h)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      disabled={editorProfile.isProtected}
                      value={editorProfile.defaultWorkplaneHeightM}
                      onChange={(e) => handleUpdateEditor({ defaultWorkplaneHeightM: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white disabled:bg-slate-950 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Wall Margin Zone (Randzone)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      disabled={editorProfile.isProtected}
                      value={editorProfile.defaultWallMarginM}
                      onChange={(e) => handleUpdateEditor({ defaultWallMarginM: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white disabled:bg-slate-950 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Minimum Color Rendering (Ra)
                    </label>
                    <input
                      type="number"
                      disabled={editorProfile.isProtected}
                      value={editorProfile.minCRI}
                      onChange={(e) => handleUpdateEditor({ minCRI: parseInt(e.target.value) || 20 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white disabled:bg-slate-950 disabled:text-slate-500"
                    />
                  </div>
                </div>

                {!editorProfile.isProtected && (
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
                    <button
                      onClick={() => {
                        toast.success(`Saved modifications to custom profile "${editorProfile.name}"`);
                      }}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition shadow"
                    >
                      Save Custom Profile
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MULTI-STANDARD CROSS-CHECK MATRIX */}
          {activeTab === "cross_comparison" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  Multi-Standard Compliance Matrix (Cross-Region Comparison)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Evaluates the identical space layout and calculation surfaces against European (EN), North American (IESNA), Australian (AS/NZS), British (CIBSE), and Japanese (JIS) standards simultaneously.
                </p>
              </div>

              {/* Matrix Table */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-700">
                        <th className="py-3 px-4 font-semibold">Standard Reference</th>
                        <th className="py-3 px-4 font-semibold">Region</th>
                        <th className="py-3 px-4 font-semibold">Target Em</th>
                        <th className="py-3 px-4 font-semibold">Actual Avg</th>
                        <th className="py-3 px-4 font-semibold">Required Uniformity</th>
                        <th className="py-3 px-4 font-semibold">Actual Uniformity</th>
                        <th className="py-3 px-4 font-semibold">Glare Limit</th>
                        <th className="py-3 px-4 font-semibold">Actual Glare</th>
                        <th className="py-3 px-4 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 text-slate-300">
                      {crossComparisonReports.map((rep) => {
                        return (
                          <tr key={rep.profileId} className="hover:bg-slate-800/50">
                            <td className="py-3 px-4 font-medium text-white">
                              {rep.profileName}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-700">
                                {rep.standardId}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-200">
                              {rep.details.targetLux} lx
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                              {rep.details.actualLux} lx
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-400">
                              {rep.details.requiredUniformity}
                            </td>
                            <td className="py-3 px-4 font-mono text-white">
                              {rep.details.actualUniformity}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-400">
                              {rep.details.requiredGlare}
                            </td>
                            <td className="py-3 px-4 font-mono text-amber-300">
                              {rep.details.actualGlare}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  rep.isCompliant
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-700"
                                    : "bg-rose-950 text-rose-400 border border-rose-700"
                                }`}
                              >
                                {rep.isCompliant ? "PASS" : "FAIL"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Informational callout */}
              <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Info className="w-4 h-4 text-sky-400" />
                  Key Observations on Regional Standards:
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                  <li>
                    <strong>EN 12464-1 vs IESNA RP-1:</strong> EN 12464 targets 500 lx with minimum uniformity U0 (min/avg), while North American practice specifies footcandles (40 fc ≈ 430 lx) and limits the Avg/Min ratio.
                  </li>
                  <li>
                    <strong>CIBSE SLL LG7:</strong> Requires room surface balance with dedicated wall (≥ 175 lx) and ceiling (≥ 125 lx) illuminance criteria for occupant circadian stimulation and visual comfort.
                  </li>
                  <li>
                    <strong>JIS C 7612:</strong> Japanese Class A industrial standard sets higher illuminance requirements (750 lx) for detailed electronic documentation and high-precision inspection.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 5: PROJECT SCOPE & SPACE ASSIGNMENTS */}
          {activeTab === "assignments" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-sky-400" />
                    Project-Wide Standard vs Space Overrides
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Set a global governing standard for the entire facility or override individual rooms with specific profiles.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSpaceAssignments((prev) =>
                        prev.map((s) => ({ ...s, assignedProfileId: activeProfileId }))
                      );
                      toast.success(`Applied [${activeProfile.name}] across all project spaces!`);
                    }}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold transition shadow"
                  >
                    Apply Active Standard to All Spaces
                  </button>
                </div>
              </div>

              {/* Spaces List Table */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-700">
                        <th className="py-3 px-4 font-semibold">Space Name</th>
                        <th className="py-3 px-4 font-semibold">Room Type</th>
                        <th className="py-3 px-4 font-semibold">Assigned Standard Profile</th>
                        <th className="py-3 px-4 font-semibold">Target Illuminance</th>
                        <th className="py-3 px-4 font-semibold">Uniformity</th>
                        <th className="py-3 px-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 text-slate-300">
                      {spaceAssignments.map((sp) => {
                        const prof = profiles.find((p) => p.id === sp.assignedProfileId) || profiles[0];

                        return (
                          <tr key={sp.id} className="hover:bg-slate-800/50">
                            <td className="py-3 px-4 font-medium text-white">{sp.name}</td>
                            <td className="py-3 px-4 uppercase text-[10px] text-slate-400 font-mono">
                              {sp.type}
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={sp.assignedProfileId}
                                onChange={(e) => {
                                  const newProfId = e.target.value;
                                  setSpaceAssignments((prev) =>
                                    prev.map((s) => (s.id === sp.id ? { ...s, assignedProfileId: newProfId } : s))
                                  );
                                  toast.info(`Updated standard for ${sp.name}`);
                                }}
                                className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                              >
                                {profiles.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-white">
                              {prof.targetMaintainedLux} lx
                            </td>
                            <td className="py-3 px-4 font-mono text-sky-300">
                              {prof.uniformityMetric} {prof.minUniformityValue}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  setActiveProfileId(prof.id);
                                  setActiveStandardId(prof.standardId);
                                  setActiveTab("viewport");
                                }}
                                className="text-sky-400 hover:underline font-semibold text-[11px]"
                              >
                                View 3D →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER BAR */}
        <div className="px-5 py-2.5 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>DIALux evo Official Tutorial 26 Engine Active</span>
            <span className="text-slate-600">|</span>
            <span>Active Standard: <strong className="text-white">{activeStandard.name}</strong></span>
            <span className="text-slate-600">|</span>
            <span>Total Profiles: {profiles.length}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setProfiles(BUILTIN_PROFILES);
                setActiveStandardId("EN_12464_1");
                setActiveProfileId("en_office_general");
                toast.info("Reset standards library to official defaults");
              }}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition cursor-pointer"
            >
              Close Studio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
