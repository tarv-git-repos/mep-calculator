const fs = require('fs');
const path = require('path');

// 1. Update backend/authServer.js
const pAuth = path.join(__dirname, 'backend/authServer.js');
let authContent = fs.readFileSync(pAuth, 'utf8');

// Update /api/notifications/delete in backend
const oldBackendDelete = `  if (req.method === 'POST' && url === '/api/notifications/delete') {
    try {
      const { id, ids } = await getRequestBody(req);
      const targetIds = new Set(Array.isArray(ids) ? ids : (id ? [id] : []));
      if (targetIds.size > 0) {
        const targetArray = Array.from(targetIds);

        // 1. Filter local notifications file strictly by notification ID or metadata.id
        const localNotifs = readNotificationsData();
        const filtered = localNotifs.filter(n => {
          if (!n) return false;
          if (targetIds.has(n.id)) return false;
          if (n.metadata?.id && targetIds.has(n.metadata.id)) return false;
          return true;
        });
        writeNotificationsData(filtered);

        // 2. Delete from Supabase notifications table comprehensively by ID
        try {
          await supabase.from('notifications').delete().in('id', targetArray);
          for (const tId of targetArray) {
            if (tId && typeof tId === 'string') {
              await supabase.from('notifications').delete().eq('metadata->>id', tId);
            }
          }
        } catch (e) {}
      }
      return sendJSON(res, 200, { success: true });
    } catch (err) {
      return sendJSON(res, 200, { success: true });
    }
  }`;

const newBackendDelete = `  if (req.method === 'POST' && url === '/api/notifications/delete') {
    try {
      const { id, ids } = await getRequestBody(req);
      const targetIds = new Set(Array.isArray(ids) ? ids.map(String) : (id ? [String(id)] : []));
      if (targetIds.size > 0) {
        const targetArray = Array.from(targetIds);

        // 1. Filter local notifications file strictly by notification ID, commentId, metadata.id, metadata.commentId
        const localNotifs = readNotificationsData();
        const filtered = localNotifs.filter(n => {
          if (!n) return false;
          if (targetIds.has(String(n.id))) return false;
          if (n.commentId && targetIds.has(String(n.commentId))) return false;
          if (n.metadata?.id && targetIds.has(String(n.metadata.id))) return false;
          if (n.metadata?.commentId && targetIds.has(String(n.metadata.commentId))) return false;
          return true;
        });
        writeNotificationsData(filtered);

        // 2. Delete from Supabase notifications table comprehensively by ID & JSON metadata
        try {
          await supabase.from('notifications').delete().in('id', targetArray);
          for (const tId of targetArray) {
            if (tId && typeof tId === 'string') {
              await supabase.from('notifications').delete().eq('metadata->>id', tId);
              await supabase.from('notifications').delete().eq('metadata->>commentId', tId);
            }
          }
        } catch (e) {}
      }
      return sendJSON(res, 200, { success: true });
    } catch (err) {
      return sendJSON(res, 200, { success: true });
    }
  }`;

authContent = authContent.replace(oldBackendDelete.replace(/\r?\n/g, '\r\n'), newBackendDelete.replace(/\r?\n/g, '\r\n'));
authContent = authContent.replace(oldBackendDelete.replace(/\r?\n/g, '\n'), newBackendDelete.replace(/\r?\n/g, '\n'));

fs.writeFileSync(pAuth, authContent, 'utf8');
console.log('backend/authServer.js updated successfully');

// 2. Update frontend/src/components/workspace/AppShell.tsx
const pAppShell = path.join(__dirname, 'frontend/src/components/workspace/AppShell.tsx');
let appShell = fs.readFileSync(pAppShell, 'utf8');

// Replace deletedNotifIds state initialization
const oldDeletedState = `  const [deletedNotifIds, setDeletedNotifIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved1 = localStorage.getItem("mep_deleted_notif_ids");
        const list1 = saved1 ? JSON.parse(saved1) : [];
        const uId = userData?.id || profile?.id;
        const saved2 = uId ? localStorage.getItem(\`mep_deleted_notif_ids_\${uId}\`) : null;
        const list2 = saved2 ? JSON.parse(saved2) : [];
        return Array.from(new Set([...list1, ...list2]));
      } catch (e) {}
    }
    return [];
  });`;

const newDeletedState = `  const [deletedNotifIds, setDeletedNotifIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved1 = localStorage.getItem("mep_deleted_notif_ids");
        const list1 = saved1 ? JSON.parse(saved1) : [];
        const allKeys: string[] = [...list1];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("mep_deleted_notif_ids_")) {
            try {
              const extra = JSON.parse(localStorage.getItem(k) || "[]");
              if (Array.isArray(extra)) allKeys.push(...extra);
            } catch (e) {}
          }
        }
        return Array.from(new Set(allKeys));
      } catch (e) {}
    }
    return [];
  });`;

