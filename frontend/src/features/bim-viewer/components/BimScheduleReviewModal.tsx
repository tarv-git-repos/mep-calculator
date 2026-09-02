import React, { useState, useEffect } from "react";
import { X, Sparkles, Table } from "lucide-react";
import { toast } from "sonner";
import { workspaceStore } from "@/lib/workspace-store";
import { predictSpacePressure } from "@/lib/ai-occupancy";
import { Extracted3DSpace, sortSpacesByFloorAndName, isMepValidSpaceName } from "@/lib/bimViewerSpaceExtractor";

interface BimScheduleReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRecords: Extracted3DSpace[];
}

export function BimScheduleReviewModal({ isOpen, onClose, initialRecords }: BimScheduleReviewModalProps) {
  const [records, setRecords] = useState<Extracted3DSpace[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const [bulkValues, setBulkValues] = useState({
    level: "",
    zone: "",
    category: "",
    pressure: "",
    height: "",
    fixtures: "",
    multiplier: "",
  });

  useEffect(() => {
    const validFiltered = (initialRecords || []).filter((r) => isMepValidSpaceName(r.name));
    const sorted = sortSpacesByFloorAndName(validFiltered);
    setRecords(sorted);
    setSelectedIds(new Set(sorted.map((r) => r.id)));
  }, [initialRecords]);

  if (!isOpen) return null;

  const toggleSelect = (id: string, shiftKey: boolean, ctrlKey: boolean) => {
    const idx = records.findIndex((r) => r.id === id);
    if (idx === -1) return;

    if (shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, idx);
      const end = Math.max(lastClickedIndex, idx);
      const rangeIds = records.slice(start, end + 1).map((r) => r.id);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        rangeIds.forEach((rId) => next.add(rId));
        return next;
      });
    } else if (ctrlKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastClickedIndex(idx);
    } else {
      setSelectedIds(new Set([id]));
      setLastClickedIndex(idx);
    }
  };

  const handleBulkApply = () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one space to apply bulk edits.");
      return;
    }

    setRecords((prev) =>
      prev.map((r) => {
        if (!selectedIds.has(r.id)) return r;

        let updatedCat = r.category;
        let updatedPress = r.pressure;
        let updatedPressAuto = r.pressureAutoDetected;

        if (bulkValues.category !== "") {
          updatedCat = bulkValues.category;
          const pred = predictSpacePressure(updatedCat);
          updatedPress = pred.pressure;
          updatedPressAuto = true;
        }

        if (bulkValues.pressure !== "") {
          updatedPress = bulkValues.pressure;
          updatedPressAuto = false;
        }

        return {
          ...r,
          level: bulkValues.level !== "" ? bulkValues.level : r.level,
          zone: bulkValues.zone !== "" ? bulkValues.zone : r.zone,
          category: updatedCat,
          pressure: updatedPress,
          pressureAutoDetected: updatedPressAuto,
          height: bulkValues.height !== "" ? parseFloat(bulkValues.height) || r.height : r.height,
          fixtures: bulkValues.fixtures !== "" ? bulkValues.fixtures : r.fixtures,
          multiplier: bulkValues.multiplier !== "" ? parseInt(bulkValues.multiplier) || r.multiplier : r.multiplier,
        };
      })
    );

    toast.success(`Updated ${selectedIds.size} selected spaces!`);
  };

  const handleSaveToProject = () => {
    const spacesToCommit = records.filter((r) => selectedIds.has(r.id));
    if (spacesToCommit.length === 0) {
      toast.error("No spaces selected for commit.");
      return;
    }

    const formattedSpaces = spacesToCommit.map((r, idx) => ({
      id: `sp-3d-${Date.now()}-${idx}`,
      name: r.name,
      building: "Tower A",
      floor: r.level || "L01",
      zone: r.zone || "Default",
      category: r.category || "General Office / Space",
      pressure: r.pressure || "+1",
      area: r.area,
      height: r.height || 3.0,
      fixtures: r.fixtures || "",
      multiplier: r.multiplier || 1,
    }));

    workspaceStore.addSpacesBulk(formattedSpaces as any);
    toast.success(`Successfully saved ${formattedSpaces.length} spaces into Project Schedule! All calculations synced to Ventilation calculator.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl w-full max-w-5xl text-white flex flex-col max-h-[85vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <header className="px-5 py-4 border-b border-[#27272a] flex items-center justify-between bg-[#111113]">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Table className="size-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">3D BIM Space Schedule Generator</h3>
              <p className="text-[11px] text-zinc-400">
                Review spatial geometry & AI occupancy predictions extracted from 3D model.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white rounded-md p-1 hover:bg-[#27272a] transition-colors"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {/* Bulk Edit Bar */}
          <div className="bg-[#202023] border border-[#27272a] rounded-lg p-3 flex flex-wrap items-center gap-2.5">
            <span className="font-bold text-zinc-300 text-[11px] uppercase tracking-wider">
              Bulk Edit ({selectedIds.size} selected):
            </span>
            <input
              type="text"
              placeholder="Level (e.g. GF)"
              value={bulkValues.level}
              onChange={(e) => setBulkValues({ ...bulkValues, level: e.target.value })}
              className="bg-[#18181b] border border-[#3f3f46] rounded px-2.5 py-1 w-28 text-white outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Zone (e.g. AHU-1)"
              value={bulkValues.zone}
              onChange={(e) => setBulkValues({ ...bulkValues, zone: e.target.value })}
              className="bg-[#18181b] border border-[#3f3f46] rounded px-2.5 py-1 w-28 text-white outline-none focus:border-blue-500"
            />
            <select
              value={bulkValues.category}
              onChange={(e) => setBulkValues({ ...bulkValues, category: e.target.value })}
              className="bg-[#18181b] border border-[#3f3f46] rounded px-2.5 py-1 w-44 text-white outline-none cursor-pointer focus:border-blue-500"
            >
              <option value="">-- ASHRAE Category --</option>
              <option value="General Office / Space">General Office / Space</option>
              <option value="Conference / Meeting Room">Conference / Meeting Room</option>
              <option value="Corridor / Circulation">Corridor / Circulation</option>
              <option value="Rest Room / Changing Room">Rest Room / Changing Room</option>
              <option value="Electrical / Switch Room">Electrical / Switch Room</option>
              <option value="Mechanical Plant / AHU Room">Mechanical Plant / AHU Room</option>
              <option value="Storage / Warehouse">Storage / Warehouse</option>
            </select>
            <select
              value={bulkValues.pressure}
              onChange={(e) => setBulkValues({ ...bulkValues, pressure: e.target.value })}
              className="bg-[#18181b] border border-[#3f3f46] rounded px-2.5 py-1 w-28 text-white outline-none cursor-pointer focus:border-blue-500"
            >
              <option value="">-- Pressure --</option>
              <option value="+1">+1 (Positive)</option>
              <option value="0">0 (Neutral)</option>
              <option value="-1">-1 (Negative)</option>
              <option value="-2">-2 (Critical Neg)</option>
            </select>
            <input
              type="number"
              placeholder="Height"
              value={bulkValues.height}
              onChange={(e) => setBulkValues({ ...bulkValues, height: e.target.value })}
              className="bg-[#18181b] border border-[#3f3f46] rounded px-2 py-1 w-16 text-white outline-none focus:border-blue-500"
            />
            <button
              onClick={handleBulkApply}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-1 rounded transition-colors ml-auto shadow cursor-pointer"
            >
              Apply Bulk
            </button>
          </div>

          {/* Table */}
          <div className="border border-[#27272a] rounded-lg overflow-hidden max-h-[45vh] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#111113] border-b border-[#27272a] sticky top-0 font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2.5 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={records.length > 0 && selectedIds.size === records.length}
                      onChange={(e) => setSelectedIds(e.target.checked ? new Set(records.map((p) => p.id)) : new Set())}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="p-2.5">Level</th>
                  <th className="p-2.5">Space Name</th>
                  <th className="p-2.5">Zone</th>
                  <th className="p-2.5">ASHRAE Category</th>
                  <th className="p-2.5">Pressure</th>
                  <th className="p-2.5">Area (m²)</th>
                  <th className="p-2.5">Height (m)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a] bg-[#18181b]">
                {records.map((rec) => {
                  const isSel = selectedIds.has(rec.id);
                  return (
                    <tr
                      key={rec.id}
                      onClick={(e) => toggleSelect(rec.id, e.shiftKey, e.ctrlKey || e.metaKey)}
                      className={`hover:bg-[#27272a]/60 ${isSel ? "bg-blue-600/10" : ""} cursor-default select-none`}
                    >
                      <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onClick={(e) => toggleSelect(rec.id, e.shiftKey, true)}
                          onChange={() => {}}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="p-2.5 font-mono text-zinc-300">{rec.level}</td>
                      <td className="p-2.5 font-medium text-white">{rec.name}</td>
                      <td className="p-2.5 font-mono text-zinc-300">{rec.zone}</td>
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex items-center gap-1.5 w-full">
                          {rec.aiDetected && <Sparkles className="size-3.5 text-blue-400 shrink-0" />}
                          <select
                            value={rec.category || "Select Category..."}
                            onChange={(e) => {
                              const cat = e.target.value;
                              const pred = predictSpacePressure(cat);
                              setRecords((prev) =>
                                prev.map((item) =>
                                  item.id === rec.id
                                    ? {
                                        ...item,
                                        category: cat,
                                        pressure: pred.pressure,
                                        pressureAutoDetected: true,
                                      }
                                    : item
                                )
                              );
                            }}
                            className="bg-[#202023] border border-[#3f3f46] rounded px-2 py-1 text-xs text-white outline-none w-full cursor-pointer"
                          >
                            <option value="Select Category...">Select Category...</option>
                            <option value="General Office / Space">General Office / Space</option>
                            <option value="Conference / Meeting Room">Conference / Meeting Room</option>
                            <option value="Corridor / Circulation">Corridor / Circulation</option>
                            <option value="Rest Room / Changing Room">Rest Room / Changing Room</option>
                            <option value="Electrical / Switch Room">Electrical / Switch Room</option>
                            <option value="Mechanical Plant / AHU Room">Mechanical Plant / AHU Room</option>
                            <option value="Storage / Warehouse">Storage / Warehouse</option>
                          </select>
                        </span>
                      </td>
                      <td className="p-2.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={rec.pressure || "+1"}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRecords((prev) =>
                              prev.map((item) =>
                                item.id === rec.id ? { ...item, pressure: val, pressureAutoDetected: false } : item
                              )
                            );
                          }}
                          className="bg-[#202023] border border-[#3f3f46] rounded px-2 py-1 text-xs font-bold text-emerald-400 outline-none cursor-pointer"
                        >
                          <option value="+1">+1</option>
                          <option value="0">0</option>
                          <option value="-1">-1</option>
                          <option value="-2">-2</option>
                        </select>
                      </td>
                      <td className="p-2.5 font-mono text-zinc-300">{rec.area.toFixed(2)}</td>
                      <td className="p-2.5 font-mono text-zinc-300">{rec.height.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-5 py-3.5 border-t border-[#27272a] flex items-center justify-between bg-[#111113]">
          <span className="text-zinc-400 text-xs font-mono">
            {selectedIds.size} of {records.length} spaces selected
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-1.5 border border-[#3f3f46] text-xs font-semibold rounded-md hover:bg-[#202023] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveToProject}
              disabled={selectedIds.size === 0}
              className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-md shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              Save {selectedIds.size} Spaces to Project Schedule
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
