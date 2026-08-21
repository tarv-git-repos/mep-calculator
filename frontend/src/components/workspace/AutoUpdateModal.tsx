import React, { useState, useEffect } from "react";
import { Sparkles, Download, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  url: string;
  notes?: string;
  mandatory?: boolean;
}

const CURRENT_VERSION = "0.0.3";

export const AutoUpdateModal: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        // Check if user dismissed update within last 24 hours
        const dismissedUntil = localStorage.getItem("mep_update_dismissed_until");
        if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
          return;
        }

        const res = await fetch("/update.json");
        if (!res.ok) return;
        const data: UpdateInfo = await res.json();

        if (data && data.version && isNewerVersion(CURRENT_VERSION, data.version)) {
          setUpdateInfo(data);
          setIsOpen(true);
        }
      } catch (err) {
        // Silent catch if offline or update check fails
      }
    };

    checkForUpdates();
  }, []);

  const isNewerVersion = (current: string, latest: string) => {
    const parse = (v: string) => v.split('.').map(n => parseInt(n) || 0);
    const [c1, c2, c3] = parse(current);
    const [l1, l2, l3] = parse(latest);
    if (l1 > c1) return true;
    if (l1 === c1 && l2 > c2) return true;
    if (l1 === c1 && l2 === c2 && l3 > c3) return true;
    return false;
  };

  const handleDismiss = () => {
    // Postpone update popup for 24 hours
    const next24h = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem("mep_update_dismissed_until", next24h.toString());
    setIsOpen(false);
  };

  const handleDownload = () => {
    if (!updateInfo?.url) return;
    toast.info(`Opening download for MEP Calculator v${updateInfo.version}...`);
    if (typeof window !== "undefined") {
      window.open(updateInfo.url, "_blank");
    }
  };

  if (!isOpen || !updateInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden font-sans">
        {/* HEADER BADGE */}
        <div className="bg-gradient-to-r from-primary to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-amber-300 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full">
                Auto-Update Available
              </span>
            </div>
            {!updateInfo.mandatory && (
              <button
                onClick={handleDismiss}
                className="text-white/70 hover:text-white transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
          <h2 className="text-xl font-black mt-3">
            MEP Calculator v{updateInfo.version}
          </h2>
          <p className="text-xs text-white/80 mt-0.5">
            Current version: v{CURRENT_VERSION}
          </p>
        </div>

        {/* CONTENT BODY */}
        <div className="p-6 space-y-4">
          <div>
            <h4 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider mb-2">
              What's New in this Release:
            </h4>
            <div className="p-3.5 bg-muted/40 border border-border/60 rounded-2xl text-xs text-foreground leading-relaxed whitespace-pre-line font-mono max-h-40 overflow-y-auto">
              {updateInfo.notes || "• Performance enhancements & security updates."}
            </div>
          </div>

          {updateInfo.mandatory && (
            <div className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              <AlertCircle className="size-4 shrink-0" />
              <span>This is a mandatory security update to continue sync.</span>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {!updateInfo.mandatory && (
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border/80 rounded-2xl cursor-pointer transition-all"
              >
                Remind Me Later
              </button>
            )}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold text-primary-foreground bg-primary hover:bg-primary/90 rounded-2xl shadow-md cursor-pointer transition-all active:scale-95"
            >
              <Download className="size-4" />
              Update Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
