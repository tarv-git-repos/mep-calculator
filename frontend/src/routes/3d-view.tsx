import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import BimViewerApp from "@/features/bim-viewer/App";

export const Route = createFileRoute("/3d-view")({
  head: () => ({
    meta: [
      { title: "3D Studio — MEP Calculator" },
      { name: "description", content: "Interactive 3D and 2D BIM studio for IFC spatial models and MEP equipment." },
    ],
  }),
  component: Platform3DPage,
});

function Platform3DPage() {
  return (
    <AppShell title="3D Studio" subtitle="Interactive IFC BIM Model & Spatial Studio">
      <div className="h-full w-full overflow-hidden bg-[#242426]">
        <BimViewerApp />
      </div>
    </AppShell>
  );
}
