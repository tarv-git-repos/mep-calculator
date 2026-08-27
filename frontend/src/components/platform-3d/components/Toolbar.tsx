import React from 'react';
import { useViewerStore } from '../store/viewer-store';

export function Toolbar({ onLevelChange, onClipToggle, onSpacesToggle, onTagsToggle, on2dToggle, on3dToggle, onWalkToggle, onOrbitToggle, onColorToggle }: any) {
  const { viewMode, cameraMode, colorMode, isClipActive, isTagsActive, isSpacesActive, levels, selectedLevel, setIsTagsActive } = useViewerStore();

  return (
    <div className="absolute top-[15px] left-1/2 -translate-x-1/2 bg-[rgba(30,30,32,0.85)] backdrop-blur-[10px] p-[8px] rounded-[8px] flex items-center gap-[10px] border border-[#444] z-10">
      <div className="inline-flex bg-[#1a1a1c] rounded-[6px] p-[2px] border border-[#333] gap-[2px]">
        <button
          onClick={on3dToggle}
          className={`px-[12px] py-[6px] rounded-[4px] text-[12px] font-bold transition-all ${viewMode === '3d' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'}`}
        >
          3D View
        </button>
        <button
          onClick={on2dToggle}
          className={`px-[12px] py-[6px] rounded-[4px] text-[12px] font-bold transition-all ${viewMode === '2d' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'}`}
        >
          2D View
        </button>
      </div>

      <div className="w-[1px] h-[20px] bg-[#444] mx-[4px]"></div>

      <div className="inline-flex bg-[#1a1a1c] rounded-[6px] p-[2px] border border-[#333] gap-[2px]">
        <button
          onClick={() => onColorToggle('full')}
          className={`px-[12px] py-[6px] rounded-[4px] text-[12px] font-bold transition-all ${colorMode === 'full' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'}`}
        >
          Color
        </button>
        <button
          onClick={() => onColorToggle('mono')}
          className={`px-[12px] py-[6px] rounded-[4px] text-[12px] font-bold transition-all ${colorMode === 'mono' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'}`}
        >
          Grayscale
        </button>
      </div>

      <div className="w-[1px] h-[20px] bg-[#444] mx-[4px]"></div>

      {viewMode === '3d' && (
        <>
          <button
            onClick={onOrbitToggle}
            className={`px-[12px] py-[8px] rounded-[4px] text-[12px] font-bold transition-all ${cameraMode === 'orbit' ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
          >
            Orbit
          </button>
          <button
            onClick={onWalkToggle}
            className={`px-[12px] py-[8px] rounded-[4px] text-[12px] font-bold transition-all ${cameraMode === 'walk' ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
          >
            Walk
          </button>
          <button
            onClick={onClipToggle}
            className={`px-[12px] py-[8px] rounded-[4px] text-[12px] font-bold transition-all ${isClipActive ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
          >
            Cut Plane
          </button>
        </>
      )}

      {(isClipActive || viewMode === '2d') && (
        <select
          value={selectedLevel}
          onChange={(e) => onLevelChange(e.target.value)}
          className="px-[12px] py-[8px] rounded-[4px] text-[12px] font-bold transition-all bg-[#333] text-white border border-[#555] outline-none"
        >
          <option value="">All Levels (No Cut)</option>
          {levels.map((s) => (
            <option key={s.expressId} value={s.expressId.toString()}>
              {s.name} ({(s.elevation / 1000).toFixed(2)}m)
            </option>
          ))}
        </select>
      )}

      {(isClipActive || viewMode === '2d') && (
        <button
          onClick={onTagsToggle}
          className={`px-[12px] py-[8px] rounded-[4px] text-[12px] font-bold transition-all ${isTagsActive ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
        >
          Tags
        </button>
      )}
      {viewMode === '2d' && (
        <button
          onClick={onSpacesToggle}
          className={`px-[12px] py-[8px] rounded-[4px] text-[12px] font-bold transition-all ${isSpacesActive ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
        >
          Spaces
        </button>
      )}
    </div>
  );
}
