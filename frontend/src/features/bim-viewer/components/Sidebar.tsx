import React, { useMemo } from 'react';
import { useViewerStore } from '../store/viewer-store';
import { useWorkspace } from '@/lib/workspace-store';
import { MapPin, Box, GripVertical, Crosshair } from 'lucide-react';

export function Sidebar({ onFullscreenToggle }: { onFullscreenToggle?: () => void }) {
  const { selectedSpaceInfo } = useViewerStore();
  const { equipment } = useWorkspace();

  const unplacedEquipment = useMemo(() => {
    return equipment.filter(e => !e.locationSpaceId);
  }, [equipment]);

  const placedEquipment = useMemo(() => {
    return equipment.filter(e => !!e.locationSpaceId);
  }, [equipment]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, equipId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'equipment', id: equipId }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleFocus = (equip: any) => {
    window.dispatchEvent(new CustomEvent('mep-focus-equipment', { detail: equip }));
  };

  return (
    <div className="w-[20%] min-w-[250px] bg-[#1a1a1c] border-l border-[#333] p-[15px] flex flex-col z-10 select-none overflow-y-auto">
      <div className="flex items-center justify-between border-b border-[#333] pb-[10px]">
        <h3 className="mt-0 text-[13px] font-extrabold uppercase tracking-[1px] text-[#aaa]">
          Selected Space
        </h3>
        <button
          onClick={onFullscreenToggle}
          title="Toggle Fullscreen View"
          className="bg-[#242426] hover:bg-[#3a3a3c] w-[34px] h-[34px] rounded-[8px] flex items-center justify-center border border-[#444] text-white text-[15px] transition-all cursor-pointer shrink-0"
        >
          ?
        </button>
      </div>
      <div 
        className="text-[13px] text-[#ccc] leading-[1.5] p-[12px] bg-[#222] rounded-[6px] border border-[#333] mt-[12px] shadow-sm select-text"
        dangerouslySetInnerHTML={{ __html: selectedSpaceInfo || '<div className="text-[#777] italic">Select a space in 3D or 2D view to inspect properties</div>' }}
      />

      <div className="mt-6 flex flex-col flex-1 border-t border-[#333] pt-4 gap-6">
        
        {unplacedEquipment.length > 0 && (
          <div className="flex flex-col max-h-[50%]">
            <h3 className="mt-0 text-[13px] font-extrabold uppercase tracking-[1px] text-[#aaa] mb-3 flex items-center gap-2">
              <Box className="size-4" /> Unplaced Equipment ({unplacedEquipment.length})
            </h3>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {unplacedEquipment.map((equip) => (
                <div
                  key={equip.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, equip.id)}
                  className="bg-[#2a2a2c] hover:bg-[#333336] border border-[#444] rounded p-2 text-white text-[12px] flex items-start gap-2 cursor-grab active:cursor-grabbing transition-colors"
                  title="Drag to place in 3D Viewer"
                >
                  <GripVertical className="size-4 text-[#777] shrink-0 mt-0.5" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="font-bold truncate">{equip.tag}</div>
                    <div className="text-[#999] truncate">{equip.type}</div>
                    <div className="text-[#777] text-[10px] truncate mt-0.5">Drag onto a floor space</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {placedEquipment.length > 0 && (
          <div className="flex flex-col flex-1">
            <h3 className="mt-0 text-[13px] font-extrabold uppercase tracking-[1px] text-[#aaa] mb-3 flex items-center gap-2">
              <MapPin className="size-4" /> Placed Equipment ({placedEquipment.length})
            </h3>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 pb-4">
              {placedEquipment.map((equip) => (
                <div
                  key={equip.id}
                  onClick={() => handleFocus(equip)}
                  className="bg-[#2a2a2c] hover:bg-[#333336] border border-[#444] rounded p-2 text-white text-[12px] flex items-start gap-2 cursor-pointer transition-colors"
                  title="Click to locate in 2D View"
                >
                  <Crosshair className="size-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="font-bold text-blue-100 truncate">{equip.tag}</div>
                    <div className="text-[#999] truncate">{equip.type}</div>
                    <div className="text-[#777] text-[10px] truncate mt-0.5">
                      In {equip.locationSpaceName || 'Space'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
