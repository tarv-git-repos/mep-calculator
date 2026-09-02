import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import BimViewerApp from "@/features/bim-viewer/App";

export const Route = createFileRoute("/3d-view")({
  head: () => ({
    meta: [
      { title: "Platform 3D — MEP Calculator" },
      { name: "description", content: "Interactive 3D and 2D BIM viewer for IFC spatial models and MEP equipment." },
    ],
  }),
  component: Platform3DPage,
});

function Platform3DPage() {
  return (
    <AppShell title="Platform 3D Viewer" subtitle="Interactive IFC BIM Model & Spatial Viewer">
      <div className="h-full w-full overflow-hidden bg-[#242426]">
        <BimViewerApp />
      </div>
    </AppShell>
  );
}
