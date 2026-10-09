import React, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  X,
  Maximize2,
  Minimize2,
  Crosshair,
  Sliders,
  RotateCcw,
  Palette,
  Sun,
  Activity,
  Check,
  Copy,
  Layers,
  Sparkles,
  Info,
  Compass,
  ArrowRight,
  Eye,
  EyeOff,
  Filter,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Camera,
  Target,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  ArticulatedLuminaire,
  AimTarget,
  ColorFilter,
  DEFAULT_ARTICULATED_LUMINAIRES,
  DEFAULT_AIM_TARGETS,
  BUILTIN_COLOR_FILTERS,
  cctToRgbHex,
  cctToCieXy,
  getCctColorName,
  generateSpectralPowerDistribution,
  solveInverseKinematicsAiming,
  calculateAimingMetrics,
} from "@/lib/dialux-improving-luminaires-engine";

export interface DialuxImprovingLuminairesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  onApplyLuminairesToSimulation?: (luminaires: ArticulatedLuminaire[]) => void;
}

export function DialuxImprovingLuminairesModal({
  isOpen,
  onClose,
  projectName = "Gallery Exhibition Lighting Design",
  onApplyLuminairesToSimulation,
}: DialuxImprovingLuminairesModalProps) {
  // 1. Navigation & Window State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "viewport" | "joints" | "lamp_color" | "spectrum_filters" | "inventory"
  >("viewport");

  // 2. Project Luminaires & Targets State
  const [luminaires, setLuminaires] = useState<ArticulatedLuminaire[]>(
    DEFAULT_ARTICULATED_LUMINAIRES
  );
  const [selectedLuminaireId, setSelectedLuminaireId] = useState<string>(
    DEFAULT_ARTICULATED_LUMINAIRES[0].id
  );
  const [targets, setTargets] = useState<AimTarget[]>(DEFAULT_AIM_TARGETS);
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    DEFAULT_AIM_TARGETS[0].id
  );

  // 3. Interactive Aiming & Picking Mode
  const [isPickingAimTarget, setIsPickingAimTarget] = useState<boolean>(false);
  const [showLeoBeam, setShowLeoBeam] = useState<boolean>(true);
  const [showLightCone, setShowLightCone] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<"3d" | "top" | "front" | "side">("3d");

  // Current active luminaire & target references
  const currentLuminaire = useMemo(() => {
    return luminaires.find((l) => l.id === selectedLuminaireId) || luminaires[0];
  }, [luminaires, selectedLuminaireId]);

  const currentFilter = useMemo(() => {
    return (
      BUILTIN_COLOR_FILTERS.find((f) => f.id === currentLuminaire.colorFilterId) ||
      BUILTIN_COLOR_FILTERS[0]
    );
  }, [currentLuminaire.colorFilterId]);

  const currentTarget = useMemo(() => {
    return targets.find((t) => t.id === selectedTargetId) || targets[0];
  }, [targets, selectedTargetId]);

  // Derived Aiming & Photometric Metrics
  const aimingMetrics = useMemo(() => {
    return calculateAimingMetrics(currentLuminaire, currentTarget, currentFilter);
  }, [currentLuminaire, currentTarget, currentFilter]);

  // Spectral Power Distribution for active luminaire
  const spdPoints = useMemo(() => {
    return generateSpectralPowerDistribution(
      currentLuminaire.cctKelvin,
      currentLuminaire.criRa,
      currentFilter
    );
  }, [currentLuminaire.cctKelvin, currentLuminaire.criRa, currentFilter]);

  const cieCoords = useMemo(() => {
    return cctToCieXy(currentLuminaire.cctKelvin);
  }, [currentLuminaire.cctKelvin]);

  const lightRgbHex = useMemo(() => {
    if (currentFilter && currentFilter.id !== "none") {
      return currentFilter.hexColor;
    }
    return cctToRgbHex(currentLuminaire.cctKelvin);
  }, [currentLuminaire.cctKelvin, currentFilter]);

  // 4. Three.js Viewport Refs
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const luminaireForkRef = useRef<THREE.Group | null>(null);
  const luminaireHeadRef = useRef<THREE.Group | null>(null);
  const beamConeMeshRef = useRef<THREE.Mesh | null>(null);
  const beamRayLineRef = useRef<THREE.Line | null>(null);
  const spotLightRef = useRef<THREE.SpotLight | null>(null);
  const targetGizmoRef = useRef<THREE.Mesh | null>(null);

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

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(6, 6, 6);
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
    controls.target.set(3, 3, 1.8);
    controlsRef.current = controls;

    // Ambient room base light (subdued so spotlights pop)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(ambientLight);

    // Subtle fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.15);
    fillLight.position.set(3, 10, 5);
    scene.add(fillLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(12, 24, 0x3b82f6, 0x1e293b);
    gridHelper.position.set(3, 3, 0);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Room Geometry (Back Wall North, Side Wall West, Floor)
    // Floor
    const floorGeo = new THREE.PlaneGeometry(8, 8);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.6,
      metalness: 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(3, 3, 0);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // North Wall (y = 6.0)
    const northWallGeo = new THREE.PlaneGeometry(8, 4);
    const northWallMat = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.8,
    });
    const northWall = new THREE.Mesh(northWallGeo, northWallMat);
    northWall.position.set(3, 6, 2);
    northWall.receiveShadow = true;
    scene.add(northWall);

    // West Wall (x = 0.0)
    const westWallGeo = new THREE.PlaneGeometry(8, 4);
    const westWallMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      roughness: 0.85,
    });
    const westWall = new THREE.Mesh(westWallGeo, westWallMat);
    westWall.position.set(0, 3, 2);
    westWall.rotation.y = Math.PI / 2;
    westWall.receiveShadow = true;
    scene.add(westWall);

    // Lighting Track suspended at ceiling (z = 3.5, y = 3.0)
    const trackGeo = new THREE.BoxGeometry(6.5, 0.08, 0.06);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8 });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.position.set(3.5, 3.0, 3.5);
    scene.add(trackMesh);

    // Gallery Artwork Canvas 1 (North Wall)
    const art1Geo = new THREE.BoxGeometry(1.6, 0.05, 1.2);
    const art1Mat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.4,
    });
    const art1 = new THREE.Mesh(art1Geo, art1Mat);
    art1.position.set(1.2, 5.95, 1.8);
    art1.receiveShadow = true;
    art1.userData = { targetId: "target-art-1", name: "Masterpiece Canvas #1" };
    scene.add(art1);

    // Artwork 1 Frame
    const art1FrameGeo = new THREE.BoxGeometry(1.7, 0.06, 1.3);
    const art1FrameMat = new THREE.MeshStandardMaterial({ color: 0xb45309 });
    const art1Frame = new THREE.Mesh(art1FrameGeo, art1FrameMat);
    art1Frame.position.set(1.2, 5.97, 1.8);
    scene.add(art1Frame);

    // Artwork Canvas 2 (North Wall)
    const art2Geo = new THREE.BoxGeometry(1.2, 0.05, 1.5);
    const art2Mat = new THREE.MeshStandardMaterial({
      color: 0xfca5a5,
      roughness: 0.4,
    });
    const art2 = new THREE.Mesh(art2Geo, art2Mat);
    art2.position.set(3.8, 5.95, 1.8);
    art2.userData = { targetId: "target-art-2", name: "Contemporary Acrylic Artwork #2" };
    scene.add(art2);

    // Sculpture Pedestal & Plinth (at x=5.5, y=4.2, z=0 to 1.2)
    const plinthGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 24);
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.set(5.5, 4.2, 0.45);
    plinth.rotation.x = Math.PI / 2;
    scene.add(plinth);

    // Bronze Sculpture (abstract torus knot)
    const sculptureGeo = new THREE.TorusKnotGeometry(0.22, 0.07, 64, 16);
    const sculptureMat = new THREE.MeshStandardMaterial({
      color: 0xcd7f32,
      metalness: 0.85,
      roughness: 0.25,
    });
    const sculpture = new THREE.Mesh(sculptureGeo, sculptureMat);
    sculpture.position.set(5.5, 4.2, 1.2);
    sculpture.castShadow = true;
    sculpture.userData = { targetId: "target-sculpt-1", name: "Bronze Sculpture" };
    scene.add(sculpture);

    // Target Gizmo Crosshair Ring
    const targetRingGeo = new THREE.RingGeometry(0.12, 0.15, 32);
    const targetRingMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const targetRing = new THREE.Mesh(targetRingGeo, targetRingMat);
    targetRing.position.set(1.2, 5.9, 1.8);
    targetRing.renderOrder = 999;
    scene.add(targetRing);
    targetGizmoRef.current = targetRing;

    // -----------------------------------------------------------------------
    // ARTICULATED 3D SPOTLIGHT MODEL
    // Base -> Swivel Fork (Pan) -> Head Cylinder (Tilt)
    // -----------------------------------------------------------------------
    const luminaireRoot = new THREE.Group();
    luminaireRoot.position.set(2.5, 3.0, 3.5);

    // 1. Base Track Adapter
    const baseGeo = new THREE.BoxGeometry(0.14, 0.08, 0.08);
    const lumMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85 });
    const baseMesh = new THREE.Mesh(baseGeo, lumMat);
    baseMesh.position.set(0, 0, -0.04);
    luminaireRoot.add(baseMesh);

    // 2. Swivel Fork (Joint 1: Pan around Z-axis)
    const forkGroup = new THREE.Group();
    const forkGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 16);
    const forkMesh = new THREE.Mesh(forkGeo, lumMat);
    forkMesh.position.set(0, 0, -0.1);
    forkMesh.rotation.x = Math.PI / 2;
    forkGroup.add(forkMesh);
    luminaireRoot.add(forkGroup);
    luminaireForkRef.current = forkGroup;

    // 3. Head Cylinder (Joint 2: Tilt around X-axis)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0, -0.18);

    const headBodyGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.28, 24);
    const headMesh = new THREE.Mesh(headBodyGeo, lumMat);
    headMesh.rotation.x = Math.PI / 2;
    headGroup.add(headMesh);

    // Front Optical Ring / Lens
    const lensGeo = new THREE.CircleGeometry(0.085, 24);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lensMesh = new THREE.Mesh(lensGeo, lensMat);
    lensMesh.position.set(0, 0.141, 0);
    lensMesh.rotation.x = -Math.PI / 2;
    headGroup.add(lensMesh);

    forkGroup.add(headGroup);
    luminaireHeadRef.current = headGroup;

    scene.add(luminaireRoot);

    // -----------------------------------------------------------------------
    // THREE.JS LIGHT SOURCE & BEAM VISUALS
    // -----------------------------------------------------------------------
    // Actual SpotLight
    const spotLight = new THREE.SpotLight(0xffe6a3, 3.5);
    spotLight.position.set(2.5, 3.0, 3.3);
    spotLight.angle = (24 * Math.PI) / 180;
    spotLight.penumbra = 0.4;
    spotLight.castShadow = true;
    spotLight.target.position.set(1.2, 5.8, 1.8);
    scene.add(spotLight);
    scene.add(spotLight.target);
    spotLightRef.current = spotLight;

    // LEO Ray (Dashed centerline from lens to target)
    const rayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(2.5, 3.0, 3.3),
      new THREE.Vector3(1.2, 5.8, 1.8),
    ]);
    const rayMat = new THREE.LineDashedMaterial({
      color: 0xfacc15,
      dashSize: 0.15,
      gapSize: 0.08,
      linewidth: 2,
    });
    const rayLine = new THREE.Line(rayGeo, rayMat);
    rayLine.computeLineDistances();
    scene.add(rayLine);
    beamRayLineRef.current = rayLine;

    // Beam Cone Mesh (Volumetric semi-transparent light cone)
    const coneGeo = new THREE.ConeGeometry(0.8, 3.5, 24, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffe6a3,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    scene.add(coneMesh);
    beamConeMeshRef.current = coneMesh;

    // Raycaster for 3D Target Picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (event: MouseEvent) => {
      if (!isPickingAimTarget) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(
        [floorMesh, northWall, westWall, art1, art2, sculpture, plinth],
        true
      );

      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitPoint = hit.point;

        // Apply new target point
        const newTarget: AimTarget = {
          id: `custom-target-${Date.now()}`,
          name: `Clicked 3D Scene Point (${hitPoint.x.toFixed(1)}m, ${hitPoint.y.toFixed(1)}m, ${hitPoint.z.toFixed(1)}m)`,
          category: hitPoint.z < 0.2 ? "floor_zone" : "artwork",
          position: {
            x: Math.round(hitPoint.x * 100) / 100,
            y: Math.round(hitPoint.y * 100) / 100,
            z: Math.round(hitPoint.z * 100) / 100,
          },
          normal: {
            x: hit.face ? hit.face.normal.x : 0,
            y: hit.face ? hit.face.normal.y : 0,
            z: hit.face ? hit.face.normal.z : 1,
          },
          description: "Target point selected via 3D interactive click aiming.",
        };

        setTargets((prev) => [newTarget, ...prev]);
        setSelectedTargetId(newTarget.id);

        // Aim current luminaire at this point using IK
        aimLuminaireAtPoint(currentLuminaire.id, newTarget.position, newTarget.name);
        setIsPickingAimTarget(false);
        toast.success(`Aiming locked to (${newTarget.position.x}m, ${newTarget.position.y}m, ${newTarget.position.z}m)!`);
      }
    };

    renderer.domElement.addEventListener("click", handleCanvasClick);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
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
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isOpen]);

  // -------------------------------------------------------------------------
  // UPDATE 3D VIEWPORT ON STATE CHANGES (JOINTS, TARGET, COLOR)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current) return;

    const panJoint = currentLuminaire.joints.find((j) => j.type === "pan");
    const tiltJoint = currentLuminaire.joints.find((j) => j.type === "tilt");
    const rollJoint = currentLuminaire.joints.find((j) => j.type === "roll");

    const panAngle = panJoint ? panJoint.currentAngleDeg : 0;
    const tiltAngle = tiltJoint ? tiltJoint.currentAngleDeg : 0;
    const rollAngle = rollJoint ? rollJoint.currentAngleDeg : 0;

    // 1. Update Fork Pan Rotation (around Z)
    if (luminaireForkRef.current) {
      luminaireForkRef.current.rotation.z = (panAngle * Math.PI) / 180;
    }

    // 2. Update Head Tilt Rotation (around X)
    if (luminaireHeadRef.current) {
      luminaireHeadRef.current.rotation.x = (tiltAngle * Math.PI) / 180;
      luminaireHeadRef.current.rotation.y = (rollAngle * Math.PI) / 180;
    }

    // 3. Update Target Gizmo Position
    if (targetGizmoRef.current && currentTarget) {
      targetGizmoRef.current.position.set(
        currentTarget.position.x,
        currentTarget.position.y - 0.02,
        currentTarget.position.z
      );
      if (currentTarget.normal.z > 0.5) {
        // Floor horizontal
        targetGizmoRef.current.rotation.x = Math.PI / 2;
      } else {
        // Wall vertical
        targetGizmoRef.current.rotation.x = 0;
      }
    }

    // 4. Update Light Source & Colors
    const hexColorVal = parseInt(lightRgbHex.replace("#", ""), 16);
    if (spotLightRef.current && currentTarget) {
      spotLightRef.current.color.setHex(hexColorVal);
      spotLightRef.current.angle = (currentLuminaire.beamAngleDeg * Math.PI) / 180;
      spotLightRef.current.intensity = (currentLuminaire.nominalLumens / 600) * (currentFilter.transmittance);
      spotLightRef.current.target.position.set(
        currentTarget.position.x,
        currentTarget.position.y,
        currentTarget.position.z
      );
    }

    // 5. Update LEO Ray & Cone
    const lumPos = new THREE.Vector3(
      currentLuminaire.position.x,
      currentLuminaire.position.y,
      currentLuminaire.position.z - 0.2
    );
    const tarPos = new THREE.Vector3(
      currentTarget.position.x,
      currentTarget.position.y,
      currentTarget.position.z
    );

    if (beamRayLineRef.current) {
      beamRayLineRef.current.visible = showLeoBeam;
      const points = [lumPos, tarPos];
      beamRayLineRef.current.geometry.setFromPoints(points);
      beamRayLineRef.current.computeLineDistances();
    }

    if (beamConeMeshRef.current) {
      beamConeMeshRef.current.visible = showLightCone;
      (beamConeMeshRef.current.material as THREE.MeshBasicMaterial).color.setHex(hexColorVal);

      const dir = new THREE.Vector3().subVectors(tarPos, lumPos);
      const dist = dir.length();
      const mid = new THREE.Vector3().addVectors(lumPos, tarPos).multiplyScalar(0.5);

      beamConeMeshRef.current.position.copy(mid);
      beamConeMeshRef.current.scale.set(
        dist * Math.tan((currentLuminaire.beamAngleDeg / 2 * Math.PI) / 180),
        dist,
        dist * Math.tan((currentLuminaire.beamAngleDeg / 2 * Math.PI) / 180)
      );
      beamConeMeshRef.current.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.clone().normalize()
      );
    }
  }, [
    currentLuminaire,
    currentTarget,
    currentFilter,
    lightRgbHex,
    showLeoBeam,
    showLightCone,
  ]);

  // -------------------------------------------------------------------------
  // CAMERA PRESETS
  // -------------------------------------------------------------------------
  const applyCameraPreset = (preset: "3d" | "top" | "front" | "side") => {
    if (!cameraRef.current || !controlsRef.current) return;
    setCameraPreset(preset);

    if (preset === "3d") {
      cameraRef.current.position.set(6, 6, 6);
      controlsRef.current.target.set(3, 3, 1.8);
    } else if (preset === "top") {
      cameraRef.current.position.set(3, 3, 9);
      controlsRef.current.target.set(3, 3, 0);
    } else if (preset === "front") {
      cameraRef.current.position.set(3, -2, 2.5);
      controlsRef.current.target.set(3, 6, 2.0);
    } else if (preset === "side") {
      cameraRef.current.position.set(-3, 3, 2.5);
      controlsRef.current.target.set(6, 3, 2.0);
    }
    controlsRef.current.update();
  };

  // -------------------------------------------------------------------------
  // INVERSE KINEMATICS AIMING ACTION
  // -------------------------------------------------------------------------
  const aimLuminaireAtPoint = (
    lumId: string,
    targetPoint: { x: number; y: number; z: number },
    targetName?: string
  ) => {
    const lum = luminaires.find((l) => l.id === lumId);
    if (!lum) return;

    const ik = solveInverseKinematicsAiming(lum.position, targetPoint);

    setLuminaires((prev) =>
      prev.map((l) => {
        if (l.id !== lumId) return l;
        return {
          ...l,
          targetPoint: { ...targetPoint, name: targetName },
          joints: l.joints.map((j) => {
            if (j.type === "pan") return { ...j, currentAngleDeg: ik.panAngleDeg };
            if (j.type === "tilt") return { ...j, currentAngleDeg: ik.tiltAngleDeg };
            return j;
          }),
        };
      })
    );
  };

  // Reset Angle to Default (0°, 0°, 0°)
  const handleResetAngle = () => {
    setLuminaires((prev) =>
      prev.map((l) => {
        if (l.id !== currentLuminaire.id) return l;
        return {
          ...l,
          joints: l.joints.map((j) => ({ ...j, currentAngleDeg: 0 })),
        };
      })
    );
    toast.info("Joint angles reset to nadir default (0°, 0°, 0°).");
  };

  // Copy Alignment to All Fixtures
  const handleCopyJointAimToAll = () => {
    const panAngle = currentLuminaire.joints.find((j) => j.type === "pan")?.currentAngleDeg || 0;
    const tiltAngle = currentLuminaire.joints.find((j) => j.type === "tilt")?.currentAngleDeg || 0;
    const rollAngle = currentLuminaire.joints.find((j) => j.type === "roll")?.currentAngleDeg || 0;

    setLuminaires((prev) =>
      prev.map((l) => ({
        ...l,
        joints: l.joints.map((j) => {
          if (j.type === "pan") return { ...j, currentAngleDeg: panAngle };
          if (j.type === "tilt") return { ...j, currentAngleDeg: tiltAngle };
          if (j.type === "roll") return { ...j, currentAngleDeg: rollAngle };
          return j;
        }),
      }))
    );
    toast.success(`Copied joint angles (Pan ${panAngle}°, Tilt ${tiltAngle}°) to all luminaires!`);
  };

  // Update Joint Angle Manually
  const handleJointAngleChange = (jointId: string, newAngleDeg: number) => {
    setLuminaires((prev) =>
      prev.map((l) => {
        if (l.id !== currentLuminaire.id) return l;
        return {
          ...l,
          joints: l.joints.map((j) => {
            if (j.id !== jointId) return j;
            return {
              ...j,
              currentAngleDeg: Math.max(j.minAngleDeg, Math.min(j.maxAngleDeg, newAngleDeg)),
            };
          }),
        };
      })
    );
  };

  // Update CCT Kelvin
  const handleCctChange = (kelvin: number) => {
    setLuminaires((prev) =>
      prev.map((l) => (l.id === currentLuminaire.id ? { ...l, cctKelvin: kelvin } : l))
    );
  };

  // Update Color Filter
  const handleFilterSelect = (filterId: string) => {
    setLuminaires((prev) =>
      prev.map((l) => (l.id === currentLuminaire.id ? { ...l, colorFilterId: filterId } : l))
    );
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
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Crosshair className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Improving Luminaires Studio
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 rounded-full">
                  DIALux evo Tutorial Part 28
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 rounded-full">
                  Joints & Light Colour
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-axis joint articulation, 3D target point picking (Inverse Kinematics), CCT Planckian tuning, and optical filters.
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
                  ? "border-cyan-500 text-cyan-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Camera className="w-4 h-4" />
              1. 3D Viewport & Aiming
            </button>
            <button
              onClick={() => setActiveTab("joints")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "joints"
                  ? "border-cyan-500 text-cyan-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sliders className="w-4 h-4" />
              2. Joints & Kinematics
            </button>
            <button
              onClick={() => setActiveTab("lamp_color")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "lamp_color"
                  ? "border-cyan-500 text-cyan-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sun className="w-4 h-4" />
              3. Lamp Tool & Light Colour (CCT)
            </button>
            <button
              onClick={() => setActiveTab("spectrum_filters")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "spectrum_filters"
                  ? "border-cyan-500 text-cyan-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Filter className="w-4 h-4" />
              4. Spectral Power & Color Filters
            </button>
            <button
              onClick={() => setActiveTab("inventory")}
              className={`px-3 py-2.5 font-medium border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "inventory"
                  ? "border-cyan-500 text-cyan-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              5. Luminaire Inventory ({luminaires.length})
            </button>
          </div>

          {/* Quick Active Luminaire Badge */}
          <div className="flex items-center gap-2 py-1">
            <span className="text-slate-400 text-[11px]">Selected:</span>
            <select
              value={selectedLuminaireId}
              onChange={(e) => setSelectedLuminaireId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-[11px] focus:outline-none focus:border-cyan-500"
            >
              {luminaires.map((lum) => (
                <option key={lum.id} value={lum.id}>
                  {lum.name} ({lum.beamAngleDeg}°)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MAIN BODY WORKSPACE                                               */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-hidden p-4">
          {/* TAB 1: 3D VIEWPORT & AIMING */}
          {activeTab === "viewport" && (
            <div className="h-full flex flex-col lg:flex-row gap-4">
              {/* Left: Three.js Canvas Container */}
              <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col">
                <div ref={canvasContainerRef} className="w-full flex-1 cursor-grab active:cursor-grabbing" />

                {/* Top Viewport Floating Controls */}
                <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-800/80 shadow-lg text-xs">
                  <span className="text-slate-400 font-semibold mr-1">Camera:</span>
                  <button
                    onClick={() => applyCameraPreset("3d")}
                    className={`px-2 py-1 rounded transition-colors ${
                      cameraPreset === "3d" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    3D Perspective
                  </button>
                  <button
                    onClick={() => applyCameraPreset("top")}
                    className={`px-2 py-1 rounded transition-colors ${
                      cameraPreset === "top" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Top (Plan)
                  </button>
                  <button
                    onClick={() => applyCameraPreset("front")}
                    className={`px-2 py-1 rounded transition-colors ${
                      cameraPreset === "front" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    North Wall
                  </button>
                  <button
                    onClick={() => applyCameraPreset("side")}
                    className={`px-2 py-1 rounded transition-colors ${
                      cameraPreset === "side" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    Side Elevation
                  </button>

                  <div className="h-4 w-px bg-slate-700 mx-1" />

                  {/* LEO & Beam Toggles */}
                  <button
                    onClick={() => setShowLeoBeam(!showLeoBeam)}
                    className={`flex items-center gap-1 px-2 py-1 rounded ${
                      showLeoBeam ? "bg-amber-600/30 text-amber-300 border border-amber-600/50" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    LEO Ray
                  </button>
                  <button
                    onClick={() => setShowLightCone(!showLightCone)}
                    className={`flex items-center gap-1 px-2 py-1 rounded ${
                      showLightCone ? "bg-indigo-600/30 text-indigo-300 border border-indigo-600/50" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    <Lightbulb className="w-3 h-3" />
                    Beam Cone
                  </button>
                </div>

                {/* Interactive "Set Illumination Point" Banner / Button */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    onClick={() => setIsPickingAimTarget(!isPickingAimTarget)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-xs shadow-xl transition-all ${
                      isPickingAimTarget
                        ? "bg-rose-600 hover:bg-rose-500 text-white ring-4 ring-rose-500/30 animate-pulse"
                        : "bg-cyan-600 hover:bg-cyan-500 text-white"
                    }`}
                  >
                    <Crosshair className="w-4 h-4" />
                    {isPickingAimTarget ? "Click Any 3D Face to Aim..." : "Set Illumination Point"}
                  </button>
                </div>

                {/* Bottom Viewport Photometric HUD */}
                <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-800 p-3 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full border border-white/40 shadow-sm"
                      style={{ backgroundColor: lightRgbHex }}
                    />
                    <div>
                      <span className="text-slate-400 block text-[10px]">CCT / Light Colour</span>
                      <span className="font-bold text-white">
                        {currentLuminaire.cctKelvin}K ({getCctColorName(currentLuminaire.cctKelvin)})
                      </span>
                    </div>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Aiming Target</span>
                    <span className="font-semibold text-cyan-300">{currentTarget.name}</span>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Throw Distance</span>
                    <span className="font-mono font-bold text-white">{aimingMetrics.throwDistanceMeters} m</span>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Target Illuminance</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {aimingMetrics.targetIlluminanceLux} lx
                    </span>
                  </div>

                  <div className="h-6 w-px bg-slate-800 hidden sm:block" />

                  <div>
                    <span className="text-slate-400 block text-[10px]">Spot Footprint</span>
                    <span className="font-mono text-slate-300">
                      {aimingMetrics.spotWidthMeters}m × {aimingMetrics.spotHeightMeters}m ({aimingMetrics.spotAreaM2} m²)
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Sidebar: Quick Aim Targets & Joint Angle Summary */}
              <div className="w-full lg:w-80 flex flex-col gap-3 overflow-y-auto">
                {/* Aim Target Picker Card */}
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-4 h-4" />
                      Aim at Target Point
                    </h3>
                    <span className="text-[10px] text-slate-400">{targets.length} predefined</span>
                  </div>

                  <div className="space-y-1.5">
                    {targets.map((tgt) => {
                      const isSelected = tgt.id === selectedTargetId;
                      return (
                        <div
                          key={tgt.id}
                          onClick={() => {
                            setSelectedTargetId(tgt.id);
                            aimLuminaireAtPoint(currentLuminaire.id, tgt.position, tgt.name);
                            toast.success(`Aiming updated to: ${tgt.name}`);
                          }}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? "bg-cyan-950/50 border-cyan-500/80 text-white"
                              : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850"
                          }`}
                        >
                          <div className="flex items-center justify-between font-medium">
                            <span>{tgt.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{tgt.description}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-slate-400">
                            <span>Pos: ({tgt.position.x}, {tgt.position.y}, {tgt.position.z})m</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Active Joint Rotations Card */}
                <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="w-4 h-4" />
                      Joint Rotations
                    </h3>
                    <button
                      onClick={handleResetAngle}
                      className="text-[10px] text-slate-400 hover:text-cyan-400 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset (0°)
                    </button>
                  </div>

                  <div className="space-y-3">
                    {currentLuminaire.joints.map((joint) => (
                      <div key={joint.id} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300">{joint.name}</span>
                          <span className="font-mono font-bold text-cyan-400">{joint.currentAngleDeg}°</span>
                        </div>
                        <input
                          type="range"
                          min={joint.minAngleDeg}
                          max={joint.maxAngleDeg}
                          step={1}
                          value={joint.currentAngleDeg}
                          onChange={(e) => handleJointAngleChange(joint.id, parseFloat(e.target.value))}
                          className="w-full accent-cyan-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>{joint.minAngleDeg}°</span>
                          <span>{joint.maxAngleDeg}°</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleCopyJointAimToAll}
                    className="w-full mt-4 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Joint Aim to All Spotlights
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: JOINTS & KINEMATICS */}
          {activeTab === "joints" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-4xl mx-auto">
              {/* Overview Card */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-cyan-400" />
                      Joint Kinematics & Mechanical Degrees of Freedom
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Configure articulation joints for <strong className="text-slate-200">{currentLuminaire.name}</strong>.
                      Adjust individual rotation axes or use Inverse Kinematics to calculate exact aiming angles.
                    </p>
                  </div>
                  <button
                    onClick={handleResetAngle}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset to Nadir (0°, 0°, 0°)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  {currentLuminaire.joints.map((joint) => (
                    <div
                      key={joint.id}
                      className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-white">{joint.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                            Axis: {joint.rotationAxis.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {joint.type === "pan" && "Azimuth rotation around the vertical mounting stem."}
                          {joint.type === "tilt" && "Elevation angle off nadir (0° down to 90° horizontal)."}
                          {joint.type === "roll" && "Axial roll of luminaire head for oval beam orientation."}
                        </p>
                      </div>

                      <div className="mt-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Current Angle:</span>
                          <span className="text-lg font-mono font-bold text-cyan-400">{joint.currentAngleDeg}°</span>
                        </div>
                        <input
                          type="range"
                          min={joint.minAngleDeg}
                          max={joint.maxAngleDeg}
                          step={1}
                          value={joint.currentAngleDeg}
                          onChange={(e) => handleJointAngleChange(joint.id, parseFloat(e.target.value))}
                          className="w-full accent-cyan-500 bg-slate-800 h-2 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Min: {joint.minAngleDeg}°</span>
                          <span>Max: {joint.maxAngleDeg}°</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inverse Kinematics Aiming Result Card */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4" />
                  Target Point Vector & Photometric Calculation
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Aiming Target</span>
                    <span className="font-bold text-white">{currentTarget.name}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Throw Distance</span>
                    <span className="font-mono font-bold text-cyan-400">{aimingMetrics.throwDistanceMeters} m</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Incident Angle (Normal)</span>
                    <span className="font-mono font-bold text-amber-400">{aimingMetrics.incidentAngleDeg}°</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Direct Illuminance</span>
                    <span className="font-mono font-bold text-emerald-400 text-base">
                      {aimingMetrics.targetIlluminanceLux} lx
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-indigo-300">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Inverse Kinematics automatically aligns Joint 1 (Pan: {aimingMetrics.panAngleDeg}°) and
                      Joint 2 (Tilt: {aimingMetrics.tiltAngleDeg}°) directly with the target surface.
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      aimLuminaireAtPoint(currentLuminaire.id, currentTarget.position, currentTarget.name);
                      toast.success("Inverse Kinematics applied to current luminaire!");
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-xs whitespace-nowrap ml-3"
                  >
                    Apply Aiming Angles
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LAMP TOOL & LIGHT COLOUR (CCT) */}
          {activeTab === "lamp_color" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-4xl mx-auto">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sun className="w-5 h-5 text-amber-400" />
                      Lamp Tool & Correlated Colour Temperature (CCT)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Tune color temperature from candlelight warm (1800K) to cool overcast daylight (10000K).
                      Color coordinates are derived along the Planckian blackbody locus.
                    </p>
                  </div>

                  {/* Visual Color Preview Chip */}
                  <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white/50 shadow-lg"
                      style={{ backgroundColor: lightRgbHex }}
                    />
                    <div>
                      <span className="font-mono text-xs font-bold text-white block">{lightRgbHex}</span>
                      <span className="text-[10px] text-slate-400">{currentLuminaire.cctKelvin} Kelvin</span>
                    </div>
                  </div>
                </div>

                {/* CCT Kelvin Slider with Thermal Gradient Bar */}
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-semibold">Colour Temperature:</span>
                    <span className="text-xl font-mono font-bold text-amber-400">
                      {currentLuminaire.cctKelvin} K
                    </span>
                  </div>

                  {/* Gradient Slider Track */}
                  <div className="relative pt-1">
                    <input
                      type="range"
                      min={1800}
                      max={8500}
                      step={50}
                      value={currentLuminaire.cctKelvin}
                      onChange={(e) => handleCctChange(parseInt(e.target.value))}
                      className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background:
                          "linear-gradient(to right, #ff8a00, #ffb347, #ffe4b5, #ffffff, #cce4ff, #8ab8ff)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>1800K (Candle)</span>
                    <span>2700K (Warm)</span>
                    <span>4000K (Neutral)</span>
                    <span>6500K (Daylight)</span>
                    <span>8500K (Sky)</span>
                  </div>
                </div>

                {/* Quick CCT Presets */}
                <div className="mt-6">
                  <span className="text-xs font-semibold text-slate-400 block mb-2">Standard Presets:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {[
                      { k: 2200, label: "2200K Sunset" },
                      { k: 2700, label: "2700K Warm" },
                      { k: 3000, label: "3000K Halogen" },
                      { k: 4000, label: "4000K Neutral" },
                      { k: 5000, label: "5000K Studio" },
                      { k: 6500, label: "6500K D65" },
                    ].map((preset) => (
                      <button
                        key={preset.k}
                        onClick={() => handleCctChange(preset.k)}
                        className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                          currentLuminaire.cctKelvin === preset.k
                            ? "bg-amber-600/30 border-amber-500 text-amber-200"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full mx-auto mb-1 border border-white/20"
                          style={{ backgroundColor: cctToRgbHex(preset.k) }}
                        />
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Rendering Index (CRI / Ra) & Chromaticity Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80 text-xs">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Color Rendering Index</span>
                    <span className="text-lg font-mono font-bold text-white">Ra {currentLuminaire.criRa}</span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">
                      {currentLuminaire.criRa >= 95 ? "Museum Quality (CIE 13.3)" : "Commercial Grade"}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">CIE 1931 Chromaticity</span>
                    <span className="text-lg font-mono font-bold text-cyan-400">
                      x: {cieCoords.x.toFixed(3)}, y: {cieCoords.y.toFixed(3)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Planckian Locus (D65)</span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">Circadian Impact (EML)</span>
                    <span className="text-lg font-mono font-bold text-indigo-400">
                      {(currentLuminaire.cctKelvin / 4000 * 0.75).toFixed(2)} M/P
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Melanopic Lux Ratio</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SPECTRAL POWER DISTRIBUTION & COLOR FILTERS */}
          {activeTab === "spectrum_filters" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-5xl mx-auto">
              {/* Spectral Power Distribution SVG Chart */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      Spectral Power Distribution (SPD) — 380 nm to 780 nm
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Relative spectral irradiance showing blue pump peak (450nm), phosphor emission, and filter modulation.
                    </p>
                  </div>
                  <span className="text-xs font-mono px-2 py-1 bg-slate-900 border border-slate-800 rounded text-cyan-300">
                    Filter: {currentFilter.name} ({Math.round(currentFilter.transmittance * 100)}% τ)
                  </span>
                </div>

                {/* SVG Graph */}
                <div className="h-44 w-full bg-slate-900/90 rounded-lg p-3 border border-slate-800 flex flex-col justify-end relative">
                  <svg className="w-full h-36 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                    {/* Wavelength Color Gradient Defs */}
                    <defs>
                      <linearGradient id="spectrumGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#7842f5" stopOpacity="0.4" />
                        <stop offset="15%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="35%" stopColor="#10b981" stopOpacity="0.4" />
                        <stop offset="55%" stopColor="#facc15" stopOpacity="0.4" />
                        <stop offset="75%" stopColor="#f97316" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>

                    {/* Area fill */}
                    <polygon
                      fill="url(#spectrumGradient)"
                      points={`0,100 ${spdPoints
                        .map((p, idx) => {
                          const x = (idx / (spdPoints.length - 1)) * 100;
                          const y = 100 - p.relativePower * 95;
                          return `${x},${y}`;
                        })
                        .join(" ")} 100,100`}
                    />

                    {/* Curve line */}
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      points={spdPoints
                        .map((p, idx) => {
                          const x = (idx / (spdPoints.length - 1)) * 100;
                          const y = 100 - p.relativePower * 95;
                          return `${x},${y}`;
                        })
                        .join(" ")}
                    />
                  </svg>

                  {/* Horizontal Wavelength Axis */}
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-2 pt-1 border-t border-slate-800">
                    <span>380 nm (UV)</span>
                    <span>450 nm (Blue)</span>
                    <span>520 nm (Green)</span>
                    <span>590 nm (Yellow)</span>
                    <span>650 nm (Red)</span>
                    <span>780 nm (IR)</span>
                  </div>
                </div>
              </div>

              {/* Optical Color Filters Catalog */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Filter className="w-4 h-4 text-purple-400" />
                    Optical Color Filter Library (Rosco / Lee Simulation)
                  </h3>
                  <span className="text-xs text-slate-400">Affects luminous flux & colorimetry</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {BUILTIN_COLOR_FILTERS.map((f) => {
                    const isSelected = f.id === currentLuminaire.colorFilterId;
                    return (
                      <div
                        key={f.id}
                        onClick={() => handleFilterSelect(f.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? "bg-purple-950/50 border-purple-500 shadow-md ring-2 ring-purple-500/30"
                            : "bg-slate-900 border-slate-800 hover:bg-slate-850"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white truncate">{f.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                          </div>
                          <span className="text-[10px] font-mono text-purple-300 block">{f.code}</span>
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{f.description}</p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                          <div
                            className="w-4 h-4 rounded-full border border-white/40 shadow-sm"
                            style={{ backgroundColor: f.hexColor }}
                          />
                          <span className="font-mono text-[10px] text-slate-300">
                            τ = {Math.round(f.transmittance * 100)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LUMINAIRE INVENTORY */}
          {activeTab === "inventory" && (
            <div className="h-full overflow-y-auto space-y-4 max-w-5xl mx-auto">
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-cyan-400" />
                      Project Luminaire Articulation & Aiming Schedule
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Complete summary of all directional luminaires, active joint angles, target points, and resulting illuminance.
                    </p>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300">
                    {luminaires.length} Fixtures Installed
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/50">
                        <th className="py-2.5 px-3">Luminaire</th>
                        <th className="py-2.5 px-3">Mounting Pos</th>
                        <th className="py-2.5 px-3">Joint Angles (Pan / Tilt / Roll)</th>
                        <th className="py-2.5 px-3">Light Colour (CCT)</th>
                        <th className="py-2.5 px-3">Beam Angle</th>
                        <th className="py-2.5 px-3">Target</th>
                        <th className="py-2.5 px-3">Target Lux</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {luminaires.map((lum) => {
                        const pan = lum.joints.find((j) => j.type === "pan")?.currentAngleDeg || 0;
                        const tilt = lum.joints.find((j) => j.type === "tilt")?.currentAngleDeg || 0;
                        const roll = lum.joints.find((j) => j.type === "roll")?.currentAngleDeg || 0;
                        const isSelected = lum.id === selectedLuminaireId;

                        return (
                          <tr
                            key={lum.id}
                            className={`transition-colors ${
                              isSelected ? "bg-cyan-950/30 text-white" : "text-slate-300 hover:bg-slate-900/60"
                            }`}
                          >
                            <td className="py-3 px-3">
                              <span className="font-semibold block">{lum.name}</span>
                              <span className="text-[10px] text-slate-400">{lum.model}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                              ({lum.position.x}, {lum.position.y}, {lum.position.z})m
                            </td>
                            <td className="py-3 px-3 font-mono font-medium text-cyan-400">
                              {pan}° / {tilt}° / {roll}°
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-3 h-3 rounded-full border border-white/30"
                                  style={{ backgroundColor: cctToRgbHex(lum.cctKelvin) }}
                                />
                                <span>{lum.cctKelvin}K</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono">{lum.beamAngleDeg}°</td>
                            <td className="py-3 px-3 text-cyan-300 font-medium">
                              {lum.targetPoint?.name || "Nadir Floor"}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                              {aimingMetrics.targetIlluminanceLux} lx
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => {
                                  setSelectedLuminaireId(lum.id);
                                  setActiveTab("viewport");
                                }}
                                className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/60 border border-cyan-500/50 text-cyan-200 rounded text-[11px] font-medium transition-colors"
                              >
                                Edit Joints
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

        {/* ================================================================= */}
        {/* FOOTER ACTIONS                                                    */}
        {/* ================================================================= */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              All joints articulated with real-time Inverse Kinematics, Planckian colorimetry, and filter derating.
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
                if (onApplyLuminairesToSimulation) {
                  onApplyLuminairesToSimulation(luminaires);
                }
                toast.success("Improved luminaire settings successfully applied to DIALux simulation!");
                onClose();
              }}
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all"
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
