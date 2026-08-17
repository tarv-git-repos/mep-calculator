import React, { useState, useEffect } from 'react';
import { X, Users, User as UserIcon, MessageSquare } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/lib/workspace-store';
import { TaskComment } from '@/lib/ventilation-calc';
import { toast } from 'sonner';

interface AssignCommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetName: string;
  targetType: 'space' | 'zone' | 'equipment';
  onSave: (comment: TaskComment) => void;
}

export function AssignCommentModal({
  isOpen,
  onClose,
  targetId,
  targetName,
  targetType,
  onSave
}: AssignCommentModalProps) {
  const { userData, profile } = useAuth();
  const { project } = useWorkspace();
  
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

    const fetchAssignees = async () => {
      if (availableUsers.length === 0) {
        setIsLoading(true);
      }
      try {
        // Fetch all users and teams
        const [allUsers, allTeams] = await Promise.all([
          api.getUsers(),
          api.getTeams()
        ]);

        // Filter to only those assigned to the current project
        const projectUsers = (project as any).project_users || [];
        const projectTeams = (project as any).project_teams || [];

        const assignedUserIds = new Set<string>(projectUsers.map((pu: any) => pu.user_id));
        const assignedTeamIds = new Set<string>(projectTeams.map((pt: any) => pt.team_id));

        const filteredTeams = allTeams.filter((t: any) => assignedTeamIds.has(t.id));

        // Add members of assigned teams to the individual users list
        filteredTeams.forEach((t: any) => {
          if (Array.isArray(t.team_members)) {
            t.team_members.forEach((m: any) => assignedUserIds.add(m.user_id));
          }
        });

        const filteredUsers = assignedUserIds.size > 0 ? allUsers.filter((u: any) => assignedUserIds.has(u.id)) : allUsers;

        setAvailableUsers(filteredUsers);
        setAvailableTeams(filteredTeams);
      } catch (err) {
        console.error("Failed to load assignees", err);
        toast.error("Failed to load project members");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignees();
  }, [isOpen, project?.id]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!commentText.trim() && selectedUsers.length === 0 && selectedTeams.length === 0) {
      toast.error("Please enter a comment description or select an assignee.");
      return;
    }

    const finalDescription = commentText.trim() || "Assigned task for review";

    const newComment: TaskComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      text: finalDescription,
      assignedUsers: selectedUsers,
      assignedTeams: selectedTeams,
      authorId: profile?.id || userData?.id || 'unknown',
      authorName: userData?.name || profile?.name || 'SystemAdmin',
      timestamp: new Date().toISOString()
    };

    onSave(newComment);
    onClose();
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
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
                {availableUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[12px] font-semibold transition-all ${
                      selectedUsers.includes(u.id) 
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-surface-2 border-border/50 text-foreground/80 hover:border-border'
                    }`}
                  >
                    <UserIcon className="size-3.5" />
                    {u.name}
                  </button>
                ))}
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
