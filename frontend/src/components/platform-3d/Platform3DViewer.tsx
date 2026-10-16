import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { extractSpacesFromIFCFile } from '@/lib/bimViewerSpaceExtractor';

export function Platform3DViewer() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [colorMode, setColorMode] = useState<'full' | 'mono'>('full');
  const [cameraMode, setCameraMode] = useState<'orbit' | 'walk'>('orbit');
  const [isClipActive, setIsClipActive] = useState(false);
  const [isTagsActive, setIsTagsActive] = useState(true);
  const [isSpacesActive, setIsSpacesActive] = useState(true);
  const [selectedSpaceInfo, setSelectedSpaceInfo] = useState<string>("Click on a space in 3D view to select it.");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Drag & Drop .ifc file here');
  const [isDragOver, setIsDragOver] = useState(false);

  const engineRef = useRef<any>(null);

  useEffect(() => {
    if (!viewportRef.current) return;
    const viewport = viewportRef.current;
    let isMounted = true;

    Promise.all([
      import('@thatopen/components'),
      import('@thatopen/components-front'),
      import('three'),
      import('three/examples/jsm/renderers/CSS2DRenderer')
    ])
      .then(([OBC, OBCF, THREE, { CSS2DRenderer }]) => {
        if (!isMounted) return;

        const components = new OBC.Components();
        const worlds = components.get(OBC.Worlds);
        const world = worlds.create<any, any, any>();

        world.scene = new OBC.SimpleScene(components);
        world.renderer = new OBC.SimpleRenderer(components, viewport, { logarithmicDepthBuffer: true });
        world.camera = new OBC.OrthoPerspectiveCamera(components);

        world.scene.setup();
        world.scene.three.background = new THREE.Color(0x242426);
        components.init();

        const css2DRenderer = new CSS2DRenderer();
        css2DRenderer.setSize(viewport.clientWidth, viewport.clientHeight);
        Object.assign(css2DRenderer.domElement.style, { position: 'absolute', top: '0px', pointerEvents: 'none' });
        viewport.appendChild(css2DRenderer.domElement);

        world.renderer.onBeforeUpdate.add(() => css2DRenderer.render(world.scene.three, world.camera.three));

        const resizeObserver = new ResizeObserver(() => {
          world.renderer?.resize();
          world.camera?.updateAspect();
          css2DRenderer.setSize(viewport.clientWidth, viewport.clientHeight);
        });
        resizeObserver.observe(viewport);

        engineRef.current = { components, world, css2DRenderer };
      })
      .catch((err) => {
        console.error("3D Engine Init Error:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleFileSelect = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith('.ifc')) return;
    setIsLoading(true);
    setLoadingText(`Parsing 3D BIM model ${file.name}...`);

    try {
      const spaces = await extractSpacesFromIFCFile(file);
      if (typeof window !== "undefined") {
        (window as any).__BIM_VIEWER_SPACES__ = spaces;
        (window as any).__BIM_VIEWER_ACTIVE_FILE__ = file.name;
        try {
          localStorage.setItem('mep_active_bim_spaces', JSON.stringify(spaces));
          localStorage.setItem('mep_active_bim_filename', file.name);
        } catch (e) {
          // ignore storage quota errors for large models
        }
      }
      setIsLoading(false);
      setIsLoaded(true);
      if (spaces.length > 0) {
        toast.success(`Loaded 3D BIM model with ${spaces.length} spatial zones ready for calculator import!`);
      } else {
        toast.success(`Loaded 3D model ${file.name}`);
      }
    } catch (err) {
      console.error("Error parsing IFC model:", err);
      setIsLoading(false);
      setIsLoaded(true);
      toast.error("Failed to extract spatial data from IFC file.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  return (
    <div className="flex w-full h-full bg-[#242426] text-white font-sans overflow-hidden relative">
      {/* Main Viewport Container */}
      <div className="flex-1 relative w-full h-full">
        {/* Top Floating Toolbar */}
        <div className="absolute top-[15px] left-1/2 -translate-x-1/2 bg-[rgba(30,30,32,0.85)] backdrop-blur-[10px] p-[8px] rounded-[8px] flex items-center gap-[10px] border border-[#444] z-30 select-none">
          {/* 3D / 2D Toggle Group */}
          <div className="inline-flex bg-[#1a1a1c] rounded-[6px] p-[2px] border border-[#333] gap-[2px]">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-[12px] py-[6px] rounded-[4px] text-[12px] font-bold transition-all ${
                viewMode === '3d' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'
              }`}
            >
              3D View
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`px-[12px] py-[6px] rounded-[4px] text-[12px] font-bold transition-all ${
                viewMode === '2d' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'
              }`}
            >
              2D View
            </button>
          </div>

          <div className="w-[1px] h-[20px] bg-[#444] mx-[4px]" />

          {/* Color / Grayscale Toggle Group */}
          <div className="inline-flex bg-[#1a1a1c] rounded-[6px] p-[2px] border border-[#333] gap-[2px]">
            <button
              onClick={() => setColorMode('full')}
              className={`px-[12px] py-[6px] rounded-[4px] text-[12px] font-bold transition-all ${
                colorMode === 'full' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'
              }`}
            >
              Color
            </button>
            <button
              onClick={() => setColorMode('mono')}
              className={`px-[12px] py-[6px] rounded-[4px] text-[12px] font-bold transition-all ${
                colorMode === 'mono' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'
              }`}
            >
              Grayscale
            </button>
          </div>

          <div className="w-[1px] h-[20px] bg-[#444] mx-[4px]" />

          {/* Mode Controls */}
          {viewMode === '3d' && (
            <>
              <button
                onClick={() => setCameraMode('orbit')}
                className={`px-[12px] py-[8px] rounded-[4px] text-[12px] font-bold transition-all ${
                  cameraMode === 'orbit' ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'
                }`}
              >
                Orbit
              </button>
              <button
                onClick={() => setCameraMode('walk')}
                className={`px-[12px] py-[8px] rounded-[4px] text-[12px] font-bold transition-all ${
                  cameraMode === 'walk' ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'
                }`}
              >
                Walk
              </button>
              <button
                onClick={() => setIsClipActive(!isClipActive)}
                className={`px-[12px] py-[8px] rounded-[4px] text-[12px] font-bold transition-all ${
                  isClipActive ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'
                }`}
              >
                Cut Plane
              </button>
            </>
          )}
        </div>

        {/* Center Dashed Drop Overlay (shown when not loaded or loading) */}
        {(!isLoaded || isLoading) && (
          <div
            onClick={() => !isLoading && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`absolute inset-0 flex flex-col items-center justify-center z-20 m-[20px] rounded-[12px] transition-all duration-300 cursor-pointer select-none ${
              isDragOver
                ? 'border-[#4da6ff] bg-[rgba(36,36,38,0.96)] shadow-xl scale-[0.99]'
                : 'border-[#555] bg-[rgba(36,36,38,0.9)] hover:border-[#888] hover:bg-[rgba(36,36,38,0.94)]'
            }`}
            style={{ borderStyle: 'dashed', borderWidth: '2px' }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".ifc"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />
            {isLoading && (
              <div className="w-8 h-8 rounded-full border-2 border-blue-400 border-t-transparent animate-spin mb-3" />
            )}
            <h2 className="text-[24px] font-semibold text-center px-4 text-white mb-2">{loadingText}</h2>
            {!isLoading && (
              <p className="text-[14px] text-[#aaa] font-medium transition-colors hover:text-white">
                📁 Click anywhere to select an .ifc file or drop it here
              </p>
            )}
          </div>
        )}

        {/* 3D WebGL Canvas Target */}
        <div ref={viewportRef} className="absolute inset-0 z-0 bg-[#242426]" />
      </div>

      {/* Right Sidebar Inspector */}
      <div className="w-[20%] min-w-[250px] bg-[#1a1a1c] border-l border-[#333] p-[15px] flex flex-col select-none">
        <h3 className="mt-0 text-[14px] uppercase tracking-[1px] text-[#aaa] border-b border-[#333] pb-[10px]">
          MEP Equipment
        </h3>
        <div
          draggable
          className="bg-[#2c2c2e] p-[10px] mb-[10px] rounded-[4px] cursor-grab font-semibold text-[13px] border border-[#3a3a3c] select-none mt-[10px] active:cursor-grabbing hover:bg-[#333] transition-colors"
        >
          Air Handling Unit (AHU)
        </div>
        <div
          draggable
          className="bg-[#2c2c2e] p-[10px] mb-[10px] rounded-[4px] cursor-grab font-semibold text-[13px] border border-[#3a3a3c] select-none active:cursor-grabbing hover:bg-[#333] transition-colors"
        >
          Chilled Water Pump
        </div>
        <div
          draggable
          className="bg-[#2c2c2e] p-[10px] mb-[10px] rounded-[4px] cursor-grab font-semibold text-[13px] border border-[#3a3a3c] select-none active:cursor-grabbing hover:bg-[#333] transition-colors"
        >
          Exhaust Fan
        </div>

        <h3 className="mt-[20px] text-[14px] uppercase tracking-[1px] text-[#aaa] border-b border-[#333] pb-[10px]">
          Selected Space
        </h3>
        <div
          className="text-[13px] text-[#ccc] leading-[1.5] p-[10px] bg-[#222] rounded-[4px] border border-[#333] mt-[10px]"
          dangerouslySetInnerHTML={{ __html: selectedSpaceInfo }}
        />
      </div>
    </div>
  );
}
