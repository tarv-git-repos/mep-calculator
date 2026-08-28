import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import BimViewerApp from "@/features/bim-viewer/App";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/bim-viewer")({
  head: () => ({
    meta: [
      { title: "BIM 3D Viewer — MEP Calculator" },
      { name: "description", content: "Interactive 3D and 2D IFC model viewer for MEP engineering." },
    ],
  }),
  component: BimViewerRoute,
});

function BimViewerRoute() {
  return (
    <AppShell
      title="BIM 3D Viewer"
      subtitle="Interactive 3D & 2D IFC Model Analysis"
      actions={
        <button
          onClick={() => {
            if ((window as any)._onGenerateSchedule) {
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
        <BimViewerApp />
      </div>
    </AppShell>
  );
}
