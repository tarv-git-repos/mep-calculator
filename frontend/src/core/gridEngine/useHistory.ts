import { useState, useCallback } from "react";

export function useHistory<T>(initialState: T[]) {
  const [history, setHistory] = useState<T[][]>([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushState = useCallback((newStateOrUpdater: T[] | ((prev: T[]) => T[])) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      const current = prev[historyIndex] ?? [];
      const resolved = typeof newStateOrUpdater === "function" 
        ? (newStateOrUpdater as (prev: T[]) => T[])(current) 
        : newStateOrUpdater;
      newHistory.push(resolved);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const undo = useCallback(() => {
    setHistoryIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const redo = useCallback(() => {
    setHistoryIndex((prev) => Math.min(history.length - 1, prev + 1));
  }, [history]);

  return {
    currentState: history[historyIndex],
    pushState,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
}
