import { useState, useCallback } from "react";

export function useSelection(rows: any[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const toggleSelection = useCallback((id: string, multi: boolean, range: boolean) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (range && lastSelectedId) {
        const lastIdx = rows.findIndex(r => r.id === lastSelectedId);
        const currIdx = rows.findIndex(r => r.id === id);
        if (lastIdx !== -1 && currIdx !== -1) {
          const start = Math.min(lastIdx, currIdx);
          const end = Math.max(lastIdx, currIdx);
          for (let i = start; i <= end; i++) {
            if (rows[i]?.id) {
              newSet.add(rows[i].id);
            }
          }
        } else {
          newSet.add(id);
        }
      } else if (multi) {
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
      } else {
        newSet.clear();
        newSet.add(id);
      }
      return newSet;
    });
    setLastSelectedId(id);
  }, [rows, lastSelectedId]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(rows.map(r => r.id)));
  }, [rows]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection
  };
}