appShell = appShell.replace(oldDeletedState.replace(/\r?\n/g, '\r\n'), newDeletedState.replace(/\r?\n/g, '\r\n'));
appShell = appShell.replace(oldDeletedState.replace(/\r?\n/g, '\n'), newDeletedState.replace(/\r?\n/g, '\n'));

// Replace getAllStoredPersistentNotifs
const oldGetAll = `  const getAllStoredPersistentNotifs = () => {
    if (typeof window === "undefined") return [];
    try {
      const uId = userId || userData?.id || profile?.id;
      const uEmail = (userData?.email || profile?.email || "").toLowerCase().trim();
      const uName = (userData?.name || profile?.name || "").toLowerCase().trim();

      const notifMap = new Map<string, any>();
      const addList = (raw: string | null) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((n: any) => {
              if (n && (n.id || n.commentId)) {
                const key = n.id || n.commentId;
                if (!notifMap.has(key)) notifMap.set(key, n);
              }
            });
          }
        } catch (e) {}
      };

      addList(localStorage.getItem("mep_persistent_user_notifs"));
      addList(localStorage.getItem("mep_calc_coord_notifs"));
      if (uId) addList(localStorage.getItem(\`mep_persistent_user_notifs_\${uId}\`));
      if (uEmail) addList(localStorage.getItem(\`mep_persistent_user_notifs_\${uEmail}\`));
      if (uName) addList(localStorage.getItem(\`mep_persistent_user_notifs_\${uName}\`));

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("mep_persistent_user_notifs_")) {
          addList(localStorage.getItem(k));
        }
      }

      return Array.from(notifMap.values());
    } catch (e) {
      return [];
    }
  };`;

const newGetAll = `  const getAllStoredPersistentNotifs = () => {
    if (typeof window === "undefined") return [];
    try {
      const uId = userId || userData?.id || profile?.id;
      const uEmail = (userData?.email || profile?.email || "").toLowerCase().trim();
      const uName = (userData?.name || profile?.name || "").toLowerCase().trim();

      // Read all deleted IDs directly from localStorage
      const d1 = localStorage.getItem("mep_deleted_notif_ids");
      const list1 = d1 ? JSON.parse(d1) : [];
      const d2 = uId ? localStorage.getItem(\`mep_deleted_notif_ids_\${uId}\`) : null;
      const list2 = d2 ? JSON.parse(d2) : [];
      const currentDeletedIds = new Set([...list1, ...list2, ...(deletedNotifIds || [])]);
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("mep_deleted_notif_ids_")) {
          try {
            const extra = JSON.parse(localStorage.getItem(k) || "[]");
            if (Array.isArray(extra)) extra.forEach(id => currentDeletedIds.add(String(id)));
          } catch (e) {}
        }
      }

      const notifMap = new Map<string, any>();
      const addList = (raw: string | null) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((n: any) => {
              if (n && (n.id || n.commentId)) {
                const key = String(n.id || n.commentId);
                const metaId = n.metadata?.id || n.metadata?.commentId ? String(n.metadata?.id || n.metadata?.commentId) : "";
                // Exclude deleted items!
                if (currentDeletedIds.has(key) || (metaId && currentDeletedIds.has(metaId)) || n.deleted === true) {
                  return;
                }
                if (!notifMap.has(key)) notifMap.set(key, n);
              }
            });
          }
        } catch (e) {}
      };

      addList(localStorage.getItem("mep_persistent_user_notifs"));
      addList(localStorage.getItem("mep_calc_coord_notifs"));
      if (uId) addList(localStorage.getItem(\`mep_persistent_user_notifs_\${uId}\`));
      if (uEmail) addList(localStorage.getItem(\`mep_persistent_user_notifs_\${uEmail}\`));
      if (uName) addList(localStorage.getItem(\`mep_persistent_user_notifs_\${uName}\`));

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("mep_persistent_user_notifs_")) {
          addList(localStorage.getItem(k));
        }
      }

      return Array.from(notifMap.values());
    } catch (e) {
      return [];
    }
  };`;

appShell = appShell.replace(oldGetAll.replace(/\r?\n/g, '\r\n'), newGetAll.replace(/\r?\n/g, '\r\n'));
appShell = appShell.replace(oldGetAll.replace(/\r?\n/g, '\n'), newGetAll.replace(/\r?\n/g, '\n'));

