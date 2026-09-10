import { create } from 'zustand';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export interface PresenceState {
  user_email: string;
  session_id: string;
  active_module: string | null;
  joined_module_at?: number;
  user_name?: string;
  last_heartbeat?: number;
}

interface CollaborationState {
  currentProject: string | null;
  channel: RealtimeChannel | null;
  activeUsers: Record<string, PresenceState>; // key is session_id
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

let localBc: BroadcastChannel | null = null;
let heartbeatInterval: any = null;

const normPath = (p: string | null | undefined): string => {
  if (!p) return "";
  return p.toLowerCase().trim().replace(/\/$/, "");
};

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

    if (localBc) {
      localBc.close();
      localBc = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    const mySessionId = get().mySessionId;
    const effectiveName = name || email.split('@')[0] || "User";
    set({ currentProject: projectName, myEmail: email, myName: effectiveName });

    // 1. Setup local BroadcastChannel for multi-tab/multi-window local & fallback sync
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        localBc = new BroadcastChannel(`mep_presence_${projectName}`);
        
        localBc.onmessage = (e) => {
          const msg = e.data;
          if (!msg || typeof msg !== 'object') return;

          if (msg.type === 'presence_sync' || msg.type === 'presence_heartbeat') {
            if (msg.session_id && msg.session_id !== mySessionId) {
              set((state) => ({
                activeUsers: {
                  ...state.activeUsers,
                  [msg.session_id]: {
                    session_id: msg.session_id,
                    user_email: msg.user_email,
                    user_name: msg.user_name,
                    active_module: msg.active_module,
                    joined_module_at: msg.joined_module_at,
                    last_heartbeat: Date.now(),
                  },
                },
              }));
            }
          } else if (msg.type === 'presence_leave') {
            if (msg.session_id) {
              set((state) => {
                const nextUsers = { ...state.activeUsers };
                delete nextUsers[msg.session_id];
                return { activeUsers: nextUsers };
              });
            }
          } else if (msg.type === 'module_update') {
            const onDataReceived = get().onDataReceived;
            if (onDataReceived && msg.module) {
              onDataReceived(msg.module, msg.data);
            }
          }
        };

        // Broadcast local presence to existing peers
        const currentMod = get().pendingModule;
        localBc.postMessage({
          type: 'presence_heartbeat',
          session_id: mySessionId,
          user_email: email,
          user_name: effectiveName,
          active_module: currentMod,
          joined_module_at: currentMod ? Date.now() : 0,
        });
      }
    } catch (bcErr) {
      console.warn("BroadcastChannel not supported or error:", bcErr);
    }

    // 2. Setup Supabase Realtime Channel
    const channel = supabase.channel(`project:${projectName}`, {
      config: {
        presence: {
          key: mySessionId,
        },
      },
    });

    const updatePresenceState = () => {
      const state = channel.presenceState();
      const activeUsers: Record<string, PresenceState> = { ...get().activeUsers };
      
      for (const [key, presences] of Object.entries(state)) {
        if (presences.length > 0) {
          const p = presences[0] as unknown as PresenceState;
          if (p && p.session_id) {
            activeUsers[p.session_id] = {
              ...p,
              last_heartbeat: Date.now(),
            };
          }
        }
      }
      
      set({ activeUsers });
    };

    channel
      .on('presence', { event: 'sync' }, updatePresenceState)
      .on('presence', { event: 'join' }, updatePresenceState)
      .on('presence', { event: 'leave' }, updatePresenceState)
      .on('broadcast', { event: 'module_update' }, (payload) => {
        const onDataReceived = get().onDataReceived;
        if (onDataReceived && payload.payload) {
          onDataReceived(payload.payload.module, payload.payload.data);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          set({ isSubscribed: true });
          const pending = get().pendingModule;
          try {
            await channel.track({
              user_email: email,
              user_name: effectiveName,
              session_id: mySessionId,
              active_module: pending,
              joined_module_at: pending ? Date.now() : 0,
            });
          } catch (trackErr) {
            console.warn("Supabase channel.track error:", trackErr);
          }
        }
      });

    // 3. Heartbeat timer to keep presence alive and prune disconnected users
    heartbeatInterval = setInterval(() => {
      const { channel, isSubscribed, pendingModule, myEmail, myName } = get();
      const now = Date.now();

      // Prune stale users (no heartbeat in > 15s)
      set((state) => {
        let changed = false;
        const nextUsers = { ...state.activeUsers };
        for (const [sId, u] of Object.entries(nextUsers)) {
          if (sId !== mySessionId && u.last_heartbeat && now - u.last_heartbeat > 15000) {
            delete nextUsers[sId];
            changed = true;
          }
        }
        return changed ? { activeUsers: nextUsers } : state;
      });

      // Broadcast heartbeat via BroadcastChannel
      if (localBc) {
        localBc.postMessage({
          type: 'presence_heartbeat',
          session_id: mySessionId,
          user_email: myEmail,
          user_name: myName,
          active_module: pendingModule,
          joined_module_at: pendingModule ? Date.now() : 0,
        });
      }

      // Re-track via Supabase channel if subscribed
      if (channel && isSubscribed) {
        channel.track({
          user_email: myEmail,
          user_name: myName,
          session_id: mySessionId,
          active_module: pendingModule,
          joined_module_at: pendingModule ? Date.now() : 0,
        }).catch(() => {});
      }
    }, 4000);

    set({ channel });
  },

  leaveProject: () => {
    const { channel, mySessionId } = get();
    if (localBc) {
      try {
        localBc.postMessage({ type: 'presence_leave', session_id: mySessionId });
        localBc.close();
      } catch (_) {}
      localBc = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (channel) {
      supabase.removeChannel(channel);
    }
    set({ currentProject: null, channel: null, activeUsers: {}, isSubscribed: false, pendingModule: null });
  },

  setActiveModule: async (moduleName: string | null) => {
    const { channel, isSubscribed, myEmail, myName, mySessionId, activeUsers } = get();
    const cleanMod = moduleName ? normPath(moduleName) : null;
    const now = Date.now();

    // Register active user locally
    set({
      pendingModule: cleanMod,
      activeUsers: {
        ...activeUsers,
        [mySessionId]: {
          user_email: myEmail,
          user_name: myName,
          session_id: mySessionId,
          active_module: cleanMod,
          joined_module_at: cleanMod ? now : 0,
          last_heartbeat: now,
        },
      },
    });

    // Broadcast locally to other tabs/windows
    if (localBc) {
      localBc.postMessage({
        type: 'presence_sync',
        session_id: mySessionId,
        user_email: myEmail,
        user_name: myName,
        active_module: cleanMod,
        joined_module_at: cleanMod ? now : 0,
      });
    }

    // Broadcast to Supabase cloud channel
    if (channel && isSubscribed) {
      try {
        await channel.track({
          user_email: myEmail,
          user_name: myName,
          session_id: mySessionId,
          active_module: cleanMod,
          joined_module_at: cleanMod ? now : 0,
        });
      } catch (e) {
        console.error("Failed to track active module", e);
      }
    }
  },

  getLockOwner: (moduleName: string) => {
    const { activeUsers } = get();
    const targetModule = normPath(moduleName);
    if (!targetModule) return null;

    let oldestUser: PresenceState | null = null;
    
    for (const [, state] of Object.entries(activeUsers)) {
      if (normPath(state.active_module) === targetModule) {
        if (!oldestUser) {
          oldestUser = state;
        } else {
          // The user with earliest joined_module_at holds the lock
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
    if (localBc) {
      localBc.postMessage({
        type: 'module_update',
        module: moduleName,
        data,
      });
    }
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
