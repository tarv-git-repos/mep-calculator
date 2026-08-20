import { create } from 'zustand';
import { supabase } from './supabase';
const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

interface PresenceState {
  user_email: string;
  session_id: string;
  active_module: string | null;
  joined_module_at?: number;
  user_name?: string;
}

interface CollaborationState {
  currentProject: string | null;
  channel: RealtimeChannel | null;
  activeUsers: Record<string, PresenceState>; // key is presence ID
  mySessionId: string;
  myEmail: string;
  myName: string;
  pendingModule: string | null;
  isSubscribed: boolean;
  
  joinProject: (projectName: string, email: string, name?: string) => void;
  leaveProject: () => void;
  setActiveModule: (moduleName: string | null) => Promise<void>;
  setOnDataReceived: (callback: (moduleName: string, data: Record<string, any>) => void) => void;
  broadcastData: (moduleName: string, data: Record<string, any>) => void;
  getLockOwner: (moduleName: string) => { email: string; sessionId: string; name?: string } | null;
  onDataReceived: ((moduleName: string, data: Record<string, any>) => void) | null;
}

export const useCollaboration = create<CollaborationState>((set, get) => ({
  currentProject: null,
  channel: null,
  activeUsers: {},
  mySessionId: generateSessionId(),
  myEmail: "unknown",
  myName: "Unknown User",
  pendingModule: null,
  isSubscribed: false,
  onDataReceived: null,

  joinProject: (projectName: string, email: string, name?: string) => {
    const existingChannel = get().channel;
    if (existingChannel) {
      existingChannel.unsubscribe();
    }

    const channel = supabase.channel(`project:${projectName}`, {
      config: {
        presence: {
          key: get().mySessionId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeUsers: Record<string, PresenceState> = {};
        
        for (const [key, presences] of Object.entries(state)) {
          if (presences.length > 0) {
            activeUsers[key] = presences[0] as unknown as PresenceState;
          }
        }
        
        set({ activeUsers });
      })
      .on('broadcast', { event: 'module_update' }, (payload) => {
        const onDataReceived = get().onDataReceived;
        if (onDataReceived) {
          onDataReceived(payload.payload.module, payload.payload.data);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          set({ isSubscribed: true, myEmail: email, myName: name || email });
          const pending = get().pendingModule;
          await channel.track({ user_email: email, user_name: name || email, session_id: get().mySessionId, active_module: pending, joined_module_at: pending ? Date.now() : 0 });
        }
      });

    set({ currentProject: projectName, channel });
  },

  leaveProject: () => {
    const { channel } = get();
    if (channel) {
      supabase.removeChannel(channel);
    }
    set({ currentProject: null, channel: null, activeUsers: {}, isSubscribed: false, pendingModule: null });
  },

  setActiveModule: async (moduleName: string | null) => {
    const { channel, isSubscribed, myEmail, mySessionId } = get();
    
    // Always store the pending module in case we connect later
    set({ pendingModule: moduleName });

    if (channel && isSubscribed) {
      try {
        await channel.track({ user_email: myEmail, user_name: get().myName, session_id: mySessionId, active_module: moduleName, joined_module_at: moduleName ? Date.now() : 0 });
      } catch (e) {
        console.error("Failed to track active module", e);
      }
    }
  },

  getLockOwner: (moduleName: string) => {
    const { activeUsers } = get();
    let oldestUser: PresenceState | null = null;
    
    for (const [key, state] of Object.entries(activeUsers)) {
      if (state.active_module === moduleName) {
        if (!oldestUser) {
          oldestUser = state;
        } else {
          // Compare joined_module_at (must be valid positive timestamp), fallback to MAX_SAFE_INTEGER so untracked/invalid timestamps never steal lock
          const timeA = state.joined_module_at && state.joined_module_at > 0 ? state.joined_module_at : Number.MAX_SAFE_INTEGER;
          const timeB = oldestUser.joined_module_at && oldestUser.joined_module_at > 0 ? oldestUser.joined_module_at : Number.MAX_SAFE_INTEGER;
          if (timeA < timeB) {
            oldestUser = state;
          } else if (timeA === timeB && state.session_id < oldestUser.session_id) {
             oldestUser = state;
          }
        }
      }
    }
    
    if (oldestUser) {
      return { email: oldestUser.user_email, sessionId: oldestUser.session_id, name: oldestUser.user_name };
    }
    return null;
  },

  broadcastData: (moduleName: string, data: any) => {
    const channel = get().channel;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'module_update',
        payload: { module: moduleName, data }
      });
    }
  },

  setOnDataReceived: (callback) => {
    set({ onDataReceived: callback });
  }
}));
