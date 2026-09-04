import { api } from '@/services/api';

export function dispatchGlobalCommentNotification(commentWithMeta: any, options?: {
  project?: any;
  currentUserName?: string;
  currentUserId?: string;
}) {
  if (!commentWithMeta) return;

  const projId = options?.project?.id || commentWithMeta.projectId || "default";
  const projName = options?.project?.name || commentWithMeta.projectName || "Active Project";

  const enrichedComment = {
    ...commentWithMeta,
    projectId: projId,
    projectName: projName,
    calculatorTitle: commentWithMeta.calculatorTitle || (typeof document !== 'undefined' ? document.title.split('—')[0].trim() : 'MEP Calculator'),
    calculatorPath: commentWithMeta.calculatorPath || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    authorName: options?.currentUserName || commentWithMeta.authorName || 'Design Engineer',
    authorId: options?.currentUserId || commentWithMeta.authorId || 'unknown',
  };

  // 1. Instant local window event broadcast (< 1ms)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent("mep_notification_received", { detail: enrichedComment }));
    window.dispatchEvent(new CustomEvent("mep-notification-added", { detail: enrichedComment }));
    window.dispatchEvent(new CustomEvent("mep_notif_tick"));
    window.dispatchEvent(new Event("storage"));

    // Save directly to persistent localStorage queues so all project views immediately receive it
    try {
      const globalKey = "mep_persistent_user_notifs";
      const existingGlobal = JSON.parse(localStorage.getItem(globalKey) || '[]');
      if (!existingGlobal.some((n: any) => n.id === enrichedComment.id)) {
        localStorage.setItem(globalKey, JSON.stringify([enrichedComment, ...existingGlobal]));
      }

      const recipients: string[] = Array.isArray(enrichedComment.assignedUsers) ? enrichedComment.assignedUsers.filter(Boolean) : [];
      recipients.forEach(r => {
        const clean = String(r).trim();
        if (clean) {
          const uKey = `mep_persistent_user_notifs_${clean}`;
          const existingU = JSON.parse(localStorage.getItem(uKey) || '[]');
          if (!existingU.some((n: any) => n.id === enrichedComment.id)) {
            localStorage.setItem(uKey, JSON.stringify([enrichedComment, ...existingU]));
          }
        }
      });
    } catch (e) {}
  }

  // 2. Trigger asynchronous background recipient delivery (non-blocking)
  notifyCommentAssigned({
    comment: enrichedComment,
    targetId: enrichedComment.targetId || 'item',
    targetName: enrichedComment.targetName || 'Item',
    targetType: enrichedComment.targetType || 'Item',
    calculatorTitle: enrichedComment.calculatorTitle,
    calculatorPath: enrichedComment.calculatorPath,
    project: options?.project || { id: projId, name: projName },
    currentUserName: enrichedComment.authorName,
    currentUserId: enrichedComment.authorId
  }).catch(console.error);
}

export async function notifyCommentAssigned(options: {
  comment: any;
  targetId: string;
  targetName: string;
  targetType: string;
  calculatorTitle: string;
  calculatorPath: string;
  project?: any;
  currentUserName?: string;
  currentUserId?: string;
}) {
  const {
    comment,
    targetId,
    targetName,
    targetType,
    calculatorTitle,
    calculatorPath,
    project,
    currentUserName = "Design Engineer",
    currentUserId
  } = options;

  const projId = project?.id || comment.projectId || "default";
  const projName = project?.name || comment.projectName || "Active Project";

  const commentWithMeta = {
    ...comment,
    targetId,
    targetName,
    targetType,
    projectName: projName,
    projectId: projId,
    calculatorPath,
  };

  // Determine recipients: assigned users, or all project members (excluding author) if unassigned
  let recipients: string[] = Array.isArray(comment.assignedUsers) ? comment.assignedUsers.filter(Boolean) : [];
  if (recipients.length === 0 && project) {
    const memberSet = new Set<string>();
    if (Array.isArray(project.project_users)) {
      project.project_users.forEach((pu: any) => {
        const idVal = pu?.user_id || pu?.id || pu?.user?.id || pu?.email || (typeof pu === 'string' ? pu : '');
        if (idVal) memberSet.add(String(idVal));
      });
    }
    if (Array.isArray(project.members)) {
      project.members.forEach((m: any) => {
        const idVal = m?.id || m?.user_id || m?.email || (typeof m === 'string' ? m : '');
        if (idVal) memberSet.add(String(idVal));
      });
    }
    recipients = Array.from(memberSet);
  }

  // Author MUST NOT be notified of their own comment/task assignment
  if (currentUserId) {
    const authorIdStr = String(currentUserId).toLowerCase().trim();
    recipients = recipients.filter(r => String(r).toLowerCase().trim() !== authorIdStr);
  }
  if (currentUserName) {
    const authorNameStr = String(currentUserName).toLowerCase().trim();
    recipients = recipients.filter(r => String(r).toLowerCase().trim() !== authorNameStr);
  }

  // 1. Instant local window event dispatch
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent("mep_notification_received", { detail: commentWithMeta }));
    window.dispatchEvent(new CustomEvent("mep-notification-added", { detail: commentWithMeta }));
    window.dispatchEvent(new CustomEvent("mep_notif_tick"));
    window.dispatchEvent(new Event("storage"));
  }

  // 2. Non-blocking asynchronous background notification delivery
  if (recipients.length > 0) {
    Promise.all(recipients.map(uId => 
      api.sendNotification({
        recipientId: uId,
        title: `💬 New Task / Comment on ${targetName} (${projName})`,
        message: `${currentUserName} commented on ${targetType} "${targetName}" in ${projName} (${calculatorTitle}): "${comment.text}"`,
        link: `${calculatorPath}?projectId=${encodeURIComponent(projId)}&commentTargetType=${encodeURIComponent(targetType)}&commentTargetId=${encodeURIComponent(targetId)}&commentTargetName=${encodeURIComponent(targetName)}`,
        metadata: {
          id: comment.id,
          projectId: projId,
          projectName: projName,
          calculatorPath,
          targetId,
          targetName,
          targetType,
          authorName: currentUserName,
          text: comment.text,
          createdAt: comment.timestamp || new Date().toISOString(),
        }
      }).catch(e => console.error("Failed to send notification to user", uId, e))
    ));
  }
}

