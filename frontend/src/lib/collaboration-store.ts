import { create } from 'zustand';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export interface PresenceState {
  user_email: string;
  session_id: string;
  active_module: string | null;
  joined_module_at?: number;
  user_name?: string;
  /** Monotonic per-session counter, used to pick the freshest meta when a session has several. */
  track_seq?: number;
}

/**
 * Local observation of when a session entered its current module (as seen by THIS client).
 * Using locally observed arrival order (instead of comparing wall clocks of different PCs)
 * makes the "first one in owns the calculator" rule immune to clock skew between machines.
 */
interface ArrivalRecord {
  /** `${module}|${joined_module_at}` — changes whenever the session (re)enters a module */
  key: string;
  /** Local timestamp at which this client first observed the arrival */
  at: number;
  /** false when the arrival came from the initial presence snapshot (arrival order unknown) */
  live: boolean;
}

export interface LockOwner {
  email: string;
  sessionId: string;
  name?: string;
}

interface CollaborationState {
  currentProject: string | null;
  channel: RealtimeChannel | null;
  activeUsers: Record<string, PresenceState>; // key is presence ID (= session id)
  mySessionId: string;
  myEmail: string;
  myName: string;
  /** Module (normalized path) this session is currently in */
  pendingModule: string | null;
  /** Timestamp at which this session entered `pendingModule`; stable across re-subscribes */
  moduleJoinedAt: number;
  isSubscribed: boolean;
  /** Local time of the first presence sync of the current channel (null = not synced yet) */
  liveSince: number | null;
  /** True once presence is known (first sync received, or fail-open timeout elapsed) */
  presenceReady: boolean;
  /** Set when the realtime connection dropped; on reconnect we re-enter as a newcomer */
  connectionDropped: boolean;
  arrivals: Record<string, ArrivalRecord>;

  joinProject: (projectName: string, email: string, name?: string) => void;
  leaveProject: () => void;
  setActiveModule: (moduleName: string | null) => Promise<void>;
  /** Clears the active module after a short delay (cancelled if another module is entered meanwhile) */
  releaseActiveModule: () => void;
  setOnDataReceived: (callback: (moduleName: string, data: Record<string, any>) => void) => void;
  broadcastData: (moduleName: string, data: Record<string, any>) => void;
  getLockOwner: (moduleName: string) => LockOwner | null;
  /** Other sessions (excluding this one) currently present in the module */
  getOthersInModule: (moduleName: string) => PresenceState[];
  onDataReceived: ((moduleName: string, data: Record<string, any>) => void) | null;
}

/** Arrivals closer together than this are treated as simultaneous and resolved deterministically. */
const ARRIVAL_GRACE_MS = 3000;
/** Delay before clearing the module on AppShell unmount (avoids presence flicker between pages). */
const MODULE_RELEASE_DELAY_MS = 400;
/** If presence never syncs (offline / realtime unavailable) stop waiting and allow editing. */
const PRESENCE_READY_TIMEOUT_MS = 5000;

const IS_BROWSER = typeof window !== 'undefined';

const normPath = (p: string | null | undefined): string => {
  if (!p) return '';
  return p.toLowerCase().trim().replace(/\/$/, '');
};

const presenceKey = (module: string | null | undefined, joinedAt: number | undefined) =>
  `${normPath(module)}|${joinedAt || 0}`;

let releaseTimer: ReturnType<typeof setTimeout> | null = null;
let presenceReadyTimer: ReturnType<typeof setTimeout> | null = null;
let joinSeq = 0;
let trackSeq = 0;
let lastJoinArgs: { projectName: string; email: string; name?: string } | null = null;

const toOwner = (p: PresenceState): LockOwner => ({
  email: p.user_email,
  sessionId: p.session_id,
  name: p.user_name || p.user_email,
});

/** Deterministic, clock-based ordering used only as a tie-breaker. */
const compareByJoinTime = (a: PresenceState, b: PresenceState) => {
  const ta = a.joined_module_at || 0;
  const tb = b.joined_module_at || 0;
  if (ta !== tb) return ta - tb;
  return (a.session_id || '') < (b.session_id || '') ? -1 : 1;
};

const pickLatestMeta = (presences: any[]): PresenceState => {
  let best = presences[0];
  for (const p of presences) {
    if ((p?.track_seq || 0) >= (best?.track_seq || 0)) best = p;
  }
  return best as PresenceState;
};

