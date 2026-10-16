import React, { useMemo } from 'react';
import { useViewerStore } from '../store/viewer-store';
import { useWorkspace, workspaceStore } from '@/lib/workspace-store';
import { MapPin, Box, GripVertical, Crosshair, RotateCcw, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { hasLiteralDimensions, getEquipmentLiteralDimensions } from '@/lib/ahu-dimensions-data';

const TRANSPARENT_DRAG_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export function Sidebar({ onFullscreenToggle }: { onFullscreenToggle?: () => void }) {
  const { selectedSpaceInfo, setDraggedEquipmentId, selectedEquipmentId, setSelectedEquipmentId } = useViewerStore();
  const { equipment } = useWorkspace();
  const emptyDragImgRef = React.useRef<HTMLImageElement | null>(null);

  const unplacedEquipment = useMemo(() => {
    return equipment.filter(e => !e.locationSpaceId && hasLiteralDimensions(e));
  }, [equipment]);

  const placedEquipment = useMemo(() => {
    return equipment.filter(e => !!e.locationSpaceId && hasLiteralDimensions(e));
  }, [equipment]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, equipId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'equipment', id: equipId }));
    e.dataTransfer.effectAllowed = 'copy';
    if (emptyDragImgRef.current) {
      e.dataTransfer.setDragImage(emptyDragImgRef.current, 0, 0);
    } else {
      const img = new Image(1, 1);
      img.src = TRANSPARENT_DRAG_PIXEL;
      e.dataTransfer.setDragImage(img, 0, 0);
    }
    setDraggedEquipmentId(equipId);
    (window as any)._currentlyDraggedEquipmentId = equipId;
    console.log('[MEP-DND] dragstart', equipId);
  };

  const handleDragEnd = () => {
    if (typeof (window as any)._clearEquipmentGhostMesh === 'function') {
      (window as any)._clearEquipmentGhostMesh();
    }
    setTimeout(() => {
      setDraggedEquipmentId(null);
      (window as any)._currentlyDraggedEquipmentId = null;
    }, 150);
  };

  const handleFocus = (equip: any) => {
    setSelectedEquipmentId(equip.id);
    if (typeof (window as any)._setSelectedEquipment === 'function') {
      (window as any)._setSelectedEquipment(equip.id);
    }
    window.dispatchEvent(new CustomEvent('mep-focus-equipment', { detail: equip }));
  };

  const handleUnplace = (equip: any) => {
    if (selectedEquipmentId === equip.id) {
      setSelectedEquipmentId(null);
      if (typeof (window as any)._setSelectedEquipment === 'function') {
        (window as any)._setSelectedEquipment(null);
      }
    }
    const updated = equipment.map((eq: any) => {
      if (eq.id === equip.id) {
        return {
          ...eq,
          locationSpaceId: undefined,
          locationSpaceName: undefined,
          locationFloor: undefined,
          positionX: undefined,
          positionY: undefined,
          positionZ: undefined,
          rotationY: undefined,
        };
      }
      return eq;
    });
    workspaceStore.updateEquipment(updated);
    if (typeof (window as any)._renderEquipmentMeshes === 'function') {
      (window as any)._renderEquipmentMeshes();
    }
    window.dispatchEvent(new CustomEvent('mep-equipment-updated'));
    toast.success(`Removed "${equip.tag}" placement from Studio`);
  };

  const handleUnplaceAll = () => {
    if (!confirm("Are you sure you want to revert all equipment placements back to unplaced?")) return;
    setSelectedEquipmentId(null);
    if (typeof (window as any)._setSelectedEquipment === 'function') {
      (window as any)._setSelectedEquipment(null);
    }
    const updated = equipment.map((eq: any) => {
      if (eq.locationSpaceId || eq.positionX !== undefined) {
        return {
          ...eq,
          locationSpaceId: undefined,
          locationSpaceName: undefined,
          locationFloor: undefined,
          positionX: undefined,
          positionY: undefined,
          positionZ: undefined,
          rotationY: undefined,
        };
      }
      return eq;
    });
    workspaceStore.updateEquipment(updated);
    if (typeof (window as any)._renderEquipmentMeshes === 'function') {
      (window as any)._renderEquipmentMeshes();
    }
    window.dispatchEvent(new CustomEvent('mep-equipment-updated'));
    toast.success("All equipment placements reverted to unplaced");
  };

  return (
    <div className="w-[20%] min-w-[250px] bg-[#1a1a1c] border-l border-[#333] p-[15px] flex flex-col z-10 select-none overflow-y-auto">
      <img
        ref={emptyDragImgRef}
        src={TRANSPARENT_DRAG_PIXEL}
        width={1}
        height={1}
        alt=""
        aria-hidden="true"
        className="fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none"
      />
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
        
        {unplacedEquipment.length === 0 && placedEquipment.length === 0 && (
          <div className="flex flex-col items-center justify-center p-5 bg-[#222]/80 rounded-xl border border-[#333] text-center gap-2.5 mt-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-400">
              <Ruler className="size-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">No Sized Equipment</span>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-[210px]">
              Equipments must have assigned zones in the Ventilation calculator to compute physical dimensions before they can be placed in 3D Studio.
            </p>
          </div>
        )}

        {unplacedEquipment.length > 0 && (
          <div className="flex flex-col max-h-[50%]">
            <h3 className="mt-0 text-[13px] font-extrabold uppercase tracking-[1px] text-[#aaa] mb-3 flex items-center gap-2">
              <Box className="size-4" /> Unplaced Equipment ({unplacedEquipment.length})
            </h3>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {unplacedEquipment.map((equip) => {
                const dims = getEquipmentLiteralDimensions(equip);
                return (
                  <div
                    key={equip.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, equip.id)} 
                    onDragEnd={handleDragEnd}
                    className="bg-[#2a2a2c] hover:bg-[#333336] border border-[#444] rounded p-2 text-white text-[12px] flex items-start gap-2 cursor-grab active:cursor-grabbing transition-colors"
                    title="Drag to place in 3D Viewer"
                  >
                    <GripVertical className="size-4 text-[#777] shrink-0 mt-0.5" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="font-bold truncate text-slate-100">{equip.tag}</div>
                      <div className="text-[#999] truncate text-[11px]">{equip.type}</div>
                      {dims && (
                        <div className="text-emerald-400 font-mono text-[10px] truncate mt-0.5 font-semibold">
                          {dims.formatted}
                        </div>
                      )}
                      <div className="text-[#777] text-[10px] truncate mt-0.5">Drag onto a floor space</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {placedEquipment.length > 0 && (
          <div className="flex flex-col flex-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="mt-0 text-[13px] font-extrabold uppercase tracking-[1px] text-[#aaa] flex items-center gap-2">
                <MapPin className="size-4" /> Placed Equipment ({placedEquipment.length})
              </h3>
              {placedEquipment.length > 1 && (
                <button
                  type="button"
                  onClick={handleUnplaceAll}
                  className="text-[10px] text-[#888] hover:text-amber-400 transition-colors uppercase tracking-wider font-semibold hover:underline"
                  title="Revert all placed equipment back to unplaced"
                >
                  Revert All
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 pb-4">
              {placedEquipment.map((equip) => {
                const dims = getEquipmentLiteralDimensions(equip);
                const isSelected = equip.id === selectedEquipmentId;

                return (
                  <div
                    key={equip.id}
                    onClick={() => handleFocus(equip)}
                    className={`group border rounded-lg p-2.5 text-white text-[12px] flex flex-col gap-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#2e2a1e] border-amber-500/90 shadow-md ring-1 ring-amber-500/40'
                        : 'bg-[#2a2a2c] hover:bg-[#333336] border-[#444]'
                    }`}
                    title="Click to select & focus in Viewer"
                  >
                    <div className="flex items-start gap-2">
                      <Crosshair className={`size-4 shrink-0 mt-0.5 ${isSelected ? 'text-amber-400' : 'text-blue-400'}`} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="font-bold text-slate-100 truncate flex items-center gap-1.5">
                          <span>{equip.tag}</span>
                          {isSelected && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[#999] truncate text-[11px]">{equip.type}</div>
                        {dims && (
                          <div className="text-emerald-400 font-mono text-[10px] truncate font-semibold">
                            {dims.formatted}
                          </div>
                        )}
                        <div className="text-[#777] text-[10px] truncate mt-0.5">
                          {equip.locationFloor ? `${equip.locationFloor} • ` : ''}{equip.locationSpaceName || 'Space'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnplace(equip);
                        }}
                        className="shrink-0 px-2 py-1 rounded bg-[#202022] hover:bg-amber-950/70 border border-[#444] hover:border-amber-500/80 text-[#999] hover:text-amber-300 transition-all flex items-center gap-1 text-[11px] shadow-sm"
                        title={`Revert placement: Remove "${equip.tag}" from Studio and move back to Unplaced`}
                      >
                        <RotateCcw className="size-3" />
                        <span>Revert</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 text-[10px] text-slate-400 bg-[#1c1c1e] rounded px-2 py-1 border border-[#38383a]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                        <span className="truncate font-medium text-slate-300">
                          Placed on {equip.locationFloor || 'Ground Floor'}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500 shrink-0">Drag to move</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