// Replace deleteNotification, restoreNotification, permanentlyDeleteNotification, clearAllDeletedNotifications
const oldNotificationFunctions = `  const deleteNotification = (idOrNotif: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const notifObj = typeof idOrNotif === 'object' && idOrNotif !== null ? idOrNotif : null;
    const id = notifObj ? (notifObj.id || notifObj.metadata?.id) : idOrNotif;
    if (!id) return;

    // Collect matching notifications strictly by unique ID
    const matchingNotifs = [
      ...(myNotifications || []),
      ...(persistentNotifs || []),
      ...(notifObj ? [notifObj] : [])
    ].filter((n: any) => {
      if (!n) return false;
      return (
        n.id === id ||
        n.metadata?.id === id
      );
    });

    const keysToDeleteSet = new Set<string>();
    if (id) keysToDeleteSet.add(String(id));

    const processNotifItem = (notif: any) => {
      if (!notif) return;
      if (notif.id) keysToDeleteSet.add(String(notif.id));
      if (notif.metadata?.id) keysToDeleteSet.add(String(notif.metadata.id));
    };

    matchingNotifs.forEach(processNotifItem);
    const keysToDelete = Array.from(keysToDeleteSet);

    // 1. Add deleted item to deletedNotifications store for Deleted tab
    setDeletedNotifications(prev => {
      const map = new Map<string, any>();
      prev.forEach(item => {
        const k = item.id || item.text;
        if (k) map.set(k, item);
      });
      matchingNotifs.forEach(item => {
        const k = item.id || item.text || String(Math.random());
        map.set(k, { ...item, deletedAt: new Date().toISOString(), deleted: true });
      });
      const updated = Array.from(map.values());
      if (typeof window !== "undefined") {
        const uId = userId || userData?.id;
        const key = uId ? \`mep_deleted_notifications_\${uId}\` : "mep_deleted_notifications";
        localStorage.setItem(key, JSON.stringify(updated));
        localStorage.setItem("mep_deleted_notifications", JSON.stringify(updated));
      }
      return updated;
    });

    // 2. Update deletedNotifIds state & localStorage permanently
    setDeletedNotifIds(prev => {
      const updated = Array.from(new Set([...prev, ...keysToDelete]));
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_deleted_notif_ids", JSON.stringify(updated));
        if (userId) {
          localStorage.setItem(\`mep_deleted_notif_ids_\${userId}\`, JSON.stringify(updated));
        }
      }
      return updated;
    });

    api.deleteNotification(keysToDelete).catch(() => {});

    setNotifTick(t => t + 1);
    toast.success("Notification moved to Deleted tab.");
  };

  const restoreNotification = (idOrNotif: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const notifObj = typeof idOrNotif === 'object' && idOrNotif !== null ? idOrNotif : null;
    const id = notifObj ? (notifObj.id || notifObj.metadata?.id) : idOrNotif;
    if (!id) return;

    const keysToRemove = new Set([
      String(id),
      notifObj?.id ? String(notifObj.id) : null,
      notifObj?.metadata?.id ? String(notifObj.metadata.id) : null
    ].filter(Boolean) as string[]);

    // 1. Remove from deletedNotifIds
    setDeletedNotifIds(prev => {
      const updated = prev.filter(k => !keysToRemove.has(k));
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_deleted_notif_ids", JSON.stringify(updated));
        if (userId) {
          localStorage.setItem(\`mep_deleted_notif_ids_\${userId}\`, JSON.stringify(updated));
        }
      }
      return updated;
    });

    // 2. Remove from deletedNotifications store
    setDeletedNotifications(prev => {
      const restoredItem = prev.find(n => keysToRemove.has(String(n.id)) || (n.metadata?.id && keysToRemove.has(String(n.metadata.id))));
      const updated = prev.filter(n => !keysToRemove.has(String(n.id)) && (!n.metadata?.id || !keysToRemove.has(String(n.metadata.id))));
      if (typeof window !== "undefined") {
        const uId = userId || userData?.id;
        const key = uId ? \`mep_deleted_notifications_\${uId}\` : "mep_deleted_notifications";
        localStorage.setItem(key, JSON.stringify(updated));
        localStorage.setItem("mep_deleted_notifications", JSON.stringify(updated));
      }

      if (restoredItem) {
        setPersistentNotifs(pPrev => {
          if (pPrev.some(p => p.id === restoredItem.id)) return pPrev;
          const pUpdated = [{ ...restoredItem, deleted: false }, ...pPrev];
          if (typeof window !== "undefined") {
            const uId = userId || userData?.id;
            const key = uId ? \`mep_persistent_user_notifs_\${uId}\` : "mep_persistent_user_notifs";
            localStorage.setItem(key, JSON.stringify(pUpdated));
          }
          return pUpdated;
        });
      }

      return updated;
    });

    setNotifTick(t => t + 1);
    toast.success("Notification restored to Received tab!");
  };

  const permanentlyDeleteNotification = (idOrNotif: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const notifObj = typeof idOrNotif === 'object' && idOrNotif !== null ? idOrNotif : null;
    const id = notifObj ? (notifObj.id || notifObj.text) : idOrNotif;
    if (!id) return;

    setDeletedNotifications(prev => {
      const updated = prev.filter(n => n.id !== id && n.text !== id);
      if (typeof window !== "undefined") {
        const uId = userId || userData?.id;
        const key = uId ? \`mep_deleted_notifications_\${uId}\` : "mep_deleted_notifications";
        localStorage.setItem(key, JSON.stringify(updated));
        localStorage.setItem("mep_deleted_notifications", JSON.stringify(updated));
      }
      return updated;
    });

    setNotifTick(t => t + 1);
    toast.success("Notification permanently deleted.");
  };

  const clearAllReceivedNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const toDelete = myNotifications.filter(n => {
      const isCompleted = Boolean(completedNotifIds.includes(n.id));
      const isDel = Boolean(deletedNotifIds.includes(n.id));
      return !isCompleted && !isDel;
    });
    toDelete.forEach(n => deleteNotification(n));
  };

  const clearAllCompletedNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const toDelete = myNotifications.filter(n => {
      const isCompleted = Boolean(completedNotifIds.includes(n.id));
      const isDel = Boolean(deletedNotifIds.includes(n.id));
      return isCompleted && !isDel;
    });
    toDelete.forEach(n => deleteNotification(n));
  };

  const clearAllDeletedNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDeletedNotifications([]);
    if (typeof window !== "undefined") {
      const uId = userId || userData?.id;
      const key = uId ? \`mep_deleted_notifications_\${uId}\` : "mep_deleted_notifications";
      localStorage.removeItem(key);
      localStorage.removeItem("mep_deleted_notifications");
    }
    setNotifTick(t => t + 1);
    toast.success("Trash emptied permanently.");
  };`;

