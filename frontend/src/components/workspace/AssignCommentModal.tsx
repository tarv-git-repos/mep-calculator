import React, { useState, useEffect } from 'react';
import { X, Users, User as UserIcon, MessageSquare } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/lib/workspace-store';
import { TaskComment } from '@/lib/ventilation-calc';
import { toast } from 'sonner';
import { dispatchGlobalCommentNotification } from '@/utils/notificationHelpers';

interface AssignCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetName: string;
  targetType?: string;
  calculatorTitle?: string;
  calculatorPath?: string;
  onSave: (comment: TaskComment) => void | Promise<void>;
  existingComments?: TaskComment[];
}

export function AssignCommentModal({
  isOpen,
  onClose,
  targetId,
  targetName,
  targetType = 'space',
  calculatorTitle,
  calculatorPath,
  onSave,
  existingComments = []
}: AssignCommentModalProps) {
  const { userData, profile } = useAuth();
  const { project, isReadOnly } = useWorkspace();
  const isEffectiveReadOnly = isReadOnly || (typeof window !== 'undefined' && Boolean((window as any).__mep_is_readonly));
  
  const [commentText, setCommentText] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCommentText('');
      setSelectedUsers([]);
      setSelectedTeams([]);
      return;
    }

    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Adding comments is locked.", { id: "readonly-notice" });
      onClose();
      return;
    }

    const fetchAssignees = async () => {
      if (availableUsers.length === 0) {
        setIsLoading(true);
      }
      try {
        const [allUsers, allTeams] = await Promise.all([
          api.getUsers().catch(() => []),
          api.getTeams().catch(() => [])
        ]);

        const activeProj = project || (useWorkspace.getState().projects || []).find((p: any) => p.id === (project as any)?.id);
        const projectUsers: any[] = (activeProj as any)?.project_users || (project as any)?.project_users || [];
        const projectTeams: any[] = (activeProj as any)?.project_teams || (project as any)?.project_teams || [];

        const assignedUserIds = new Set<string>();
        const assignedUserEmails = new Set<string>();
        const directUserObjects: any[] = [];

        projectUsers.forEach((pu: any) => {
          if (!pu) return;
          if (typeof pu === 'string') {
            const clean = pu.trim().toLowerCase();
            if (clean.includes('@')) assignedUserEmails.add(clean);
            else if (clean) assignedUserIds.add(clean);
          } else if (typeof pu === 'object') {
            const uId = String(pu.id || pu.user_id || pu.user?.id || '').trim().toLowerCase();
            const uEmail = String(pu.email || pu.user?.email || '').trim().toLowerCase();
            if (uId) assignedUserIds.add(uId);
            if (uEmail) assignedUserEmails.add(uEmail);
            directUserObjects.push(pu);
          }
        });

        const assignedTeamIds = new Set<string>((projectTeams || []).map((pt: any) => String(pt.team_id || pt.id || pt).trim().toLowerCase()));
        const filteredTeams = (allTeams || []).filter((t: any) => assignedTeamIds.has(String(t.id).toLowerCase()));

        (allTeams || []).forEach((t: any) => {
          if (assignedTeamIds.has(String(t.id).toLowerCase()) && Array.isArray(t.team_members)) {
            t.team_members.forEach((m: any) => {
              const mId = String(m.user_id || m.id || m.email || m).trim().toLowerCase();
              if (mId.includes('@')) assignedUserEmails.add(mId);
              else if (mId) assignedUserIds.add(mId);
            });
          }
        });

        const uniqueUsers: any[] = [];
        const seenUniqueKeys = new Set<string>();

        const registerUser = (u: any) => {
          if (!u) return;
          const rawId = String(u.id || u.user_id || u.user?.id || '').trim();
          const rawEmail = String(u.email || u.user?.email || '').trim();
          const rawName = String(u.name || u.user?.name || u.userName || u.user_name || '').trim();

          const uniqueKey = (rawId || rawEmail || rawName).toLowerCase();
          if (!uniqueKey || seenUniqueKeys.has(uniqueKey)) return;
          seenUniqueKeys.add(uniqueKey);

          let displayName = rawName;
          if (!displayName || displayName.startsWith('usr_') || displayName.startsWith('User #')) {
            if (rawEmail) displayName = rawEmail.split('@')[0];
            else displayName = rawId || 'User';
          }

          const emailHandle = rawEmail ? rawEmail.split('@')[0] : '';
          const displayLabel = (emailHandle && !displayName.includes('(')) ? `${displayName} (${emailHandle})` : displayName;

          uniqueUsers.push({
            id: rawId || rawEmail || uniqueKey,
            name: displayLabel,
            rawName: displayName,
            email: rawEmail,
            role: u.role || 'Design Engineer'
          });
        };

        // 1. Add matching users from allUsers
        (allUsers || []).forEach((u: any) => {
          const uId = String(u.id || '').trim().toLowerCase();
          const uEmail = String(u.email || '').trim().toLowerCase();
          if (assignedUserIds.has(uId) || (uEmail && assignedUserEmails.has(uEmail))) {
            registerUser(u);
          }
        });

        // 2. Add direct user objects from projectUsers that might not be in allUsers
        directUserObjects.forEach((pu: any) => {
          const puId = String(pu.id || pu.user_id || pu.user?.id || '').trim().toLowerCase();
          const puEmail = String(pu.email || pu.user?.email || '').trim().toLowerCase();
          const matchInAll = (allUsers || []).find((u: any) => 
            (puId && String(u.id || '').trim().toLowerCase() === puId) ||
            (puEmail && String(u.email || '').trim().toLowerCase() === puEmail)
          );
          if (matchInAll) {
            registerUser(matchInAll);
          } else {
            registerUser(pu);
          }
        });

        // Fallback: If projectUsers was empty or filter yielded 0 users, show allUsers
        if (uniqueUsers.length === 0 && Array.isArray(allUsers) && allUsers.length > 0) {
          allUsers.forEach((u: any) => registerUser(u));
        }

        setAvailableUsers(uniqueUsers);
        setAvailableTeams(filteredTeams);
      } catch (err) {
        console.error("Failed to load assignees", err);
        toast.error("Failed to load project members");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignees();
  }, [isOpen, project?.id, isEffectiveReadOnly]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (isEffectiveReadOnly) {
      toast.info("Workspace is in Read-Only mode. Adding comments is locked.", { id: "readonly-notice" });
      onClose();
      return;
    }

    if (!commentText.trim() && selectedUsers.length === 0 && selectedTeams.length === 0) {
      toast.error("Please enter a comment description or select an assignee.");
      return;
    }

    const finalDescription = commentText.trim() || "Assigned task for review";

    const allAssignedUserIds = new Set<string>();
    selectedUsers.forEach(uKey => {
      if (uKey) allAssignedUserIds.add(uKey);
      const matchU = availableUsers.find(u => 
        String(u.id) === uKey || String(u.email) === uKey || String(u.name) === uKey
      );
      if (matchU) {
        if (matchU.id) allAssignedUserIds.add(String(matchU.id));
        if (matchU.email) allAssignedUserIds.add(String(matchU.email));
        if (matchU.name) allAssignedUserIds.add(String(matchU.name));
      }
    });

    const newComment: TaskComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      text: finalDescription,
      assignedUsers: Array.from(allAssignedUserIds),
      assignedTeams: selectedTeams,
      authorId: profile?.id || userData?.id || 'unknown',
      authorName: userData?.name || profile?.name || 'SystemAdmin',
      timestamp: new Date().toISOString()
    };

    try {
      await onSave(newComment);
      toast.success("Comment sent!");
    } catch(e) {
      console.error(e);
      toast.error("Failed to send comment");
    }

    try {
      dispatchGlobalCommentNotification({
        ...newComment,
        targetId,
        targetName,
        targetType: targetType || 'space',
        calculatorTitle: calculatorTitle || (typeof document !== 'undefined' ? document.title.split('—')[0].trim() : 'MEP Calculator'),
        calculatorPath: calculatorPath || (typeof window !== 'undefined' ? window.location.pathname : '/')
      }, {
        project,
        currentUserName: userData?.name || profile?.name || 'SystemAdmin',
        currentUserId: profile?.id || userData?.id || 'unknown'
      });
    } catch(e) {
      console.error(e);
    }

    onClose();
  };

  const formatAssignedUsers = (assignedList: string[]) => {
    if (!Array.isArray(assignedList) || assignedList.length === 0) return '';
    
    const resolvedNames = assignedList.map((uKey: string) => {
      if (!uKey) return '';
      const cleanKey = String(uKey).trim().toLowerCase();

      const matchedUser = availableUsers.find((u: any) => {
        const uId = String(u.id || '').trim().toLowerCase();
        const uEmail = String(u.email || '').trim().toLowerCase();
        const uName = String(u.name || '').trim().toLowerCase();
        const uRawName = String(u.rawName || '').trim().toLowerCase();
        return uId === cleanKey || uEmail === cleanKey || uName === cleanKey || uRawName === cleanKey;
      });
      if (matchedUser) return matchedUser.name;

      const matchedTeam = availableTeams.find((t: any) => {
        const tId = String(t.id || '').trim().toLowerCase();
        const tName = String(t.name || '').trim().toLowerCase();
        return tId === cleanKey || tName === cleanKey;
      });
      if (matchedTeam) return matchedTeam.name;

      if (cleanKey.includes('@')) {
        return cleanKey.split('@')[0];
      }

      if (typeof localStorage !== 'undefined') {
        try {
          const rawLocal = localStorage.getItem('mep_local_users') || localStorage.getItem('cachedAllUsers');
          if (rawLocal) {
            const parsed = JSON.parse(rawLocal);
            if (Array.isArray(parsed)) {
              const foundInCache = parsed.find((lu: any) => 
                String(lu.id || '').trim().toLowerCase() === cleanKey ||
                String(lu.email || '').trim().toLowerCase() === cleanKey
              );
              if (foundInCache?.name) {
                const handle = foundInCache.email ? ` (${foundInCache.email.split('@')[0]})` : '';
                return `${foundInCache.name}${handle}`;
              }
            }
          }
        } catch (e) {}
      }

      if (cleanKey.startsWith('usr_')) {
        return 'Project Member';
      }

      return uKey;
    }).filter(Boolean);

    return resolvedNames.join(', ');
  };

  const toggleUser = (uId: any) => {
    const strId = String(uId);
    setSelectedUsers(prev => 
      prev.includes(strId) ? prev.filter(id => id !== strId) : [...prev, strId]
    );
  };

  const toggleTeam = (teamId: any) => {
    const strId = String(teamId);
    setSelectedTeams(prev => 
      prev.includes(strId) ? prev.filter(id => id !== strId) : [...prev, strId]
    );
  };

  return (
    <div role="dialog" className="assign-comment-modal fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-surface-1">
          <div className="flex items-center gap-2.5 text-foreground">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <MessageSquare className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold leading-tight">Assign Task / Comment</h2>
              <p className="text-[11.5px] text-muted-foreground font-medium">
                {targetType.toUpperCase()}: <span className="font-semibold text-foreground/80">{targetName}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-surface-2 rounded-lg text-muted-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-5">
          
          {/* Existing Comments History */}
          {Array.isArray(existingComments) && existingComments.length > 0 && (
            <div>
              <label className="block text-[11.5px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                Existing Comments & History ({existingComments.length})
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {existingComments.map((c, idx) => (
                  <div key={c.id || idx} className="p-2.5 bg-surface-2 border border-border/60 rounded-lg text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-foreground">{c.authorName || 'Engineer'}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {c.timestamp ? new Date(c.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </span>
                    </div>
                    <p className="text-foreground/90 whitespace-pre-wrap">{c.text}</p>
                    {Array.isArray(c.assignedUsers) && c.assignedUsers.length > 0 && (
                      <div className="mt-1.5 pt-1 border-t border-border/40 text-[10.5px] text-primary font-medium flex items-center gap-1">
                        <Users className="size-3" />
                        <span>Assigned to: {formatAssignedUsers(c.assignedUsers)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[12.5px] font-bold text-foreground mb-1.5 uppercase tracking-wide">
              Assign To (Project Members)
            </label>
            
            {isLoading ? (
              <div className="text-[12px] text-muted-foreground animate-pulse p-2">Loading project members...</div>
            ) : availableUsers.length === 0 ? (
              <div className="text-[12px] text-muted-foreground p-3 bg-surface-2 rounded-lg border border-dashed border-border text-center">
                No users assigned to this project yet.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableUsers.map(u => {
                  const strId = String(u.id || u.email || u.name);
                  const isSelected = selectedUsers.includes(strId) || selectedUsers.includes(String(u.id));
                  return (
                    <button
                      key={strId}
                      onClick={() => toggleUser(strId)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[12px] font-semibold transition-all ${
                        isSelected 
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-surface-2 border-border/50 text-foreground/80 hover:border-border'
                      }`}
                    >
                      <UserIcon className="size-3.5" />
                      {u.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[12.5px] font-bold text-foreground mb-1.5 uppercase tracking-wide">
              Task Description
            </label>
            <textarea
              autoFocus
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Describe the changes or task required..."
              className="w-full h-28 px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all custom-scrollbar resize-none"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 bg-surface-1 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-surface-2 text-muted-foreground transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!commentText.trim() && selectedUsers.length === 0 && selectedTeams.length === 0}
            className="px-5 py-2 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            Send Comment
          </button>
        </div>
        
      </div>
    </div>
  );
}
