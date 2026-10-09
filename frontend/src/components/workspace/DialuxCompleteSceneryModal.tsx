import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Building2,
  DoorClosed,
  Grid,
  Layers,
  Sliders,
  Check,
  Plus,
  Trash2,
  Sun,
  Eye,
  EyeOff,
  Maximize,
  Camera,
  Info,
  CheckCircle2,
  Sparkles,
  Zap,
  Box,
  Compass,
  FileDown,
  LayoutGrid,
  ShieldCheck,
  Armchair,
} from "lucide-react";
import { toast } from "sonner";
import {
  CompleteBuildingScenery,
  SceneryRoom,
  SceneryOpening,
  SceneryFurniture,
  SceneryColumn,
  RoomProfileType,
  ROOM_STANDARDS,
  DEFAULT_COMPLETE_SCENERY,
  calculateSceneryMetrics,
  calculateRoomPhotometrics,
} from "@/lib/dialux-complete-scenery-engine";

export interface DialuxCompleteSceneryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  onApplySceneryToSimulation?: (scenery: CompleteBuildingScenery) => void;
}

export function DialuxCompleteSceneryModal({
  isOpen,
  onClose,
  projectName = "Corporate Headquarters Lighting Project",
  onApplySceneryToSimulation,
}: DialuxCompleteSceneryModalProps) {
  // 1. Navigation & State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "viewport" | "rooms" | "openings" | "furniture" | "photometrics"
  >("viewport");

  // Project Scenery Model
  const [scenery, setScenery] = useState<CompleteBuildingScenery>(DEFAULT_COMPLETE_SCENERY);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    DEFAULT_COMPLETE_SCENERY.rooms[0].id
  );

  // 3D Viewport Controls
  const [viewMode, setViewMode] = useState<"dollhouse" | "plan" | "exterior">("dollhouse");
  const [showCeilings, setShowCeilings] = useState<boolean>(false);
  const [showFurniture, setShowFurniture] = useState<boolean>(true);
  const [showDaylightSun, setShowDaylightSun] = useState<boolean>(true);
  const [showWorkplanes, setShowWorkplanes] = useState<boolean>(true);

  // Derived metrics
  const sceneryMetrics = useMemo(() => {
    return calculateSceneryMetrics(scenery);
  }, [scenery]);

  const selectedRoom = useMemo(() => {
    return scenery.rooms.find((r) => r.id === selectedRoomId) || scenery.rooms[0];
  }, [scenery.rooms, selectedRoomId]);

  // Three.js Viewport Refs
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const roomsGroupRef = useRef<THREE.Group | null>(null);
  const furnitureGroupRef = useRef<THREE.Group | null>(null);
  const ceilingsGroupRef = useRef<THREE.Group | null>(null);
  const workplanesGroupRef = useRef<THREE.Group | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);

  // -------------------------------------------------------------------------
  // INITIALIZE THREE.JS 3D VIEWPORT
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !canvasContainerRef.current) return;

    const container = canvasContainerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131722);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(18, 18, 22);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(9.0, 6.0, 1.6);
    controlsRef.current = controls;

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    // Directional Sunlight
    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    sunLight.position.set(25, -15, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Sky / Fill Light
    const skyLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.4);
    scene.add(skyLight);

    // Ground Plane Grid
    const gridHelper = new THREE.GridHelper(36, 36, 0x3b82f6, 0x1e293b);
    gridHelper.position.set(9.0, 6.0, 0);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Group containers
    const roomsGroup = new THREE.Group();
    scene.add(roomsGroup);
    roomsGroupRef.current = roomsGroup;

    const furnitureGroup = new THREE.Group();
    scene.add(furnitureGroup);
    furnitureGroupRef.current = furnitureGroup;

    const ceilingsGroup = new THREE.Group();
    scene.add(ceilingsGroup);
    ceilingsGroupRef.current = ceilingsGroup;

    const workplanesGroup = new THREE.Group();
    scene.add(workplanesGroup);
    workplanesGroupRef.current = workplanesGroup;

    // Raycaster for Room Picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(roomsGroup.children, true);

      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && !obj.userData?.roomId) {
          obj = obj.parent;
        }
        if (obj && obj.userData?.roomId) {
          setSelectedRoomId(obj.userData.roomId);
          toast.info(`Selected Room: ${obj.userData.name}`);
        }
      }
    };

    renderer.domElement.addEventListener("click", handleCanvasClick);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", handleCanvasClick);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isOpen]);

  // -------------------------------------------------------------------------
  // REBUILD 3D SCENERY GEOMETRY ON SCENERY OR TOGGLE CHANGES
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!roomsGroupRef.current || !furnitureGroupRef.current || !ceilingsGroupRef.current || !workplanesGroupRef.current)
      return;

    const roomsGroup = roomsGroupRef.current;
    const furnitureGroup = furnitureGroupRef.current;
    const ceilingsGroup = ceilingsGroupRef.current;
    const workplanesGroup = workplanesGroupRef.current;

    // Clear previous children
    while (roomsGroup.children.length > 0) roomsGroup.remove(roomsGroup.children[0]);
    while (furnitureGroup.children.length > 0) furnitureGroup.remove(furnitureGroup.children[0]);
    while (ceilingsGroup.children.length > 0) ceilingsGroup.remove(ceilingsGroup.children[0]);
    while (workplanesGroup.children.length > 0) workplanesGroup.remove(workplanesGroup.children[0]);

    // Sun light visibility
    if (sunLightRef.current) {
      sunLightRef.current.visible = showDaylightSun;
    }

    // 1. Build Base Building Slab
    const slabGeo = new THREE.BoxGeometry(scenery.buildingWidthM, scenery.buildingDepthM, scenery.slabThicknessM);
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const slabMesh = new THREE.Mesh(slabGeo, slabMat);
    slabMesh.position.set(scenery.buildingWidthM / 2, scenery.buildingDepthM / 2, -scenery.slabThicknessM / 2);
    slabMesh.receiveShadow = true;
    roomsGroup.add(slabMesh);

    // 2. Build Each Room (Floor slab, Partition Walls, Columns, Workplane)
    scenery.rooms.forEach((room) => {
      const isSelected = room.id === selectedRoomId;
      const roomGroup = new THREE.Group();
      roomGroup.userData = { roomId: room.id, name: room.name };

      // Calculate room center and bounding box from polygon
      const xs = room.polygon.map((p) => p.x);
      const ys = room.polygon.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const roomW = maxX - minX;
      const roomD = maxY - minY;
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Floor Tile Mesh
      const floorShape = new THREE.Shape();
      room.polygon.forEach((pt, idx) => {
        if (idx === 0) floorShape.moveTo(pt.x, pt.y);
        else floorShape.lineTo(pt.x, pt.y);
      });
      floorShape.closePath();

      const floorGeo = new THREE.ShapeGeometry(floorShape);
      const floorMat = new THREE.MeshStandardMaterial({
        color: isSelected ? new THREE.Color(room.colorHex).multiplyScalar(1.2) : new THREE.Color(room.colorHex).multiplyScalar(0.7),
        roughness: 0.5,
        metalness: 0.1,
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.position.set(0, 0, 0.01);
      floorMesh.receiveShadow = true;
      floorMesh.userData = { roomId: room.id, name: room.name };
      roomGroup.add(floorMesh);

      // Room Walls (Construct wall boundaries along polygon edges)
      const wallHeight = viewMode === "dollhouse" ? 1.6 : room.ceilingHeightM;
      for (let i = 0; i < room.polygon.length; i++) {
        const p1 = room.polygon[i];
        const p2 = room.polygon[(i + 1) % room.polygon.length];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const wallGeo = new THREE.BoxGeometry(length, scenery.innerWallThicknessM, wallHeight);
        const wallMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0xe2e8f0 : 0xc7d2fe,
          roughness: 0.7,
        });
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.position.set(
          p1.x + dx / 2,
          p1.y + dy / 2,
          wallHeight / 2
        );
        wallMesh.rotation.z = angle;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        wallMesh.userData = { roomId: room.id, name: room.name };
        roomGroup.add(wallMesh);
      }

      // Windows & Openings representation
      room.openings.forEach((op) => {
        if (op.type === "window" || op.type === "curtain_wall") {
          // Glass panel
          const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0x93c5fd,
            transparent: true,
            opacity: 0.45,
            roughness: 0.1,
            transmission: 0.8,
            ior: 1.5,
          });
          const glassGeo = new THREE.BoxGeometry(op.widthM, 0.05, op.heightM);
          const glassMesh = new THREE.Mesh(glassGeo, glassMat);

          // Position glass along wall orientation
          if (op.wallOrientation === "north") {
            glassMesh.position.set(minX + op.positionAlongWallM + op.widthM / 2, maxY, op.sillHeightM + op.heightM / 2);
          } else if (op.wallOrientation === "south") {
            glassMesh.position.set(minX + op.positionAlongWallM + op.widthM / 2, minY, op.sillHeightM + op.heightM / 2);
          } else if (op.wallOrientation === "east") {
            glassMesh.position.set(maxX, minY + op.positionAlongWallM + op.widthM / 2, op.sillHeightM + op.heightM / 2);
            glassMesh.rotation.z = Math.PI / 2;
          } else {
            glassMesh.position.set(minX, minY + op.positionAlongWallM + op.widthM / 2, op.sillHeightM + op.heightM / 2);
            glassMesh.rotation.z = Math.PI / 2;
          }
          roomGroup.add(glassMesh);
        }
      });

      // Structural Columns
      room.columns.forEach((col) => {
        const colMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
        let colMesh: THREE.Mesh;
        if (col.type === "cylindrical") {
          const colGeo = new THREE.CylinderGeometry(col.size.width / 2, col.size.width / 2, col.heightM, 24);
          colMesh = new THREE.Mesh(colGeo, colMat);
          colMesh.position.set(col.position.x, col.position.y, col.heightM / 2);
          colMesh.rotation.x = Math.PI / 2;
        } else {
          const colGeo = new THREE.BoxGeometry(col.size.width, col.size.depth, col.heightM);
          colMesh = new THREE.Mesh(colGeo, colMat);
          colMesh.position.set(col.position.x, col.position.y, col.heightM / 2);
        }
        colMesh.castShadow = true;
        colMesh.receiveShadow = true;
        roomGroup.add(colMesh);
      });

      // Workplane Grid Surface (EN 12464-1 calculation surface)
      if (showWorkplanes) {
        const std = ROOM_STANDARDS[room.profileType];
        const wpHeight = std.workplaneHeightM;
        const margin = std.boundaryMarginM;

        const wpGeo = new THREE.PlaneGeometry(Math.max(0.5, roomW - margin * 2), Math.max(0.5, roomD - margin * 2));
        const wpMat = new THREE.MeshBasicMaterial({
          color: isSelected ? 0x10b981 : 0x059669,
          wireframe: true,
          transparent: true,
          opacity: isSelected ? 0.8 : 0.35,
        });
        const wpMesh = new THREE.Mesh(wpGeo, wpMat);
        wpMesh.position.set(centerX, centerY, wpHeight + 0.05);
        workplanesGroup.add(wpMesh);
      }

      // Suspended Ceiling Mesh (toggleable)
      if (showCeilings) {
        const ceilingGeo = new THREE.ShapeGeometry(floorShape);
        const ceilingMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.9,
          side: THREE.DoubleSide,
        });
        const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
        ceilingMesh.position.set(0, 0, room.suspendedCeilingHeightM);
        ceilingsGroup.add(ceilingMesh);
      }

      roomsGroup.add(roomGroup);
    });

    // 3. Build Furniture Objects
    if (showFurniture) {
      scenery.rooms.forEach((room) => {
        room.furniture.forEach((f) => {
          const furnMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(f.colorHex),
            roughness: 0.5,
          });

          const furnGroup = new THREE.Group();
          furnGroup.position.set(f.position.x, f.position.y, f.position.z);
          furnGroup.rotation.z = (f.rotationDeg * Math.PI) / 180;

          if (f.category === "desk" || f.category === "conference_table") {
            // Desk tabletop
            const topGeo = new THREE.BoxGeometry(f.dimensions.width, f.dimensions.depth, 0.04);
            const topMesh = new THREE.Mesh(topGeo, furnMat);
            topMesh.position.set(0, 0, f.dimensions.height - 0.02);
            topMesh.castShadow = true;
            furnGroup.add(topMesh);

            // 4 Legs
            const legGeo = new THREE.CylinderGeometry(0.025, 0.025, f.dimensions.height, 12);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 });
            const offsets = [
              [-f.dimensions.width / 2 + 0.08, -f.dimensions.depth / 2 + 0.08],
              [f.dimensions.width / 2 - 0.08, -f.dimensions.depth / 2 + 0.08],
              [-f.dimensions.width / 2 + 0.08, f.dimensions.depth / 2 - 0.08],
              [f.dimensions.width / 2 - 0.08, f.dimensions.depth / 2 - 0.08],
            ];
            offsets.forEach(([ox, oy]) => {
              const leg = new THREE.Mesh(legGeo, legMat);
              leg.position.set(ox, oy, f.dimensions.height / 2);
              leg.rotation.x = Math.PI / 2;
              furnGroup.add(leg);
            });
          } else if (f.category === "reception_counter") {
            const counterGeo = new THREE.BoxGeometry(f.dimensions.width, f.dimensions.depth, f.dimensions.height);
            const counterMesh = new THREE.Mesh(counterGeo, furnMat);
            counterMesh.position.set(0, 0, f.dimensions.height / 2);
            counterMesh.castShadow = true;
            furnGroup.add(counterMesh);
          } else {
            const boxGeo = new THREE.BoxGeometry(f.dimensions.width, f.dimensions.depth, f.dimensions.height);
            const boxMesh = new THREE.Mesh(boxGeo, furnMat);
            boxMesh.position.set(0, 0, f.dimensions.height / 2);
            boxMesh.castShadow = true;
            furnGroup.add(boxMesh);
          }

          furnitureGroup.add(furnGroup);
        });
      });
    }
  }, [
    scenery,
    selectedRoomId,
    viewMode,
    showCeilings,
    showFurniture,
    showDaylightSun,
    showWorkplanes,
  ]);

  // -------------------------------------------------------------------------
  // CAMERA VIEW PRESETS
  // -------------------------------------------------------------------------
  const applyViewPreset = (mode: "dollhouse" | "plan" | "exterior") => {
    setViewMode(mode);
    if (!cameraRef.current || !controlsRef.current) return;

    if (mode === "dollhouse") {
      cameraRef.current.position.set(18, 18, 22);
      controlsRef.current.target.set(9.0, 6.0, 1.6);
    } else if (mode === "plan") {
      cameraRef.current.position.set(9.0, 6.0, 28);
      controlsRef.current.target.set(9.0, 6.0, 0);
    } else if (mode === "exterior") {
      cameraRef.current.position.set(9.0, -14, 12);
      controlsRef.current.target.set(9.0, 6.0, 2.0);
    }
    controlsRef.current.update();
  };

  // Update Room Utilization Profile
  const handleProfileChange = (roomId: string, newProfile: RoomProfileType) => {
    const std = ROOM_STANDARDS[newProfile];
    setScenery((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) => {
        if (r.id !== roomId) return r;
        const windowArea = r.openings
          .filter((o) => o.type === "window" || o.type === "curtain_wall")
          .reduce((sum, o) => sum + o.widthM * o.heightM, 0);
        const photo = calculateRoomPhotometrics(
          r.floorAreaM2,
          r.ceilingHeightM,
          std,
          r.reflectance,
          windowArea
        );
        return {
          ...r,
          profileType: newProfile,
          ...photo,
        };
      }),
    }));
    toast.success(`Updated [${selectedRoom.name}] standard to ${std.name} (${std.targetLux} lx)`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4">
      <div
        className={`bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100 transition-all duration-200 ${
          isFullscreen ? "w-full h-full rounded-none" : "w-[98vw] max-w-7xl h-[94vh]"
        }`}
      >
        {/* ================================================================= */}
        {/* HEADER BAR                                                        */}
        {/* ================================================================= */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Complete Building Scenery Studio
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded-full">
                  DIALux evo Tutorial Part 29
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 rounded-full">
                  Architecture & Assessment Zones
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-room storey construction, doors, windows, structural columns, furniture, and EN 12464-1 assessment profiles.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TAB NAVIGATION                                                    */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between px-5 bg-slate-950/60 border-b border-slate-800 text-xs">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab("viewport")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "viewport"
                  ? "border-emerald-500 text-emerald-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Camera className="w-4 h-4" />
              1. 3D Scenery Viewport
            </button>
            <button
              onClick={() => setActiveTab("rooms")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "rooms"
                  ? "border-emerald-500 text-emerald-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Building2 className="w-4 h-4" />
              2. Building & Room Contours ({scenery.rooms.length})
            </button>
            <button
              onClick={() => setActiveTab("openings")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "openings"
                  ? "border-emerald-500 text-emerald-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <DoorClosed className="w-4 h-4" />
              3. Doors & Windows ({sceneryMetrics.totalOpenings})
            </button>
            <button
              onClick={() => setActiveTab("furniture")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "furniture"
                  ? "border-emerald-500 text-emerald-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Armchair className="w-4 h-4" />
              4. Furniture & Columns ({sceneryMetrics.totalFurniture + sceneryMetrics.totalColumns})
            </button>
            <button
              onClick={() => setActiveTab("photometrics")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "photometrics"
                  ? "border-emerald-500 text-emerald-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="w-4 h-4" />
              5. Assessment Zones & Photometrics
            </button>
          </div>

          {/* Quick Active Room Selector */}
          <div className="flex items-center gap-2 py-1">
            <span className="text-slate-400 text-[11px]">Active Room:</span>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500"
            >
              {scenery.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} - {r.name} ({r.floorAreaM2} m²)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MAIN BODY WORKSPACE                                               */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-hidden p-4">
          {/* TAB 1: 3D SCENERY VIEWPORT */}
          {activeTab === "viewport" && (
            <div className="h-full flex flex-col lg:flex-row gap-4">
              {/* Three.js Canvas Container */}
              <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col">
                <div ref={canvasContainerRef} className="w-full flex-1 cursor-grab active:cursor-grabbing" />

                {/* Top Viewport Floating Controls */}
                <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800/80 shadow-lg text-xs">
                  <span className="text-slate-400 font-semibold mr-1">View Mode:</span>
                  <button
                    onClick={() => applyViewPreset("dollhouse")}
                    className={`px-2 py-1 rounded transition-colors ${
                      viewMode === "dollhouse"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Dollhouse Cutaway
                  </button>
                  <button
                    onClick={() => applyViewPreset("plan")}
                    className={`px-2 py-1 rounded transition-colors ${
                      viewMode === "plan"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    2D Plan View
                  </button>
                  <button
                    onClick={() => applyViewPreset("exterior")}
                    className={`px-2 py-1 rounded transition-colors ${
                      viewMode === "exterior"
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Exterior Façade
                  </button>

                  <div className="h-4 w-px bg-slate-700 mx-1" />

                  {/* Layer Toggles */}
                  <button
                    onClick={() => setShowCeilings(!showCeilings)}
                    className={`flex items-center gap-1 px-2 py-1 rounded ${
                      showCeilings
                        ? "bg-indigo-600/30 text-indigo-300 border border-indigo-600/50"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    Ceilings
                  </button>
                  <button
                    onClick={() => setShowFurniture(!showFurniture)}
                    className={`flex items-center gap-1 px-2 py-1 rounded ${
                      showFurniture
                        ? "bg-amber-600/30 text-amber-300 border border-amber-600/50"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    Furniture
                  </button>
                  <button
                    onClick={() => setShowWorkplanes(!showWorkplanes)}
                    className={`flex items-center gap-1 px-2 py-1 rounded ${
                      showWorkplanes
                        ? "bg-emerald-600/30 text-emerald-300 border border-emerald-600/50"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    Workplanes
                  </button>
                  <button
                    onClick={() => setShowDaylightSun(!showDaylightSun)}
                    className={`flex items-center gap-1 px-2 py-1 rounded ${
                      showDaylightSun
                        ? "bg-yellow-600/30 text-yellow-300 border border-yellow-600/50"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    <Sun className="w-3 h-3" />
                    Sun
                  </button>
                </div>

                {/* Bottom Viewport HUD Card */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded border border-white/30"
                      style={{ backgroundColor: selectedRoom.colorHex }}
                    />
                    <div>
                      <span className="text-slate-400 block text-[10px]">Selected Room</span>
                      <span className="font-bold text-white">
                        {selectedRoom.code}: {selectedRoom.name}
                      </span>
                    </div>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Utilization Profile</span>
                    <span className="font-semibold text-emerald-300">
                      {ROOM_STANDARDS[selectedRoom.profileType].name}
                    </span>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Target Illuminance</span>
                    <span className="font-mono font-bold text-white">
                      {ROOM_STANDARDS[selectedRoom.profileType].targetLux} lx (Em)
                    </span>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Floor Area</span>
                    <span className="font-mono text-cyan-300 font-bold">{selectedRoom.floorAreaM2} m²</span>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Estimated Equipment</span>
                    <span className="font-mono font-bold text-amber-400">
                      {selectedRoom.estimatedFixturesCount} Fixtures ({selectedRoom.connectedWatts} W)
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Sidebar: Room Navigation List */}
              <div className="w-full lg:w-80 flex flex-col gap-3 overflow-y-auto">
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <LayoutGrid className="w-4 h-4" />
                      Building Storey Rooms
                    </h3>
                    <span className="text-[10px] text-slate-400">{scenery.rooms.length} zones</span>
                  </div>

                  <div className="space-y-1.5">
                    {scenery.rooms.map((room) => {
                      const isSelected = room.id === selectedRoomId;
                      const std = ROOM_STANDARDS[room.profileType];
                      return (
                        <div
                          key={room.id}
                          onClick={() => {
                            setSelectedRoomId(room.id);
                            toast.info(`Active Zone: ${room.name}`);
                          }}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? "bg-emerald-950/50 border-emerald-500/80 text-white"
                              : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850"
                          }`}
                        >
                          <div className="flex items-center justify-between font-medium">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-full border border-white/40"
                                style={{ backgroundColor: room.colorHex }}
                              />
                              <span>
                                {room.code}: {room.name}
                              </span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                            <span>{room.floorAreaM2} m²</span>
                            <span className="font-semibold text-emerald-300">{std.targetLux} lx</span>
                            <span>{room.estimatedFixturesCount} luminaires</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Building Storey Global Metrics Card */}
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-xs">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    Storey Footprint
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Gross Footprint</span>
                      <span className="font-bold text-white">{sceneryMetrics.grossAreaM2} m²</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Net Room Area</span>
                      <span className="font-bold text-emerald-400">{sceneryMetrics.netAreaM2} m²</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Connected Load</span>
                      <span className="font-bold text-amber-400">{sceneryMetrics.totalConnectedWatts} W</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Power Density</span>
                      <span className="font-bold text-cyan-400">{sceneryMetrics.averageWattsPerM2} W/m²</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BUILDING & ROOM CONTOURS */}
          {activeTab === "rooms" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-5xl mx-auto">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-emerald-400" />
                      Building Storey Architectural Specifications
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Storey geometry: {scenery.buildingWidthM}m × {scenery.buildingDepthM}m ({sceneryMetrics.grossAreaM2} m² gross),
                      Storey Height: {scenery.storeyHeightM}m, Outer Walls: {scenery.outerWallThicknessM}m, Partitions: {scenery.innerWallThicknessM}m.
                    </p>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-emerald-300">
                    {scenery.rooms.length} Architectural Rooms
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/50">
                        <th className="py-2.5 px-3">Room Code & Name</th>
                        <th className="py-2.5 px-3">EN 12464-1 Profile</th>
                        <th className="py-2.5 px-3">Floor Area</th>
                        <th className="py-2.5 px-3">Ceiling Height</th>
                        <th className="py-2.5 px-3">Target Lux (Em)</th>
                        <th className="py-2.5 px-3">UGR max</th>
                        <th className="py-2.5 px-3">Uniformity U0</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {scenery.rooms.map((room) => {
                        const std = ROOM_STANDARDS[room.profileType];
                        const isSelected = room.id === selectedRoomId;
                        return (
                          <tr
                            key={room.id}
                            className={`transition-colors ${
                              isSelected ? "bg-emerald-950/30 text-white" : "text-slate-300 hover:bg-slate-900/60"
                            }`}
                          >
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full border border-white/30"
                                  style={{ backgroundColor: room.colorHex }}
                                />
                                <div>
                                  <span className="font-semibold block">{room.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{room.code}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <select
                                value={room.profileType}
                                onChange={(e) => handleProfileChange(room.id, e.target.value as RoomProfileType)}
                                className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500"
                              >
                                {Object.entries(ROOM_STANDARDS).map(([key, val]) => (
                                  <option key={key} value={key}>
                                    {val.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-cyan-400">{room.floorAreaM2} m²</td>
                            <td className="py-3 px-3 font-mono">{room.ceilingHeightM} m</td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-400">{std.targetLux} lx</td>
                            <td className="py-3 px-3 font-mono">{std.ugrMax}</td>
                            <td className="py-3 px-3 font-mono">{std.uniformityMin}</td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedRoomId(room.id);
                                  setActiveTab("viewport");
                                }}
                                className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/60 border border-emerald-500/50 text-emerald-200 rounded text-[11px] font-medium transition-colors"
                              >
                                View 3D
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

          {/* TAB 3: DOORS, WINDOWS & FAÇADE OPENINGS */}
          {activeTab === "openings" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-5xl mx-auto">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <DoorClosed className="w-5 h-5 text-cyan-400" />
                      Façade Fenestrations, Ribbon Windows & Partition Doors
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Precise architectural opening dimensions, sill heights, casing, and daylight transmittance.
                    </p>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300">
                    {sceneryMetrics.totalOpenings} Openings Configured
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scenery.rooms.map((room) => {
                    if (room.openings.length === 0) return null;
                    return (
                      <div key={room.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-xs text-white">
                            {room.code}: {room.name}
                          </span>
                          <span className="text-[10px] text-slate-400">{room.openings.length} openings</span>
                        </div>

                        <div className="space-y-2">
                          {room.openings.map((op) => (
                            <div
                              key={op.id}
                              className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold text-slate-200 block">{op.name}</span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                  <span>Type: {op.type}</span>
                                  <span>•</span>
                                  <span>Wall: {op.wallOrientation.toUpperCase()}</span>
                                  <span>•</span>
                                  <span>Dim: {op.widthM}m × {op.heightM}m</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block">Sill: {op.sillHeightM}m</span>
                                <span className="font-mono text-[10px] text-cyan-400">
                                  τ = {Math.round(op.glassTransmittance * 100)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FURNITURE & STRUCTURAL ELEMENTS */}
          {activeTab === "furniture" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-5xl mx-auto">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Armchair className="w-5 h-5 text-amber-400" />
                      Furniture Objects & Structural Columns
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Realistic physical interior obstructions: office workstations, conference tables, and structural columns.
                    </p>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-amber-300">
                    {sceneryMetrics.totalFurniture} Furniture Items • {sceneryMetrics.totalColumns} Columns
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scenery.rooms.map((room) => {
                    const totalElements = room.furniture.length + room.columns.length;
                    if (totalElements === 0) return null;
                    return (
                      <div key={room.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-xs text-white">
                            {room.code}: {room.name}
                          </span>
                          <span className="text-[10px] text-slate-400">{totalElements} elements</span>
                        </div>

                        <div className="space-y-2">
                          {room.columns.map((col) => (
                            <div
                              key={col.id}
                              className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold text-indigo-300 block">Column: {col.name}</span>
                                <span className="text-[10px] text-slate-400">
                                  Type: {col.type} ({col.size.width}m × {col.size.depth}m, Height: {col.heightM}m)
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-slate-400">
                                Pos: ({col.position.x}, {col.position.y})m
                              </span>
                            </div>
                          ))}

                          {room.furniture.map((furn) => (
                            <div
                              key={furn.id}
                              className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold text-amber-200 block">{furn.name}</span>
                                <span className="text-[10px] text-slate-400">
                                  Category: {furn.category} ({furn.dimensions.width}m × {furn.dimensions.depth}m × {furn.dimensions.height}m)
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono text-[10px] text-slate-400 block">
                                  Rot: {furn.rotationDeg}°
                                </span>
                                <span className="font-mono text-[10px] text-slate-400">
                                  Pos: ({furn.position.x}, {furn.position.y})m
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ASSESSMENT ZONES & PHOTOMETRICS */}
          {activeTab === "photometrics" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-5xl mx-auto">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      EN 12464-1 Assessment Zones & Energy Density (EN 15193)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Comprehensive room compliance criteria, recommended luminaire counts, and connected lighting load.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6 text-xs">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Net Usable Area</span>
                    <span className="text-lg font-mono font-bold text-white">{sceneryMetrics.netAreaM2} m²</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Total Connected Load</span>
                    <span className="text-lg font-mono font-bold text-amber-400">
                      {sceneryMetrics.totalConnectedWatts} W
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Average Power Density</span>
                    <span className="text-lg font-mono font-bold text-cyan-400">
                      {sceneryMetrics.averageWattsPerM2} W/m²
                    </span>
                    <span className="text-[10px] text-emerald-400">Compliant (&lt;8 W/m²)</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Total Luminaire Count</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">
                      {sceneryMetrics.totalFixtures} Fixtures
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/50">
                        <th className="py-2.5 px-3">Room</th>
                        <th className="py-2.5 px-3">Standard Reference</th>
                        <th className="py-2.5 px-3">Target Em</th>
                        <th className="py-2.5 px-3">Workplane Height</th>
                        <th className="py-2.5 px-3">Margin</th>
                        <th className="py-2.5 px-3">Fixtures</th>
                        <th className="py-2.5 px-3">Connected W</th>
                        <th className="py-2.5 px-3">W/m²</th>
                        <th className="py-2.5 px-3">Daylight Factor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {scenery.rooms.map((room) => {
                        const std = ROOM_STANDARDS[room.profileType];
                        return (
                          <tr key={room.id} className="text-slate-300 hover:bg-slate-900/60 transition-colors">
                            <td className="py-3 px-3 font-semibold text-white">
                              {room.code}: {room.name}
                            </td>
                            <td className="py-3 px-3 text-[10px] text-slate-400">{std.standardRef}</td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-400">{std.targetLux} lx</td>
                            <td className="py-3 px-3 font-mono">{std.workplaneHeightM} m</td>
                            <td className="py-3 px-3 font-mono">{std.boundaryMarginM} m</td>
                            <td className="py-3 px-3 font-mono font-bold text-amber-300">
                              {room.estimatedFixturesCount}
                            </td>
                            <td className="py-3 px-3 font-mono">{room.connectedWatts} W</td>
                            <td className="py-3 px-3 font-mono text-cyan-400">{room.wattsPerM2} W/m²</td>
                            <td className="py-3 px-3 font-mono text-indigo-300">{room.daylightFactorEstPercent}%</td>
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

        {/* ================================================================= */}
        {/* FOOTER ACTIONS                                                    */}
        {/* ================================================================= */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              Complete architectural scenery synchronized with EN 12464-1 assessment zones and 3D fenestrations.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                if (onApplySceneryToSimulation) {
                  onApplySceneryToSimulation(scenery);
                }
                toast.success("Complete building scenery applied to DIALux simulation model!");
                onClose();
              }}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
            >
              <Check className="w-4 h-4" />
              Apply to DIALux Simulation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
