/**
 * Utility helpers for merging item comments with global and calculator-specific comments
 */

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

    // Extract targets from comment
    const cTargetId = String(c.targetId || c.spaceId || c.itemId || '').trim().toLowerCase();
    const cTargetName = String(c.targetName || c.spaceName || c.name || '').trim().toLowerCase();

    // If the comment has no specific target ID or name, it cannot match a specific field/row
    if (!cTargetId && !cTargetName) return false;

    // Reject general calculator/page-level targets from matching specific fields/inputs unless targeted directly
    const pageLevelIds = new Set([
      'global', 'project', 'page', 'calc', 'calculator',
      'condensate-drain', '/condensate-drain'
    ]);
    if (pageLevelIds.has(cTargetId) && cleanTargetId !== cTargetId) {
      return false;
    }

    // 1. Direct ID matching
    if (cleanTargetId && cTargetId) {
      // Direct exact equality
      if (cleanTargetId === cTargetId) return true;

      // Prefix variations: field-xxx, res-xxx, step-xxx
      if (
        cTargetId === `field-${cleanTargetId}` ||
        cleanTargetId === `field-${cTargetId}` ||
        cTargetId === `res-${cleanTargetId}` ||
        cleanTargetId === `res-${cTargetId}` ||
        cTargetId === `step-${cleanTargetId}` ||
        cleanTargetId === `step-${cTargetId}`
      ) {
        return true;
      }

      // Exact match after removing hyphens/underscores (e.g. units_quantity vs units-quantity)
      const normCleanId = cleanTargetId.replace(/[-_]/g, '');
      const normCId = cTargetId.replace(/[-_]/g, '');
      if (normCleanId && normCId && normCleanId === normCId) {
        return true;
      }
    }

    // 2. Exact or Base Label/Name matching
    if (cleanTargetName && cTargetName) {
      // Direct exact equality
      if (cleanTargetName === cTargetName) return true;

      // Base label comparison ignoring unit suffix like "(kW)", "(TR)", "(m)", "(ft)", "(19mm)"
      const baseCleanName = cleanTargetName.replace(/\s*\([^)]*\)/g, '').trim();
      const baseCName = cTargetName.replace(/\s*\([^)]*\)/g, '').trim();
      if (baseCleanName && baseCName && baseCleanName === baseCName) {
        return true;
      }
    }

    // 3. Match if comment targetId matches item label (or vice versa) strictly
    if (cleanTargetId && cTargetName) {
      const normCleanId = cleanTargetId.replace(/[-_]/g, '');
      const normCName = cTargetName.replace(/[^a-z0-9]/g, '');
      if (normCleanId && normCName && normCleanId === normCName) return true;
    }
    if (cleanTargetName && cTargetId) {
      const normCleanName = cleanTargetName.replace(/[^a-z0-9]/g, '');
      const normCId = cTargetId.replace(/[-_]/g, '');
      if (normCleanName && normCId && normCleanName === normCId) return true;
    }

    return false;
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
          const savedCalcComments = JSON.parse(localStorage.getItem(calcCommentsKey) || '[]');
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
    const savedCoordNotifs = JSON.parse(localStorage.getItem(coordKey) || '[]');
    if (Array.isArray(savedCoordNotifs)) {
      savedCoordNotifs.forEach((c) => addCommentIfMatch(c, false));
    }
  } catch (e) {}

  // 4. Also check persistent user notifications: mep_persistent_user_notifs
  try {
    const userNotifsKey = 'mep_persistent_user_notifs';
    const savedUserNotifs = JSON.parse(localStorage.getItem(userNotifsKey) || '[]');
    if (Array.isArray(savedUserNotifs)) {
      savedUserNotifs.forEach((c) => addCommentIfMatch(c, false));
    }
  } catch (e) {}

  // 5. Check user-specific notification queues
  try {
    const user = JSON.parse(localStorage.getItem('mep_user') || localStorage.getItem('mep_profile') || '{}');
    const uName = user.name || user.email || user.id || '';
    if (uName) {
      const uKey = `mep_persistent_user_notifs_${uName}`;
      const savedU = JSON.parse(localStorage.getItem(uKey) || '[]');
      if (Array.isArray(savedU)) {
        savedU.forEach((c) => addCommentIfMatch(c, false));
      }
    }
  } catch (e) {}

  return merged;
}
