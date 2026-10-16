import { useEffect } from 'react';

// Helper to gather all project and calculation data from local storage
export const gatherProjectData = () => {
  const data: Record<string, any> = {};
  if (typeof window === 'undefined') return JSON.stringify(data);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith('mep-') ||
        key.startsWith('mep_') ||
        key.startsWith('pcl_') ||
        key.startsWith('project') ||
        key.startsWith('feature_') ||
        key.startsWith('calculator') ||
        key === 'mep_unit_system' ||
        key === 'mep_theme')
    ) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key) || 'null');
      } catch {
        data[key] = localStorage.getItem(key);
      }
    }
  }
  return JSON.stringify(data, null, 2);
};

export const performBackup = async (
  targetCustomPath?: string
): Promise<{ success: boolean; path?: string; message?: string }> => {
  if (typeof window === 'undefined') return { success: false, message: 'Window not defined' };

  const isEnabled = localStorage.getItem('mep_auto_save_enabled') !== 'false';
  if (!isEnabled && !targetCustomPath) {
    return { success: false, message: 'Auto Save is currently disabled' };
  }

  const rawPath = targetCustomPath || localStorage.getItem('localBackupPath') || 'C:\\MEP_Calculator_Autosaves';
  const cleanPath = rawPath.trim().replace(/[/\\]+$/, '');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `MEP_Project_Backup_${timestamp}.json`;
  const data = gatherProjectData();

  // 1. Try Tauri v2 Native Desktop File System if available
  const isTauri = !!(
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    (window as any).__TAURI_IPC__ ||
    window.location.protocol === 'tauri:' ||
    window.location.protocol === 'asset:'
  );

  if (isTauri) {
    try {
      const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
      const pathExists = await exists(cleanPath).catch(() => false);
      if (!pathExists) {
        await mkdir(cleanPath, { recursive: true }).catch((e) => console.warn('mkdir warning:', e));
      }
      const fullPath = `${cleanPath}\\${filename}`;
      await writeTextFile(fullPath, data);
      const timeStr = new Date().toLocaleTimeString();
      localStorage.setItem('mep_last_backup_time', new Date().toISOString());
      console.log(`[AutoBackup] Successfully saved Tauri desktop backup to ${fullPath}`);
      window.dispatchEvent(new CustomEvent('mep_backup_completed', { detail: { path: fullPath, time: timeStr } }));
      return { success: true, path: fullPath, message: `Backup saved at ${timeStr}` };
    } catch (tauriErr) {
      console.warn('[AutoBackup] Tauri plugin-fs backup failed, falling back to local service:', tauriErr);
    }
  }

  // 2. Try Localhost Backend API (works in both Web browsers and Desktop)
  try {
    const res = await fetch('http://localhost:4000/api/write-local-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath: cleanPath, data, filename }),
    });
    if (res.ok) {
      const result = await res.json();
      if (result.success) {
        const timeStr = new Date().toLocaleTimeString();
        localStorage.setItem('mep_last_backup_time', new Date().toISOString());
        console.log(`[AutoBackup] Successfully saved local backup to ${result.fullPath}`);
        window.dispatchEvent(new CustomEvent('mep_backup_completed', { detail: { path: result.fullPath, time: timeStr } }));
        return { success: true, path: result.fullPath, message: `Backup saved at ${timeStr}` };
      }
      return { success: false, message: result.message || 'Server returned error' };
    }
  } catch (backendErr) {
    console.warn('[AutoBackup] Backend write-local-backup call failed:', backendErr);
  }

  return {
    success: false,
    message: 'Could not write backup to disk. Ensure the local application service is running.',
  };
};

export const performServerBackup = async (
  targetCustomPath?: string
): Promise<{ success: boolean; path?: string; message?: string }> => {
  if (typeof window === 'undefined') return { success: false, message: 'Window not defined' };

  const rawPath = targetCustomPath || localStorage.getItem('serverBackupPath') || localStorage.getItem('versionsPath');
  if (!rawPath || !rawPath.trim()) {
    return { success: false, message: 'Server backup path is not configured' };
  }

  const cleanPath = rawPath.trim().replace(/[/\\]+$/, '');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `MEP_Server_Hourly_Backup_${timestamp}.json`;
  const data = gatherProjectData();

  try {
    const res = await fetch('http://localhost:4000/api/write-local-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath: cleanPath, data, filename }),
    });
    if (res.ok) {
      const result = await res.json();
      if (result.success) {
        const timeStr = new Date().toLocaleTimeString();
        localStorage.setItem('mep_last_server_backup_time', new Date().toISOString());
        console.log(`[AutoBackup] Successfully saved 1-hour server backup to ${result.fullPath}`);
        window.dispatchEvent(new CustomEvent('mep_server_backup_completed', { detail: { path: result.fullPath, time: timeStr } }));
        return { success: true, path: result.fullPath, message: `Server backup saved at ${timeStr}` };
      }
      return { success: false, message: result.message || 'Server returned error' };
    }
  } catch (backendErr) {
    console.warn('[AutoBackup] Server backup write failed:', backendErr);
  }

  return {
    success: false,
    message: 'Could not write server backup to disk. Ensure the path is reachable.',
  };
};

export function useAutoBackup() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let localInterval: any = null;
    let serverInterval: any = null;

    const setupInterval = () => {
      if (localInterval) clearInterval(localInterval);
      const isEnabled = localStorage.getItem('mep_auto_save_enabled') !== 'false';
      if (!isEnabled) return;

      const saved = localStorage.getItem('mep_auto_save_interval');
      const mins = saved ? parseInt(saved, 10) : 10;
      const ms = (isNaN(mins) || mins < 1 ? 10 : mins) * 60 * 1000;

      localInterval = setInterval(() => {
        performBackup();
      }, ms);
    };

    const setupServerInterval = () => {
      if (serverInterval) clearInterval(serverInterval);
      const serverPath = localStorage.getItem('serverBackupPath') || localStorage.getItem('versionsPath');
      if (!serverPath || !serverPath.trim()) return;

      // Hourly server backup: 60 minutes = 3,600,000 ms
      const ONE_HOUR_MS = 60 * 60 * 1000;
      serverInterval = setInterval(() => {
        performServerBackup();
      }, ONE_HOUR_MS);
    };

    // Run first local backup shortly after startup (after 15 seconds) if enabled
    const initialTimer = setTimeout(() => {
      const isEnabled = localStorage.getItem('mep_auto_save_enabled') !== 'false';
      if (isEnabled) performBackup();
    }, 15000);

    // Run first server backup shortly after startup (after 45 seconds) if configured
    const initialServerTimer = setTimeout(() => {
      const serverPath = localStorage.getItem('serverBackupPath');
      if (serverPath && serverPath.trim()) performServerBackup();
    }, 45000);

    setupInterval();
    setupServerInterval();

    const handleSettingsChanged = () => {
      setupInterval();
      setupServerInterval();
    };

    window.addEventListener('mep_auto_save_settings_changed', handleSettingsChanged);
    window.addEventListener('mep_auto_save_interval_changed', handleSettingsChanged);
    window.addEventListener('storage', handleSettingsChanged);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(initialServerTimer);
      if (localInterval) clearInterval(localInterval);
      if (serverInterval) clearInterval(serverInterval);
      window.removeEventListener('mep_auto_save_settings_changed', handleSettingsChanged);
      window.removeEventListener('mep_auto_save_interval_changed', handleSettingsChanged);
      window.removeEventListener('storage', handleSettingsChanged);
    };
  }, []);
}
