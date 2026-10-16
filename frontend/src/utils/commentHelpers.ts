/**
 * Utility helpers for merging item comments with global and calculator-specific comments
 */

const parsedStorageCache = new Map<string, { raw: string | null; parsed: any; ts: number }>();
const CACHE_TTL_MS = 1500;

export function invalidateCommentStorageCache(key?: string) {
  if (key) {
    parsedStorageCache.delete(key);
  } else {
    parsedStorageCache.clear();
  }
}

function getCachedJsonFromStorage(key: string, fallbackRaw: string): any {
  if (typeof window === 'undefined') return JSON.parse(fallbackRaw);
  const now = Date.now();
  const cached = parsedStorageCache.get(key);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.parsed;
  }
  try {
    const raw = localStorage.getItem(key);
    if (cached && cached.raw === raw) {
      cached.ts = now;
      return cached.parsed;
    }
    const parsed = JSON.parse(raw || fallbackRaw);
    parsedStorageCache.set(key, { raw, parsed, ts: now });
    return parsed;
  } catch {
    return JSON.parse(fallbackRaw);
  }
}

export function getMergedItemComments(
  targetId: string | number | undefined,
  targetName?: string | undefined,
  itemOrExistingComments?: any[] | any,
  calculatorPath?: string,
  projectId?: string
): any[] {
  const merged: any[] = [];
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();

  const cleanTargetId = targetId !== undefined && targetId !== null ? String(targetId).trim().toLowerCase() : '';
  const cleanTargetName = targetName ? String(targetName).trim().toLowerCase() : '';
  const normTargetId = cleanTargetId.replace(/[^a-z0-9]/g, '');
  const normTargetName = cleanTargetName.replace(/[^a-z0-9]/g, '');

  const isTargetMatch = (c: any) => {
    if (!c || typeof c !== 'object') return false;
    const cTargetId = String(c.targetId || c.spaceId || c.itemId || '').trim().toLowerCase();
    const cTargetName = String(c.targetName || c.spaceName || c.name || '').trim().toLowerCase();
    const normCTargetId = cTargetId.replace(/[^a-z0-9]/g, '');
    const normCTargetName = cTargetName.replace(/[^a-z0-9]/g, '');

    const matchesId = Boolean(
      cleanTargetId &&
      cTargetId &&
      (cTargetId === cleanTargetId ||
        cTargetId === `field-${cleanTargetId}` ||
        cleanTargetId === `field-${cTargetId}` ||
        cTargetId === `card-${cleanTargetId}` ||
        cleanTargetId === `card-${cTargetId}` ||
        cTargetId === `field-card-${cleanTargetId}` ||
        cleanTargetId === `field-card-${cTargetId}` ||
        cTargetId === `res-${cleanTargetId}` ||
        cleanTargetId === `res-${cTargetId}` ||
        cTargetId === `step-${cleanTargetId}` ||
        cleanTargetId === `step-${cTargetId}` ||
        (normTargetId && normCTargetId && (normTargetId === normCTargetId || normCTargetId.includes(normTargetId) || normTargetId.includes(normCTargetId))))
    );

    const matchesName = Boolean(
      (cleanTargetName && cTargetName && (
        cTargetName === cleanTargetName ||
        cTargetName.includes(cleanTargetName) ||
        cleanTargetName.includes(cTargetName) ||
        (normTargetName && normCTargetName && normTargetName === normCTargetName)
      )) ||
      (cleanTargetId && cTargetName && normTargetId && normCTargetName && normTargetId === normCTargetName) ||
      (cleanTargetName && cTargetId && normTargetName && normCTargetId && normTargetName === normCTargetId)
    );

    return matchesId || matchesName;
  };

  const addCommentIfMatch = (c: any, isDirectRowAttachment: boolean = false) => {
    if (!c || typeof c !== 'object') return;
    const cid = String(c.id || `${c.timestamp || ''}_${c.text || ''}`);
    if (seenIds.has(cid)) return;

    // Content signature deduplication (author + text + targetId + minute timestamp)
    const author = String(c.authorName || c.authorId || '').trim().toLowerCase();
    const text = String(c.text || '').trim().toLowerCase();
    const tId = String(c.targetId || c.spaceId || c.itemId || '').trim().toLowerCase();
    const timeMinute = String(c.timestamp || '').slice(0, 16);
    const signature = `${author}:::${text}:::${tId}:::${timeMinute}`;

    if (seenSignatures.has(signature)) return;

    // If it's a direct row array (like row.comments on a Space or Coil), and no targetId was specified on comment,
    // then it belongs to this item directly. Otherwise, check if targetId or targetName matches.
    const hasExplicitTarget = Boolean(c.targetId || c.spaceId || c.itemId || c.targetName || c.spaceName);
    if (!hasExplicitTarget && isDirectRowAttachment) {
      seenIds.add(cid);
      seenSignatures.add(signature);
      merged.push(c);
      return;
    }

    if (isTargetMatch(c)) {
      seenIds.add(cid);
      seenSignatures.add(signature);
      merged.push(c);
    }
  };

  // 1. Add direct existing comments on the item (if any)
  if (Array.isArray(itemOrExistingComments)) {
    for (const c of itemOrExistingComments) {
      addCommentIfMatch(c, true);
    }
  } else if (itemOrExistingComments && typeof itemOrExistingComments === 'object') {
    addCommentIfMatch(itemOrExistingComments, true);
  }

  // If in SSR / node environment, return early
  if (typeof window === 'undefined') {
    return merged;
  }

  const pId = projectId || 'default';

  // 2. Check calculator-specific comments in localStorage for both current project and default
  if (calculatorPath) {
    try {
      const pathsToCheck = [calculatorPath, calculatorPath.replace(/^\//, ''), `/${calculatorPath.replace(/^\//, '')}`];
      const projectIdsToCheck = Array.from(new Set([pId, 'default', '']));
      
      for (const proj of projectIdsToCheck) {
        for (const p of pathsToCheck) {
          const calcCommentsKey = `mep_calc_comments_${proj}_${p}`;
          const savedCalcComments = getCachedJsonFromStorage(calcCommentsKey, '[]');
          if (Array.isArray(savedCalcComments)) {
            savedCalcComments.forEach((c) => addCommentIfMatch(c, false));
          }
        }
      }
    } catch (e) {}
  }

  // 3. Also check global coordination notifications queue: mep_calc_coord_notifs
  try {
    const coordKey = 'mep_calc_coord_notifs';
    const savedCoordNotifs = getCachedJsonFromStorage(coordKey, '[]');
    if (Array.isArray(savedCoordNotifs)) {
      savedCoordNotifs.forEach((c) => addCommentIfMatch(c, false));
    }
  } catch (e) {}

  // 4. Also check persistent user notifications: mep_persistent_user_notifs
  try {
    const userNotifsKey = 'mep_persistent_user_notifs';
    const savedUserNotifs = getCachedJsonFromStorage(userNotifsKey, '[]');
    if (Array.isArray(savedUserNotifs)) {
      savedUserNotifs.forEach((c) => addCommentIfMatch(c, false));
    }
  } catch (e) {}

  // 5. Check user-specific notification queues
  try {
    const userObj = getCachedJsonFromStorage('mep_user', 'null') || getCachedJsonFromStorage('mep_profile', '{}') || {};
    const uName = userObj.name || userObj.email || userObj.id || '';
    if (uName) {
      const uKey = `mep_persistent_user_notifs_${uName}`;
      const savedU = getCachedJsonFromStorage(uKey, '[]');
      if (Array.isArray(savedU)) {
        savedU.forEach((c) => addCommentIfMatch(c, false));
      }
    }
  } catch (e) {}

  return merged;
}
