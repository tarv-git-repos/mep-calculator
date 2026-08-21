import { useEffect } from 'react'
import { writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs'

// Helper to gather all project data from local storage
const gatherProjectData = () => {
  const data: Record<string, any> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && (key.startsWith('mep-') || key.startsWith('feature_'))) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key) || 'null')
      } catch {
        data[key] = localStorage.getItem(key)
      }
    }
  }
  return JSON.stringify(data, null, 2)
}

export function useAutoBackup() {
  useEffect(() => {
    // Check if running inside Tauri Desktop
    const isTauri = typeof window !== 'undefined' && '__TAURI_IPC__' in window
    if (!isTauri) return

    const backupToPath = async (path: string, type: 'Local' | 'Server') => {
      if (!path) return
      
      try {
        const pathExists = await exists(path).catch(() => false)
        if (!pathExists) {
          await mkdir(path, { recursive: true }).catch((e) => console.warn('mkdir warning:', e))
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `MEP_Project_Backup_${timestamp}.json`
        const fullPath = `${path}\\${filename}`
        
        const data = gatherProjectData()
        await writeTextFile(fullPath, data)
        console.log(`Successfully saved ${type} backup to ${fullPath}`)
      } catch (err) {
        console.error(`Failed to save ${type} backup:`, err)
      }
    }

    const isEnabled = localStorage.getItem('mep_auto_save_enabled') !== 'false'
    if (!isEnabled) return

    const getIntervalMs = () => {
      const saved = localStorage.getItem('mep_auto_save_interval')
      const mins = saved ? parseInt(saved, 10) : 10
      return (isNaN(mins) || mins < 1 ? 10 : mins) * 60 * 1000
    }

    const localInterval = setInterval(() => {
      const localPath = localStorage.getItem('localBackupPath') || 'C:\\MEP_Calculator_Autosaves'
      if (localPath) backupToPath(localPath, 'Local')
    }, getIntervalMs())

    const serverInterval = setInterval(() => {
      const serverPath = localStorage.getItem('serverBackupPath')
      if (serverPath) backupToPath(serverPath, 'Server')
    }, 3600000)

    return () => {
      clearInterval(localInterval)
      clearInterval(serverInterval)
    }
  }, [])
}
