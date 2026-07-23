import { useCallback } from "react";
import { toast } from "../notifications";

export function useBulkActions<T extends { id: string }>(
  rows: T[],
  selectedIds: Set<string>,
  pushState: (s: T[]) => void
) {
  
  const bulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    const remaining = rows.filter(r => !selectedIds.has(r.id));
    pushState(remaining);
    toast.success(`${selectedIds.size} rows deleted`);
  }, [rows, selectedIds, pushState]);

  const bulkDuplicate = useCallback(() => {
    if (selectedIds.size === 0) return;
    
    const newRows = [...rows];
    let addedCount = 0;

    rows.forEach(r => {
      if (selectedIds.has(r.id)) {
        newRows.push({
          ...r,
          id: crypto.randomUUID()
        });
        addedCount++;
      }
    });

    pushState(newRows);
    toast.success(`${addedCount} rows duplicated`);
  }, [rows, selectedIds, pushState]);

  const bulkEdit = useCallback((field: keyof T, value: any) => {
    if (selectedIds.size === 0) return;
    const newRows = rows.map(r => {
      if (selectedIds.has(r.id)) {
        return { ...r, [field]: value };
      }
      return r;
    });
    pushState(newRows);
    toast.success(`Updated ${selectedIds.size} rows`);
  }, [rows, selectedIds, pushState]);

  return { bulkDelete, bulkDuplicate, bulkEdit };
}
