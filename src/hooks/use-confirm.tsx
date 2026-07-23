import React, { createContext, useContext, useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  hideCancel?: boolean;
}

interface ConfirmContextType {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    isOpen: boolean;
    message: string;
    title?: string;
    confirmText?: string;
    cancelText?: string;
    hideCancel?: boolean;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        isOpen: true,
        message,
        title: options?.title,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        hideCancel: options?.hideCancel,
        resolve,
      });
    });
  }, []);

  const handleCancel = () => {
    if (state) {
      state.resolve(false);
      setState(null);
    }
  };

  const handleConfirm = () => {
    if (state) {
      state.resolve(true);
      setState(null);
    }
  };

  // Determine button text dynamically based on the query if not provided
  const isDeleteAction = state ? (state.message.toLowerCase().includes("delete") || state.message.toLowerCase().includes("remove")) : false;
  const defaultConfirmText = isDeleteAction ? "Delete" : "Confirm";
  const confirmText = state?.confirmText || defaultConfirmText;
  const cancelText = state?.cancelText || "Cancel";

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog
        open={!!state?.isOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <AlertDialogContent className="w-full max-w-[400px] bg-surface border border-border shadow-2xl rounded-xl p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
          <AlertDialogHeader className="space-y-1.5">
            <AlertDialogTitle className="text-[14px] font-semibold tracking-tight text-foreground">
              {state?.title || "Confirm Action"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] text-muted-foreground leading-normal font-normal">
              {state?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-2 mt-2">
            {!state?.hideCancel && (
              <AlertDialogCancel
                onClick={handleCancel}
                className="h-8 px-4 border border-border bg-transparent hover:bg-surface-2 rounded text-[12px] font-medium text-foreground transition-colors mt-0"
              >
                {cancelText}
              </AlertDialogCancel>
            )}
            <AlertDialogAction
              onClick={handleConfirm}
              className={`h-8 px-4 rounded text-[12px] font-semibold transition-colors shadow-sm text-white ${
                isDeleteAction
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-primary hover:bg-primary-hover"
              }`}
            >
              {confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context.confirm;
}
