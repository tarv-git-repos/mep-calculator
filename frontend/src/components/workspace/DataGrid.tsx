import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  width: number;
  align?: "left" | "right" | "center";
  render?: (row: T) => React.ReactNode;
  mono?: boolean;
  editable?: boolean;
}

const ROW_H = 30;
const OVERSCAN = 8;

export function DataGrid<T extends { id: string }>({
  rows,
  columns,
  selected,
  onToggle: onToggleProp,
  onToggleAll: onToggleAllProp,
  renderContextMenu,
  groupBy,
  groupOrder,
  renderGroupHeader,
  renderGroupContextMenu,
  onToggleGroup,
  onRowDoubleClick,
  activeRowId,
  rowClassName,
  stickyHeaderTop,
  gridId,
}: {
  rows: T[];
  columns: Column<T>[];
  selected: Set<string>;
  onToggle: (id: string, isShift?: boolean, isCtrl?: boolean) => void;
  onToggleAll: () => void;
  renderContextMenu?: (row: T) => React.ReactNode;
  groupBy?: (row: T) => string;
  groupOrder?: string[];
  renderGroupHeader?: (groupValue: string) => React.ReactNode;
  renderGroupContextMenu?: (groupValue: string) => React.ReactNode;
  onToggleGroup?: (ids: string[], select: boolean) => void;
  onRowDoubleClick?: (row: T) => void;
  activeRowId?: string;
  rowClassName?: (row: T, index: number) => string;
  stickyHeaderTop?: number | string;
  gridId?: string;
}) {
  const isReadOnly = typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly || (window as any).__mep_approved_readonly);
  const onToggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    if (isReadOnly) {
       toast.info("Workspace is in Read-Only mode. Selection is locked.", { id: "readonly-notice" });
       return;
    }
    onToggleProp(id, isShift, isCtrl);
  };
  const onToggleAll = () => {
    if (isReadOnly) {
       toast.info("Workspace is in Read-Only mode. Selection is locked.", { id: "readonly-notice" });
       return;
    }
    onToggleAllProp();
  };

  const ref = useRef<HTMLDivElement>(null);
   const headerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);

  const [colRatios, setColRatios] = useState<Record<string, number>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const containerWidthRef = useRef(1000);

  // Initialize and synchronize ratios when columns prop changes
  useEffect(() => {
    const totalDefault = columns.reduce((sum, c) => sum + c.width, 0);
    const initialRatios: Record<string, number> = {};
    columns.forEach((c) => {
      initialRatios[String(c.key)] = c.width / totalDefault;
    });

    if (gridId) {
      try {
        const saved = localStorage.getItem(`mep_grid_${gridId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          const hasAllKeys = columns.every((c) => typeof parsed[String(c.key)] === "number");
          if (hasAllKeys) {
            setColRatios(parsed);
            return;
          }
        }
      } catch (e) {}
    }

    setColRatios(initialRatios);
  }, [columns, gridId]);

  const handleMouseDown = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    
    const colIndex = columns.findIndex((c) => String(c.key) === key);
    if (colIndex === -1 || colIndex === columns.length - 1) return;

    const key1 = String(columns[colIndex].key);
    const key2 = String(columns[colIndex + 1].key);

    const totalDefault = columns.reduce((sum, c) => sum + c.width, 0);
    const r1 = colRatios[key1] ?? (columns[colIndex].width / totalDefault);
    const r2 = colRatios[key2] ?? (columns[colIndex + 1].width / totalDefault);
    const rSum = r1 + r2;

    const availableWidth = containerWidthRef.current - 36;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      const deltaRatio = deltaPx / availableWidth;

      let nextR1 = r1 + deltaRatio;
      let nextR2 = r2 - deltaRatio;

      const minW1 = Math.min(columns[colIndex].width, 50);
      const minW2 = Math.min(columns[colIndex + 1].width, 50);
      const minRatio1 = minW1 / availableWidth;
      const minRatio2 = minW2 / availableWidth;

      if (nextR1 < minRatio1) {
        nextR1 = minRatio1;
        nextR2 = rSum - minRatio1;
      } else if (nextR2 < minRatio2) {
        nextR2 = minRatio2;
        nextR1 = rSum - minRatio2;
      }

      setColRatios((prev) => ({
        ...prev,
        [key1]: nextR1,
        [key2]: nextR2,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.classList.remove("select-none");

      if (gridId) {
        setColRatios((prev) => {
          localStorage.setItem(`mep_grid_${gridId}`, JSON.stringify(prev));
          return prev;
        });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.classList.add("select-none");
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timeoutId: any;
    const update = () => {
      containerWidthRef.current = el.clientWidth;
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        setHeight(el.clientHeight);
        timeoutId = null;
      }, 100);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Pre-process items if grouping is enabled
  const items = useMemo(() => {
    if (!groupBy) {
      return rows.map((r) => ({ type: "row" as const, id: r.id, data: r }));
    }

    const groups: Record<string, T[]> = {};
    rows.forEach((r) => {
      const val = groupBy(r) || "Unknown";
      if (!groups[val]) groups[val] = [];
      groups[val].push(r);
    });

    const result: Array<{ type: "group" | "row"; id: string; groupValue?: string; data?: T }> = [];
    const sortedGroupValues = Object.keys(groups).sort((a, b) => {
      if (groupOrder && groupOrder.length > 0) {
        const idxA = groupOrder.indexOf(a);
        const idxB = groupOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedGroupValues.forEach((groupVal) => {
      result.push({
        type: "group",
        id: `group-header-${groupVal}`,
        groupValue: groupVal,
      });
      if (!collapsedGroups.has(groupVal)) {
        groups[groupVal].forEach((r) => {
          result.push({
            type: "row",
            id: r.id,
            data: r,
          });
        });
      }
    });

    return result;
  }, [rows, groupBy, groupOrder, collapsedGroups]);

  const isSticky = stickyHeaderTop !== undefined;
  const total = items.length;
  const start = isSticky ? 0 : Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const visible = isSticky ? total : Math.ceil(height / ROW_H) + OVERSCAN * 2;
  const end = isSticky ? total : Math.min(total, start + visible);
  const slice = isSticky ? items : items.slice(start, end);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const heightRef = useRef(height);
  heightRef.current = height;
  const highlightTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const handleScrollToItem = (e: Event) => {
      const customEvent = e as CustomEvent<{ id?: string; name?: string }>;
      if (!customEvent || !customEvent.detail) return;
      const { id: itemId, name: targetName } = customEvent.detail;
      const currentItems = itemsRef.current;
      const currentHeight = heightRef.current;
      
      const itemIndex = currentItems.findIndex(
        (item) =>
          (itemId && (item.id === itemId || (item.data && item.data.id === itemId))) ||
          (targetName && item.data && String((item.data as any).name).toLowerCase().trim() === String(targetName).toLowerCase().trim())
      );

      if (itemIndex !== -1 && ref.current) {
        const matchedItem = currentItems[itemIndex];
        const actualId = matchedItem.data?.id || matchedItem.id;

        const topOffset = itemIndex * ROW_H;
        ref.current.scrollTop = Math.max(0, topOffset - (currentHeight / 2) + (ROW_H / 2));
        
        setHighlightedRowId(actualId);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedRowId(null);
          highlightTimeoutRef.current = null;
        }, 3000);
      }
    };
    
    window.addEventListener("mep-scroll-to-item", handleScrollToItem);
    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollToItem);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const gridTemplate = `36px ${columns.map((c) => {
    const ratio = colRatios[String(c.key)];
    if (ratio !== undefined) {
      const minW = Math.min(c.width, 50);
      return `minmax(${minW}px, ${ratio}fr)`;
    }
    return `${c.width}px`;
  }).join(" ")}`;
  const allSelected = (selected?.size ?? 0) === rows.length && rows.length > 0;

  return (
    <div className={`flex flex-col bg-background w-full ${isSticky ? "h-auto" : "h-full overflow-hidden"}`}>
      <div 
        ref={headerRef} 
        style={isSticky ? { position: "sticky", top: stickyHeaderTop, zIndex: 25 } : undefined}
        className={`bg-background dark:bg-[#1a1a1a] border-t border-b border-border-strong overflow-hidden w-full transition-all duration-300 shadow-2xs ${
          activeRowId ? "blur-[1px] opacity-35 pointer-events-none" : ""
        }`}
      >
        <div
          className="grid h-10 items-center text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground w-full"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div className="px-2 grid place-items-center">
            <input type="checkbox" checked={allSelected} disabled={isReadOnly} onChange={onToggleAll} className="size-3 accent-primary disabled:cursor-not-allowed disabled:opacity-60" />
          </div>
          {columns.map((c) => {
            const k = String(c.key);
            const isLast = columns.indexOf(c) === columns.length - 1;
            return (
              <div
                key={k}
                className={`relative px-2 border-l border-transparent hover:border-border transition-colors duration-150 first:border-l-0 group flex items-center h-full ${
                  c.align === "right" ? "justify-end text-right" :
                  c.align === "center" ? "justify-center text-center" : ""
                }`}
              >
                <span className="whitespace-pre-line leading-tight">{c.header}</span>
                {!isLast && (
                  <div
                    onMouseDown={(e) => handleMouseDown(k, e)}
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 flex items-center justify-center group/handle"
                    style={{ transform: "translateX(50%)" }}
                  >
                    <div className="w-[1.5px] h-full bg-transparent group-hover/handle:bg-primary/50 group-hover:bg-border/60 active:bg-primary transition-colors" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        ref={ref}
        onScroll={!isSticky ? (e) => {
          const target = e.currentTarget;
          setScrollTop(target.scrollTop);
          if (headerRef.current) {
            headerRef.current.scrollLeft = target.scrollLeft;
          }
        } : undefined}
        className={isSticky ? "w-full relative z-10" : "flex-1 overflow-y-auto overflow-x-hidden w-full relative z-10"}
      >
        <div style={{ height: total * ROW_H, position: "relative" }} className="w-full">
          <div style={{ transform: `translateY(${start * ROW_H}px)` }} className="w-full">
            {slice.map((item) => {
              if (item.type === "group") {
                const groupVal = item.groupValue!;
                const groupRows = rows.filter((r) => (groupBy!(r) || "Unknown") === groupVal);
                const groupRowIds = groupRows.map((r) => r.id);
                const allSelected = groupRowIds.every((id) => selected.has(id));

                const handleGroupClick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onToggleGroup?.(groupRowIds, !allSelected);
                };

                const isCollapsed = collapsedGroups.has(groupVal);
                const handleToggleCollapse = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setCollapsedGroups((prev) => {
                    const next = new Set(prev);
                    if (next.has(groupVal)) {
                      next.delete(groupVal);
                    } else {
                      next.add(groupVal);
                    }
                    return next;
                  });
                };

                const isGroupBlurred = activeRowId !== undefined;
                const groupContent = (
                  <div
                    onClick={handleGroupClick}
                    className={`col-span-full h-full bg-primary/5 hover:bg-primary/10 border-b border-border flex items-center border-l-4 border-l-primary pl-1.5 text-[12.5px] font-semibold text-primary select-none cursor-pointer gap-1.5 w-full transition-colors duration-150 ${
                      isGroupBlurred ? "blur-[1px] opacity-30 pointer-events-none scale-[0.99]" : ""
                    }`}
                  >
                    <button
                      onClick={handleToggleCollapse}
                      className="p-0.5 rounded hover:bg-primary/10 transition-colors text-primary/70 hover:text-primary flex items-center justify-center cursor-pointer"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </button>
                    <div className="flex-1 flex items-center gap-1.5 py-1">
                      {renderGroupHeader ? renderGroupHeader(groupVal) : `Floor: ${groupVal}`}
                    </div>
                  </div>
                );

                if (renderGroupContextMenu) {
                  return (
                    <ContextMenu key={item.id}>
                      <ContextMenuTrigger asChild>
                        <div
                          className="grid h-[30px] w-full"
                          style={{ gridTemplateColumns: "1fr" }}
                        >
                          {groupContent}
                        </div>
                      </ContextMenuTrigger>
                      {renderGroupContextMenu(groupVal)}
                    </ContextMenu>
                  );
                }

                return (
                  <div
                    key={item.id}
                    className="grid h-[30px] w-full"
                    style={{ gridTemplateColumns: "1fr" }}
                  >
                    {groupContent}
                  </div>
                );
              }

              const row = item.data!;
              const rowIndex = rows.indexOf(row);
              const sel = selected.has(row.id);
              const isActiveRow = activeRowId === row.id;
              const isBlurred = activeRowId !== undefined && !isActiveRow;
              
              const blurActiveInput = () => {
                const activeEl = document.activeElement;
                if (!activeEl) return;
                const tagName = activeEl.tagName.toUpperCase();
                const isTextInput =
                  (tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
                  tagName === "TEXTAREA" ||
                  tagName === "SELECT" ||
                  (activeEl as HTMLElement).isContentEditable ||
                  activeEl.getAttribute("contenteditable") === "true";
                if (isTextInput) {
                  (activeEl as HTMLElement).blur();
                }
              };

              const renderRowContent = () => (
                <>
                  <div className="px-2 grid place-items-center" onClick={(e) => { e.stopPropagation(); blurActiveInput(); onToggle(row.id, e.shiftKey, true); }}>
                    <input type="checkbox" checked={sel} disabled={isReadOnly} onChange={() => {}} className="size-3 accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" />
                  </div>
                  {columns.map((c) => {
                    const isEditable = c.editable;
                    return (
                      <div
                        key={String(c.key)}
                        className={`px-2 truncate flex items-center ${
                          c.align === "right" ? "justify-end text-right" :
                          c.align === "center" ? "justify-center text-center w-full" : ""
                        } ${c.mono ? "font-mono tabular text-[13.5px]" : ""} ${isEditable ? "group/cell cursor-pointer hover:bg-primary/5 transition-colors" : ""}`}
                        title={isEditable ? "Double-click to edit" : undefined}
                      >
                        {c.render ? c.render(row) : (row as any)[c.key]}
                      </div>
                    );
                  })}
                </>
              );

              if (renderContextMenu) {
                return (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        id={`row-${row.id}`}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          const isTextInputTarget = (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "checkbox" && (target as HTMLInputElement).type !== "radio") ||
                            target.tagName === "TEXTAREA" ||
                            target.tagName === "SELECT" ||
                            target.isContentEditable ||
                            target.getAttribute("contenteditable") === "true";
                          if (!isTextInputTarget) {
                            blurActiveInput();
                            onToggle(row.id, e.shiftKey, e.ctrlKey || e.metaKey);
                          } else {
                            if (!selected.has(row.id)) {
                              onToggle(row.id, false, false);
                            }
                          }
                        }}
                        onDoubleClick={() => {
                          if ((window as any).__mep_is_readonly) {
                            toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
                            return;
                          }
                          if (!selected.has(row.id)) {
                            onToggle(row.id, false, false);
                          }
                          onRowDoubleClick?.(row);
                        }}
                        onContextMenu={(e) => {
                          if ((window as any).__mep_is_readonly) {
                            e.preventDefault();
                            e.stopPropagation();
                            toast.info("Workspace is in Read-Only mode. Context menu is disabled.", { id: "readonly-notice" });
                            return;
                          }
                          if (!selected.has(row.id)) {
                            setTimeout(() => {
                              onToggle(row.id, false, false);
                            }, 0);
                          }
                        }}
                        className={`grid items-center text-[13.5px] border-b border-border/60 hover:bg-row-hover cursor-default select-none w-full transition-colors duration-150 ${
                          rowClassName && !sel ? rowClassName(row, rowIndex) : ""
                        } ${
                          sel ? "bg-row-selected" : ""
                        } ${
                          isActiveRow
                            ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-2xl z-30 relative opacity-100 blur-none scale-[1.005]"
                            : ""
                        } ${
                          highlightedRowId === row.id
                            ? "row-highlight-flash"
                            : ""
                        } ${isBlurred ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200" : ""}`}
                        style={{ gridTemplateColumns: gridTemplate, height: ROW_H }}
                      >
                        {renderRowContent()}
                      </div>
                    </ContextMenuTrigger>
                    {renderContextMenu(row)}
                  </ContextMenu>
                );
              }

              return (
                <div
                  id={`row-${row.id}`}
                  key={row.id}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const isTextInputTarget = (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "checkbox" && (target as HTMLInputElement).type !== "radio") ||
                      target.tagName === "TEXTAREA" ||
                      target.tagName === "SELECT" ||
                      target.isContentEditable ||
                      target.getAttribute("contenteditable") === "true";
                    if (!isTextInputTarget) {
                      blurActiveInput();
                      onToggle(row.id, e.shiftKey, e.ctrlKey || e.metaKey);
                    } else {
                      if (!selected.has(row.id)) {
                        onToggle(row.id, false, false);
                      }
                    }
                  }}
                  onDoubleClick={() => {
                    if ((window as any).__mep_is_readonly) {
                      toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
                      return;
                    }
                    if (!selected.has(row.id)) {
                      onToggle(row.id, false, false);
                    }
                    onRowDoubleClick?.(row);
                  }}
                  className={`grid items-center text-[13.5px] border-b border-border/60 hover:bg-row-hover cursor-default select-none w-full transition-colors duration-150 ${
                    rowClassName && !sel ? rowClassName(row, rowIndex) : ""
                  } ${
                    sel ? "bg-row-selected" : ""
                  } ${
                    isActiveRow
                      ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-2xl z-30 relative opacity-100 blur-none scale-[1.005]"
                      : ""
                  } ${
                    highlightedRowId === row.id
                      ? "row-highlight-flash"
                      : ""
                  } ${isBlurred ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200" : ""}`}
                  style={{ gridTemplateColumns: gridTemplate, height: ROW_H }}
                >
                  {renderRowContent()}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}