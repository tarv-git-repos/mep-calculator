import React from 'react';
import { useViewerStore } from '../store/viewer-store';

export function Sidebar({ onFullscreenToggle }: { onFullscreenToggle?: () => void }) {
  const { selectedSpaceInfo } = useViewerStore();

  return (
    <div className="w-[20%] min-w-[250px] bg-[#1a1a1c] border-l border-[#333] p-[15px] flex flex-col z-10 select-none">
      <div className="flex items-center justify-between border-b border-[#333] pb-[10px]">
        <h3 className="mt-0 text-[13px] font-extrabold uppercase tracking-[1px] text-[#aaa]">
          Selected Space
        </h3>
        <button
          onClick={onFullscreenToggle}
          title="Toggle Fullscreen View"
          className="bg-[#242426] hover:bg-[#3a3a3c] w-[34px] h-[34px] rounded-[8px] flex items-center justify-center border border-[#444] text-white text-[15px] transition-all cursor-pointer shrink-0"
        >
          ⛶
        </button>
      </div>
      <div 
        className="text-[13px] text-[#ccc] leading-[1.5] p-[12px] bg-[#222] rounded-[6px] border border-[#333] mt-[12px] shadow-sm select-text"
        dangerouslySetInnerHTML={{ __html: selectedSpaceInfo || '<div className="text-[#777] italic">Select a space in 3D or 2D view to inspect properties</div>' }}
      />
    </div>
  );
}
