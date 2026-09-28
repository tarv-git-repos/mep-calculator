import React, { useState } from "react";
import {
  Plus,
  Download,
  Upload,
  Search,
  X,
  Filter,
  ArrowUpDown,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Check,
  FileText,
} from "lucide-react";
import { DataGrid, Column } from "@/components/workspace/DataGrid";
import { CalculationReviewBar, useCalculationReviewState, getCalculationStatusBorderClass } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { StandardContextMenu, CustomMenuItem } from "./StandardContextMenu";
import {
  CalculationPreviewModal,
  CalculationPreviewData,
} from "./CalculationPreviewModal";
import { TBtn } from "@/components/workspace/Button";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export interface TabOption {
  id: string;
  label: string;
  count?: number;
}

export interface RoundOffOption {
  label: string;
  value: string | number;
}

export interface SummaryStatPill {
  label: string;
  value: string | number;
  unit?: string;
  variant?: "default" | "primary" | "success" | "warning";
}

interface StandardCalculatorLayoutProps<T extends { id: string; name?: string; code?: string }> {
  title?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  summaryPills?: SummaryStatPill[];

  // Tabs
  tabs?: TabOption[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;

  // Round off presets (Optional - only renders if explicitly provided)
  roundOffOptions?: RoundOffOption[];
  activeRoundOff?: string | number;
  onRoundOffChange?: (val: string | number) => void;

  // Data & Columns
  rows: T[];
  columns: Column<T>[];
  gridId?: string;
  groupBy?: (row: T) => string;
  groupOrder?: string[];
  renderGroupHeader?: (groupValue: string) => React.ReactNode;

  // Selection & Lock State
  selectedIds: Set<string>;
  onToggle: (id: string, isShift?: boolean, isCtrl?: boolean) => void;
  onToggleAll: () => void;
  onClearSelection: () => void;
  isReadOnly?: boolean;

  // Search, Filter & Sort
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  filterPlaceholder?: string;

  availableSortKeys?: Array<{ key: string; label: string }>;
  activeSortKey?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (key: string) => void;

  availableFilterCategories?: Array<{ key: string; label: string }>;
  activeFilterCategory?: string;
  onFilterCategoryChange?: (key: string) => void;

  // Actions
  onAddRow?: () => void;
  addRowLabel?: string;
  onEditRow?: (row: T) => void;
  onDuplicateRow?: (row: T | T[]) => void;
  onDeleteRow?: (row: T | T[]) => void;
  onBulkEdit?: (selectedIds: string[]) => void;

  // Modals & Calculation Preview
  getCalculationPreview?: (row: T) => CalculationPreviewData | null;
  commentTarget?: { id: string; name: string } | null;
  isCommentOpen?: boolean;
  onCloseCommentModal?: () => void;
  onSaveComment?: (comment: any) => void;

  previewData?: CalculationPreviewData | null;
  isPreviewOpen?: boolean;
  onClosePreviewModal?: () => void;

  // Custom Context Menu Items & Buttons
  customContextMenuItems?: CustomMenuItem[];
  customToolbarActions?: React.ReactNode;

  // Export / Import
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  exportPdfLabel?: string;
  onImport?: () => void;
  importLabel?: string;

  // Review status path
  calculatorPath: string;
  children?: React.ReactNode;
  
  hideHeader?: boolean;
  hideReviewBar?: boolean;
}

export function StandardCalculatorLayout<T extends { id: string; name?: string; code?: string }>({
  title,
  subtitle,
  icon: HeaderIcon = Sparkles,
  summaryPills = [],
  tabs = [],
  hideHeader = false,
  hideReviewBar = false,
  activeTab,
  onTabChange,
  roundOffOptions, // Defaults to undefined so it's strictly optional
  activeRoundOff,
  onRoundOffChange,
  rows,
  columns,
  gridId,
  groupBy,
  groupOrder,
  renderGroupHeader,
  selectedIds,
  onToggle,
  onToggleAll,
  onClearSelection,
  isReadOnly = false,
  searchTerm = "",
  onSearchChange,
  filterPlaceholder = "Filter items...",
  availableSortKeys = [],
  activeSortKey,
  sortDirection = "asc",
  onSortChange,
  availableFilterCategories = [],
  activeFilterCategory = "all",
  onFilterCategoryChange,
  onAddRow,
  addRowLabel = "+ New Item",
  onEditRow,
  onDuplicateRow,
  onDeleteRow,
  onBulkEdit,
  getCalculationPreview,
  commentTarget,
  isCommentOpen = false,
  onCloseCommentModal,
  onSaveComment,
  previewData,
  isPreviewOpen = false,
  onClosePreviewModal,
  customContextMenuItems = [],
  customToolbarActions,
  onExportExcel,
  onExportPDF,
  exportPdfLabel = "Export PDF",
  onImport,
  importLabel = "Import",
  calculatorPath,
  children,
}: StandardCalculatorLayoutProps<T>) {
  const [internalPreviewData, setInternalPreviewData] = useState<CalculationPreviewData | null>(null);
  const [internalIsPreviewOpen, setInternalIsPreviewOpen] = useState(false);

  const [internalCommentTarget, setInternalCommentTarget] = useState<{ id: string; name: string } | null>(null);
  const [internalIsCommentOpen, setInternalIsCommentOpen] = useState(false);

  const handlePreviewCalculation = (row: T) => {
    if (getCalculationPreview) {
      const calcData = getCalculationPreview(row);
      if (calcData) {
        setInternalPreviewData(calcData);
        setInternalIsPreviewOpen(true);
        return;
      }
    }
    toast.info(`Calculation breakdown for ${row.name || row.code || row.id}`);
  };

  const handleOpenComment = (row: T) => {
    setInternalCommentTarget({ id: row.id, name: row.name || row.code || `Item ${row.id}` });
    setInternalIsCommentOpen(true);
  };

  const activeCommentTarget = commentTarget || internalCommentTarget;
  const activeIsCommentOpen = isCommentOpen || internalIsCommentOpen;
  const activeCloseCommentModal = onCloseCommentModal || (() => setInternalIsCommentOpen(false));

  const activePreviewData = previewData || internalPreviewData;
  const activeIsPreviewOpen = isPreviewOpen || internalIsPreviewOpen;
  const activeClosePreviewModal = onClosePreviewModal || (() => setInternalIsPreviewOpen(false));

  const hasSelection = selectedIds.size > 0;
  const showTopControlsRow = (tabs && tabs.length > 0) || (roundOffOptions && roundOffOptions.length > 0);
  const reviewState = useCalculationReviewState(calculatorPath);
  const statusBorderClass = getCalculationStatusBorderClass(reviewState?.status);

  return (
    <div className={`flex flex-col h-full bg-background text-foreground overflow-hidden rounded-2xl transition-all duration-300 ${statusBorderClass}`}>
      {/* Optional Title Header Bar (if title provided) */}
      {!hideHeader && title && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-header-bg shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <HeaderIcon className="size-4" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-foreground">{title}</h1>
              {subtitle && <p className="text-[11.5px] text-muted-foreground">{subtitle}</p>}
            </div>
          </div>

          {summaryPills.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto py-0.5">
              {summaryPills.map((pill, i) => (
                <div
                  key={i}
                  className="px-2.5 py-1 rounded-md border text-xs flex items-center gap-1.5 tabular font-medium bg-surface-2 border-border/80 text-foreground"
                >
                  <span className="text-[10.5px] text-muted-foreground font-normal">{pill.label}:</span>
                  <span className="font-mono font-bold text-primary">{pill.value}</span>
                  {pill.unit && <span className="text-[10px] text-muted-foreground font-normal">{pill.unit}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Row 1: Pill Tabs & Round-off Selector (Only rendered if tabs or roundOffOptions are provided) */}
      {!hideHeader && showTopControlsRow && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-surface-1 border-b border-border/60 shrink-0">
          {/* Tabs Bar */}
          {tabs && tabs.length > 0 && (
            <div className="inline-flex items-center gap-1 p-1 bg-muted/60 rounded-full border border-border/60">
              {tabs.map((t) => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onTabChange && onTabChange(t.id)}
                    className={`px-4 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    }`}
                  >
                    {t.label}
                    {t.count !== undefined && (
                      <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Round-Off Selector (Renders ONLY if roundOffOptions is provided) */}
          {roundOffOptions && roundOffOptions.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-muted/40 rounded-full border border-border/60 text-xs ml-auto">
              <span className="text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase">
                Round-Off:
              </span>
              <div className="inline-flex items-center gap-1">
                {roundOffOptions.map((opt) => {
                  const isSel = activeRoundOff === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      onClick={() => onRoundOffChange && onRoundOffChange(opt.value)}
                      className={`px-2.5 py-0.5 rounded-full text-[11.5px] font-medium transition-all cursor-pointer ${
                        isSel
                          ? "bg-background text-foreground shadow-xs font-bold border border-border/60"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Row 2: Filter Search, Filter Button, Sort Button, Action Buttons */}
      {!hideHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2 border-b border-border bg-background shrink-0">
          {/* Left Controls: Search Input + Filter Funnel + Sort Arrows */}
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          {onSearchChange && (
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder={filterPlaceholder}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full h-8 pl-3 pr-7 bg-muted/30 border border-border rounded-full text-xs focus:outline-none focus:border-primary transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          {/* Filter Popover Button */}
          {availableFilterCategories.length > 0 && onFilterCategoryChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="size-8 rounded-full border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer">
                  <Filter className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel className="text-xs">Filter Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onFilterCategoryChange("all")}
                  className="flex items-center justify-between text-xs"
                >
                  <span>All Categories</span>
                  {activeFilterCategory === "all" && <Check className="size-3 text-primary" />}
                </DropdownMenuItem>
                {availableFilterCategories.map((c) => (
                  <DropdownMenuItem
                    key={c.key}
                    onClick={() => onFilterCategoryChange(c.key)}
                    className="flex items-center justify-between text-xs"
                  >
                    <span>{c.label}</span>
                    {activeFilterCategory === c.key && <Check className="size-3 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Sort Button */}
          {availableSortKeys.length > 0 && onSortChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="size-8 rounded-full border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer">
                  <ArrowUpDown className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel className="text-xs">Sort By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableSortKeys.map((s) => (
                  <DropdownMenuItem
                    key={s.key}
                    onClick={() => onSortChange(s.key)}
                    className="flex items-center justify-between text-xs"
                  >
                    <span>{s.label}</span>
                    {activeSortKey === s.key && (
                      <span className="text-[10px] font-mono text-primary uppercase font-bold">
                        {sortDirection}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Selection Action Indicator */}
          {hasSelection && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-border">
              <span className="text-xs font-semibold text-primary px-1">
                {selectedIds.size} Selected
              </span>
              {onBulkEdit && (
                <TBtn size="sm" variant="outline" onClick={() => onBulkEdit(Array.from(selectedIds))}>
                  Edit
                </TBtn>
              )}
              {onDeleteRow && (
                <TBtn
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => onDeleteRow(Array.from(selectedIds) as any)}
                >
                  Delete
                </TBtn>
              )}
              <button
                onClick={onClearSelection}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Right Controls: Import, Export PDF, Custom Actions, New Space Button */}
        <div className="flex items-center gap-2">
          {onImport && (
            <button
              onClick={onImport}
              className="px-3.5 py-1.5 border border-border hover:bg-muted text-foreground text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="size-3.5 text-muted-foreground" />
              <span>{importLabel}</span>
            </button>
          )}

          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="px-3.5 py-1.5 border border-border hover:bg-muted text-foreground text-xs font-semibold rounded-full flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="size-3.5 text-muted-foreground" />
              <span>{exportPdfLabel}</span>
            </button>
          )}

          {customToolbarActions}

          {onAddRow && (
            <button
              onClick={() => {
                if (isReadOnly) {
                  toast.info("Workspace is in Read-Only mode.", { id: "readonly-notice" });
                  return;
                }
                onAddRow();
              }}
              className="px-4 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>{addRowLabel}</span>
            </button>
          )}
        </div>
      </div>
      )}

      {/* 3. Main Content Area / DataGrid */}
      <div className="flex-1 min-h-0 relative flex flex-col">
        {children || (
          <DataGrid
            gridId={gridId}
            rows={rows}
            columns={columns}
            selected={selectedIds}
            onToggle={onToggle}
            onToggleAll={onToggleAll}
            groupBy={groupBy}
            groupOrder={groupOrder}
            renderGroupHeader={renderGroupHeader}
            onRowDoubleClick={(row) => {
              if (onEditRow) onEditRow(row);
              else handlePreviewCalculation(row);
            }}
            renderContextMenu={(row) => (
              <StandardContextMenu
                row={row}
                selectedIds={Array.from(selectedIds)}
                isReadOnly={isReadOnly}
                onEdit={onEditRow}
                onPreviewCalculation={handlePreviewCalculation}
                onDuplicate={onDuplicateRow}
                onAddComment={handleOpenComment}
                onDelete={onDeleteRow}
                onBulkEdit={onBulkEdit}
                customItems={customContextMenuItems}
              />
            )}
          />
        )}
      </div>

      {/* 4. Bottom Sticky Calculation Review Bar */}
      {!hideReviewBar && (
        <div className="shrink-0 px-4 py-2 border-t border-border bg-surface-1 flex items-center justify-between no-print">
          <CalculationReviewBar calculatorPath={calculatorPath} calculatorTitle={title || "Calculation"} />
        </div>
      )}

      {/* Modals */}
      {activeCommentTarget && (
        <AssignCommentModal
          isOpen={activeIsCommentOpen}
          onClose={activeCloseCommentModal}
          targetId={activeCommentTarget.id}
          targetName={activeCommentTarget.name}
          targetType="calculation"
          calculatorTitle={title || "MEP Calculator"}
          calculatorPath={calculatorPath}
          onSave={onSaveComment || (() => {})}
        />
      )}

      <CalculationPreviewModal
        isOpen={activeIsPreviewOpen}
        onClose={activeClosePreviewModal}
        data={activePreviewData}
      />
    </div>
  );
}
