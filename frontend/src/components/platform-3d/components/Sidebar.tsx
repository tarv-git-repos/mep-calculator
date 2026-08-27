import React from 'react';
import { useViewerStore } from '../store/viewer-store';

export function Sidebar() {
  const { selectedSpaceInfo } = useViewerStore();

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('mep-type', type);
  };

  return (
    <div className="w-[20%] min-w-[250px] bg-[#1a1a1c] border-l border-[#333] p-[15px] flex flex-col">
      <h3 className="mt-0 text-[14px] uppercase tracking-[1px] text-[#aaa] border-b border-[#333] pb-[10px]">
        MEP Equipment
      </h3>
      <div 
        draggable 
        onDragStart={(e) => handleDragStart(e, 'AHU')}
        className="bg-[#2c2c2e] p-[10px] mb-[10px] rounded-[4px] cursor-grab font-semibold text-[13px] border border-[#3a3a3c] select-none mt-[10px] active:cursor-grabbing hover:bg-[#333] transition-colors"
      >
        Air Handling Unit (AHU)
      </div>
      <div 
        draggable 
        onDragStart={(e) => handleDragStart(e, 'Pump')}
        className="bg-[#2c2c2e] p-[10px] mb-[10px] rounded-[4px] cursor-grab font-semibold text-[13px] border border-[#3a3a3c] select-none active:cursor-grabbing hover:bg-[#333] transition-colors"
      >
        Chilled Water Pump
      </div>
      <div 
        draggable 
        onDragStart={(e) => handleDragStart(e, 'Fan')}
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
  );
}
