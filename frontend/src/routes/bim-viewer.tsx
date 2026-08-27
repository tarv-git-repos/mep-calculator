import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import BimViewerApp from "@/features/bim-viewer/App";

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
    >
      <div className="flex-1 w-full h-full min-h-0 relative overflow-hidden bg-[#242426]">
        <BimViewerApp />
      </div>
    </AppShell>
  );
}
