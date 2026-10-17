import React from 'react';
import { useViewerStore } from '../store/viewer-store';

export function Toolbar({
  onLevelChange,
  onClipToggle,
  onSpacesToggle,
  onTagsToggle,
  on2dToggle,
  on3dToggle,
  onWalkToggle,
  onOrbitToggle,
  onColorToggle,
  onExportSchedule,
  onRemoveModel,
}: any) {
  const { viewMode, cameraMode, colorMode, isClipActive, isTagsActive, isSpacesActive, levels, selectedLevel, setIsTagsActive, isLoaded } = useViewerStore();

  return (
    <div className="absolute top-[15px] left-4 bg-[rgba(30,30,32,0.95)] backdrop-blur-[10px] px-[12px] rounded-[8px] flex items-center gap-[8px] border border-[#444] z-20 h-[50px] overflow-hidden shadow-xl whitespace-nowrap">
      {/* 3D / 2D View Toggle */}
      <div className="inline-flex bg-[#1a1a1c] rounded-[6px] p-[2px] border border-[#333] gap-[2px] shrink-0 h-[36px] items-center">
        <button
          onClick={on3dToggle}
          className={`px-[12px] h-[30px] rounded-[4px] text-[12px] font-bold transition-all flex items-center justify-center shrink-0 ${viewMode === '3d' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'}`}
        >
          3D View
        </button>
        <button
          onClick={on2dToggle}
          className={`px-[12px] h-[30px] rounded-[4px] text-[12px] font-bold transition-all flex items-center justify-center shrink-0 ${viewMode === '2d' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'}`}
        >
          2D View
        </button>
      </div>

      <div className="w-[1px] h-[20px] bg-[#444] mx-[2px] shrink-0"></div>

      {/* Color / Grayscale Mode Toggle */}
      <div className="inline-flex bg-[#1a1a1c] rounded-[6px] p-[2px] border border-[#333] gap-[2px] shrink-0 h-[36px] items-center">
        <button
          onClick={() => onColorToggle('full')}
          className={`px-[12px] h-[30px] rounded-[4px] text-[12px] font-bold transition-all flex items-center justify-center shrink-0 ${colorMode === 'full' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'}`}
        >
          Color
        </button>
        <button
          onClick={() => onColorToggle('mono')}
          className={`px-[12px] h-[30px] rounded-[4px] text-[12px] font-bold transition-all flex items-center justify-center shrink-0 ${colorMode === 'mono' ? 'bg-[#4da6ff] text-white' : 'bg-transparent text-[#aaa] hover:bg-[#2a2a2c] hover:text-white'}`}
        >
          Grayscale
        </button>
      </div>

      <div className="w-[1px] h-[20px] bg-[#444] mx-[2px] shrink-0"></div>

      {/* 3D Navigation Controls */}
      {viewMode === '3d' && (
        <>
          <button
            onClick={onOrbitToggle}
            className={`px-[12px] h-[34px] rounded-[4px] text-[12px] font-bold transition-all flex items-center justify-center shrink-0 ${cameraMode === 'orbit' ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
          >
            Orbit
          </button>
          <button
            onClick={onWalkToggle}
            className={`px-[12px] h-[34px] rounded-[4px] text-[12px] font-bold transition-all flex items-center justify-center shrink-0 ${cameraMode === 'walk' ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
          >
            Walk
          </button>
          <button
            onClick={onClipToggle}
            className={`px-[12px] h-[34px] rounded-[4px] text-[12px] font-bold transition-all flex items-center justify-center shrink-0 ${isClipActive ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
          >
            Cut Plane
          </button>
        </>
      )}

      {/* Level Selection Dropdown */}
      {levels && levels.length > 0 && (
        <select
          value={selectedLevel}
          onChange={(e) => onLevelChange(e.target.value)}
          className="px-[12px] h-[34px] rounded-[4px] text-[12px] font-bold transition-all bg-[#333] text-white border border-[#555] outline-none shrink-0"
          title="Select active floor / level"
        >
          <option value="">{viewMode === '2d' ? 'Select Level...' : 'All Levels (No Cut)'}</option>
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
          className={`px-[12px] h-[34px] rounded-[4px] text-[12px] font-bold transition-all flex items-center justify-center shrink-0 ${isTagsActive ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
        >
          Tags
        </button>
      )}
      {viewMode === '2d' && (
        <button
          onClick={onSpacesToggle}
          className={`px-[12px] h-[34px] rounded-[4px] text-[12px] font-bold transition-all flex items-center justify-center shrink-0 ${isSpacesActive ? 'bg-[#555] text-white' : 'bg-[#333] text-[#ccc] hover:bg-[#555]'}`}
        >
          Spaces
        </button>
      )}

      <div className="w-[1px] h-[20px] bg-[#444] mx-[2px] shrink-0"></div>

      {/* Schedule Generation Action Button */}
      <button
        onClick={onExportSchedule}
        className="px-[14px] h-[36px] rounded-[6px] text-[12px] font-extrabold transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md flex items-center gap-[6px] cursor-pointer shrink-0"
      >
        <span>⚡</span>
        Generate Space Schedule
      </button>

      {/* Delete Model Action Button */}
      {isLoaded && (
        <button
          onClick={onRemoveModel}
          title="Delete currently loaded IFC model from this project"
          className="px-[10px] h-[34px] rounded-[6px] text-[12px] font-bold transition-all bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 flex items-center gap-[4px] cursor-pointer shrink-0"
        >
          <span>🗑️</span>
          <span>Delete</span>
        </button>
      )}
    </div>
  );
}
