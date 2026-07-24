import { useState, useCallback, useEffect } from "react";

export function useGridSelection<T extends { id: string }>(
  items: T[],
  setItems: React.Dispatch<React.SetStateAction<T[]>>,
  pushToUndo?: (items: T[]) => void
) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<T[]>([]);

  const copyRows = useCallback((ids: string[]) => {
    const toCopy = items.filter(item => ids.includes(item.id));
    setClipboard(toCopy);
  }, [items]);

  const cutRows = useCallback((ids: string[]) => {
    copyRows(ids);
    if (pushToUndo) pushToUndo(items);
    setItems(prev => prev.filter(item => !ids.includes(item.id)));
    setSelectedRows(new Set());
  }, [items, copyRows, setItems, pushToUndo]);

  const pasteRows = useCallback(() => {
    if (clipboard.length === 0) return;
    if (pushToUndo) pushToUndo(items);
    
    // We append the pasted items with new IDs
    const newItems = clipboard.map(item => ({
      ...item,
      id: crypto.randomUUID()
    }));
    
    setItems(prev => [...prev, ...newItems]);
    // Optionally select the newly pasted items
    setSelectedRows(new Set(newItems.map(i => i.id)));
  }, [clipboard, items, setItems, pushToUndo]);

  const handleRowSelect = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      
      if (e.shiftKey && lastSelectedId) {
        // Shift select
        const currentIndex = items.findIndex(i => i.id === id);
        const lastIndex = items.findIndex(i => i.id === lastSelectedId);
        
        if (currentIndex !== -1 && lastIndex !== -1) {
          const start = Math.min(currentIndex, lastIndex);
          const end = Math.max(currentIndex, lastIndex);
          
          for (let i = start; i <= end; i++) {
            newSet.add(items[i].id);
          }
        }
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl select (toggle)
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
      } else {
        // Normal select (replace)
        newSet.clear();
        newSet.add(id);
      }
      
      return newSet;
    });
    setLastSelectedId(id);
  }, [items, lastSelectedId]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedRows.size > 0) {
          e.preventDefault();
          copyRows(Array.from(selectedRows));
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        if (selectedRows.size > 0) {
          e.preventDefault();
          cutRows(Array.from(selectedRows));
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteRows();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRows.size > 0) {
          e.preventDefault();
          if (pushToUndo) pushToUndo(items);
          setItems(prev => prev.filter(item => !selectedRows.has(item.id)));
          setSelectedRows(new Set());
        }
      } else if (e.key === 'Escape') {
        setSelectedRows(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRows, copyRows, cutRows, pasteRows, items, setItems, pushToUndo]);

  return {
    selectedRows,
    setSelectedRows,
    handleRowSelect,
    copyRows,
    cutRows,
    pasteRows,
    clipboard
  };
}