const newNotificationFunctions = `  const deleteNotification = (idOrNotif: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const notifObj = typeof idOrNotif === 'object' && idOrNotif !== null ? idOrNotif : null;
    const id = notifObj ? (notifObj.id || notifObj.metadata?.id || notifObj.commentId) : idOrNotif;
    if (!id) return;

    const keysToDeleteSet = new Set<string>();
    keysToDeleteSet.add(String(id));
    if (notifObj) {
      if (notifObj.id) keysToDeleteSet.add(String(notifObj.id));
      if (notifObj.commentId) keysToDeleteSet.add(String(notifObj.commentId));
      if (notifObj.metadata?.id) keysToDeleteSet.add(String(notifObj.metadata.id));
      if (notifObj.metadata?.commentId) keysToDeleteSet.add(String(notifObj.metadata.commentId));
      if (notifObj.targetId && notifObj.timestamp) keysToDeleteSet.add(\`notif_\${notifObj.targetId}_\${notifObj.timestamp}\`);
    }
    const keysToDelete = Array.from(keysToDeleteSet);

    // 1. Move to deletedNotifications for Deleted tab
    setDeletedNotifications(prev => {
      const map = new Map<string, any>();
      prev.forEach(item => {
        const k = item.id || item.text;
        if (k) map.set(k, item);
      });
      const itemToSave = notifObj || { id, text: id, deleted: true, deletedAt: new Date().toISOString() };
      map.set(id, { ...itemToSave, deletedAt: new Date().toISOString(), deleted: true });
      const updated = Array.from(map.values());
      if (typeof window !== "undefined") {
        const uId = userId || userData?.id || profile?.id;
        if (uId) localStorage.setItem(\`mep_deleted_notifications_\${uId}\`, JSON.stringify(updated));
        localStorage.setItem("mep_deleted_notifications", JSON.stringify(updated));
      }
      return updated;
    });

    // 2. Add to deletedNotifIds & persist globally
    setDeletedNotifIds(prev => {
      const updated = Array.from(new Set([...prev, ...keysToDelete]));
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_deleted_notif_ids", JSON.stringify(updated));
        const uId = userId || userData?.id || profile?.id;
        if (uId) {
          localStorage.setItem(\`mep_deleted_notif_ids_\${uId}\`, JSON.stringify(updated));
        }
      }
      return updated;
    });

    // 3. PURGE from all persistent localStorage arrays immediately so it NEVER resurrects
    if (typeof window !== "undefined") {
      const purgeFromStorage = (key: string) => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const cleaned = list.filter((n: any) => {
                if (!n) return false;
                const nId = String(n.id || n.commentId || "");
                const nMetaId = String(n.metadata?.id || n.metadata?.commentId || "");
                return !keysToDeleteSet.has(nId) && (!nMetaId || !keysToDeleteSet.has(nMetaId));
              });
              localStorage.setItem(key, JSON.stringify(cleaned));
            }
          }
        } catch (e) {}
      };

      purgeFromStorage("mep_persistent_user_notifs");
      purgeFromStorage("mep_calc_coord_notifs");
      const uId = userId || userData?.id || profile?.id;
      if (uId) purgeFromStorage(\`mep_persistent_user_notifs_\${uId}\`);
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("mep_persistent_user_notifs_")) {
          purgeFromStorage(k);
        }
      }
    }

    // 4. Cascade deletion to underlying project space comments in memory & storage
    try {
      if (typeof window !== "undefined") {
        const storedProjectsRaw = localStorage.getItem("mep_workspace_projects");
        if (storedProjectsRaw) {
          const storedProjects = JSON.parse(storedProjectsRaw);
          if (Array.isArray(storedProjects)) {
            let modified = false;
            storedProjects.forEach((proj: any) => {
              const checkAndClean = (items: any[]) => {
                if (Array.isArray(items)) {
                  items.forEach((item: any) => {
                    if (Array.isArray(item.comments)) {
                      item.comments = item.comments.filter((c: any) => {
                        const cId = String(c.id || "");
                        const isMatch = keysToDeleteSet.has(cId);
                        if (isMatch) modified = true;
                        return !isMatch;
                      });
                    }
                  });
                }
              };
              checkAndClean(proj.spaces);
              checkAndClean(proj.zones);
              checkAndClean(proj.equipment);
            });
            if (modified) {
              localStorage.setItem("mep_workspace_projects", JSON.stringify(storedProjects));
            }
          }
        }
      }
    } catch (e) {}

    // 5. Update state
    setPersistentNotifs(prev => prev.filter(n => !keysToDeleteSet.has(n.id) && (!n.metadata?.id || !keysToDeleteSet.has(n.metadata.id))));

    // 6. Call API to delete in server & Supabase
    api.deleteNotification(keysToDelete).catch(() => {});

    setNotifTick(t => t + 1);
    toast.success("Notification moved to Deleted tab.");
  };

  const restoreNotification = (idOrNotif: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const notifObj = typeof idOrNotif === 'object' && idOrNotif !== null ? idOrNotif : null;
    const id = notifObj ? (notifObj.id || notifObj.metadata?.id || notifObj.commentId) : idOrNotif;
    if (!id) return;

    const keysToRemove = new Set([
      String(id),
      notifObj?.id ? String(notifObj.id) : null,
      notifObj?.commentId ? String(notifObj.commentId) : null,
      notifObj?.metadata?.id ? String(notifObj.metadata.id) : null,
      notifObj?.metadata?.commentId ? String(notifObj.metadata.commentId) : null
    ].filter(Boolean) as string[]);

    // 1. Remove from deletedNotifIds
    setDeletedNotifIds(prev => {
      const updated = prev.filter(k => !keysToRemove.has(k));
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_deleted_notif_ids", JSON.stringify(updated));
        const uId = userId || userData?.id || profile?.id;
        if (uId) {
          localStorage.setItem(\`mep_deleted_notif_ids_\${uId}\`, JSON.stringify(updated));
        }
      }
      return updated;
    });

    // 2. Remove from deletedNotifications store
    setDeletedNotifications(prev => {
      const restoredItem = prev.find(n => keysToRemove.has(String(n.id)) || (n.metadata?.id && keysToRemove.has(String(n.metadata.id))) || (n.commentId && keysToRemove.has(String(n.commentId))));
      const updated = prev.filter(n => !keysToRemove.has(String(n.id)) && (!n.metadata?.id || !keysToRemove.has(String(n.metadata.id))) && (!n.commentId || !keysToRemove.has(String(n.commentId))));
      if (typeof window !== "undefined") {
        const uId = userId || userData?.id || profile?.id;
        const key = uId ? \`mep_deleted_notifications_\${uId}\` : "mep_deleted_notifications";
        localStorage.setItem(key, JSON.stringify(updated));
        localStorage.setItem("mep_deleted_notifications", JSON.stringify(updated));
      }

      if (restoredItem) {
        setPersistentNotifs(pPrev => {
          if (pPrev.some(p => p.id === restoredItem.id)) return pPrev;
          const pUpdated = [{ ...restoredItem, deleted: false }, ...pPrev];
          if (typeof window !== "undefined") {
            const uId = userId || userData?.id || profile?.id;
            const key = uId ? \`mep_persistent_user_notifs_\${uId}\` : "mep_persistent_user_notifs";
            localStorage.setItem(key, JSON.stringify(pUpdated));
          }
          return pUpdated;
        });
      }

      return updated;
    });

    setNotifTick(t => t + 1);
    toast.success("Notification restored to Received tab!");
  };

  const permanentlyDeleteNotification = (idOrNotif: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const notifObj = typeof idOrNotif === 'object' && idOrNotif !== null ? idOrNotif : null;
    const id = notifObj ? (notifObj.id || notifObj.metadata?.id || notifObj.commentId || notifObj.text) : idOrNotif;
    if (!id) return;

    const keysToDeleteSet = new Set<string>();
    keysToDeleteSet.add(String(id));
    if (notifObj) {
      if (notifObj.id) keysToDeleteSet.add(String(notifObj.id));
      if (notifObj.commentId) keysToDeleteSet.add(String(notifObj.commentId));
      if (notifObj.metadata?.id) keysToDeleteSet.add(String(notifObj.metadata.id));
      if (notifObj.metadata?.commentId) keysToDeleteSet.add(String(notifObj.metadata.commentId));
    }
    const keysToDelete = Array.from(keysToDeleteSet);

    // 1. Remove from deletedNotifications
    setDeletedNotifications(prev => {
      const updated = prev.filter(n => {
        const nId = String(n.id || "");
        const nText = String(n.text || "");
        const nMetaId = String(n.metadata?.id || "");
        const nCommentId = String(n.commentId || n.metadata?.commentId || "");
        return !keysToDeleteSet.has(nId) && !keysToDeleteSet.has(nText) && !keysToDeleteSet.has(nMetaId) && !keysToDeleteSet.has(nCommentId);
      });
      if (typeof window !== "undefined") {
        const uId = userId || userData?.id || profile?.id;
        const key = uId ? \`mep_deleted_notifications_\${uId}\` : "mep_deleted_notifications";
        localStorage.setItem(key, JSON.stringify(updated));
        localStorage.setItem("mep_deleted_notifications", JSON.stringify(updated));
      }
      return updated;
    });

    // 2. Keep in deletedNotifIds so it NEVER resurrects from spaces/persistent stores
    setDeletedNotifIds(prev => {
      const updated = Array.from(new Set([...prev, ...keysToDelete]));
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_deleted_notif_ids", JSON.stringify(updated));
        const uId = userId || userData?.id || profile?.id;
        if (uId) localStorage.setItem(\`mep_deleted_notif_ids_\${uId}\`, JSON.stringify(updated));
      }
      return updated;
    });

    // 3. Purge from persistent stores
    if (typeof window !== "undefined") {
      const purgeFromStorage = (key: string) => {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const cleaned = list.filter((n: any) => {
                if (!n) return false;
                const nId = String(n.id || n.commentId || "");
                const nMetaId = String(n.metadata?.id || n.metadata?.commentId || "");
                return !keysToDeleteSet.has(nId) && (!nMetaId || !keysToDeleteSet.has(nMetaId));
              });
              localStorage.setItem(key, JSON.stringify(cleaned));
            }
          }
        } catch (e) {}
      };

      purgeFromStorage("mep_persistent_user_notifs");
      purgeFromStorage("mep_calc_coord_notifs");
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("mep_persistent_user_notifs_")) {
          purgeFromStorage(k);
        }
      }
    }

    // 4. Call server API
    api.deleteNotification(keysToDelete).catch(() => {});

    setNotifTick(t => t + 1);
    toast.success("Notification permanently deleted.");
  };

  const clearAllReceivedNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const toDelete = myNotifications.filter(n => {
      const isCompleted = Boolean(completedNotifIds.includes(n.id));
      const isDel = Boolean(deletedNotifIds.includes(n.id));
      return !isCompleted && !isDel;
    });
    toDelete.forEach(n => deleteNotification(n));
  };

  const clearAllCompletedNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const toDelete = myNotifications.filter(n => {
      const isCompleted = Boolean(completedNotifIds.includes(n.id));
      const isDel = Boolean(deletedNotifIds.includes(n.id));
      return isCompleted && !isDel;
    });
    toDelete.forEach(n => deleteNotification(n));
  };

  const clearAllDeletedNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const allDeletedIds: string[] = [];
    deletedNotifications.forEach(n => {
      if (n.id) allDeletedIds.push(String(n.id));
      if (n.commentId) allDeletedIds.push(String(n.commentId));
      if (n.metadata?.id) allDeletedIds.push(String(n.metadata.id));
      if (n.metadata?.commentId) allDeletedIds.push(String(n.metadata.commentId));
    });

    setDeletedNotifications([]);
    if (typeof window !== "undefined") {
      const uId = userId || userData?.id || profile?.id;
      const key = uId ? \`mep_deleted_notifications_\${uId}\` : "mep_deleted_notifications";
      localStorage.removeItem(key);
      localStorage.removeItem("mep_deleted_notifications");
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("mep_deleted_notifications_")) {
          localStorage.removeItem(k);
        }
      }
    }

    if (allDeletedIds.length > 0) {
      api.deleteNotification(allDeletedIds).catch(() => {});
    }

    setNotifTick(t => t + 1);
    toast.success("Trash emptied permanently.");
  };`;

