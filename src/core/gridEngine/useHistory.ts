import { useState, useCallback } from "react";

export function useHistory<T>(initialState: T[]) {
  const [history, setHistory] = useState<T[][]>([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushState = useCallback((newState: T[]) => {
    setHistory((prev) => {
      // Use the actual previous state length to avoid closure stale state
      // We only slice up to the current historyIndex if it was provided, 
      // but to be safe against rapid calls, we can just slice to the end of the known state
      // Actually, since historyIndex is state, we should sync them.
      // The safest way is to just use historyIndex from closure but NOT use functional update for index
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newState);
      return newHistory;
    });
    setHistoryIndex(historyIndex + 1);
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
