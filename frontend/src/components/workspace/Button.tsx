import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export const TBtn = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; children: ReactNode }
>(({ children, primary, ...rest }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center whitespace-nowrap shrink-0 gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium border transition-colors cursor-pointer ${
        primary
          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
          : "bg-background text-foreground border-border hover:bg-surface-2"
      } ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
});
TBtn.displayName = "TBtn";

export function BulkBtn({
  icon: Icon,
  children,
  onClick,
}: {
  icon?: any;
  children: ReactNode;
  onClick?: (e?: any) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11.5px] font-semibold transition-colors text-[#06456F] hover:bg-primary/10 dark:text-[#0A7BC7] dark:hover:bg-primary/20 border border-transparent hover:border-primary/20 active:bg-primary/20 dark:active:bg-primary/30 cursor-pointer"
    >
      {Icon && <Icon className="size-3 shrink-0" />}
      {children}
    </button>
  );
}