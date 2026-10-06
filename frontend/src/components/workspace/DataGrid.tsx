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
  isReadOnly: isReadOnlyProp,
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
  isReadOnly?: boolean;
}) {
  const [isClientReadOnly, setIsClientReadOnly] = useState(false);
  useEffect(() => {
    setIsClientReadOnly(Boolean((window as any).__mep_is_readonly || (window as any).__mep_approved_readonly));
  }, []);
  const isReadOnly = Boolean(isReadOnlyProp || isClientReadOnly);
  const onToggle = onToggleProp;
  const onToggleAll = onToggleAllProp;

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
  const lastTapRef = useRef<{ id: string; time: number }>({ id: "", time: 0 });

  useEffect(() => {
    const handleScrollToItem = (e: Event) => {
      const customEvent = e as CustomEvent<{ id?: string; name?: string; type?: string }>;
      if (!customEvent || !customEvent.detail) return;
      const { id: itemId, name: targetName } = customEvent.detail;
      const currentHeight = heightRef.current;
      
      const cleanId = itemId ? String(itemId).trim().toLowerCase() : "";
      const cleanIdNorm = cleanId.replace(/[^a-z0-9]/g, "");
      const cleanTarget = targetName ? String(targetName).trim().toLowerCase() : "";
      const cleanTargetNorm = cleanTarget.replace(/[^a-z0-9]/g, "");

      // If target row is inside a collapsed group, uncollapse that group first
      const matchingRow = rows.find((r: any) => {
        const rId = String(r.id || "").trim().toLowerCase();
        const rIdNorm = rId.replace(/[^a-z0-9]/g, "");
        if (cleanId && (rId === cleanId || (cleanIdNorm && rIdNorm === cleanIdNorm))) return true;

        if (cleanTargetNorm) {
          const rName = String(r.name || "").trim().toLowerCase();
          const rLabel = String(r.label || "").trim().toLowerCase();
          const rDesc = String(r.desc || "").trim().toLowerCase();
          const rNameNorm = rName.replace(/[^a-z0-9]/g, "");
          const rLabelNorm = rLabel.replace(/[^a-z0-9]/g, "");
          const rDescNorm = rDesc.replace(/[^a-z0-9]/g, "");

          if (rNameNorm && (rNameNorm === cleanTargetNorm || rNameNorm.includes(cleanTargetNorm) || cleanTargetNorm.includes(rNameNorm))) return true;
          if (rLabelNorm && (rLabelNorm === cleanTargetNorm || rLabelNorm.includes(cleanTargetNorm) || cleanTargetNorm.includes(rLabelNorm))) return true;
          if (rDescNorm && (rDescNorm === cleanTargetNorm || rDescNorm.includes(cleanTargetNorm) || cleanTargetNorm.includes(rDescNorm))) return true;
          if (rIdNorm && (rIdNorm === cleanTargetNorm || rIdNorm.includes(cleanTargetNorm) || cleanTargetNorm.includes(rIdNorm))) return true;
        }

        return false;
      });

      if (matchingRow && groupBy) {
        const gVal = groupBy(matchingRow) || "Unknown";
        setCollapsedGroups(prev => {
          if (prev.has(gVal)) {
            const next = new Set(prev);
            next.delete(gVal);
            return next;
          }
          return prev;
        });
      }

      const matchFn = (item: any) => {
        const rowData = item.data as any;
        const rId = String(item.id || rowData?.id || "").trim().toLowerCase();
        const rIdNorm = rId.replace(/[^a-z0-9]/g, "");
        if (cleanId && (rId === cleanId || (cleanIdNorm && rIdNorm === cleanIdNorm))) return true;

        if (cleanTargetNorm && rowData) {
          const rName = String(rowData.name || "").trim().toLowerCase();
          const rLabel = String(rowData.label || "").trim().toLowerCase();
          const rDesc = String(rowData.desc || "").trim().toLowerCase();
          const rTag = String(rowData.tag || "").trim().toLowerCase();
          const rFrom = String(rowData.from || "").trim().toLowerCase();
          const rLoc = String(rowData.location || "").trim().toLowerCase();
          const rRef = String(rowData.ref || "").trim().toLowerCase();

          const rNameNorm = rName.replace(/[^a-z0-9]/g, "");
          const rLabelNorm = rLabel.replace(/[^a-z0-9]/g, "");
          const rDescNorm = rDesc.replace(/[^a-z0-9]/g, "");
          const rTagNorm = rTag.replace(/[^a-z0-9]/g, "");

          if (rNameNorm && (rNameNorm === cleanTargetNorm || rNameNorm.includes(cleanTargetNorm) || cleanTargetNorm.includes(rNameNorm))) return true;
          if (rLabelNorm && (rLabelNorm === cleanTargetNorm || rLabelNorm.includes(cleanTargetNorm) || cleanTargetNorm.includes(rLabelNorm))) return true;
          if (rDescNorm && (rDescNorm === cleanTargetNorm || rDescNorm.includes(cleanTargetNorm) || cleanTargetNorm.includes(rDescNorm))) return true;
          if (rTagNorm && (rTagNorm === cleanTargetNorm || rTagNorm.includes(cleanTargetNorm) || cleanTargetNorm.includes(rTagNorm))) return true;
          if (rIdNorm && (rIdNorm === cleanTargetNorm || rIdNorm.includes(cleanTargetNorm) || cleanTargetNorm.includes(rIdNorm))) return true;
        }

        return false;
      };

      const doScroll = () => {
        const currentItems = itemsRef.current;
        const itemIndex = currentItems.findIndex(matchFn);

        if (itemIndex !== -1 && ref.current) {
          const matchedItem = currentItems[itemIndex];
          const actualId = matchedItem.data?.id || matchedItem.id;

          const topOffset = itemIndex * ROW_H;
          const newScrollTop = Math.max(0, topOffset - (currentHeight / 2) + (ROW_H / 2));
          ref.current.scrollTop = newScrollTop;
          setScrollTop(newScrollTop);
          
          setHighlightedRowId(actualId);
          if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
          highlightTimeoutRef.current = setTimeout(() => {
            setHighlightedRowId(null);
            highlightTimeoutRef.current = null;
          }, 4500);
        }
      };

      doScroll();
      setTimeout(doScroll, 100);
      setTimeout(doScroll, 300);
    };
    
    window.addEventListener("mep-scroll-to-item", handleScrollToItem);
    window.addEventListener("mep-data-grid-scroll", handleScrollToItem);
    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollToItem);
      window.removeEventListener("mep-data-grid-scroll", handleScrollToItem);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const totalDefaultWidth = useMemo(() => {
    return 36 + columns.reduce((sum, c) => sum + (c.width || 100), 0);
  }, [columns]);

  const gridTemplate = `36px ${columns.map((c) => {
    const ratio = colRatios[String(c.key)];
    if (ratio !== undefined) {
      return `minmax(0, ${ratio}fr)`;
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
          style={{ gridTemplateColumns: gridTemplate, minWidth: "100%" }}
        >
          <div className="px-2 grid place-items-center">
            <input
              type="checkbox"
              checked={allSelected && !isReadOnly}
              disabled={isReadOnly}
              onChange={() => {
                if (isReadOnly) {
                  toast.info("Calculation is Approved and Locked. Selection is locked.", { id: "readonly-notice" });
                  return;
                }
                onToggleAll();
              }}
              className="size-3 accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
          {columns.map((c) => {
            const k = String(c.key);
            const isLast = columns.indexOf(c) === columns.length - 1;
            return (
              <div
                key={k}
                className={`relative px-2 border-l border-transparent hover:border-border transition-colors duration-150 first:border-l-0 group flex items-center h-full min-w-0 ${
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
        className={isSticky ? "w-full relative z-10" : "flex-1 overflow-y-auto overflow-x-auto w-full relative z-10"}
      >
        <div style={{ height: total * ROW_H, position: "relative", minWidth: "100%" }} className="w-full">
          <div style={{ transform: `translateY(${start * ROW_H}px)`, minWidth: "100%" }} className="w-full">
            {slice.map((item) => {
              if (item.type === "group") {
                const groupVal = item.groupValue!;
                const groupRows = rows.filter((r) => (groupBy!(r) || "Unknown") === groupVal);
                const groupRowIds = groupRows.map((r) => r.id);
                const allSelected = groupRowIds.every((id) => selected.has(id));

                const handleGroupClick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (isReadOnly) {
                    toast.info("Calculation is Approved and Locked. Selection is locked.", { id: "readonly-notice" });
                    return;
                  }
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
                          style={{ gridTemplateColumns: "1fr", minWidth: "100%" }}
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
                    style={{ gridTemplateColumns: "1fr", minWidth: "100%" }}
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
                  <div
                    className="px-2 grid place-items-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isReadOnly) {
                        toast.info("Calculation is Approved and Locked. Selection is locked.", { id: "readonly-notice" });
                        return;
                      }
                      if (e.target === e.currentTarget) {
                        blurActiveInput();
                        onToggle(row.id, e.shiftKey, true);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sel && !isReadOnly}
                      disabled={isReadOnly}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isReadOnly) {
                          toast.info("Calculation is Approved and Locked. Selection is locked.", { id: "readonly-notice" });
                        }
                      }}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (isReadOnly) {
                          toast.info("Calculation is Approved and Locked. Selection is locked.", { id: "readonly-notice" });
                          return;
                        }
                        blurActiveInput();
                        onToggle(row.id, (e.nativeEvent as any)?.shiftKey || e.shiftKey, true);
                      }}
                      className="size-3.5 accent-primary cursor-pointer rounded disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                  {columns.map((c) => {
                    const isEditable = c.editable;
                    return (
                      <div
                        key={String(c.key)}
                        className={`px-2 truncate min-w-0 flex items-center ${
                          c.align === "right" ? "justify-end text-right" :
                          c.align === "center" ? "justify-center text-center w-full" : ""
                        } ${c.mono ? "font-mono tabular text-[13.5px]" : ""} ${isEditable && !isReadOnly ? "group/cell cursor-pointer hover:bg-primary/5 transition-colors" : ""}`}
                        title={isEditable && !isReadOnly ? "Double-click to edit" : undefined}
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
                        data-row-id={row.id}
                        data-item-id={row.id}
                        data-sprinkler-id={row.id}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          const isTextInputTarget = (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "checkbox" && (target as HTMLInputElement).type !== "radio") ||
                            target.tagName === "TEXTAREA" ||
                            target.tagName === "SELECT" ||
                            target.isContentEditable ||
                            target.getAttribute("contenteditable") === "true";
                          
                          const now = Date.now();
                          const isDoubleTap = lastTapRef.current.id === row.id && (now - lastTapRef.current.time) < 350;
                          lastTapRef.current = { id: row.id, time: now };

                          if (isDoubleTap) {
                            if (!selected.has(row.id)) {
                              onToggle(row.id, false, false);
                            }
                            onRowDoubleClick?.(row);
                            return;
                          }

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
                          if (!selected.has(row.id)) {
                            onToggle(row.id, false, false);
                          }
                          onRowDoubleClick?.(row);
                        }}
                        onContextMenu={(e) => {
                          if (isReadOnly) {
                            e.preventDefault();
                            e.stopPropagation();
                            toast.info("Calculation is Approved and Locked. Context menu is locked.", { id: "readonly-notice" });
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
                            ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/25 z-20 relative font-bold"
                            : ""
                        } ${isBlurred ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200" : ""}`}
                        style={{ gridTemplateColumns: gridTemplate, height: ROW_H, minWidth: "100%" }}
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
                  data-row-id={row.id}
                  data-item-id={row.id}
                  data-sprinkler-id={row.id}
                  key={row.id}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    const isTextInputTarget = (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "checkbox" && (target as HTMLInputElement).type !== "radio") ||
                      target.tagName === "TEXTAREA" ||
                      target.tagName === "SELECT" ||
                      target.isContentEditable ||
                      target.getAttribute("contenteditable") === "true";
                    
                    const now = Date.now();
                    const isDoubleTap = lastTapRef.current.id === row.id && (now - lastTapRef.current.time) < 350;
                    lastTapRef.current = { id: row.id, time: now };

                    if (isDoubleTap && !isTextInputTarget) {
                      if (!selected.has(row.id)) {
                        onToggle(row.id, false, false);
                      }
                      onRowDoubleClick?.(row);
                      return;
                    }

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
                      ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/25 z-20 relative font-bold"
                      : ""
                  } ${isBlurred ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200" : ""}`}
                  style={{ gridTemplateColumns: gridTemplate, height: ROW_H, minWidth: "100%" }}
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