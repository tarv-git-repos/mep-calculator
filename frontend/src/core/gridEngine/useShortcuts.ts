import { useEffect } from "react";

interface ShortcutHandlers {
  readOnly?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onNewRow?: () => void;
  onSave?: () => void;
  onPrint?: () => void;
  onExportExcel?: () => void;
  onExportPdf?: () => void;
}

export function useShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          handlers.onClearSelection?.();
        }
        return;
      }

      const ctrlCmd = e.ctrlKey || e.metaKey;

      if (ctrlCmd && e.key === "a") {
        e.preventDefault();
        handlers.onSelectAll?.();
      } else if (ctrlCmd && e.key === "c") {
        e.preventDefault();
        handlers.onCopy?.();
      } else if (ctrlCmd && e.key === "x") {
        if (handlers.readOnly) return;
        e.preventDefault();
        handlers.onCut?.();
      } else if (ctrlCmd && e.key === "v") {
        if (handlers.readOnly) return;
        // Pasting might need OS level clipboard API depending on implementation, 
        // but for internal clipboard we can trigger our paste
        e.preventDefault();
        handlers.onPaste?.();
      } else if (ctrlCmd && e.key === "z") {
        e.preventDefault();
        handlers.onUndo?.();
      } else if (ctrlCmd && e.key === "y") {
        e.preventDefault();
        handlers.onRedo?.();
      } else if (ctrlCmd && e.key === "d") {
        if (handlers.readOnly) return;
        e.preventDefault();
        handlers.onDuplicate?.();
      } else if (ctrlCmd && e.key === "n") {
        if (handlers.readOnly) return;
        e.preventDefault();
        handlers.onNewRow?.();
      } else if (ctrlCmd && e.key === "s") {
        e.preventDefault();
        handlers.onSave?.();
      } else if (ctrlCmd && e.key === "p") {
        e.preventDefault();
        if (e.shiftKey) {
          handlers.onExportPdf?.();
        } else {
          handlers.onPrint?.();
        }
      } else if (ctrlCmd && e.key === "e") {
        e.preventDefault();
        handlers.onExportExcel?.();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (handlers.readOnly) return;
        handlers.onDelete?.();
      } else if (e.key === "Escape") {
        handlers.onClearSelection?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
