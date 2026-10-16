import { useEffect } from "react";

interface GridNavigationConfig {
  gridId: string;
}

export function useGridNavigation({ gridId }: GridNavigationConfig) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      
      // Ensure we are inside the target grid
      if (!target.closest(`#${gridId}`)) return;
      
      // Only process if we are inside a table cell input/select
      if (target.tagName !== "INPUT" && target.tagName !== "SELECT") return;

      const rowStr = target.getAttribute("data-row");
      const colStr = target.getAttribute("data-col");
      if (!rowStr || !colStr) return;

      const rowIndex = parseInt(rowStr, 10);
      const colIndex = parseInt(colStr, 10);

      // Up / Down / Enter
      if (["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
        e.preventDefault();
        let nextRow = rowIndex;
        if (e.key === "ArrowUp") nextRow--;
        if (e.key === "ArrowDown" || e.key === "Enter") nextRow++;

        const nextEl = document.querySelector(`#${gridId} [data-row="${nextRow}"][data-col="${colIndex}"]`) as HTMLElement;
        if (nextEl) {
          nextEl.focus();
          if (nextEl instanceof HTMLInputElement) nextEl.select();
        }
      } 
      // Left / Right / Tab
      else if (["ArrowLeft", "ArrowRight", "Tab"].includes(e.key)) {
        let shouldMove = false;
        
        if (e.key === "Tab") {
          // Tab always moves to the next/prev cell, browser default prevented below
          shouldMove = true;
          e.preventDefault();
        } else if (target.tagName === "SELECT" || (target as HTMLInputElement).value === "") {
          shouldMove = true;
        } else if (target instanceof HTMLInputElement) {
          if (e.key === "ArrowLeft" && target.selectionStart === 0) shouldMove = true;
          if (e.key === "ArrowRight" && target.selectionEnd === (target.value || "").length) shouldMove = true;
        }

        if (shouldMove) {
          if (e.key !== "Tab") e.preventDefault(); // Already prevented for Tab above

          let nextCol = colIndex;
          let nextRow = rowIndex;

          if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
            nextCol--;
          } else if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
            nextCol++;
          }

          let nextEl = document.querySelector(`#${gridId} [data-row="${nextRow}"][data-col="${nextCol}"]`) as HTMLElement;
          
          // Wrap around logic for Tab (optional, makes it more Excel-like)
          if (!nextEl && e.key === "Tab") {
            if (!e.shiftKey) {
               nextRow++;
               nextCol = 0;
            } else {
               nextRow--;
               nextCol = 99; // Fallback to find max col
            }
            // Simple heuristic to find next row's valid col
            const rowEls = document.querySelectorAll(`#${gridId} [data-row="${nextRow}"]`);
            if (rowEls.length > 0) {
               if (!e.shiftKey) {
                 nextEl = rowEls[0] as HTMLElement;
               } else {
                 nextEl = rowEls[rowEls.length - 1] as HTMLElement;
               }
            }
          }

          if (nextEl) {
            nextEl.focus();
            if (nextEl instanceof HTMLInputElement) nextEl.select();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gridId]);
}
