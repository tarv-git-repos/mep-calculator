import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  FolderKanban, Plus, Trash2, Copy, Play, Calendar, User, FileCode,
  MapPin, CheckCircle2, X, Edit3, Save, AlertTriangle
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { useWorkspace, type Project } from "@/lib/workspace-store";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — MEP Calc" },
      { name: "description", content: "Manage project workspaces and calculations schedules." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const {
    project: activeProject,
    projects,
    activeProjectId,
    selectProject,
    createNewProject,
    duplicateProject,
    deleteProject,
    updateProject
  } = useWorkspace();

  const [search, setSearch] = useState("");
  const [newProject, setNewProject] = useState({
    name: "",
    code: "",
    client: "",
    location: "",
    description: "",
    notes: "",
  });

  const [editingProj, setEditingProj] = useState<Project | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.client.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim()) {
      alert("Project Name is required!");
      return;
    }
    if (!newProject.code.trim()) {
      alert("Project Code is required!");
      return;
    }
    createNewProject({
      name: newProject.name.trim(),
      code: newProject.code.trim().toUpperCase(),
      client: newProject.client.trim() || "N/A",
      location: newProject.location.trim(),
      description: newProject.description.trim(),
      notes: newProject.notes.trim(),
    });
    setNewProject({
      name: "",
      code: "",
      client: "",
      location: "",
      description: "",
      notes: "",
    });
  };

  const handleSaveEdit = () => {
    if (editingProj) {
      if (!editingProj.name.trim()) {
        alert("Project Name is required!");
        return;
      }
      updateProject(editingProj);
      setEditingProj(null);
    }
  };

  const statsMap = useMemo(() => {
    const map: Record<string, { spaces: number; zones: number; equipment: number }> = {};
    projects.forEach((p) => {
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(`mep_project_workspace_${p.id}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            map[p.id] = {
              spaces: Array.isArray(parsed.spaces) ? parsed.spaces.length : 0,
              zones: Array.isArray(parsed.zones) ? parsed.zones.length : 0,
              equipment: Array.isArray(parsed.equipment) ? parsed.equipment.length : 0,
            };
            return;
          }
        } catch (e) {}
      }
      map[p.id] = { spaces: 0, zones: 0, equipment: 0 };
    });
    return map;
  }, [projects]);

  return (
    <AppShell title="Projects" subtitle={`${projects.length} workspaces`}>
      <div className="grid grid-cols-[1fr_360px] h-full overflow-hidden">
        {/* Left Side: Projects List */}
        <div className="border-r border-border flex flex-col min-h-0 bg-surface-2 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-semibold tracking-tight">Active Workspaces</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="h-8 w-60 px-3 bg-background border border-border focus:border-border-strong rounded text-[12px] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {filteredProjects.map((p) => {
              const isActive = p.id === activeProjectId;
              const stats = statsMap[p.id] || { spaces: 0, zones: 0, equipment: 0 };
              return (
                <div
                  key={p.id}
                  className={`border rounded-lg p-4 flex flex-col justify-between transition-all bg-background relative overflow-hidden group ${
                    isActive
                      ? "border-primary shadow-md ring-1 ring-primary/30"
                      : "border-border hover:border-border-strong hover:shadow-sm"
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
                  )}
                  
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground bg-surface px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                        {p.code}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                          <CheckCircle2 className="size-3" /> Active
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-[14px] font-semibold tracking-tight leading-snug group-hover:text-primary transition-colors">
                      {p.name}
                    </h3>
                    <div className="mt-1 flex flex-col gap-1 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="size-3 shrink-0" />
                        <span>Client: {p.client}</span>
                      </div>
                      {p.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="size-3 shrink-0" />
                          <span>{p.location}</span>
                        </div>
                      )}
                    </div>
                    {p.description && (
                      <p className="mt-3 text-[11.5px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                      {stats.spaces} spaces · {stats.zones} zones
                    </span>
                    <div className="flex items-center gap-1">
                      {!isActive && (
                        <button
                          onClick={() => selectProject(p.id)}
                          className="size-7 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary flex items-center justify-center transition-colors"
                          title="Open Project"
                        >
                          <Play className="size-3.5 fill-current" />
                        </button>
                      )}
                      <button
                        onClick={() => duplicateProject(p.id)}
                        className="size-7 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingProj(p)}
                        className="size-7 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                        title="Edit Details"
                      >
                        <Edit3 className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(p.id)}
                        className="size-7 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                        title="Delete Workspace"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Create New Project Workspace */}
        <div className="flex flex-col min-h-0 bg-background p-6">
          <h2 className="text-[15px] font-semibold tracking-tight mb-4 flex items-center gap-2">
            <Plus className="size-4 text-primary" /> Create New Workspace
          </h2>
          <form onSubmit={handleCreate} className="flex-1 flex flex-col justify-between text-xs">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground font-semibold">Project Name *</label>
                <input
                  type="text"
                  required
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="e.g. Dubai Mall Expansion"
                  className="bg-surface-2 border border-border rounded px-3 py-2 outline-none focus:border-border-strong text-[12.5px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-muted-foreground font-semibold">Project Code *</label>
                  <input
                    type="text"
                    required
                    value={newProject.code}
                    onChange={(e) => setNewProject({ ...newProject, code: e.target.value })}
                    placeholder="e.g. DMX-2026"
                    className="bg-surface-2 border border-border rounded px-3 py-2 outline-none focus:border-border-strong text-[12.5px] uppercase font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-muted-foreground font-semibold">Client Name</label>
                  <input
                    type="text"
                    value={newProject.client}
                    onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                    placeholder="e.g. Emaar"
                    className="bg-surface-2 border border-border rounded px-3 py-2 outline-none focus:border-border-strong text-[12.5px]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground font-semibold">Location</label>
                <input
                  type="text"
                  value={newProject.location}
                  onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                  placeholder="e.g. Dubai, UAE"
                  className="bg-surface-2 border border-border rounded px-3 py-2 outline-none focus:border-border-strong text-[12.5px]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground font-semibold">Description</label>
                <input
                  type="text"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Brief scope summary..."
                  className="bg-surface-2 border border-border rounded px-3 py-2 outline-none focus:border-border-strong text-[12.5px]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-muted-foreground font-semibold">Design Code & Notes</label>
                <textarea
                  rows={4}
                  value={newProject.notes}
                  onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                  placeholder="e.g. ASHRAE 62.1 Standard, Title 24..."
                  className="bg-surface-2 border border-border rounded px-3 py-2 outline-none focus:border-border-strong text-[12.5px] resize-none"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-border mt-6">
              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground font-semibold h-9 rounded hover:bg-primary/95 transition-colors text-[12.5px] shadow"
              >
                Create Workspace
              </button>
              <p className="text-[10px] text-muted-foreground text-center mt-2.5 leading-normal">
                Creating a workspace sets it as active and prepares a clean slate, ready for Excel imports.
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Edit Details Overlay */}
      {editingProj && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-sm animate-scale-in">
            <header className="px-4 py-3 border-b border-border flex items-center justify-between bg-header-bg">
              <h3 className="font-semibold text-[14px]">Edit Project Details</h3>
              <button onClick={() => setEditingProj(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </header>
            <div className="p-4 flex flex-col gap-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Project Name</label>
                <input
                  type="text"
                  value={editingProj.name}
                  onChange={(e) => setEditingProj({ ...editingProj, name: e.target.value })}
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none focus:border-border-strong text-[12.5px]"
                />
              </div>
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Project Code</label>
                <input
                  type="text"
                  value={editingProj.code}
                  onChange={(e) => setEditingProj({ ...editingProj, code: e.target.value.toUpperCase() })}
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none focus:border-border-strong text-[12.5px] uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Client Name</label>
                <input
                  type="text"
                  value={editingProj.client}
                  onChange={(e) => setEditingProj({ ...editingProj, client: e.target.value })}
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none focus:border-border-strong text-[12.5px]"
                />
              </div>
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Location</label>
                <input
                  type="text"
                  value={editingProj.location || ""}
                  onChange={(e) => setEditingProj({ ...editingProj, location: e.target.value })}
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none focus:border-border-strong text-[12.5px]"
                />
              </div>
            </div>
            <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
              <button
                onClick={() => setEditingProj(null)}
                className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-primary text-primary-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-primary/95 shadow"
              >
                Save Details
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Delete Confirmation Overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-background/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-sm animate-scale-in">
            <header className="px-4 py-3 border-b border-border flex items-center justify-between bg-header-bg">
              <h3 className="font-semibold text-[14px] text-destructive">Delete Workspace?</h3>
              <button onClick={() => setDeleteConfirmId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </header>
            <div className="p-4 flex gap-3 text-xs">
              <AlertTriangle className="size-8 text-destructive shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1.5 leading-relaxed">
                <p className="font-semibold text-foreground">Are you sure you want to delete this workspace?</p>
                <p className="text-muted-foreground text-[11px]">
                  This will permanently clear all project metadata, spaces list, zones mapping, and equipment scheduling from local storage. This action cannot be undone.
                </p>
              </div>
            </div>
            <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteProject(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="bg-destructive text-destructive-foreground text-xs font-semibold px-4 py-1.5 rounded hover:bg-destructive/95 shadow"
              >
                Confirm Delete
              </button>
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  );
}