appShell = appShell.replace(oldNotificationFunctions.replace(/\r?\n/g, '\r\n'), newNotificationFunctions.replace(/\r?\n/g, '\r\n'));
appShell = appShell.replace(oldNotificationFunctions.replace(/\r?\n/g, '\n'), newNotificationFunctions.replace(/\r?\n/g, '\n'));

// Update addNotifs check in AppShell.tsx
const oldAddNotifsDelCheck = `            const isDel = Boolean(
              c.deleted === true ||
              deletedNotifIds.includes(notifId) ||
              (c.id && deletedNotifIds.includes(String(c.id))) ||
              (c.metadata?.id && deletedNotifIds.includes(String(c.metadata.id)))
            );`;

const newAddNotifsDelCheck = `            const isDel = Boolean(
              c.deleted === true ||
              deletedNotifIds.includes(notifId) ||
              (c.id && deletedNotifIds.includes(String(c.id))) ||
              (c.metadata?.id && deletedNotifIds.includes(String(c.metadata.id))) ||
              (c.commentId && deletedNotifIds.includes(String(c.commentId))) ||
              (c.timestamp && deletedNotifIds.includes(\`notif_\${item.id}_\${c.timestamp}\`))
            );
            if (isDel) return;`;

appShell = appShell.replace(oldAddNotifsDelCheck.replace(/\r?\n/g, '\r\n'), newAddNotifsDelCheck.replace(/\r?\n/g, '\r\n'));
appShell = appShell.replace(oldAddNotifsDelCheck.replace(/\r?\n/g, '\n'), newAddNotifsDelCheck.replace(/\r?\n/g, '\n'));

