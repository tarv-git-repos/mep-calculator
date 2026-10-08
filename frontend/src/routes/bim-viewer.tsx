import React, { useState, useEffect, Suspense, lazy } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import { Sparkles, RefreshCw } from "lucide-react";

const BimViewerApp = lazy(() => import("@/features/bim-viewer/App"));

export const Route = createFileRoute("/bim-viewer")({
  head: () => ({
    meta: [
      { title: "3D Studio — MEP Calculator" },
      { name: "description", content: "Interactive 3D and 2D IFC model viewer for MEP engineering." },
    ],
  }),
  component: BimViewerRoute,
  errorComponent: BimViewerErrorComponent,
});

function BimViewerErrorComponent({ error, reset }: { error: any; reset: () => void }) {
  return (
    <AppShell
      title="3D Studio"
      subtitle="Interactive 3D & 2D IFC Model Analysis"
    >
      <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-[#242426] text-white p-6 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl">
          ⚡
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-lg font-bold text-slate-100">3D Studio Ready to Initialize</h2>
          <p className="text-xs text-slate-400 mt-1">
            {error?.message?.includes("WebGL")
              ? "The WebGL graphics context is resetting. Click below to reconnect the 3D viewport."
              : "Click below to refresh and launch the 3D Studio workspace."}
          </p>
        </div>
        <button
          onClick={() => {
            if (reset) reset();
            if (typeof window !== "undefined") window.location.reload();
          }}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-lg text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all border border-blue-400/30"
        >
          <RefreshCw className="size-3.5" />
          Reload 3D Workspace
        </button>
      </div>
    </AppShell>
  );
}

function BimViewerRoute() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <AppShell
      title="3D Studio"
      subtitle="Interactive 3D & 2D IFC Model Analysis"
      actions={
        <button
          onClick={() => {
            if (typeof window !== "undefined" && (window as any)._onGenerateSchedule) {
              (window as any)._onGenerateSchedule();
            }
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md flex items-center gap-1.5 cursor-pointer transition-all border border-blue-400/30"
        >
          <Sparkles className="size-3.5 text-yellow-300 fill-yellow-300" />
          Generate Space Schedule
        </button>
      }
    >
      <div className="flex-1 w-full h-full min-h-0 relative overflow-hidden bg-[#242426]">
        {isClient ? (
          <Suspense
            fallback={
              <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-[#242426] text-white p-6 gap-3">
                <RefreshCw className="size-6 text-sky-400 animate-spin" />
                <div className="text-xs text-slate-400 font-medium">Initializing 3D Studio...</div>
              </div>
            }
          >
            <BimViewerApp />
          </Suspense>
        ) : (
          <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-[#242426] text-white p-6 gap-3">
            <RefreshCw className="size-6 text-sky-400 animate-spin" />
            <div className="text-xs text-slate-400 font-medium">Initializing 3D Studio...</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
