import React, { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function AutoUpdaterPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [update, setUpdate] = useState<any>(null);
  const [status, setStatus] = useState<string>('');
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      // Only run in Tauri environment
      if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) return;

      try {
        const foundUpdate = await check();
        if (foundUpdate) {
          const ignoredVersion = localStorage.getItem('ignored_update_version');
          // If the user hasn't ignored this specific version, show the popup
          if (ignoredVersion !== foundUpdate.version) {
            setUpdate(foundUpdate);
            setIsOpen(true);
          }
        }
      } catch (e) {
        console.error('Auto update check failed on startup:', e);
      }
    };

    checkForUpdates();
  }, []);

  const handleSkip = () => {
    if (update?.version) {
      localStorage.setItem('ignored_update_version', update.version);
    }
    setIsOpen(false);
  };

  const handleInstall = async () => {
    if (!update) return;
    try {
      setIsInstalling(true);
      setStatus("Downloading and installing update... Please do not close the app.");
      
      let downloaded = 0;
      let contentLength = 0;
      
      await update.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength;
            setStatus(`Downloading update: 0%`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength) {
               setStatus(`Downloading update: ${Math.round((downloaded / contentLength) * 100)}%`);
            }
            break;
          case 'Finished':
            setStatus("Update installed successfully. Restarting...");
            break;
        }
      });
      await relaunch();
    } catch (e: any) {
      console.error("Update installation error:", e);
      setStatus(`Error installing update: ${e?.message || String(e)}`);
      // Re-enable buttons so they can close the dialog or try again if they want
      setIsInstalling(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isInstalling && setIsOpen(open)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Update Available</DialogTitle>
          <DialogDescription>
            {update ? `Version ${update.version} is available. Would you like to install it now?` : 'Checking for updates...'}
          </DialogDescription>
        </DialogHeader>
        
        {status && (
          <div className="text-sm font-medium p-3 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-800 dark:text-slate-200">
            {status}
          </div>
        )}

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={handleSkip} 
            disabled={isInstalling}
          >
            Continue with current version
          </Button>
          <Button 
            onClick={handleInstall} 
            disabled={isInstalling}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isInstalling ? 'Installing...' : 'Install Version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