export const useCollaboration = create<CollaborationState>((set, get) => {
  const startPresenceReadyTimer = () => {
    if (!IS_BROWSER) return;
    if (presenceReadyTimer) clearTimeout(presenceReadyTimer);
    presenceReadyTimer = setTimeout(() => {
      if (!get().presenceReady) set({ presenceReady: true });
    }, PRESENCE_READY_TIMEOUT_MS);
  };

  const trackSelf = async () => {
    const { channel, isSubscribed, myEmail, myName, mySessionId, pendingModule, moduleJoinedAt } = get();
    if (!channel || !isSubscribed) return;
    trackSeq += 1;
    try {
      await channel.track({
        user_email: myEmail,
        user_name: myName,
        session_id: mySessionId,
        active_module: pendingModule,
        joined_module_at: pendingModule ? moduleJoinedAt : 0,
        track_seq: trackSeq,
      });
    } catch (e) {
      console.error('Failed to track presence', e);
    }
  };

  const handleSync = (channel: RealtimeChannel) => {
    if (get().channel !== channel) return;
    const state = channel.presenceState();
    const now = Date.now();
    const { arrivals, liveSince, mySessionId } = get();
    const isInitialSnapshot = liveSince === null;

    const activeUsers: Record<string, PresenceState> = {};
    const nextArrivals: Record<string, ArrivalRecord> = {};

    for (const [key, presences] of Object.entries(state)) {
      if (!presences || presences.length === 0) continue;
      const p = pickLatestMeta(presences as any[]);
      activeUsers[key] = p;

      const sid = p.session_id || key;
      if (sid === mySessionId) continue; // own arrival is managed locally in setActiveModule
      if (!p.active_module) continue;

      const k = presenceKey(p.active_module, p.joined_module_at);
      const prev = arrivals[sid];
      nextArrivals[sid] = prev && prev.key === k ? prev : { key: k, at: now, live: !isInitialSnapshot };
    }

    if (arrivals[mySessionId]) nextArrivals[mySessionId] = arrivals[mySessionId];

    set({
      activeUsers,
      arrivals: nextArrivals,
      liveSince: isInitialSnapshot ? now : liveSince,
      presenceReady: true,
    });
  };

  /**
   * Returns 'other' if `other` owns the module over me, 'me' otherwise.
   * 1. Prefer locally observed arrival order (immune to clock skew between PCs):
   *    - other was already there (well before I arrived)  -> other wins
   *    - other arrived live, well after I was in           -> I win
   * 2. Near-simultaneous / unknown order -> deterministic join-time + session-id tie-break,
   *    which every client evaluates identically, so exactly one owner emerges.
   */
  const resolveAgainst = (other: PresenceState): 'me' | 'other' => {
    const { arrivals, mySessionId, myEmail, myName, pendingModule, moduleJoinedAt } = get();
    const mine = arrivals[mySessionId];
    const theirs = arrivals[other.session_id];

    if (mine && theirs) {
      if (theirs.at + ARRIVAL_GRACE_MS < mine.at) return 'other';
      if (mine.at + ARRIVAL_GRACE_MS < theirs.at && theirs.live) return 'me';
    }

    const me: PresenceState = {
      user_email: myEmail,
      user_name: myName,
      session_id: mySessionId,
      active_module: pendingModule,
      joined_module_at: moduleJoinedAt,
    };
    return compareByJoinTime(other, me) < 0 ? 'other' : 'me';
  };

  if (IS_BROWSER) {
    startPresenceReadyTimer();
    // Leave presence immediately when the tab/window closes so other users are unlocked right away
    window.addEventListener('pagehide', () => {
      try { get().leaveProject(); } catch (e) { /* ignore */ }
    });
    // Page restored from back/forward cache: re-enter presence as a newcomer
    window.addEventListener('pageshow', (e: PageTransitionEvent) => {
      if (!e.persisted || !lastJoinArgs) return;
      const st = get();
      if (st.pendingModule) {
        const now = Date.now();
        set({
          moduleJoinedAt: now,
          arrivals: { [st.mySessionId]: { key: presenceKey(st.pendingModule, now), at: now, live: true } },
        });
      }
      get().joinProject(lastJoinArgs.projectName, lastJoinArgs.email, lastJoinArgs.name);
    });
  }

  return {
    currentProject: null,
    channel: null,
    activeUsers: {},
    mySessionId: generateSessionId(),
    myEmail: "unknown",
    myName: "Unknown User",
    pendingModule: null,
    moduleJoinedAt: 0,
    isSubscribed: false,
    liveSince: null,
    presenceReady: false,
    connectionDropped: false,
    arrivals: {},
    onDataReceived: null,

    /**
     * Idempotent: the presence channel is kept alive across page navigations (AppShell remounts per route).
     * It is only re-created when the project changes.
     */
    joinProject: (projectName: string, email: string, name?: string) => {
      lastJoinArgs = { projectName, email, name };
      const s = get();
      const displayName = name || email;
      const identityChanged = s.myEmail !== email || s.myName !== displayName;
      set({ myEmail: email, myName: displayName });

      if (s.currentProject === projectName && s.channel) {
        if (identityChanged) void trackSelf();
        return;
      }

      const seq = ++joinSeq;
      const oldChannel = s.channel;
      const myArrival = s.arrivals[s.mySessionId];

      set({
        currentProject: projectName,
        channel: null,
        isSubscribed: false,
        activeUsers: {},
        arrivals: myArrival ? { [s.mySessionId]: myArrival } : {},
        liveSince: null,
        presenceReady: false,
        connectionDropped: false,
      });
      startPresenceReadyTimer();

      void (async () => {
        try {
          if (oldChannel) {
            try { await oldChannel.untrack(); } catch (e) { /* ignore */ }
            try { await supabase.removeChannel(oldChannel); } catch (e) { /* ignore */ }
          }
          // supabase.channel() returns an existing channel with the same topic (even one that is still closing),
          // so make sure no stale instance is left before creating a fresh one.
          const topic = `realtime:project:${projectName}`;
          for (const c of supabase.getChannels()) {
            if (c.topic === topic) {
              try { await supabase.removeChannel(c); } catch (e) { /* ignore */ }
            }
          }
          if (seq !== joinSeq) return; // a newer join superseded this one

          const channel = supabase.channel(`project:${projectName}`, {
            config: { presence: { key: get().mySessionId } },
          });
          set({ channel });

          channel
            .on('presence', { event: 'sync' }, () => handleSync(channel))
            .on('broadcast', { event: 'module_update' }, (payload) => {
              if (get().channel !== channel) return;
              const onDataReceived = get().onDataReceived;
              if (onDataReceived && payload.payload) {
                onDataReceived(payload.payload.module, payload.payload.data);
              }
            })
            .subscribe(async (status) => {
              if (get().channel !== channel) return;
              if (status === 'SUBSCRIBED') {
                const st = get();
                if (st.connectionDropped && st.pendingModule) {
                  // We were disconnected while inside a module: others may have taken over meanwhile,
                  // so re-enter as a newcomer (never silently reclaim the lock).
                  const now = Date.now();
                  set({
                    moduleJoinedAt: now,
                    arrivals: {
                      ...st.arrivals,
                      [st.mySessionId]: { key: presenceKey(st.pendingModule, now), at: now, live: true },
                    },
                  });
                }
                set({ isSubscribed: true, connectionDropped: false });
                await trackSelf();
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                set({ isSubscribed: false, connectionDropped: true });
              }
            });
        } catch (err) {
          console.error('Failed to join collaboration channel', err);
          set({ presenceReady: true }); // fail open
        }
      })();
    },

    leaveProject: () => {
      joinSeq++;
      const { channel } = get();
      if (channel) {
        try { void channel.untrack(); } catch (e) { /* ignore */ }
        try { void supabase.removeChannel(channel); } catch (e) { /* ignore */ }
      }
      set({
        currentProject: null,
        channel: null,
        activeUsers: {},
        isSubscribed: false,
        liveSince: null,
        connectionDropped: false,
      });
    },

    setActiveModule: async (moduleName: string | null) => {
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      const cleanMod = moduleName ? normPath(moduleName) || null : null;
      const { pendingModule, mySessionId, arrivals } = get();

      // Same module -> keep the original entry time (do NOT lose ownership on re-render / remount)
      if (cleanMod === pendingModule) return;

      const joinedAt = cleanMod ? Date.now() : 0;
      const nextArrivals = { ...arrivals };
      if (cleanMod) {
        nextArrivals[mySessionId] = { key: presenceKey(cleanMod, joinedAt), at: joinedAt, live: true };
      } else {
        delete nextArrivals[mySessionId];
      }

      set({ pendingModule: cleanMod, moduleJoinedAt: joinedAt, arrivals: nextArrivals });
      await trackSelf();
    },

    releaseActiveModule: () => {
      if (!IS_BROWSER) return;
      if (releaseTimer) clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => {
        releaseTimer = null;
        void get().setActiveModule(null);
      }, MODULE_RELEASE_DELAY_MS);
    },

    getOthersInModule: (moduleName: string) => {
      const { activeUsers, mySessionId } = get();
      const target = normPath(moduleName);
      if (!target) return [];
      return Object.values(activeUsers).filter(
        (p) => p && p.session_id !== mySessionId && p.active_module && normPath(p.active_module) === target
      );
    },

    getLockOwner: (moduleName: string) => {
      const { mySessionId, myEmail, myName, pendingModule } = get();
      const target = normPath(moduleName);
      if (!target) return null;

      const others = get().getOthersInModule(target);
      const meInModule = pendingModule === target;
      const self: LockOwner = { email: myEmail, sessionId: mySessionId, name: myName };

      if (others.length === 0) return meInModule ? self : null;

      // Not (yet) inside this module: anyone already there owns it
      if (!meInModule) return toOwner([...others].sort(compareByJoinTime)[0]);

      const winners = others.filter((o) => resolveAgainst(o) === 'other');
      if (winners.length === 0) return self;
      return toOwner(winners.sort(compareByJoinTime)[0]);
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
  };
});
