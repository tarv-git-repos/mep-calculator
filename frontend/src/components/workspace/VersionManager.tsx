import React, { useState } from 'react';
import { History, Save, FolderOpen, Plus, List, AlertCircle } from 'lucide-react';
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
import { api } from '@/services/api';
import { workspaceStore } from '@/lib/workspace-store';

export function VersionManager({ projectName, calculatorName = 'Unknown' }: { projectName: string, calculatorName?: string }) {
  const { userData } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Restore prompt state
  const [pendingRestoreItem, setPendingRestoreItem] = useState<any>(null);
  const [isRestorePromptOpen, setIsRestorePromptOpen] = useState(false);

  const activeVersionKey = `mep_active_ver_${projectName.replace(/[<>:"/\\|?*]/g, '_')}_${calculatorName.replace(/[<>:"/\\|?*]/g, '_')}`;
  
  const [activeVersionName, setActiveVersionName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(activeVersionKey) || 'Versions';
    }
    return 'Versions';
  });

  const updateActiveVersion = (verName: string) => {
    setActiveVersionName(verName);
    if (typeof window !== 'undefined') {
      localStorage.setItem(activeVersionKey, verName);
    }
  };

  // Gather complete project state (workspace store memory + all calculator localStorage items)
  const gatherProjectData = () => {
    const wsState = workspaceStore.getState();
    const lsState: Record<string, any> = {};
    
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        // Exclude session & auth keys
        if (
          key === 'auth_token' || 
          key === 'mep_calculator_user_data' || 
          key === 'mep_device_client_id' || 
          key === 'privacy_policy_accepted' ||
          key.startsWith('mep_profile_photo') ||
          key.startsWith('mep_local_users')
        ) {
          continue;
        }

        try {
          lsState[key] = JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
          lsState[key] = localStorage.getItem(key);
        }
      }
    }

    return {
      spaces: wsState.spaces || [],
      zones: wsState.zones || [],
      equipment: wsState.equipment || [],
      roundOffPreset: wsState.roundOffPreset ?? 5,
      localStorageCache: lsState
    };
  };

  const saveActiveVersionState = async (verName: string) => {
    try {
      const userName = (userData?.name || "SystemAdmin");
      const projectData = gatherProjectData();

      const payload = {
        _versionMetadata: {
          version: verName,
          description: `Updated calculation state for ${verName}`,
          user: userName,
          timestamp: new Date().toISOString()
        },
        data: projectData
      };

      // 1. Overwrite / sync to server database
      try {
        await api.saveVersionToServer(projectName, calculatorName, payload);
      } catch (e) {
        console.warn("Cloud version update warning:", e);
      }

      // 2. Overwrite / save to local disk if in desktop app
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      const basePath = localStorage.getItem('versionsPath') || localStorage.getItem('localBackupPath');
      if (isTauri && basePath) {
        try {
          const safeBasePath = basePath.replace(/['"]/g, '');
          const safeProjectName = projectName.replace(/[<>:"/\\|?*]/g, '_');
          const safeCalculatorName = calculatorName.replace(/[<>:"/\\|?*]/g, '_');
          const projectDir = `${safeBasePath}\\${safeProjectName}\\${safeCalculatorName}`;
          if (!await exists(projectDir)) {
            await mkdir(projectDir, { recursive: true });
          }
          const filePath = `${projectDir}\\${verName.toLowerCase()}.json`;
          await invoke('save_backup', { 
            path: filePath, 
            content: JSON.stringify(payload, null, 2)
          });
        } catch (e) {
          console.warn("Local active version save warning:", e);
        }
      }
    } catch (err) {
      console.error("Failed to update active version:", err);
    }
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
      toast.error("Version creation is only allowed inside calculation sections.");
      return;
    }

    setDescriptionInput('');
    setIsModalOpen(true);
  };

  const confirmSaveAsVersion = async () => {
    setIsModalOpen(false);

    try {
      const userName = (userData?.name || "SystemAdmin");
      const projectData = gatherProjectData();
      
      // Fetch current server versions count to generate accurate incremental version string (V0, V1, V2...)
      let serverVersions: any[] = [];
      try {
        serverVersions = await api.getVersionsFromServer(projectName, calculatorName);
      } catch (e) {}

      const nextV = Array.isArray(serverVersions) && serverVersions.length > 0
        ? serverVersions.length 
        : (historyList.length || 0);

      const versionStr = `V${nextV}`;
      
      const payload = {
        _versionMetadata: {
          version: versionStr,
          description: descriptionInput.trim() || 'No description',
          user: userName,
          timestamp: new Date().toISOString()
        },
        data: projectData
      };

      updateActiveVersion(versionStr);

      // 1. Sync to server database so ALL project members see the saved version
      try {
        await api.saveVersionToServer(projectName, calculatorName, payload);
      } catch (e) {
        console.warn("Cloud version sync warning:", e);
      }

      // 2. Also save to local disk if running in desktop app and path configured
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      const basePath = localStorage.getItem('versionsPath') || localStorage.getItem('localBackupPath');
      if (isTauri && basePath) {
        try {
          const safeBasePath = basePath.replace(/['"]/g, '');
          const safeProjectName = projectName.replace(/[<>:"/\\|?*]/g, '_');
          const safeCalculatorName = calculatorName.replace(/[<>:"/\\|?*]/g, '_');
          const projectDir = `${safeBasePath}\\${safeProjectName}\\${safeCalculatorName}`;

          const dirExists = await exists(projectDir);
          if (!dirExists) {
            await mkdir(projectDir, { recursive: true });
          }

          const finalFileName = `${versionStr.toLowerCase()}.json`;
          const filePath = `${projectDir}\\${finalFileName}`;
          await invoke('save_backup', { 
            path: filePath, 
            content: JSON.stringify(payload, null, 2)
          });
        } catch (e) {
          console.warn("Local backup warning:", e);
        }
      }

      toast.success(`Successfully saved as version ${versionStr}`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error: ${err.message || err}`);
    }
  };

  const loadVersionData = (data: any, versionName?: string) => {
    if (!data || typeof data !== 'object') {
      toast.error("Invalid version data.");
      return;
    }

    if (versionName) {
      updateActiveVersion(versionName);
    }

    // 1. Restore localStorage keys
    const lsCache = data.localStorageCache || data;
    if (typeof localStorage !== 'undefined' && lsCache && typeof lsCache === 'object') {
      Object.keys(lsCache).forEach(key => {
        if (key === 'spaces' || key === 'zones' || key === 'equipment' || key === 'localStorageCache' || key === '_versionMetadata') {
          return;
        }
        const val = lsCache[key];
        if (val === null || val === undefined) {
          localStorage.removeItem(key);
        } else if (typeof val === 'string') {
          localStorage.setItem(key, val);
        } else {
          localStorage.setItem(key, JSON.stringify(val));
        }
      });
    }

    // 2. Restore workspaceStore state (spaces, zones, equipment)
    if (Array.isArray(data.spaces) || Array.isArray(data.zones) || Array.isArray(data.equipment)) {
      workspaceStore.setState({
        spaces: data.spaces || [],
        zones: data.zones || [],
        equipment: data.equipment || [],
        isReadOnly: false
      });
      workspaceStore.forceSaveToCloud(true);
    }

    toast.success(`Version ${versionName || ''} restored successfully!`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mep_version_restored', { detail: data }));
    }
    setTimeout(() => window.location.reload(), 300);
  };

  const handleInitiateRestore = (item: any) => {
    if (activeVersionName && activeVersionName !== 'Versions') {
      setPendingRestoreItem(item);
      setIsRestorePromptOpen(true);
    } else {
      setIsHistoryOpen(false);
      const dataToLoad = item.parsedData || item.data || item.payload;
      loadVersionData(dataToLoad, item.version);
    }
  };

  const confirmSaveActiveAndRestore = async () => {
    if (!pendingRestoreItem) return;
    setIsRestorePromptOpen(false);
    setIsHistoryOpen(false);

    if (activeVersionName && activeVersionName !== 'Versions') {
      toast.info(`Saving current calculations to ${activeVersionName}...`);
      await saveActiveVersionState(activeVersionName);
    }

    const dataToLoad = pendingRestoreItem.parsedData || pendingRestoreItem.data || pendingRestoreItem.payload;
    loadVersionData(dataToLoad, pendingRestoreItem.version);
  };

  const confirmRestoreWithoutSaving = () => {
    if (!pendingRestoreItem) return;
    setIsRestorePromptOpen(false);
    setIsHistoryOpen(false);

    const dataToLoad = pendingRestoreItem.parsedData || pendingRestoreItem.data || pendingRestoreItem.payload;
    loadVersionData(dataToLoad, pendingRestoreItem.version);
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
      
      const dataToLoad = parsed._versionMetadata ? parsed.data : parsed;
      const vName = parsed._versionMetadata?.version || 'Restored';
      loadVersionData(dataToLoad, vName);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load version.");
    }
  };

  const handleOpenHistory = async () => {
    try {
      const historyMap = new Map<string, any>();

      // 1. Fetch shared team versions from server (visible to all project members)
      try {
        const serverVersions = await api.getVersionsFromServer(projectName, calculatorName);
        if (Array.isArray(serverVersions)) {
          serverVersions.forEach((item: any) => {
            const vKey = item.version || item.id;
            historyMap.set(vKey, {
              version: item.version,
              description: item.description,
              user: item.user,
              timestamp: item.timestamp,
              parsedData: item.data || item.parsedData || item.payload
            });
          });
        }
      } catch (e) {
        console.warn('Server version list warning:', e);
      }

      // 2. Fetch local versions from disk if running in desktop app
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      const basePath = localStorage.getItem('versionsPath') || localStorage.getItem('localBackupPath');
      if (isTauri && basePath) {
        try {
          const safeBasePath = basePath.replace(/['"]/g, '');
          const safeProjectName = projectName.replace(/[<>:"/\\|?*]/g, '_');
          const safeCalculatorName = calculatorName.replace(/[<>:"/\\|?*]/g, '_');
          const projectDir = `${safeBasePath}\\${safeProjectName}\\${safeCalculatorName}`;

          const dirExists = await exists(projectDir);
          if (dirExists) {
            const entries = await readDir(projectDir);
            const versionRegex = /^v(\d+)\.json$/i;
            for (const entry of entries) {
              if (entry.isFile && versionRegex.test(entry.name)) {
                try {
                  const filePath = `${projectDir}\\${entry.name}`;
                  const fileContent = await readTextFile(filePath);
                  const parsed = JSON.parse(fileContent);
                  if (parsed._versionMetadata) {
                    const vKey = parsed._versionMetadata.version || entry.name;
                    if (!historyMap.has(vKey)) {
                      historyMap.set(vKey, {
                        ...parsed._versionMetadata,
                        filePath,
                        fileName: entry.name,
                        parsedData: parsed.data
                      });
                    }
                  }
                } catch (e) {}
              }
            }
          }
        } catch (e) {}
      }

      const combinedList = Array.from(historyMap.values());
      combinedList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setHistoryList(combinedList);
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
            <span className="font-semibold text-foreground dark:text-white">{activeVersionName}</span>
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
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-surface-2 text-muted-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmSaveAsVersion}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
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
              <button onClick={() => setIsHistoryOpen(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none cursor-pointer">&times;</button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-surface-1">
              {historyList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No versions saved yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyList.map((item, idx) => {
                    const isActive = activeVersionName === item.version;
                    return (
                      <div key={idx} className={`bg-background border rounded-xl p-4 flex gap-4 items-center transition-colors ${isActive ? 'border-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/10' : 'border-border hover:border-primary/30'}`}>
                        <div className={`w-14 h-14 shrink-0 rounded-xl flex items-center justify-center font-bold text-lg ${isActive ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary'}`}>
                          {item.version}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-foreground truncate">{item.description}</h4>
                              {isActive && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">Active</span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">Created by <span className="font-medium text-foreground">{item.user}</span></p>
                        </div>
                        <button
                          onClick={() => {
                            if (!isActive) {
                              handleInitiateRestore(item);
                            }
                          }}
                          disabled={isActive}
                          className={`px-4 py-2 shrink-0 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 cursor-default font-bold' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer'}`}
                        >
                          {isActive ? 'Active Version' : 'Restore'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {isRestorePromptOpen && pendingRestoreItem && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-3 text-amber-500">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-foreground">Save Current Version Work?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              You are currently working on <strong className="text-foreground">{activeVersionName}</strong>. 
              Do you want to update and save your current calculation changes to <strong className="text-foreground">{activeVersionName}</strong> before restoring <strong className="text-emerald-500">{pendingRestoreItem.version}</strong>?
            </p>
            
            <div className="flex flex-col gap-2.5">
              <button
                onClick={confirmSaveActiveAndRestore}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Yes, Save {activeVersionName} & Restore {pendingRestoreItem.version}</span>
              </button>
              <button
                onClick={confirmRestoreWithoutSaving}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-all cursor-pointer"
              >
                No, Restore {pendingRestoreItem.version} Without Saving
              </button>
              <button
                onClick={() => setIsRestorePromptOpen(false)}
                className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mt-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
