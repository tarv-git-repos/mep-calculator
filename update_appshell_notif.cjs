const fs = require('fs');
const path = require('path');

const pAppShell = path.join(__dirname, 'frontend/src/components/workspace/AppShell.tsx');
let c = fs.readFileSync(pAppShell, 'utf8');

// 1. Improve deletedNotifIds initial state in AppShell
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

c = c.replace(oldDeletedState.replace(/\r?\n/g, '\r\n'), newDeletedState.replace(/\r?\n/g, '\r\n'));
c = c.replace(oldDeletedState.replace(/\r?\n/g, '\n'), newDeletedState.replace(/\r?\n/g, '\n'));

// 2. Improve getAllStoredPersistentNotifs
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

      const notifMap = new Map<string, any>();
      const addList = (raw: string | null) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((n: any) => {
              if (n && (n.id || n.commentId)) {
                const key = n.id || n.commentId;
                const metaId = n.metadata?.id || n.metadata?.commentId;
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

      return Array.from(notifMap.values());
    } catch (e) {
      return [];
    }
  };`;

c = c.replace(oldGetAll.replace(/\r?\n/g, '\r\n'), newGetAll.replace(/\r?\n/g, '\r\n'));
c = c.replace(oldGetAll.replace(/\r?\n/g, '\n'), newGetAll.replace(/\r?\n/g, '\n'));

// 3. In addNotifs, ensure isDel immediately returns
c = c.replace(
  `            const isDel = Boolean(
              c.deleted === true ||
              deletedNotifIds.includes(notifId) ||
              (c.id && deletedNotifIds.includes(String(c.id))) ||
              (c.metadata?.id && deletedNotifIds.includes(String(c.metadata.id)))
            );`,
  `            const isDel = Boolean(
              c.deleted === true ||
              deletedNotifIds.includes(notifId) ||
              (c.id && deletedNotifIds.includes(String(c.id))) ||
              (c.metadata?.id && deletedNotifIds.includes(String(c.metadata.id))) ||
              (c.commentId && deletedNotifIds.includes(String(c.commentId)))
            );
            if (isDel) return;`
);

// 4. Update deleteNotification, restoreNotification, permanentlyDeleteNotification
const oldDeleteFunc = `  const deleteNotification = (idOrNotif: any, e?: React.MouseEvent) => {
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
  };`;

const newDeleteFunc = `  const deleteNotification = (idOrNotif: any, e?: React.MouseEvent) => {
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
                const nId = n.id || n.commentId;
                const nMetaId = n.metadata?.id || n.metadata?.commentId;
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
  };`;

c = c.replace(oldDeleteFunc.replace(/\r?\n/g, '\r\n'), newDeleteFunc.replace(/\r?\n/g, '\r\n'));
c = c.replace(oldDeleteFunc.replace(/\r?\n/g, '\n'), newDeleteFunc.replace(/\r?\n/g, '\n'));

fs.writeFileSync(pAppShell, c, 'utf8');
console.log('AppShell.tsx notification lifecycle updated successfully');
