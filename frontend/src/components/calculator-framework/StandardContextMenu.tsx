import React from "react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Edit3, Copy, MessageSquare, Trash2, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";

export interface CustomMenuItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (row: any) => void;
  shortcut?: string;
  variant?: "default" | "destructive" | "primary";
}

interface StandardContextMenuProps<T extends { id: string; name?: string }> {
  row: T;
  selectedIds?: string[];
  isReadOnly?: boolean;
  onEdit?: (row: T) => void;
  onPreviewCalculation?: (row: T) => void;
  onDuplicate?: (row: T | T[]) => void;
  onAddComment?: (row: T) => void;
  onDelete?: (row: T | T[]) => void;
  onBulkEdit?: (selectedIds: string[]) => void;
  customItems?: CustomMenuItem[];
}

export function StandardContextMenu<T extends { id: string; name?: string }>({
  row,
  selectedIds = [],
  isReadOnly = false,
  onEdit,
  onPreviewCalculation,
  onDuplicate,
  onAddComment,
  onDelete,
  onBulkEdit,
  customItems = [],
}: StandardContextMenuProps<T>) {
  const isMulti = selectedIds.length > 1 && selectedIds.includes(row.id);
  const targetsCount = isMulti ? selectedIds.length : 1;

  const handleReadOnlyGuard = (action: () => void, actionName: string) => {
    if (isReadOnly) {
      toast.info(`Workspace is in Read-Only mode. ${actionName} is locked.`, {
        id: "readonly-notice",
      });
      return;
    }
    action();
  };

  return (
    <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
      {/* 1. Primary Action: Edit or Bulk Edit */}
      {isMulti && onBulkEdit ? (
        <ContextMenuItem
          onClick={() => handleReadOnlyGuard(() => onBulkEdit(selectedIds), "Bulk Editing")}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Bulk Edit ({targetsCount} items)</span>
        </ContextMenuItem>
      ) : (
        onEdit && (
          <ContextMenuItem
            onClick={() => handleReadOnlyGuard(() => onEdit(row), "Editing")}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
          >
            <Edit3 className="size-3.5 text-muted-foreground" />
            <span>Edit Item</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">
              Double Click
            </ContextMenuShortcut>
          </ContextMenuItem>
        )
      )}

      {/* 2. Calculation Breakdown / Step-by-Step Preview */}
      {onPreviewCalculation && (
        <ContextMenuItem
          onClick={() => onPreviewCalculation(row)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer font-medium text-primary"
        >
          <Eye className="size-3.5 text-primary" />
          <span>Calculation Preview</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">
            Formula
          </ContextMenuShortcut>
        </ContextMenuItem>
      )}

      {/* 3. Duplicate Option */}
      {onDuplicate && (
        <ContextMenuItem
          onClick={() =>
            handleReadOnlyGuard(
              () => onDuplicate(isMulti ? (selectedIds as any) : row),
              "Duplicating"
            )
          }
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? `Duplicate Selected (${targetsCount})` : "Duplicate Item"}</span>
        </ContextMenuItem>
      )}

      {/* 4. Add Comment & Assign Task */}
      {onAddComment && (
        <ContextMenuItem
          onClick={() => handleReadOnlyGuard(() => onAddComment(row), "Adding Comments")}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5" />
          <span>Add Comment / Assign Task</span>
        </ContextMenuItem>
      )}

      {/* Custom Menu Items Slot */}
      {customItems.length > 0 && (
        <>
          <ContextMenuSeparator className="h-px bg-border my-1" />
          {customItems.map((item, idx) => {
            const Icon = item.icon || Sparkles;
            return (
              <ContextMenuItem
                key={idx}
                onClick={() => handleReadOnlyGuard(() => item.onClick(row), item.label)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${
                  item.variant === "destructive"
                    ? "hover:bg-destructive/10 text-destructive"
                    : "hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="size-3.5 text-muted-foreground" />
                <span>{item.label}</span>
                {item.shortcut && (
                  <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">
                    {item.shortcut}
                  </ContextMenuShortcut>
                )}
              </ContextMenuItem>
            );
          })}
        </>
      )}

      {/* 5. Delete Action */}
      {onDelete && (
        <>
          <ContextMenuSeparator className="h-px bg-border my-1" />
          <ContextMenuItem
            onClick={() =>
              handleReadOnlyGuard(
                () => onDelete(isMulti ? (selectedIds as any) : row),
                "Deleting"
              )
            }
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 text-destructive hover:text-destructive rounded cursor-pointer font-medium"
          >
            <Trash2 className="size-3.5" />
            <span>{isMulti ? `Delete Selected (${targetsCount})` : "Delete Item"}</span>
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
