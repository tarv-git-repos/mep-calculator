import { api } from '@/services/api';

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

  const projId = project?.id || "default";
  const projName = project?.name || "Active Project";

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
        title: `💬 New Task / Comment on ${targetName}`,
        message: `${currentUserName} commented on ${targetType} "${targetName}" (${calculatorTitle}): "${comment.text}"`,
        link: `${calculatorPath}?commentTargetType=${encodeURIComponent(targetType)}&commentTargetId=${encodeURIComponent(targetId)}&commentTargetName=${encodeURIComponent(targetName)}`,
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
