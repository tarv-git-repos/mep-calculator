import type { ButtonHTMLAttributes, ReactNode } from "react";

export function TBtn({ children, primary, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; children: ReactNode }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium border transition-colors cursor-pointer ${
        primary
          ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
          : "bg-background text-foreground border-border hover:bg-surface-2"
      } ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function BulkBtn({
  icon: Icon,
  children,
  onClick,
}: {
  icon?: any;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[11.5px] font-semibold bg-white/80 dark:bg-black/40 hover:bg-white dark:hover:bg-black/60 text-[#06456F] dark:text-[#0A7BC7] border border-[#06456F]/20 dark:border-[#0A7BC7]/30 transition-all cursor-pointer active:scale-95 shadow-xs"
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
    </button>
  );
}