import React, { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import { toast } from 'sonner';

export function AutoUpdaterPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [update, setUpdate] = useState<any>(null);
  const [status, setStatus] = useState<string>('');
  const [isInstalling, setIsInstalling] = useState(false);

  const checkForUpdates = async (isManual = false) => {
    if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) {
      if (isManual) {
        toast.info("Web version updates automatically on page refresh.");
      }
      return;
    }

    try {
      if (isManual) {
        setStatus("Checking for updates...");
      }
      const foundUpdate = await check();
      if (foundUpdate) {
        const ignoredVersion = localStorage.getItem('ignored_update_version');
        if (isManual || ignoredVersion !== foundUpdate.version) {
          setUpdate(foundUpdate);
          setIsOpen(true);
        }
      } else if (isManual) {
        toast.success("You are using the latest version!");
      }
    } catch (e: any) {
      console.error('Auto update check failed:', e);
      if (isManual) {
        toast.info("Web version updates automatically on page refresh.");
      }
    }
  };

  useEffect(() => {
    checkForUpdates(false);

    const handleManualCheck = () => {
      localStorage.removeItem('ignored_update_version');
      checkForUpdates(true);
    };

    window.addEventListener('mep_check_updates_manual', handleManualCheck);
    return () => window.removeEventListener('mep_check_updates_manual', handleManualCheck);
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (isInstalling) return;
    if (!open && update?.version) {
      localStorage.setItem('ignored_update_version', update.version);
    }
    setIsOpen(open);
  };

  const handleSkip = () => {
    handleOpenChange(false);
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
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