// Update wdata.notifications loop in AppShell
const oldWdataNotifs = `        wdata.notifications.forEach((wn: any) => {
          if (!wn || !wn.id || !wn.text) return;
          const wnId = wn.id;

          // Skip duplicates
          if (notifs.some(n => n.id === wnId)) return;`;

const newWdataNotifs = `        wdata.notifications.forEach((wn: any) => {
          if (!wn || !wn.id || !wn.text) return;
          const wnId = wn.id;

          const isWnDel = Boolean(
            wn.deleted === true ||
            deletedNotifIds.includes(wnId) ||
            (wn.metadata?.id && deletedNotifIds.includes(String(wn.metadata.id))) ||
            (wn.commentId && deletedNotifIds.includes(String(wn.commentId))) ||
            (wn.metadata?.commentId && deletedNotifIds.includes(String(wn.metadata.commentId)))
          );
          if (isWnDel) return;

          // Skip duplicates
          if (notifs.some(n => n.id === wnId)) return;`;

appShell = appShell.replace(oldWdataNotifs.replace(/\r?\n/g, '\r\n'), newWdataNotifs.replace(/\r?\n/g, '\r\n'));
appShell = appShell.replace(oldWdataNotifs.replace(/\r?\n/g, '\n'), newWdataNotifs.replace(/\r?\n/g, '\n'));