/**
 * Universally scrolls to and highlights any target element (row, card, header, input) in the active view
 */
export function executeHighlightAndScroll(detail: {
  id?: string;
  name?: string;
  type?: string;
  commentId?: string;
}): boolean {
  if (typeof document === 'undefined') return false;
  const { id, name, type } = detail || {};
  if (!id && !name) return false;

  const cleanId = id ? String(id).trim() : "";
  const cleanName = name ? String(name).trim().toLowerCase() : "";

  // 1. Try to find the exact element by ID or data attributes
  const candidateSelectors = [
    cleanId ? `[data-row-id="${cleanId}"]` : null,
    cleanId ? `[data-space-id="${cleanId}"]` : null,
    cleanId ? `[data-zone-id="${cleanId}"]` : null,
    cleanId ? `[data-item-id="${cleanId}"]` : null,
    cleanId ? `#row-${cleanId}` : null,
    cleanId ? `#space-row-${cleanId}` : null,
    cleanId ? `#gen-row-${cleanId}` : null,
    cleanId ? `#busbar-row-${cleanId}` : null,
    cleanId ? `#tray-row-${cleanId}` : null,
    cleanId ? `#sprinkler-row-${cleanId}` : null,
    cleanId ? `#loading-unit-row-${cleanId}` : null,
    cleanId ? `#lux-row-${cleanId}` : null,
    cleanId ? `#item-${cleanId}` : null,
    cleanId ? `#${cleanId}` : null,
  ].filter(Boolean) as string[];

  let targetEl: HTMLElement | null = null;

  for (const selector of candidateSelectors) {
    try {
      const found = document.querySelector(selector) as HTMLElement;
      if (found) {
        targetEl = found;
        break;
      }
    } catch (e) {}
  }

  // 2. If not found by direct selector, search table rows, cards, or grid items by text / name
  if (!targetEl && cleanName) {
    const rowsAndCards = document.querySelectorAll('tr, [role="row"], .grid, [data-card], [data-zone], [data-space]');
    for (let i = 0; i < rowsAndCards.length; i++) {
      const el = rowsAndCards[i] as HTMLElement;
      const text = (el.textContent || "").toLowerCase();
      if (text.includes(cleanName)) {
        targetEl = el;
        break;
      }
    }
  }

  // 3. If element found, scroll into center and apply flashing pulse highlight
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    targetEl.classList.add('row-highlight-flash', 'item-highlight-pulse', 'ring-2', 'ring-primary', 'bg-primary/20');
    
    // Also highlight child tds or cells if present
    const childTds = targetEl.querySelectorAll('td, th');
    childTds.forEach(td => td.classList.add('item-highlight-pulse'));

    setTimeout(() => {
      if (targetEl) {
        targetEl.classList.remove('row-highlight-flash', 'item-highlight-pulse', 'ring-2', 'ring-primary', 'bg-primary/20');
      }
      childTds.forEach(td => td.classList.remove('item-highlight-pulse'));
    }, 4500);

    return true;
  }

  return false;
}

/**
 * High-level helper to navigate from any notification click directly to the target location and trigger highlight
 */
export function navigateToNotificationTarget(
  notif: any,
  navigate: (opts: any) => void,
  selectProject?: (id: string) => void,
  markNotifAsRead?: (id: string) => void
) {
  if (!notif) return;

  if (notif.id && markNotifAsRead) {
    markNotifAsRead(notif.id);
  }

  const projId = notif.projectId || notif.metadata?.projectId;
  if (projId && selectProject) {
    selectProject(projId);
  }

  let rawPath = notif.calculatorPath || notif.metadata?.calculatorPath || notif.link || "/ventilation";
  
  // Extract path and query params if rawPath contains query string
  let targetPath = rawPath;
  let queryParams: Record<string, string> = {};
  if (rawPath.includes("?")) {
    const [pathPart, queryPart] = rawPath.split("?");
    targetPath = pathPart;
    const searchParams = new URLSearchParams(queryPart);
    searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });
  }

  const targetId = notif.targetId || notif.metadata?.targetId || notif.id || "";
  const targetName = notif.targetName || notif.metadata?.targetName || "";
  const targetType = notif.targetType || notif.metadata?.targetType || "";

  if (targetId) queryParams.commentTargetId = targetId;
  if (targetName) queryParams.commentTargetName = targetName;
  if (targetType) queryParams.commentTargetType = targetType;

  // Navigate to calculator
  navigate({
    to: (targetPath || "/ventilation") as any,
    search: Object.keys(queryParams).length > 0 ? queryParams : undefined,
  });

  const dispatchDetail = {
    id: targetId,
    name: targetName,
    type: targetType?.toLowerCase(),
    commentId: notif.id,
  };

  // Dispatch multiple staggered attempts to guarantee scroll & highlight once the page/DOM finishes rendering
  const retryIntervals = [100, 300, 600, 1000, 1500];
  retryIntervals.forEach((delay) => {
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("mep-scroll-to-item", {
          detail: dispatchDetail,
        })
      );
      executeHighlightAndScroll(dispatchDetail);
    }, delay);
  });
}
