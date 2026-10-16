import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import { useEffect, useRef } from "react";
import { attachPersistentBimViewer, detachAndParkPersistentBimViewer } from "@/features/bim-viewer/bimViewerPersistentHost";
import { useWorkspace, workspaceStore } from "@/lib/workspace-store";

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
  const mountRef = useRef<HTMLDivElement>(null);
  const { activeProjectId } = useWorkspace();

  useEffect(() => {
    if (mountRef.current) {
      attachPersistentBimViewer(mountRef.current, activeProjectId);
    }

    return () => {
      detachAndParkPersistentBimViewer();
    };
  }, [activeProjectId]);

  return (
    <AppShell title="3D Studio" subtitle="Interactive IFC BIM Model & Spatial Studio">
      <div ref={mountRef} className="h-full w-full overflow-hidden bg-[#242426]" />
    </AppShell>
  );
}
