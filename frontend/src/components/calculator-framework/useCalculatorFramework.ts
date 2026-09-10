import { useState, useMemo, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { toast } from "sonner";
import { TaskComment } from "@/lib/ventilation-calc";
import { CalculationPreviewData } from "./CalculationPreviewModal";

export interface CalculatorItem {
  id: string;
  name?: string;
  code?: string;
  comments?: TaskComment[];
  [key: string]: any;
}

export interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

export interface UseCalculatorFrameworkOptions<T extends CalculatorItem> {
  calculatorId: string;
  calculatorTitle: string;
  items: T[];
  initialTab?: string;
  initialRoundOff?: string | number;
  onUpdateItems?: (updatedItems: T[]) => void;
  onUpdateItemComments?: (itemId: string, newComment: TaskComment) => void;
}

export function useCalculatorFramework<T extends CalculatorItem>({
  calculatorId,
  calculatorTitle,
  items,
  initialTab = "spaces",
  initialRoundOff = "1 L/s",
  onUpdateItems,
  onUpdateItemComments,
}: UseCalculatorFrameworkOptions<T>) {
  const { activeProjectId, isReadOnly: workspaceReadOnly } = useWorkspace();

  // 1. Tab Navigation
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // 2. Round-Off Selection
  const [roundOffPreset, setRoundOffPreset] = useState<string | number>(initialRoundOff);

  // 3. Selection State
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string, isShift = false, isCtrl = false) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === items.length) {
        return new Set();
      } else {
        return new Set(items.map((item) => item.id));
      }
    });
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  // 4. Search, Filter & Sort State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "name",
    direction: "asc",
  });

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }, []);

  // Processed Items (Filtered & Sorted)
  const processedItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((item) => {
        const nameMatch = (item.name || "").toLowerCase().includes(term);
        const codeMatch = (item.code || "").toLowerCase().includes(term);
        const catMatch = (item.category || "").toLowerCase().includes(term);
        const floorMatch = (item.floor || "").toLowerCase().includes(term);
        return nameMatch || codeMatch || catMatch || floorMatch;
      });
    }

    // Category filter
    if (filterCategory !== "all") {
      result = result.filter((item) => item.category === filterCategory);
    }

    // Status filter
    if (filterStatus !== "all") {
      result = result.filter((item) => item.status === filterStatus);
    }

    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key] ?? "";
        const valB = b[sortConfig.key] ?? "";

        if (typeof valA === "number" && typeof valB === "number") {
          return sortConfig.direction === "asc" ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA < strB) return sortConfig.direction === "asc" ? -1 : 1;
        if (strA > strB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [items, searchTerm, filterCategory, filterStatus, sortConfig]);

  // 5. Modals State (Comment, Calculation Preview, Bulk Edit)
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string } | null>(null);
  const [isCommentOpen, setIsCommentOpen] = useState(false);

  const openCommentModal = useCallback((row: T) => {
    setCommentTarget({
      id: row.id,
      name: row.name || row.code || `Item ${row.id}`,
    });
    setIsCommentOpen(true);
  }, []);

  const closeCommentModal = useCallback(() => {
    setCommentTarget(null);
    setIsCommentOpen(false);
  }, []);

  const [previewData, setPreviewData] = useState<CalculationPreviewData | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const openPreviewModal = useCallback((data: CalculationPreviewData) => {
    setPreviewData(data);
    setIsPreviewOpen(true);
  }, []);

  const closePreviewModal = useCallback(() => {
    setPreviewData(null);
    setIsPreviewOpen(false);
  }, []);

  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkTargetIds, setBulkTargetIds] = useState<string[]>([]);

  const openBulkEdit = useCallback((targetIds: string[]) => {
    setBulkTargetIds(targetIds);
    setIsBulkEditOpen(true);
  }, []);

  const closeBulkEdit = useCallback(() => {
    setBulkTargetIds([]);
    setIsBulkEditOpen(false);
  }, []);

  // 6. Review & Lock State
  const storageKey = useMemo(
    () => `mep_calc_review_${activeProjectId || "default"}_${calculatorId}`,
    [activeProjectId, calculatorId]
  );

  const [reviewState, setReviewState] = useState<{ status: "DRAFT" | "IN_REVIEW" | "APPROVED" }>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return { status: "DRAFT" };
  });

  const isReadOnly = Boolean(
    workspaceReadOnly ||
      reviewState.status === "APPROVED" ||
      (typeof window !== "undefined" &&
        Boolean((window as any).__mep_is_readonly || (window as any).__mep_approved_readonly))
  );

  const handleSaveComment = useCallback(
    async (newComment: TaskComment) => {
      if (!commentTarget) return;

      if (onUpdateItemComments) {
        onUpdateItemComments(commentTarget.id, newComment);
      }

      toast.success("Comment created successfully!");
    },
    [commentTarget, onUpdateItemComments]
  );

  return {
    // Tabs & Roundoff
    activeTab,
    setActiveTab,
    roundOffPreset,
    setRoundOffPreset,

    // Selection
    selected,
    toggle,
    toggleAll,
    clearSelection,
    setSelected,

    // Search, Filter & Sort
    searchTerm,
    setSearchTerm,
    filterCategory,
    setFilterCategory,
    filterStatus,
    setFilterStatus,
    sortConfig,
    setSortConfig,
    handleSort,
    processedItems,

    // Modals
    commentTarget,
    isCommentOpen,
    openCommentModal,
    closeCommentModal,
    handleSaveComment,

    previewData,
    isPreviewOpen,
    openPreviewModal,
    closePreviewModal,

    isBulkEditOpen,
    bulkTargetIds,
    openBulkEdit,
    closeBulkEdit,

    // Lock & Review
    isReadOnly,
    reviewState,
    setReviewState,
    calculatorTitle,
    calculatorId,
  };
}
