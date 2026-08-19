import React, { useState, useEffect, useCallback } from "react";
import { WifiOff, RefreshCw, AlertTriangle, ShieldAlert, SignalHigh } from "lucide-react";

interface NetworkConnectionGuardProps {
  children?: React.ReactNode;
}

export const NetworkConnectionGuard: React.FC<NetworkConnectionGuardProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return navigator.onLine;
    }
    return true;
  });

  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);

  const getBackendUrl = () => {
    if (typeof window !== "undefined" && (window as any).import?.meta?.env?.VITE_API_URL) {
      return (window as any).import.meta.env.VITE_API_URL;
    }
    return "http://localhost:4000";
  };

  const checkConnectivity = useCallback(async () => {
    setIsChecking(true);
    try {
      // 1. Basic browser check
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOnline(false);
        setIsChecking(false);
        return false;
      }

      // 2. Active health ping to backend/network endpoint with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${getBackendUrl()}/health?t=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok || res.status === 200 || res.status === 204 || res.status === 304) {
        setIsOnline(true);
        setFailedAttempts(0);
        setIsChecking(false);
        return true;
      } else {
        setIsOnline(false);
        setFailedAttempts((prev) => prev + 1);
        setIsChecking(false);
        return false;
      }
    } catch (err) {
      // Fallback check: if backend fetch failed, try a lightweight public image ping to verify general internet access
      try {
        const pingController = new AbortController();
        const pingTimeout = setTimeout(() => pingController.abort(), 3000);
        await fetch(`https://www.google.com/favicon.ico?t=${Date.now()}`, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
          signal: pingController.signal,
        });
        clearTimeout(pingTimeout);
        setIsOnline(true);
        setFailedAttempts(0);
        setIsChecking(false);
        return true;
      } catch (e) {
        setIsOnline(false);
        setFailedAttempts((prev) => prev + 1);
        setIsChecking(false);
        return false;
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      checkConnectivity();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    checkConnectivity();

    // Continuous polling: Check every 3s when offline/disconnected, every 15s when online
    const intervalTime = isOnline ? 15000 : 3000;
    const timer = setInterval(() => {
      checkConnectivity();
    }, intervalTime);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(timer);
    };
  }, [isOnline, checkConnectivity]);

  return (
    <>
      {children}

      {!isOnline && (
        <div
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 text-center select-none animate-in fade-in duration-300"
          style={{ pointerEvents: "all" }}
        >
          <div className="relative mb-6 flex items-center justify-center">
            {/* Pulsing Aura Rings */}
            <div className="absolute h-28 w-28 rounded-full bg-red-500/20 animate-ping" />
            <div className="absolute h-20 w-20 rounded-full bg-amber-500/20 animate-pulse" />

            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/80 shadow-2xl shadow-red-500/10">
              <WifiOff className="h-10 w-10 text-red-500 animate-bounce" />
            </div>
          </div>

          <div className="max-w-md space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-400">
              <ShieldAlert className="h-3.5 w-3.5" />
              Network Connection Required
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              No Internet Connection
            </h2>

            <p className="text-sm leading-relaxed text-slate-300">
              The Universal MEP Engineering Suite requires an active internet connection to compute calculations, verify floating licenses, and access engineering standards.
            </p>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-left space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Network Status:</span>
                <span className="flex items-center gap-1.5 font-bold text-red-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                  </span>
                  Disconnected
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Auto-Reconnection:</span>
                <span className="text-slate-300">Polling every 3 seconds...</span>
              </div>
              {failedAttempts > 0 && (
                <div className="flex items-center justify-between text-xs font-medium text-slate-400">
                  <span>Connection Attempts:</span>
                  <span className="text-slate-400">{failedAttempts}</span>
                </div>
              )}
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => checkConnectivity()}
                disabled={isChecking}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
                {isChecking ? "Checking Network..." : "Retry Connection Now"}
              </button>
            </div>

            <p className="pt-2 text-xs text-slate-500">
              Please check your Wi-Fi, Ethernet cable, or router connection. Access will automatically resume as soon as a network is detected.
            </p>
          </div>
        </div>
      )}
    </>
  );
};
