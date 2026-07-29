import React, { useState } from 'react';
import { History, Lock, Unlock, Save, FolderOpen, Plus } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuLabel 
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

export function VersionManager({ projectName }: { projectName: string }) {
  // Helper to gather all project data from local storage
  const gatherProjectData = () => {
    const data: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('mep-') || key.startsWith('feature_'))) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    }
    return JSON.stringify(data, null, 2);
  };

  const handleSaveAsVersion = async () => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (!isTauri) {
      toast.error("Version saving requires the native desktop app.");
      return;
    }

    const versionName = prompt("Enter version name (e.g. V1, V2, Final):");
    if (!versionName) return;

    const basePath = localStorage.getItem('localBackupPath') || localStorage.getItem('serverBackupPath');
    
    if (!basePath) {
      toast.error("Please configure a backup path in the Admin Panel first.");
      return;
    }

    try {
      // Sanitize the path to prevent OS Error 161
      const safeBasePath = basePath.replace(/['"]/g, '');
      const safeProjectName = projectName.replace(/[<>:"/\\|?*]/g, '_');
      const safeVersionName = versionName.replace(/[<>:"/\\|?*]/g, '_');

      // Use raw Rust command to bypass JS sandbox limitations for absolute paths
      const filePath = `${safeBasePath}\\${safeProjectName}\\${safeVersionName}\\project.json`;
      const data = gatherProjectData();
      
      await invoke('save_backup', { 
        path: filePath, 
        content: data 
      });

      toast.success(`Successfully saved Version: ${versionName}`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message || err}`);
    }
  };

  const handleLoadVersion = async () => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (!isTauri) {
      toast.error("Version loading requires the native desktop app.");
      return;
    }

    try {
      const selectedPath = await openDialog({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (!selectedPath || typeof selectedPath !== 'string') return;

      const fileContent = await readTextFile(selectedPath);
      const data = JSON.parse(fileContent);

      // Restore to local storage
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string') {
          localStorage.setItem(key, data[key]);
        } else {
          localStorage.setItem(key, JSON.stringify(data[key]));
        }
      });

      toast.success("Version loaded successfully!");
      
      toast.success("Version loaded successfully!");
      
      // Force reload to apply state
      setTimeout(() => window.location.reload(), 1500);
      
    } catch (err) {
      console.error(err);
      toast.error("Failed to load version.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Version Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 px-4 h-10 bg-surface-2 dark:bg-white/5 border border-border dark:border-[#262626] hover:bg-surface-3 dark:hover:bg-white/10 rounded-full text-[13.5px] cursor-pointer outline-none select-none transition-all duration-150 allow-read-only">
            <History className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-foreground dark:text-white">Versions</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 z-50">
          <DropdownMenuLabel>Revision Manager</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSaveAsVersion} className="gap-2 cursor-pointer">
            <Plus className="w-4 h-4 text-blue-500" />
            <span>Save as New Version...</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLoadVersion} className="gap-2 cursor-pointer">
            <FolderOpen className="w-4 h-4 text-emerald-500" />
            <span>Load Past Version...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
