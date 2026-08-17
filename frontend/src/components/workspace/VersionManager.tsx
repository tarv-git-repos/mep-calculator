import React, { useState } from 'react';
import { History, Save, FolderOpen, Plus, List } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuLabel 
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { readTextFile, exists, mkdir, readDir } from '@tauri-apps/plugin-fs';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '@/contexts/AuthContext';

export function VersionManager({ projectName, calculatorName = 'Unknown' }: { projectName: string, calculatorName?: string }) {
  const { userData } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);

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
    return data;
  };

  const handleSaveAsVersion = async () => {
    const currentPath = (typeof window !== 'undefined' ? window.location.pathname : '').toLowerCase().replace(/\/$/, "") || "/";
    const NON_VERSION_PATHS = [
      "/",
      "/dashboard",
      "/projects",
      "/reports",
      "/report",
      "/teams",
      "/team",
      "/admin",
      "/settings",
      "/privacy",
      "/login",
      "/calculators",
      "/reset-password"
    ];
    if (NON_VERSION_PATHS.some(p => currentPath === p || currentPath.startsWith(p + '/'))) {
      toast.error("Version creation is only allowed inside HVAC, Electrical, Plumbing, and Fire Fighting calculation sections.");
      return;
    }

    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (!isTauri) {
      toast.error("Version saving requires the native desktop app.");
      return;
    }

    const basePath = localStorage.getItem('versionsPath') || localStorage.getItem('localBackupPath');
    if (!basePath) {
      toast.error("Please configure a Versions Path in the Admin Panel first.");
      return;
    }

    setDescriptionInput('');
    setIsModalOpen(true);
  };

  const confirmSaveAsVersion = async () => {
    setIsModalOpen(false);

    const basePath = localStorage.getItem('versionsPath') || localStorage.getItem('localBackupPath');
    if (!basePath) {
      toast.error("Please configure a Versions Path in the Admin Panel first.");
      return;
    }

    try {
      // Sanitize inputs
      const safeBasePath = basePath.replace(/['"]/g, '');
      const safeProjectName = projectName.replace(/[<>:"/\\|?*]/g, '_');
      const safeCalculatorName = calculatorName.replace(/[<>:"/\\|?*]/g, '_');
      
      const userName = (userData?.name || "SystemAdmin");
      const projectDir = `${safeBasePath}\\${safeProjectName}\\${safeCalculatorName}`;

      // 1. Ensure directory exists
      const dirExists = await exists(projectDir);
      if (!dirExists) {
        await mkdir(projectDir, { recursive: true });
      }

      // 2. Determine next version number based on existing files in that dir
      let nextV = 0;
      const entries = await readDir(projectDir);
      
      const versionRegex = /^v(\d+)\.json$/i;
      
      for (const entry of entries) {
        if (entry.isFile) {
          const match = entry.name.match(versionRegex);
          if (match && match[1]) {
            const vNum = parseInt(match[1], 10);
            if (vNum >= nextV) {
              nextV = vNum + 1;
            }
          }
        }
      }

      // 3. Finalize path and save
      const finalFileName = `v${nextV}.json`;
      const filePath = `${projectDir}\\${finalFileName}`;
      
      const payload = {
        _versionMetadata: {
          version: `V${nextV}`,
          description: descriptionInput.trim() || 'No description',
          user: userName,
          timestamp: new Date().toISOString()
        },
        data: gatherProjectData()
      };
      
      await invoke('save_backup', { 
        path: filePath, 
        content: JSON.stringify(payload, null, 2)
      });

      toast.success(`Successfully saved as ${finalFileName}`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message || err}`);
    }
  };

  const loadVersionData = (data: any) => {
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'string') {
        localStorage.setItem(key, data[key]);
      } else {
        localStorage.setItem(key, JSON.stringify(data[key]));
      }
    });

    toast.success("Version loaded successfully!");
    setTimeout(() => window.location.reload(), 1500);
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
      let parsed = JSON.parse(fileContent);
      
      // Support for new format with _versionMetadata or old flat format
      const dataToLoad = parsed._versionMetadata ? parsed.data : parsed;
      loadVersionData(dataToLoad);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load version.");
    }
  };

  const handleOpenHistory = async () => {
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    if (!isTauri) {
      toast.error("Version history requires the native desktop app.");
      return;
    }

    const basePath = localStorage.getItem('versionsPath') || localStorage.getItem('localBackupPath');
    if (!basePath) {
      toast.error("Please configure a Versions Path in the Admin Panel first.");
      return;
    }

    try {
      const safeBasePath = basePath.replace(/['"]/g, '');
      const safeProjectName = projectName.replace(/[<>:"/\\|?*]/g, '_');
      const safeCalculatorName = calculatorName.replace(/[<>:"/\\|?*]/g, '_');
      const projectDir = `${safeBasePath}\\${safeProjectName}\\${safeCalculatorName}`;

      const dirExists = await exists(projectDir);
      if (!dirExists) {
        setHistoryList([]);
        setIsHistoryOpen(true);
        return;
      }

      const entries = await readDir(projectDir);
      const versionRegex = /^v(\d+)\.json$/i;
      const historyItems = [];

      for (const entry of entries) {
        if (entry.isFile && versionRegex.test(entry.name)) {
          try {
            const filePath = `${projectDir}\\${entry.name}`;
            const fileContent = await readTextFile(filePath);
            const parsed = JSON.parse(fileContent);
            if (parsed._versionMetadata) {
              historyItems.push({
                ...parsed._versionMetadata,
                filePath,
                fileName: entry.name,
                parsedData: parsed.data
              });
            }
          } catch (e) {
            console.error(`Failed to parse version file ${entry.name}`, e);
          }
        }
      }

      // Sort by timestamp descending
      historyItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setHistoryList(historyItems);
      setIsHistoryOpen(true);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error loading history: ${err.message || err}`);
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
            <span>Load Past Version (File)...</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleOpenHistory} className="gap-2 cursor-pointer">
            <List className="w-4 h-4 text-purple-500" />
            <span>History</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm p-5 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Save as New Version</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Description (Optional)</label>
                <textarea
                  autoFocus
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  className="w-full h-24 p-3 bg-surface-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  placeholder="What changed in this version?"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-surface-2 text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmSaveAsVersion}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-foreground">Version History</h3>
                <p className="text-xs text-muted-foreground">{projectName} - {calculatorName}</p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-surface-1">
              {historyList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No versions saved yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyList.map((item, idx) => (
                    <div key={idx} className="bg-background border border-border rounded-xl p-4 flex gap-4 items-center hover:border-primary/30 transition-colors">
                      <div className="w-14 h-14 shrink-0 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold text-lg">
                        {item.version}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-semibold text-foreground truncate">{item.description}</h4>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">Created by <span className="font-medium text-foreground">{item.user}</span></p>
                      </div>
                      <button
                        onClick={() => {
                          setIsHistoryOpen(false);
                          loadVersionData(item.parsedData);
                        }}
                        className="px-4 py-2 shrink-0 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg text-sm font-medium transition-colors"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
