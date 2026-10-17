import React, { createContext, useContext, useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogPortal,
  AlertDialogOverlay,
} from "@/components/ui/alert-dialog";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { AlertTriangle, Trash2 } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  hideCancel?: boolean;
  threeButtons?: boolean;
  saveText?: string;
  unsaveText?: string;
  variant?: "default" | "unit-transition" | "destructive";
}

interface ConfirmContextType {
  confirm: {
    (message: string, options: ConfirmOptions & { threeButtons: true }): Promise<"save" | "unsave" | "cancel">;
    (message: string, options?: ConfirmOptions & { threeButtons?: false }): Promise<boolean>;
    (options: { title: string; body: string; confirmText?: string; cancelText?: string }): Promise<boolean>;
    (message: string, options?: ConfirmOptions): Promise<any>;
    (options: any): Promise<any>;
  };
  prompt: (message: string, defaultValue?: string, options?: ConfirmOptions) => Promise<string | null>;
}

const ConfirmContext = typeof window !== "undefined" 
  ? ((window as any).__ConfirmContext = (window as any).__ConfirmContext || createContext<ConfirmContextType | null>(null))
  : createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    isOpen: boolean;
    message: string;
    title?: string;
    confirmText?: string;
    cancelText?: string;
    hideCancel?: boolean;
    threeButtons?: boolean;
    saveText?: string;
    unsaveText?: string;
    variant?: "default" | "unit-transition" | "destructive";
    resolve: (value: any) => void;
  } | null>(null);

  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    message: string;
    defaultValue?: string;
    title?: string;
    confirmText?: string;
    cancelText?: string;
    resolve: (value: string | null) => void;
  } | null>(null);

  const [promptValue, setPromptValue] = useState("");

  const confirm = useCallback((messageOrOptions: any, options?: ConfirmOptions) => {
    return new Promise<any>((resolve) => {
      let msg = "";
      let title = options?.title;
      let confirmText = options?.confirmText;
      let cancelText = options?.cancelText;
      let hideCancel = options?.hideCancel;
      let threeButtons = options?.threeButtons;
      let saveText = options?.saveText;
      let unsaveText = options?.unsaveText;
      let variant = options?.variant || "default";

      if (typeof messageOrOptions === "object" && messageOrOptions !== null) {
        msg = messageOrOptions.body || messageOrOptions.message || "";
        title = messageOrOptions.title || title;
        confirmText = messageOrOptions.confirmText || confirmText;
        cancelText = messageOrOptions.cancelText || cancelText;
        hideCancel = messageOrOptions.hideCancel || hideCancel;
        variant = messageOrOptions.variant || variant;
      } else {
        msg = String(messageOrOptions);
      }

      setState({
        isOpen: true,
        message: msg,
        title,
        confirmText,
        cancelText,
        hideCancel,
        threeButtons,
        saveText,
        unsaveText,
        variant,
        resolve,
      });
    });
  }, []);

  const prompt = useCallback((message: string, defaultValue = "", options?: ConfirmOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(defaultValue);
      setPromptState({
        isOpen: true,
        message,
        defaultValue,
        title: options?.title || "Input Required",
        confirmText: options?.confirmText || "OK",
        cancelText: options?.cancelText || "Cancel",
        resolve,
      });
    });
  }, []);

  const handleCancel = () => {
    if (state) {
      state.resolve(state.threeButtons ? "cancel" : false);
      setState(null);
    }
  };

  const handleConfirm = () => {
    if (state) {
      state.resolve(state.threeButtons ? "save" : true);
      setState(null);
    }
  };

  const handleUnsave = () => {
    if (state) {
      state.resolve("unsave");
      setState(null);
    }
  };

  // Determine button text dynamically based on the query if not provided
  const isDeleteAction = state ? (state.message.toLowerCase().includes("delete") || state.message.toLowerCase().includes("remove")) : false;
  const defaultConfirmText = isDeleteAction ? "Delete" : "Confirm";
  const confirmText = state?.confirmText || defaultConfirmText;
  const cancelText = state?.cancelText || "Cancel";

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}
      <AlertDialog
        open={!!state?.isOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <AlertDialogPortal>
          <AlertDialogOverlay />
          <AlertDialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-[420px] translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/80 bg-background/95 dark:bg-[#16161a]/95 backdrop-blur-md p-6 shadow-2xl rounded-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col focus:outline-none">
          {state?.variant === "unit-transition" ? (
            <div className="flex gap-3.5 items-start">
              <div className="size-10 rounded-xl bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center justify-center text-red-500 shrink-0 select-none shadow-xs">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1 pt-0.5 flex-1 min-w-0">
                <AlertDialogTitle className="text-[15px] font-bold text-foreground leading-tight tracking-tight">
                  {state?.title || "Unit System Transition"}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[12.5px] text-muted-foreground leading-relaxed font-normal">
                  {state?.message}
                </AlertDialogDescription>
              </div>
            </div>
          ) : isDeleteAction || state?.variant === "destructive" ? (
            <div className="flex gap-3.5 items-start">
              <div className="size-10 rounded-xl bg-destructive/10 dark:bg-destructive/20 border border-destructive/20 flex items-center justify-center text-destructive shrink-0 select-none shadow-xs">
                <Trash2 className="size-5" />
              </div>
              <div className="space-y-1 pt-0.5 flex-1 min-w-0">
                <AlertDialogTitle className="text-[15px] font-bold text-foreground leading-tight tracking-tight">
                  {state?.title || "Delete Confirmation"}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[12.5px] text-muted-foreground leading-relaxed font-normal">
                  {state?.message}
                </AlertDialogDescription>
              </div>
            </div>
          ) : (
            <AlertDialogHeader className="space-y-1.5">
              <AlertDialogTitle className="text-[14.5px] font-bold tracking-tight text-foreground leading-tight">
                {state?.title || "Confirm Action"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[12.5px] text-muted-foreground leading-relaxed font-normal">
                {state?.message}
              </AlertDialogDescription>
            </AlertDialogHeader>
          )}
          <AlertDialogFooter className="flex items-center justify-end gap-2 mt-2 w-full pt-1">
            {state?.threeButtons ? (
              <div className="flex items-center justify-end gap-2 w-full">
                <AlertDialogCancel
                  onClick={handleCancel}
                  className="h-8.5 px-4 border border-border/80 bg-surface-1 hover:bg-surface-2 rounded-lg text-[12px] font-semibold text-foreground transition-all mt-0 cursor-pointer"
                >
                  {state.cancelText || "Cancel"}
                </AlertDialogCancel>
                {state.variant === "unit-transition" ? (
                  <>
                    <button
                      type="button"
                      onClick={handleUnsave}
                      className="h-8.5 px-4 border-0 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg text-[12px] font-semibold transition-all cursor-pointer"
                    >
                      {state.unsaveText || "Keep Values As-Is"}
                    </button>
                    <AlertDialogAction
                      onClick={handleConfirm}
                      className="h-8.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[12px] font-semibold transition-all shadow-xs cursor-pointer border-0"
                    >
                      {state.saveText || "Convert Values"}
                    </AlertDialogAction>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleUnsave}
                      className="h-8.5 px-4 border border-destructive/20 bg-destructive/10 hover:bg-destructive hover:text-white rounded-lg text-[12px] font-medium text-destructive transition-all cursor-pointer"
                    >
                      {state.unsaveText || "Unsave"}
                    </button>
                    <AlertDialogAction
                      onClick={handleConfirm}
                      className="h-8.5 px-4 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-lg text-[12px] font-semibold transition-all shadow-xs cursor-pointer border-0"
                    >
                      {state.saveText || "Save"}
                    </AlertDialogAction>
                  </>
                )}
              </div>
            ) : (
              <>
                {!state?.hideCancel && (
                  <AlertDialogCancel
                    onClick={handleCancel}
                    className="h-8.5 px-4 border border-border/80 bg-surface-1 hover:bg-surface-2 rounded-lg text-[12px] font-semibold text-foreground transition-all mt-0 cursor-pointer"
                  >
                    {cancelText}
                  </AlertDialogCancel>
                )}
                <AlertDialogAction
                  onClick={handleConfirm}
                  className={`h-8.5 px-4 rounded-lg text-[12px] font-semibold transition-all shadow-xs text-white cursor-pointer active:scale-[0.98] border-0 ${
                    isDeleteAction || state?.variant === "destructive"
                      ? "bg-destructive hover:bg-destructive/90"
                      : "bg-[#0A7BC7] hover:bg-[#06456F]"
                  }`}
                >
                  {confirmText}
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
          </AlertDialogPrimitive.Content>
        </AlertDialogPortal>
      </AlertDialog>

      <AlertDialog
        open={!!promptState?.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            promptState?.resolve(null);
            setPromptState(null);
          }
        }}
      >
        <AlertDialogPortal>
          <AlertDialogOverlay />
          <AlertDialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-[400px] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl rounded-3xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col focus:outline-none">
            <AlertDialogHeader className="space-y-1.5">
              <AlertDialogTitle className="text-[14px] font-semibold tracking-tight text-foreground">
                {promptState?.title}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[12.5px] text-muted-foreground leading-normal font-normal">
                {promptState?.message}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (promptState) {
                  promptState.resolve(promptValue);
                  setPromptState(null);
                }
              }}
              className="space-y-4"
            >
              <input
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[13px] text-foreground transition-all duration-150 font-sans"
                autoFocus
              />
              <AlertDialogFooter className="flex items-center justify-end gap-2 mt-2 w-full">
                <AlertDialogCancel
                  onClick={() => {
                    promptState?.resolve(null);
                    setPromptState(null);
                  }}
                  className="h-8 px-4 border border-border bg-transparent hover:bg-surface-2 rounded text-[12px] font-medium text-foreground transition-colors mt-0 cursor-pointer"
                >
                  {promptState?.cancelText || "Cancel"}
                </AlertDialogCancel>
                <AlertDialogAction
                  type="submit"
                  className="h-8 px-4 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded text-[12px] font-semibold transition-colors shadow-sm cursor-pointer border-0"
                >
                  {promptState?.confirmText || "OK"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </AlertDialogPrimitive.Content>
        </AlertDialogPortal>
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

export function usePrompt() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("usePrompt must be used within a ConfirmProvider");
  }
  return context.prompt;
}
