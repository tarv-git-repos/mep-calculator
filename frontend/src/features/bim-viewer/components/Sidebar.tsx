import React from 'react';
import { useViewerStore } from '../store/viewer-store';

export function Sidebar() {
  const { selectedSpaceInfo } = useViewerStore();

  return (
    <div className="w-[20%] min-w-[250px] bg-[#1a1a1c] border-l border-[#333] p-[15px] flex flex-col z-10">
      <h3 className="mt-0 text-[14px] font-bold uppercase tracking-[1px] text-[#aaa] border-b border-[#333] pb-[10px]">
        Selected Space
      </h3>
      <div 
        className="text-[13px] text-[#ccc] leading-[1.5] p-[12px] bg-[#222] rounded-[6px] border border-[#333] mt-[12px] shadow-sm"
        dangerouslySetInnerHTML={{ __html: selectedSpaceInfo || '<div className="text-[#777] italic">Select a space in 3D or 2D view to inspect properties</div>' }}
      />
    </div>
  );
}
