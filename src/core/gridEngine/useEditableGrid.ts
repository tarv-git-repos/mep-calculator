import { useCallback, useEffect } from "react";
import { useHistory } from "./useHistory";
import { useSelection } from "./useSelection";
import { useClipboard } from "./useClipboard";
import { useShortcuts } from "./useShortcuts";
import { useBulkActions } from "./useBulkActions";

export interface EditableGridConfig<T> {
  initialRows: T[];
  onStateChange?: (rows: T[]) => void;
  onSave?: () => void;
  onPrint?: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
  onNewRow?: () => void;
}

export function useEditableGrid<T extends { id: string }>(config: EditableGridConfig<T>) {
  const { currentState: rows, pushState, undo, redo, canUndo, canRedo } = useHistory<T>(config.initialRows);
  const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection(rows);
  
  // Notify parent on change
  useEffect(() => {
    if (config.onStateChange) {
      config.onStateChange(rows);
    }
  }, [rows, config.onStateChange]); // Intentionally not including config as it might cause infinite loops if not memoized by parent, but ideally we should handle it better.

  const { copy, cut, paste } = useClipboard(rows, selectedIds, pushState);
  const { bulkDelete, bulkDuplicate, bulkEdit } = useBulkActions(rows, selectedIds, pushState);

  useShortcuts({
    onUndo: undo,
    onRedo: redo,
    onCopy: copy,
    onCut: cut,
    onPaste: paste,
    onSelectAll: selectAll,
    onClearSelection: clearSelection,
    onDelete: bulkDelete,
    onDuplicate: bulkDuplicate,
    onNewRow: config.onNewRow,
    onSave: config.onSave,
    onPrint: config.onPrint,
    onExportExcel: config.onExportExcel,
    onExportPdf: config.onExportPdf
  });

  const updateRow = useCallback((id: string, field: keyof T, value: any) => {
    const newRows = rows.map(r => r.id === id ? { ...r, [field]: value } : r);
    pushState(newRows);
  }, [rows, pushState]);

  const addRow = useCallback((newRow: T) => {
    pushState([...rows, newRow]);
  }, [rows, pushState]);

  const removeRow = useCallback((id: string) => {
    pushState(rows.filter(r => r.id !== id));
  }, [rows, pushState]);

  return {
    rows,
    selectedIds,
    toggleSelection,
    clearSelection,
    selectAll,
    updateRow,
    addRow,
    removeRow,
    bulkDelete,
    bulkDuplicate,
    bulkEdit,
    undo,
    redo,
    canUndo,
    canRedo,
    pushState, // Escape hatch to set full state
  };
}