// Update persistentNotifs loop inside myNotifications
const oldPersistentLoop = `    (persistentNotifs || []).forEach((pn: any) => {
      if (!pn || !pn.id) return;
      const pnAuthorId = String(pn.authorId || pn.metadata?.authorId || "").toLowerCase().trim();`;

const newPersistentLoop = `    (persistentNotifs || []).forEach((pn: any) => {
      if (!pn || !pn.id) return;
      const pnId = String(pn.id);
      const pnMetaId = pn.metadata?.id ? String(pn.metadata.id) : "";
      const pnCommentId = pn.commentId || pn.metadata?.commentId ? String(pn.commentId || pn.metadata?.commentId) : "";
      const isPnDel = Boolean(
        pn.deleted === true ||
        deletedNotifIds.includes(pnId) ||
        (pnMetaId && deletedNotifIds.includes(pnMetaId)) ||
        (pnCommentId && deletedNotifIds.includes(pnCommentId))
      );
      if (isPnDel) return;

      const pnAuthorId = String(pn.authorId || pn.metadata?.authorId || "").toLowerCase().trim();`;

appShell = appShell.replace(oldPersistentLoop.replace(/\r?\n/g, '\r\n'), newPersistentLoop.replace(/\r?\n/g, '\r\n'));
appShell = appShell.replace(oldPersistentLoop.replace(/\r?\n/g, '\n'), newPersistentLoop.replace(/\r?\n/g, '\n'));

