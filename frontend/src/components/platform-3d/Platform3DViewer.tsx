import React, { useEffect, useRef, useState } from 'react';
import * as OBC from '@thatopen/components';
import * as OBCF from '@thatopen/components-front';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export function Platform3DViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [selectedSpaceInfo, setSelectedSpaceInfo] = useState<string>("Click on a space in 3D view to select it.");
  const [activeTab, setActiveTab] = useState<'3d' | '2d'>('3d');
  const [activeCameraMode, setActiveCameraMode] = useState<'orbit' | 'walk'>('orbit');
  const [isClipActive, setIsClipActive] = useState(false);
  const [isTagsActive, setIsTagsActive] = useState(true);
  const [isSpacesActive, setIsSpacesActive] = useState(true);
  const [levels, setLevels] = useState<Array<{ expressId: number; name: string; elevation: number }>>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingText, setLoadingText] = useState('Drag & Drop .ifc file here');

  useEffect(() => {
    if (!viewportRef.current) return;
    const viewport = viewportRef.current;

    // Components & World initialization
    const components = new OBC.Components();
    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();

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

    const ifcLoader = components.get(OBC.IfcLoader);
    ifcLoader.setup();

    return () => {
      resizeObserver.disconnect();
      if (viewport.contains(css2DRenderer.domElement)) {
        viewport.removeChild(css2DRenderer.domElement);
      }
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setLoadingText('Processing IFC File...');
    setIsLoaded(true);
  };

  return (
    <div ref={containerRef} className="flex w-full h-full bg-[#242426] text-white font-sans overflow-hidden relative">
      <div id="viewport" ref={viewportRef} className="flex-1 relative w-full h-full">
        {/* Floating Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#1e1e20]/85 backdrop-blur-md p-2 rounded-lg flex items-center gap-2.5 border border-[#444] z-10">
          <div className="inline-flex bg-[#1a1a1c] rounded-md p-0.5 border border-[#333] gap-0.5">
            <button
              onClick={() => setActiveTab('3d')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${activeTab === '3d' ? 'bg-[#555] text-white' : 'text-[#aaa] hover:text-white'}`}
            >
              3D View
            </button>
            <button
              onClick={() => setActiveTab('2d')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${activeTab === '2d' ? 'bg-[#555] text-white' : 'text-[#aaa] hover:text-white'}`}
            >
              2D View
            </button>
          </div>

          <div className="w-[1px] h-5 bg-[#444] mx-1" />

          <button
            onClick={() => setActiveCameraMode('orbit')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${activeCameraMode === 'orbit' ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
          >
            Orbit
          </button>
          <button
            onClick={() => setActiveCameraMode('walk')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${activeCameraMode === 'walk' ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
          >
            Walk
          </button>
          <button
            onClick={() => setIsClipActive(!isClipActive)}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${isClipActive ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
          >
            Cut Plane
          </button>
          <button
            onClick={() => setIsTagsActive(!isTagsActive)}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${isTagsActive ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
          >
            Tags
          </button>
          <button
            onClick={() => setIsSpacesActive(!isSpacesActive)}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${isSpacesActive ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
          >
            Spaces
          </button>
        </div>

        {/* Overlay for Drop Zone */}
        {!isLoaded && (
          <div
            ref={overlayRef}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="absolute inset-0 bg-[#242426]/90 flex flex-col items-center justify-center border-2 border-dashed border-[#555] m-6 rounded-xl transition-all cursor-pointer"
          >
            <div className="text-4xl mb-3">📁</div>
            <h2 className="text-xl font-semibold text-gray-200">{loadingText}</h2>
            <p className="text-sm text-gray-400 mt-2">Support for IFC2x3 & IFC4 spatial models</p>
          </div>
        )}
      </div>

      {/* Sidebar Panel */}
      <div id="sidebar" className="w-[260px] bg-[#1a1a1c] border-l border-[#333] p-4 flex flex-col gap-4">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[#aaa] border-b border-[#333] pb-2 font-bold mb-3">
            MEP Equipment
          </h3>
          <div className="space-y-2">
            <div draggable className="p-2.5 bg-[#252528] rounded border border-[#3a3a3d] text-xs font-semibold cursor-grab hover:bg-[#333] transition-all">
              Air Handling Unit (AHU)
            </div>
            <div draggable className="p-2.5 bg-[#252528] rounded border border-[#3a3a3d] text-xs font-semibold cursor-grab hover:bg-[#333] transition-all">
              Chilled Water Pump
            </div>
            <div draggable className="p-2.5 bg-[#252528] rounded border border-[#3a3a3d] text-xs font-semibold cursor-grab hover:bg-[#333] transition-all">
              Exhaust Fan
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs uppercase tracking-wider text-[#aaa] border-b border-[#333] pb-2 font-bold mb-3">
            Selected Space
          </h3>
          <div className="text-xs text-gray-300 leading-relaxed p-3 bg-[#222] rounded border border-[#333]">
            {selectedSpaceInfo}
          </div>
        </div>
      </div>
    </div>
  );
}
