import { useState, useCallback } from "react";

export function useSelection(rows: any[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string, multi: boolean, range: boolean) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (range) {
        // Find index of last selected, and select range. (Simplified for now)
        newSet.add(id);
      } else if (multi) {
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
      } else {
        newSet.clear();
        newSet.add(id);
      }
      return newSet;
    });
  }, [rows]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(rows.map(r => r.id)));
  }, [rows]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection
  };
}