// Update myNotifications persistence effect
const oldSaveEffect = `  // Continuously preserve full notifications list in local storage so on next reload it appears instantly (0ms)
  useEffect(() => {
    if (typeof window !== "undefined" && Array.isArray(myNotifications) && myNotifications.length > 0) {
      const uId = userId || userData?.id || profile?.id;
      if (uId) {
        try {
          const key = \`mep_persistent_user_notifs_\${uId}\`;
          const currentRaw = localStorage.getItem(key);
          const currentList = currentRaw ? JSON.parse(currentRaw) : [];
          
          const map = new Map();
          currentList.forEach((n: any) => { if (n && n.id) map.set(n.id, n); });
          myNotifications.forEach((n: any) => { if (n && n.id) map.set(n.id, n); });
          
          const merged = Array.from(map.values());
          localStorage.setItem(key, JSON.stringify(merged));
        } catch (e) {}
      }
    }
  }, [myNotifications, userId, userData?.id, profile?.id]);`;

const newSaveEffect = `  // Continuously preserve active notifications list in local storage so on next reload it appears instantly (0ms)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const uId = userId || userData?.id || profile?.id;
      if (uId) {
        try {
          const key = \`mep_persistent_user_notifs_\${uId}\`;
          const currentRaw = localStorage.getItem(key);
          const currentList = currentRaw ? JSON.parse(currentRaw) : [];
          
          const delSet = new Set(deletedNotifIds);
          const map = new Map();
          currentList.forEach((n: any) => {
            if (n && n.id && !delSet.has(String(n.id)) && !n.deleted) {
              map.set(n.id, n);
            }
          });
          (myNotifications || []).forEach((n: any) => {
            if (n && n.id && !delSet.has(String(n.id)) && !n.deleted) {
              map.set(n.id, n);
            }
          });
          
          const activeOnly = Array.from(map.values()).filter((n: any) => !delSet.has(String(n.id)) && !n.deleted);
          localStorage.setItem(key, JSON.stringify(activeOnly));
        } catch (e) {}
      }
    }
  }, [myNotifications, userId, userData?.id, profile?.id, deletedNotifIds]);`;

appShell = appShell.replace(oldSaveEffect.replace(/\r?\n/g, '\r\n'), newSaveEffect.replace(/\r?\n/g, '\r\n'));
appShell = appShell.replace(oldSaveEffect.replace(/\r?\n/g, '\n'), newSaveEffect.replace(/\r?\n/g, '\n'));

// Update fetchBackendNotifs
const oldFetchEffect = `          // Filter out any remote notifications that the user has already deleted
          const allowedRemote = remoteNotifs.filter(n => {
            if (!n || !n.id) return false;
            if (currentDeletedIds.includes(n.id)) return false;
            if (n.metadata?.id && currentDeletedIds.includes(n.metadata.id)) return false;
            return true;
          });`;

const newFetchEffect = `          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith("mep_deleted_notif_ids_")) {
              try {
                const extra = JSON.parse(localStorage.getItem(k) || "[]");
                if (Array.isArray(extra)) currentDeletedIds.push(...extra);
              } catch (e) {}
            }
          }
          const delSet = new Set([...currentDeletedIds, ...(deletedNotifIds || [])]);

          // Filter out any remote notifications that the user has already deleted
          const allowedRemote = remoteNotifs.filter(n => {
            if (!n || !n.id) return false;
            if (delSet.has(String(n.id))) return false;
            if (n.commentId && delSet.has(String(n.commentId))) return false;
            if (n.metadata?.id && delSet.has(String(n.metadata.id))) return false;
            if (n.metadata?.commentId && delSet.has(String(n.metadata.commentId))) return false;
            return true;
          });`;

appShell = appShell.replace(oldFetchEffect.replace(/\r?\n/g, '\r\n'), newFetchEffect.replace(/\r?\n/g, '\r\n'));
appShell = appShell.replace(oldFetchEffect.replace(/\r?\n/g, '\n'), newFetchEffect.replace(/\r?\n/g, '\n'));

fs.writeFileSync(pAppShell, appShell, 'utf8');
console.log('frontend/src/components/workspace/AppShell.tsx updated successfully');
