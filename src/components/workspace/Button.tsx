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