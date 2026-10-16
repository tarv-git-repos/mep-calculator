import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Layers,
  Building2,
  Plus,
  Trash2,
  CheckCircle2,
  Eye,
  Camera,
  Activity,
  Box,
  Compass,
  FileDown,
  Check,
  RotateCcw,
  Info,
  Shield,
  Sliders,
  Sparkles,
  Grid,
  Sun,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  Split,
  TreePine,
  Car,
  Truck,
  Footprints,
} from "lucide-react";
import { toast } from "sonner";
import {
  WorkplaneEnvironmentType,
  WorkplaneGeometryType,
  CalculationMetricType,
  WorkplaneProfile,
  WORKPLANE_PROFILES,
  WorkplanePoint,
  WorkplaneItem,
  WorkplaneCalculationResult,
  calculateEN12464GridStep,
  solveWorkplanePhotometrics,
  DEFAULT_WORKPLANES,
} from "@/lib/dialux-workplane-engine";

export interface DialuxWorkplaneStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  onApplyToSimulation?: (workplanes: WorkplaneItem[]) => void;
}

export function DialuxWorkplaneStudioModal({
  isOpen,
  onClose,
  projectName = "Campus Facility & Interior Lighting",
  onApplyToSimulation,
}: DialuxWorkplaneStudioModalProps) {
  // 1. Core State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "viewport" | "manager" | "profiles" | "grid_margin" | "compliance"
  >("viewport");

  // Project Settings & Workplane Items
  const [autoCreateInterior, setAutoCreateInterior] = useState(true);
  const [workplanes, setWorkplanes] = useState<WorkplaneItem[]>(DEFAULT_WORKPLANES);
  const [selectedId, setSelectedId] = useState<string>("wp_int_office");

  // 3D Visualizer Toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMarginBorder, setShowMarginBorder] = useState(true);
  const [showGridPoints, setShowGridPoints] = useState(true);
  const [showRoomWireframe, setShowRoomWireframe] = useState(true);
  const [showFixtures, setShowFixtures] = useState(true);

  // New Workplane Modal/Form State
  const [isAddingWorkplane, setIsAddingWorkplane] = useState(false);
  const [newWpName, setNewWpName] = useState("Exterior Expansion Zone");
  const [newWpEnv, setNewWpEnv] = useState<WorkplaneEnvironmentType>("exterior");
  const [newWpProfile, setNewWpProfile] = useState<string>("parking_busy");
  const [newWpWidth, setNewWpWidth] = useState(10.0);
  const [newWpLength, setNewWpLength] = useState(12.0);
  const [newWpHeight, setNewWpHeight] = useState(0.0);

  // Current Selected Workplane
  const activeWorkplane = useMemo(() => {
    return workplanes.find((w) => w.id === selectedId) || workplanes[0];
  }, [workplanes, selectedId]);

  // Photometric Calculation Results for all Workplanes
  const calculationResults = useMemo(() => {
    const map: Record<string, WorkplaneCalculationResult> = {};
    for (const wp of workplanes) {
      if (wp.isEnabled) {
        map[wp.id] = solveWorkplanePhotometrics(wp);
      }
    }
    return map;
  }, [workplanes]);

  const activeResult = calculationResults[activeWorkplane.id] || solveWorkplanePhotometrics(activeWorkplane);
  const activeProfile = WORKPLANE_PROFILES[activeWorkplane.profileId] || WORKPLANE_PROFILES["office_general"];

  // 3D Scene Refs
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Helper: update active workplane fields
  const handleUpdateActive = (patch: Partial<WorkplaneItem>) => {
    setWorkplanes((prev) =>
      prev.map((wp) => (wp.id === activeWorkplane.id ? { ...wp, ...patch } : wp))
    );
  };

  // Preset camera positions
  const setCameraView = (type: "campus" | "office" | "corridor" | "parking" | "plaza" | "dock") => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    switch (type) {
      case "campus":
        cam.position.set(20, 24, 25);
        ctrl.target.set(3, 1, 3);
        break;
      case "office":
        cam.position.set(5, 12, 16);
        ctrl.target.set(5, 0.8, 4);
        break;
      case "corridor":
        cam.position.set(5, 6, 4);
        ctrl.target.set(5, 0, -1.5);
        break;
      case "parking":
        cam.position.set(-8, 16, 22);
        ctrl.target.set(-8, 0, 6);
        break;
      case "plaza":
        cam.position.set(-4, 10, 8);
        ctrl.target.set(-4, 0, -2);
        break;
      case "dock":
        cam.position.set(16, 10, 14);
        ctrl.target.set(14, 1, 4);
        break;
    }
    ctrl.update();
  };

  // Three.js Mount & Render
  useEffect(() => {
    if (!isOpen || !mountRef.current) return;

    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // dark slate 900
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(18, 22, 24);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // allow slight under-view
    controls.target.set(3, 1, 3);
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Ground Grid & Exterior Terrain
    const gridHelper = new THREE.GridHelper(60, 60, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // Site boundary plane
    const siteGeo = new THREE.PlaneGeometry(60, 60);
    const siteMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.9,
    });
    const siteMesh = new THREE.Mesh(siteGeo, siteMat);
    siteMesh.rotation.x = -Math.PI / 2;
    siteMesh.position.y = -0.02;
    scene.add(siteMesh);

    // Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle Resize
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
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.dispose();
      }
      container.innerHTML = "";
    };
  }, [isOpen]);

  // Re-build 3D objects when workplanes or display flags change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing dynamic objects (tag with isDynamic)
    const toRemove: any[] = [];
    scene.traverse((obj: any) => {
      if (obj.userData?.isDynamic) {
        toRemove.push(obj);
      }
    });
    toRemove.forEach((obj) => {
      scene.remove(obj);
      if ((obj as any).geometry) (obj as any).geometry.dispose();
      if ((obj as any).material) {
        if (Array.isArray((obj as any).material)) {
          (obj as any).material.forEach((m: any) => m.dispose());
        } else {
          (obj as any).material.dispose();
        }
      }
    });

    // 1. BUILD INTERIOR BUILDING SHELL (Office & Corridor Room)
    if (showRoomWireframe) {
      // Office Room Wireframe Box (10m x 8m x 3.2m at (5, 4))
      const officeGeo = new THREE.BoxGeometry(10.0, 3.2, 8.0);
      const officeEdges = new THREE.EdgesGeometry(officeGeo);
      const officeWire = new THREE.LineSegments(
        officeEdges,
        new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 })
      );
      officeWire.position.set(5.0, 1.6, 4.0);
      officeWire.userData = { isDynamic: true };
      scene.add(officeWire);

      // Office Floor Slab
      const offFloorGeo = new THREE.PlaneGeometry(10.0, 8.0);
      const offFloorMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.6,
      });
      const offFloor = new THREE.Mesh(offFloorGeo, offFloorMat);
      offFloor.rotation.x = -Math.PI / 2;
      offFloor.position.set(5.0, 0.0, 4.0);
      offFloor.userData = { isDynamic: true };
      scene.add(offFloor);

      // Corridor Wireframe Box (10m x 2.2m x 3.2m at (5, -1.5))
      const corrGeo = new THREE.BoxGeometry(10.0, 3.2, 2.2);
      const corrEdges = new THREE.EdgesGeometry(corrGeo);
      const corrWire = new THREE.LineSegments(
        corrEdges,
        new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.4 })
      );
      corrWire.position.set(5.0, 1.6, -1.5);
      corrWire.userData = { isDynamic: true };
      scene.add(corrWire);

      // Building Wall Partition between Office & Corridor
      const wallGeo = new THREE.BoxGeometry(10.0, 3.2, 0.2);
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        transparent: true,
        opacity: 0.35,
      });
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(5.0, 1.6, 0.0);
      wallMesh.userData = { isDynamic: true };
      scene.add(wallMesh);
    }

    // 2. BUILD LOADING DOCK ELEVATED PLATFORM (14m, 4m)
    const dockGeo = new THREE.BoxGeometry(8.0, 1.0, 6.0);
    const dockMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.8,
    });
    const dockMesh = new THREE.Mesh(dockGeo, dockMat);
    dockMesh.position.set(14.0, 0.5, 4.0);
    dockMesh.userData = { isDynamic: true };
    scene.add(dockMesh);

    // Dock ramp slope
    const rampGeo = new THREE.BoxGeometry(4.0, 0.2, 6.0);
    const rampMesh = new THREE.Mesh(rampGeo, dockMat);
    rampMesh.rotation.z = 0.25;
    rampMesh.position.set(8.2, 0.5, 4.0);
    rampMesh.userData = { isDynamic: true };
    scene.add(rampMesh);

    // 3. BUILD ALL WORKPLANES
    for (const wp of workplanes) {
      if (!wp.isEnabled) continue;

      const isSelected = wp.id === selectedId;
      const res = calculationResults[wp.id] || solveWorkplanePhotometrics(wp);
      const elevZ = wp.position.z + wp.heightOffsetM;

      // Workplane Surface Mesh
      const wpGeo = new THREE.PlaneGeometry(wp.lengthM, wp.widthM);
      const baseMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(wp.colorHex),
        transparent: true,
        opacity: isSelected ? 0.38 : 0.22,
        side: THREE.DoubleSide,
      });
      const wpMesh = new THREE.Mesh(wpGeo, baseMat);
      wpMesh.rotation.x = -Math.PI / 2;
      wpMesh.position.set(wp.position.x, elevZ, wp.position.y);
      wpMesh.userData = { isDynamic: true };
      scene.add(wpMesh);

      // Workplane Perimeter Line
      const perimeterGeo = new THREE.EdgesGeometry(wpGeo);
      const perimeterLine = new THREE.LineSegments(
        perimeterGeo,
        new THREE.LineBasicMaterial({
          color: isSelected ? 0x38bdf8 : new THREE.Color(wp.colorHex),
          linewidth: isSelected ? 3 : 1,
        })
      );
      perimeterLine.rotation.x = -Math.PI / 2;
      perimeterLine.position.set(wp.position.x, elevZ + 0.005, wp.position.y);
      perimeterLine.userData = { isDynamic: true };
      scene.add(perimeterLine);

      // Wall Margin Border Line (Randzone exclusion boundary)
      if (showMarginBorder && wp.wallMarginM > 0) {
        const innerLen = Math.max(0.1, wp.lengthM - 2 * wp.wallMarginM);
        const innerWid = Math.max(0.1, wp.widthM - 2 * wp.wallMarginM);
        const marginGeo = new THREE.PlaneGeometry(innerLen, innerWid);
        const marginEdges = new THREE.EdgesGeometry(marginGeo);
        const marginLine = new THREE.LineSegments(
          marginEdges,
          new THREE.LineBasicMaterial({
            color: 0xf59e0b, // amber exclusion boundary
            transparent: true,
            opacity: 0.9,
          })
        );
        marginLine.rotation.x = -Math.PI / 2;
        marginLine.position.set(wp.position.x, elevZ + 0.008, wp.position.y);
        marginLine.userData = { isDynamic: true };
        scene.add(marginLine);
      }

      // Height Stand Columns for elevated workplanes
      if (wp.heightOffsetM > 0.05) {
        const corners = [
          [-wp.lengthM / 2, -wp.widthM / 2],
          [wp.lengthM / 2, -wp.widthM / 2],
          [wp.lengthM / 2, wp.widthM / 2],
          [-wp.lengthM / 2, wp.widthM / 2],
        ];
        corners.forEach(([cx, cy]) => {
          const colGeo = new THREE.CylinderGeometry(0.04, 0.04, wp.heightOffsetM, 8);
          const colMat = new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.5 });
          const col = new THREE.Mesh(colGeo, colMat);
          col.position.set(wp.position.x + cx, wp.heightOffsetM / 2, wp.position.y + cy);
          col.userData = { isDynamic: true };
          scene.add(col);
        });
      }

      // Grid Calculation Points with False-Color Isolux Heatmap
      if (showGridPoints && res.gridPoints && res.gridPoints.length > 0) {
        const pointGroup = new THREE.Group();
        pointGroup.userData = { isDynamic: true };

        res.gridPoints.forEach((pt) => {
          // Point marker geometry
          const dotGeo = new THREE.SphereGeometry(isSelected ? 0.06 : 0.045, 8, 8);

          // Color scale: Blue (<50 lx) -> Cyan (50-200) -> Green (200-400) -> Yellow (400-600) -> Red (>600 lx)
          let dotColor = new THREE.Color(0x3b82f6);
          if (!pt.isInsideMargin) {
            dotColor = new THREE.Color(0x64748b); // greyed out wall margin zone
          } else if (pt.lux >= 600) {
            dotColor = new THREE.Color(0xef4444); // red
          } else if (pt.lux >= 450) {
            dotColor = new THREE.Color(0xf59e0b); // amber/yellow
          } else if (pt.lux >= 250) {
            dotColor = new THREE.Color(0x10b981); // green
          } else if (pt.lux >= 75) {
            dotColor = new THREE.Color(0x06b6d4); // cyan
          }

          const dotMat = new THREE.MeshBasicMaterial({
            color: dotColor,
            transparent: true,
            opacity: pt.isInsideMargin ? 0.95 : 0.35,
          });
          const dotMesh = new THREE.Mesh(dotGeo, dotMat);
          dotMesh.position.set(pt.x, pt.z + 0.015, pt.y);
          pointGroup.add(dotMesh);
        });
        scene.add(pointGroup);
      }

      // False-color gradient surface overlay
      if (showHeatmap && isSelected) {
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const grad = ctx.createRadialGradient(64, 64, 5, 64, 64, 60);
          grad.addColorStop(0, "rgba(239, 68, 68, 0.45)"); // center high lux
          grad.addColorStop(0.4, "rgba(245, 158, 11, 0.35)");
          grad.addColorStop(0.7, "rgba(16, 185, 129, 0.25)");
          grad.addColorStop(1, "rgba(59, 130, 246, 0.15)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 128, 128);

          const tex = new THREE.CanvasTexture(canvas);
          const heatMat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
          });
          const heatPlane = new THREE.Mesh(wpGeo, heatMat);
          heatPlane.rotation.x = -Math.PI / 2;
          heatPlane.position.set(wp.position.x, elevZ + 0.01, wp.position.y);
          heatPlane.userData = { isDynamic: true };
          scene.add(heatPlane);
        }
      }
    }

    // 4. LIGHT FIXTURES & CONES
    if (showFixtures) {
      // Office ceiling downlights array (at y = 3.0)
      const officeLights = [
        [3.0, 3.0, 2.0],
        [7.0, 3.0, 2.0],
        [3.0, 3.0, 6.0],
        [7.0, 3.0, 6.0],
      ];
      officeLights.forEach(([lx, ly, lz]) => {
        const fixGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16);
        const fixMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const fix = new THREE.Mesh(fixGeo, fixMat);
        fix.position.set(lx, ly, lz);
        fix.userData = { isDynamic: true };
        scene.add(fix);

        // Light cone
        const coneGeo = new THREE.ConeGeometry(1.6, 2.2, 16, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xfef08a,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(lx, ly - 1.1, lz);
        cone.userData = { isDynamic: true };
        scene.add(cone);
      });

      // Exterior parking floodlight poles
      const parkingPoles = [
        [-13.0, 0, 12.0],
        [-3.0, 0, 12.0],
      ];
      parkingPoles.forEach(([px, py, pz]) => {
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 6.0, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(px, 3.0, pz);
        pole.userData = { isDynamic: true };
        scene.add(pole);

        // Luminaire head
        const headGeo = new THREE.BoxGeometry(0.5, 0.2, 0.8);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
        const head = new THREE.Mesh(headGeo, headMat);
        head.rotation.x = 0.3;
        head.position.set(px, 6.0, pz);
        head.userData = { isDynamic: true };
        scene.add(head);

        // Broad light cone
        const broadConeGeo = new THREE.ConeGeometry(5.5, 6.0, 16, 1, true);
        const broadConeMat = new THREE.MeshBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
        });
        const cone = new THREE.Mesh(broadConeGeo, broadConeMat);
        cone.position.set(px, 3.0, pz - 1.0);
        cone.userData = { isDynamic: true };
        scene.add(cone);
      });
    }
  }, [
    workplanes,
    selectedId,
    showHeatmap,
    showMarginBorder,
    showGridPoints,
    showRoomWireframe,
    showFixtures,
    calculationResults,
  ]);

  if (!isOpen) return null;

  // Add workplane handler
  const handleCreateWorkplane = () => {
    const newId = `wp_${newWpEnv}_${Date.now()}`;
    const prof = WORKPLANE_PROFILES[newWpProfile];
    const defaultColor =
      newWpEnv === "interior" ? "#38bdf8" : "#10b981";

    const item: WorkplaneItem = {
      id: newId,
      name: newWpName,
      environment: newWpEnv,
      geometryType: "rectangular",
      profileId: newWpProfile,
      position: {
        x: newWpEnv === "interior" ? 5.0 : -6.0,
        y: newWpEnv === "interior" ? 4.0 : 4.0,
        z: 0.0,
      },
      widthM: newWpWidth,
      lengthM: newWpLength,
      heightOffsetM: newWpHeight,
      wallMarginM: prof ? prof.defaultMarginM : 0.0,
      gridStepM: calculateEN12464GridStep(Math.max(newWpWidth, newWpLength)),
      calculationMetric: "horizontal_eh",
      isEnabled: true,
      colorHex: defaultColor,
    };

    setWorkplanes((prev) => [...prev, item]);
    setSelectedId(newId);
    setIsAddingWorkplane(false);
    toast.success(`Created ${newWpEnv} workplane "${newWpName}"`);
  };

  // Delete workplane
  const handleDeleteWorkplane = (id: string) => {
    if (workplanes.length <= 1) {
      toast.error("At least one workplane must remain active.");
      return;
    }
    setWorkplanes((prev) => prev.filter((w) => w.id !== id));
    if (selectedId === id) {
      const remaining = workplanes.filter((w) => w.id !== id);
      setSelectedId(remaining[0].id);
    }
    toast.info("Workplane deleted");
  };

  // Export full calculation report
  const handleExportJson = () => {
    const reportData = {
      project: projectName,
      tutorial: "DIALux evo Tutorial Part 25 — Managing interior and exterior workplanes",
      timestamp: new Date().toISOString(),
      standards: ["EN 12464-1 (Indoor)", "EN 12464-2 (Outdoor)"],
      autoCreateInteriorRooms: autoCreateInterior,
      workplanes: workplanes.map((wp) => {
        const res = calculationResults[wp.id] || solveWorkplanePhotometrics(wp);
        const prof = WORKPLANE_PROFILES[wp.profileId];
        return {
          id: wp.id,
          name: wp.name,
          environment: wp.environment,
          profile: prof?.name,
          dimensions: `${wp.lengthM}m x ${wp.widthM}m`,
          heightOffsetM: `${wp.heightOffsetM}m`,
          wallMarginM: `${wp.wallMarginM}m`,
          targetLux: prof?.targetMaintainedLux,
          averageLux: res.averageLux,
          minLux: res.minLux,
          uniformityU0: res.uniformityU0,
          targetUniformityU0: prof?.minUniformityU0,
          compliance: res.isCompliant ? "PASS" : "FAIL",
        };
      }),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DIALux_Workplane_Report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workplane photometric report exported successfully.");
  };

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
            <div className="p-2 bg-gradient-to-br from-sky-500 to-emerald-600 rounded-lg shadow-sm text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  DIALux evo Workplane Management Studio
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-950 text-sky-400 border border-sky-700/50">
                  Tutorial Part 25
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-700/50">
                  EN 12464-1 & EN 12464-2
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Interior Working Planes (Desk 0.80m / Margin 0.50m) & Exterior Assessment Zones (Parking, Walkways, Docks)
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
              1. 3D Viewport & Heatmap
            </button>

            <button
              onClick={() => setActiveTab("manager")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "manager"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              2. Workplane Manager ({workplanes.length})
            </button>

            <button
              onClick={() => setActiveTab("profiles")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "profiles"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              3. EN 12464 Profiles & Targets
            </button>

            <button
              onClick={() => setActiveTab("grid_margin")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "grid_margin"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              4. Grid & Margin (Randzone)
            </button>

            <button
              onClick={() => setActiveTab("compliance")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                activeTab === "compliance"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              5. Photometric Summary & Audit
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium border border-slate-700 transition"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export Report
            </button>
            <button
              onClick={() => {
                if (onApplyToSimulation) {
                  onApplyToSimulation(workplanes);
                }
                toast.success("Applied workplane configuration to project workspace!");
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
          {/* TAB 1: 3D VIEWPORT & HEATMAP */}
          {activeTab === "viewport" && (
            <div className="flex-1 flex flex-col md:flex-row h-full">
              {/* Left / Main 3D Canvas */}
              <div className="flex-1 h-full relative bg-slate-950 flex flex-col">
                <div ref={mountRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />

                {/* Overlay 3D Controls HUD */}
                <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-2.5 shadow-lg flex flex-col gap-2 max-w-xs">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                    <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-sky-400" />
                      Camera Presets
                    </span>
                    <span className="text-[10px] text-slate-400">Click to focus</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <button
                      onClick={() => setCameraView("campus")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 text-left truncate transition"
                    >
                      Campus Overview
                    </button>
                    <button
                      onClick={() => setCameraView("office")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sky-300 text-left truncate transition"
                    >
                      Interior Office
                    </button>
                    <button
                      onClick={() => setCameraView("corridor")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-purple-300 text-left truncate transition"
                    >
                      Corridor Floor
                    </button>
                    <button
                      onClick={() => setCameraView("parking")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-emerald-300 text-left truncate transition"
                    >
                      Outdoor Parking
                    </button>
                    <button
                      onClick={() => setCameraView("plaza")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-amber-300 text-left truncate transition"
                    >
                      Entrance Plaza
                    </button>
                    <button
                      onClick={() => setCameraView("dock")}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-rose-300 text-left truncate transition"
                    >
                      Loading Bay Dock
                    </button>
                  </div>

                  <div className="border-t border-slate-700 pt-1.5 flex flex-col gap-1 text-[11px]">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showHeatmap}
                        onChange={(e) => setShowHeatmap(e.target.checked)}
                        className="rounded border-slate-700 text-sky-500 focus:ring-0"
                      />
                      Isolux Heatmap Overlay
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showMarginBorder}
                        onChange={(e) => setShowMarginBorder(e.target.checked)}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0"
                      />
                      Wall Margin Zone (Randzone)
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showGridPoints}
                        onChange={(e) => setShowGridPoints(e.target.checked)}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      Grid Measurement Points
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showRoomWireframe}
                        onChange={(e) => setShowRoomWireframe(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      Architectural Walls & Rooms
                    </label>
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showFixtures}
                        onChange={(e) => setShowFixtures(e.target.checked)}
                        className="rounded border-slate-700 text-yellow-400 focus:ring-0"
                      />
                      Luminaires & Light Cones
                    </label>
                  </div>
                </div>

                {/* Bottom Status Legend */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-900/85 backdrop-blur-md border border-slate-700 rounded-lg px-4 py-2 flex items-center justify-between text-xs text-slate-300 pointer-events-none">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-white">Active Plane: {activeWorkplane.name}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase font-mono text-[10px]">
                      {activeWorkplane.environment}
                    </span>
                    <span>
                      Height: <strong className="text-sky-400">{activeWorkplane.heightOffsetM.toFixed(2)}m</strong>
                    </span>
                    <span>
                      Wall Margin: <strong className="text-amber-400">{activeWorkplane.wallMarginM.toFixed(2)}m</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      Avg: <strong className="text-white">{activeResult.averageLux} lx</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span>
                      Uniformity U0: <strong className="text-white">{activeResult.uniformityU0.toFixed(2)}</strong>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        activeResult.isCompliant
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-700"
                          : "bg-rose-950 text-rose-400 border border-rose-700"
                      }`}
                    >
                      {activeResult.isCompliant ? "EN COMPLIANT" : "TARGET NOT MET"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Quick Settings Inspector Pane */}
              <div className="w-full md:w-80 bg-slate-800/90 border-l border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-sky-400" />
                    Live Plane Inspector
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Adjust dimensions and parameters in real time.
                  </p>
                </div>

                {/* Plane Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Select Workplane
                  </label>
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    {workplanes.map((wp) => (
                      <option key={wp.id} value={wp.id}>
                        [{wp.environment.toUpperCase()}] {wp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Height Offset Slider */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-750 flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-200">Height Offset (h)</span>
                    <span className="font-mono text-sky-400 font-bold">
                      {activeWorkplane.heightOffsetM.toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="2.5"
                    step="0.05"
                    value={activeWorkplane.heightOffsetM}
                    onChange={(e) => handleUpdateActive({ heightOffsetM: parseFloat(e.target.value) })}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0.00m (Floor)</span>
                    <span>0.80m (Desk)</span>
                    <span>2.50m (Ceiling)</span>
                  </div>
                </div>

                {/* Wall Margin Zone (Randzone) */}
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-750 flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-200">Wall Margin (Randzone)</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {activeWorkplane.wallMarginM.toFixed(2)} m
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={activeWorkplane.wallMarginM}
                    onChange={(e) => handleUpdateActive({ wallMarginM: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0.00m (Edge)</span>
                    <span>0.50m (EN 12464)</span>
                    <span>1.00m (Max)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    Points within this distance of walls are excluded from uniformity calculations.
                  </p>
                </div>

                {/* Dimensions (Length & Width) */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Length (m)</label>
                    <input
                      type="number"
                      min="1.0"
                      max="50.0"
                      step="0.5"
                      value={activeWorkplane.lengthM}
                      onChange={(e) => handleUpdateActive({ lengthM: parseFloat(e.target.value) || 1 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">Width (m)</label>
                    <input
                      type="number"
                      min="1.0"
                      max="50.0"
                      step="0.5"
                      value={activeWorkplane.widthM}
                      onChange={(e) => handleUpdateActive({ widthM: parseFloat(e.target.value) || 1 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>

                {/* Utilization Profile Card */}
                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-700">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Assigned Standard
                  </span>
                  <div className="text-xs font-semibold text-white mt-0.5">{activeProfile.name}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>
                      Target Em: <strong className="text-emerald-400">{activeProfile.targetMaintainedLux} lx</strong>
                    </div>
                    <div>
                      Min U0: <strong className="text-sky-400">{activeProfile.minUniformityU0}</strong>
                    </div>
                  </div>
                </div>

                {/* Quick Add Button */}
                <button
                  onClick={() => {
                    setIsAddingWorkplane(true);
                    setActiveTab("manager");
                  }}
                  className="w-full py-2 bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white rounded text-xs font-bold transition shadow"
                >
                  + Add New Assessment Zone
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: WORKPLANE MANAGER */}
          {activeTab === "manager" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              {/* Top Banner & Automatic Generation Setting */}
              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Split className="w-5 h-5 text-sky-400" />
                    Interior vs. Exterior Domain Management
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    DIALux evo automatically generates a workplane for every interior room created (or imported from IFC).
                    Exterior workplanes must be created manually as calculation objects. Toggle automatic generation below.
                  </p>
                </div>

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs font-bold text-white block">Auto-generate Room Workplanes</span>
                    <span className="text-[10px] text-slate-400">Settings & Program Options</span>
                  </div>
                  <button
                    onClick={() => {
                      setAutoCreateInterior(!autoCreateInterior);
                      toast.info(`Automatic workplane creation is now ${!autoCreateInterior ? "ENABLED" : "DISABLED"}`);
                    }}
                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition ${
                      autoCreateInterior ? "bg-emerald-600" : "bg-slate-700"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                        autoCreateInterior ? "translate-x-6" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Add New Workplane Form (Collapsible) */}
              {isAddingWorkplane && (
                <div className="bg-slate-800 border-2 border-sky-500/50 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      Create New Workplane or Exterior Assessment Zone
                    </h4>
                    <button
                      onClick={() => setIsAddingWorkplane(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Workplane Label
                      </label>
                      <input
                        type="text"
                        value={newWpName}
                        onChange={(e) => setNewWpName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                        placeholder="e.g. Employee Parking North"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Domain Environment
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewWpEnv("interior")}
                          className={`flex-1 py-1.5 rounded text-xs font-bold border transition ${
                            newWpEnv === "interior"
                              ? "bg-sky-600 text-white border-sky-500"
                              : "bg-slate-900 text-slate-400 border-slate-700"
                          }`}
                        >
                          Interior Room
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewWpEnv("exterior")}
                          className={`flex-1 py-1.5 rounded text-xs font-bold border transition ${
                            newWpEnv === "exterior"
                              ? "bg-emerald-600 text-white border-emerald-500"
                              : "bg-slate-900 text-slate-400 border-slate-700"
                          }`}
                        >
                          Exterior Zone
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Standard Profile
                      </label>
                      <select
                        value={newWpProfile}
                        onChange={(e) => setNewWpProfile(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                      >
                        {Object.values(WORKPLANE_PROFILES)
                          .filter((p) => p.environment === newWpEnv)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Length (m)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={newWpLength}
                        onChange={(e) => setNewWpLength(parseFloat(e.target.value) || 5)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Width (m)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={newWpWidth}
                        onChange={(e) => setNewWpWidth(parseFloat(e.target.value) || 5)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Height Offset (m)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.05"
                        value={newWpHeight}
                        onChange={(e) => setNewWpHeight(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingWorkplane(false)}
                      className="px-4 py-1.5 bg-slate-700 text-slate-300 rounded text-xs font-semibold hover:bg-slate-600 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateWorkplane}
                      className="px-5 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-500 transition shadow"
                    >
                      Confirm & Create
                    </button>
                  </div>
                </div>
              )}

              {/* Workplane List Table */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span className="text-sm font-bold text-white">Active Workplanes in Project</span>
                  </div>
                  {!isAddingWorkplane && (
                    <button
                      onClick={() => setIsAddingWorkplane(true)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Assessment Zone
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-700">
                        <th className="py-2.5 px-3 font-semibold">Active</th>
                        <th className="py-2.5 px-3 font-semibold">Name & Zone</th>
                        <th className="py-2.5 px-3 font-semibold">Domain</th>
                        <th className="py-2.5 px-3 font-semibold">Dimensions (L x W)</th>
                        <th className="py-2.5 px-3 font-semibold">Height (h)</th>
                        <th className="py-2.5 px-3 font-semibold">Margin (Randzone)</th>
                        <th className="py-2.5 px-3 font-semibold">Target Em</th>
                        <th className="py-2.5 px-3 font-semibold">Result Em</th>
                        <th className="py-2.5 px-3 font-semibold">Uniformity U0</th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 text-slate-300">
                      {workplanes.map((wp) => {
                        const isSelected = wp.id === selectedId;
                        const res = calculationResults[wp.id] || solveWorkplanePhotometrics(wp);
                        const prof = WORKPLANE_PROFILES[wp.profileId];

                        return (
                          <tr
                            key={wp.id}
                            onClick={() => setSelectedId(wp.id)}
                            className={`cursor-pointer transition ${
                              isSelected
                                ? "bg-sky-950/40 border-l-4 border-sky-500"
                                : "hover:bg-slate-800/50"
                            }`}
                          >
                            <td className="py-3 px-3">
                              <input
                                type="checkbox"
                                checked={wp.isEnabled}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setWorkplanes((prev) =>
                                    prev.map((w) => (w.id === wp.id ? { ...w, isEnabled: e.target.checked } : w))
                                  );
                                }}
                                className="rounded border-slate-700 text-sky-500"
                              />
                            </td>
                            <td className="py-3 px-3 font-medium text-white">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full inline-block"
                                  style={{ backgroundColor: wp.colorHex }}
                                />
                                {wp.name}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  wp.environment === "interior"
                                    ? "bg-sky-950 text-sky-400 border border-sky-800"
                                    : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                }`}
                              >
                                {wp.environment}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono">
                              {wp.lengthM}m × {wp.widthM}m
                            </td>
                            <td className="py-3 px-3 font-mono text-sky-300">
                              {wp.heightOffsetM.toFixed(2)} m
                            </td>
                            <td className="py-3 px-3 font-mono text-amber-300">
                              {wp.wallMarginM.toFixed(2)} m
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-400">
                              {prof?.targetMaintainedLux} lx
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-white">
                              {res.averageLux} lx
                            </td>
                            <td className="py-3 px-3 font-mono">
                              {res.uniformityU0.toFixed(2)}{" "}
                              <span className="text-[10px] text-slate-500">
                                (min {prof?.minUniformityU0})
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  res.isCompliant
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-700"
                                    : "bg-rose-950 text-rose-400 border border-rose-700"
                                }`}
                              >
                                {res.isCompliant ? "PASS" : "FAIL"}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWorkplane(wp.id);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition"
                                title="Delete Workplane"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

          {/* TAB 3: EN 12464 PROFILES & TARGETS */}
          {activeTab === "profiles" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  EN 12464 Utilization Profiles & Normative Requirements
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Lighting parameters dictated by standard EN 12464-1 (Indoor workplaces) and EN 12464-2 (Outdoor workplaces).
                </p>
              </div>

              {/* Grid of Profiles */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(WORKPLANE_PROFILES).map((prof) => {
                  const isAssigned = activeWorkplane.profileId === prof.id;

                  return (
                    <div
                      key={prof.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                        isAssigned
                          ? "bg-slate-800 border-sky-500 ring-1 ring-sky-500"
                          : "bg-slate-850/60 border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              prof.standard === "EN 12464-1"
                                ? "bg-sky-950 text-sky-400 border border-sky-800"
                                : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            }`}
                          >
                            {prof.standard}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">
                            {prof.environment}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mb-1">{prof.name}</h4>
                        <p className="text-xs text-slate-400 mb-4">{prof.description}</p>
                      </div>

                      <div className="space-y-2 border-t border-slate-700/60 pt-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Target Maintained Em:</span>
                          <strong className="text-emerald-400 font-mono">{prof.targetMaintainedLux} lx</strong>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Min Uniformity U0:</span>
                          <strong className="text-sky-400 font-mono">{prof.minUniformityU0}</strong>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Glare Limit (UGR / GR):</span>
                          <strong className="text-slate-200 font-mono">≤ {prof.maxUgrOrGr}</strong>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Default Workplane Height:</span>
                          <strong className="text-slate-200 font-mono">{prof.defaultHeightM.toFixed(2)} m</strong>
                        </div>

                        <button
                          onClick={() => {
                            handleUpdateActive({
                              profileId: prof.id,
                              heightOffsetM: prof.defaultHeightM,
                              wallMarginM: prof.defaultMarginM,
                            });
                            toast.success(`Assigned profile "${prof.name}" to active workplane`);
                          }}
                          className={`w-full mt-2 py-1.5 rounded text-xs font-semibold transition ${
                            isAssigned
                              ? "bg-sky-600 text-white cursor-default"
                              : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                          }`}
                        >
                          {isAssigned ? "Currently Assigned" : "Assign to Selected Plane"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: GRID & MARGIN SETTINGS */}
          {activeTab === "grid_margin" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Grid className="w-5 h-5 text-amber-400" />
                  Calculation Grid Formula & Wall Margin (Randzone)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure the point evaluation grid step and edge exclusion borders according to international lighting standards.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Section A: Wall Margin Zone (Randzone) */}
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
                    <Box className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-white">
                      Wall Margin Zone (Randzone per EN 12464-1 §4.3)
                    </h4>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    According to EN 12464-1, functional lighting calculations in rooms exclude a wall zone
                    (typically <strong>0.50m</strong> wide) from uniformity and average illuminance assessments.
                    This prevents corner shadows and perimeter effects from artificially failing the task plane criteria.
                  </p>

                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-750 flex flex-col gap-3">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-200">Current Margin Width:</span>
                      <span className="font-mono text-amber-400 font-bold">
                        {activeWorkplane.wallMarginM.toFixed(2)} meters
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={activeWorkplane.wallMarginM}
                      onChange={(e) => handleUpdateActive({ wallMarginM: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />

                    <div className="flex justify-between text-[11px] text-slate-400">
                      <button
                        onClick={() => handleUpdateActive({ wallMarginM: 0.0 })}
                        className="hover:text-white"
                      >
                        0.00m (None)
                      </button>
                      <button
                        onClick={() => handleUpdateActive({ wallMarginM: 0.2 })}
                        className="hover:text-white"
                      >
                        0.20m (Corridor)
                      </button>
                      <button
                        onClick={() => handleUpdateActive({ wallMarginM: 0.5 })}
                        className="text-amber-400 font-bold hover:underline"
                      >
                        0.50m (Standard EN)
                      </button>
                      <button
                        onClick={() => handleUpdateActive({ wallMarginM: 1.0 })}
                        className="hover:text-white"
                      >
                        1.00m (Wide)
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg text-xs text-amber-300 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      In exterior parking and sports grounds, the wall margin is conventionally set to <strong>0.00m</strong>
                      because there are no room boundaries enclosing the task area.
                    </span>
                  </div>
                </div>

                {/* Section B: CIE / EN 12464 Grid Step Formula */}
                <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
                    <Grid className="w-4 h-4 text-sky-400" />
                    <h4 className="text-sm font-bold text-white">
                      Normative Grid Point Formula (CIE / EN 12464)
                    </h4>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    The maximum grid point spacing p is calculated from the longest plane dimension d:
                  </p>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-750 text-center font-mono text-sm text-sky-300 font-bold">
                    p = 0.2 × 5^(log10(d))
                  </div>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span>Longest Dimension (d):</span>
                      <strong className="font-mono text-white">
                        {Math.max(activeWorkplane.lengthM, activeWorkplane.widthM).toFixed(2)} m
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>EN 12464 Recommended Step (p):</span>
                      <strong className="font-mono text-emerald-400">
                        {calculateEN12464GridStep(Math.max(activeWorkplane.lengthM, activeWorkplane.widthM))} m
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Configured Grid Step:</span>
                      <strong className="font-mono text-sky-400">{activeWorkplane.gridStepM.toFixed(2)} m</strong>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        const rec = calculateEN12464GridStep(
                          Math.max(activeWorkplane.lengthM, activeWorkplane.widthM)
                        );
                        handleUpdateActive({ gridStepM: rec });
                        toast.success(`Grid step adjusted to EN formula standard: ${rec}m`);
                      }}
                      className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold transition"
                    >
                      Apply Recommended Formula Step
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PHOTOMETRIC SUMMARY & COMPLIANCE */}
          {activeTab === "compliance" && (
            <div className="flex-1 p-6 overflow-y-auto bg-slate-900 flex flex-col gap-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  Workplane Photometric Summary & Standards Compliance Audit
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Full calculation overview comparing maintained illuminance and uniformity against EN 12464-1 & EN 12464-2.
                </p>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {workplanes.map((wp) => {
                  const res = calculationResults[wp.id] || solveWorkplanePhotometrics(wp);
                  const prof = WORKPLANE_PROFILES[wp.profileId];

                  return (
                    <div
                      key={wp.id}
                      className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col justify-between shadow-lg"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              wp.environment === "interior"
                                ? "bg-sky-950 text-sky-400 border border-sky-800"
                                : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                            }`}
                          >
                            {wp.environment}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              res.isCompliant
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-700"
                                : "bg-rose-950 text-rose-400 border border-rose-700"
                            }`}
                          >
                            {res.isCompliant ? "COMPLIANT" : "NON-COMPLIANT"}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white">{wp.name}</h4>
                        <div className="text-[11px] text-slate-400 mb-3">{prof?.name}</div>

                        <div className="space-y-1.5 text-xs text-slate-300">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Average Lux (Em):</span>
                            <strong className="font-mono text-white">
                              {res.averageLux} lx{" "}
                              <span className="text-[10px] text-slate-500">
                                (req. ≥ {prof?.targetMaintainedLux})
                              </span>
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Min Lux (Emin):</span>
                            <strong className="font-mono text-slate-200">{res.minLux} lx</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Uniformity (U0 = Emin / Eavg):</span>
                            <strong className="font-mono text-white">
                              {res.uniformityU0.toFixed(2)}{" "}
                              <span className="text-[10px] text-slate-500">
                                (req. ≥ {prof?.minUniformityU0})
                              </span>
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Elevation (h):</span>
                            <strong className="font-mono text-sky-300">{wp.heightOffsetM.toFixed(2)} m</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Wall Margin:</span>
                            <strong className="font-mono text-amber-300">{wp.wallMarginM.toFixed(2)} m</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Active Evaluated Points:</span>
                            <strong className="font-mono text-slate-200">
                              {res.activePointsCount} / {res.totalPointsCount}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Standard: {prof?.standard}</span>
                        <button
                          onClick={() => {
                            setSelectedId(wp.id);
                            setActiveTab("viewport");
                          }}
                          className="text-sky-400 hover:underline font-semibold"
                        >
                          View 3D →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER BAR */}
        <div className="px-5 py-2.5 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>DIALux evo Official Tutorial 25 Engine Active</span>
            <span className="text-slate-600">|</span>
            <span>Total Workplanes: {workplanes.length}</span>
            <span className="text-slate-600">|</span>
            <span>
              Auto-generate Rooms:{" "}
              <strong className={autoCreateInterior ? "text-emerald-400" : "text-amber-400"}>
                {autoCreateInterior ? "ON" : "OFF"}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setWorkplanes(DEFAULT_WORKPLANES);
                setSelectedId("wp_int_office");
                toast.info("Reset workplanes to default campus layout");
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
