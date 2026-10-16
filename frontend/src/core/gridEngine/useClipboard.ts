import { useCallback } from "react";
import { toast } from "sonner";

export function useClipboard<T extends { id: string }>(
  rows: T[], 
  selectedIds: Set<string>, 
  pushState: (s: T[]) => void
) {
  
  const copy = useCallback(() => {
    if (selectedIds.size === 0) return;
    const selectedRows = rows.filter(r => selectedIds.has(r.id));
    localStorage.setItem("grid_clipboard", JSON.stringify(selectedRows));
    toast.success(`${selectedRows.length} rows copied`);
  }, [rows, selectedIds]);

  const cut = useCallback(() => {
    if (selectedIds.size === 0) return;
    copy();
    const remainingRows = rows.filter(r => !selectedIds.has(r.id));
    pushState(remainingRows);
  }, [rows, selectedIds, copy, pushState]);

  const paste = useCallback(() => {
    try {
      const data = localStorage.getItem("grid_clipboard");
      if (!data) return;
      const parsed = JSON.parse(data) as T[];
      
      // Give them new IDs
      const newRows = parsed.map(r => ({
        ...r,
        id: crypto.randomUUID()
      }));

      pushState([...rows, ...newRows]);
      toast.success(`${newRows.length} rows pasted`);
    } catch (e) {
      toast.error("Failed to paste data");
    }
  }, [rows, pushState]);

  return { copy, cut, paste };
}
