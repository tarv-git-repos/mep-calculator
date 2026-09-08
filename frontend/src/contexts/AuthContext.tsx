import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, clearAllAuthStorage, AuthUserData } from '@/services/authService';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { loadOrgHierarchyFromStorage } from '@/utils/hierarchy';

export type Role = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'PROJECT_MANAGER' | 'ENGINEER' | 'VIEWER' | 'USER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organization_id?: string;
  isAccountVerified: boolean;
  privacyPolicyAccepted: boolean;
  features?: Record<string, boolean>;
  subscription_expires?: string;
  status?: string;
};

export type Profile = {
  id: string;
  email: string;
  name: string;
  role: Role;
  organization_id?: string;
  subscription_status: string;
  isAccountVerified: boolean;
  features?: Record<string, boolean>;
  subscription_expires?: string;
  company?: string;
  designation?: string;
  profile_photo?: string;
  settings?: Record<string, any>;
  status?: string;
  is_founding_pioneer?: boolean;
  pioneer_number?: number | null;
};

interface AuthContextType {
  isLoggedin: boolean;
  userData: AuthUserData | null;
  profile: Profile | null;
  loading: boolean;
  session: { user: { id: string; email: string } } | null;
  user: { id: string; email: string } | null;
  setIsLoggedin: (logged: boolean) => void;
  setUserData: (data: AuthUserData | null) => void;
  getUserData: () => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  deleteAccount: (password?: string) => Promise<{ success: boolean; message?: string }>;
  updateProfileDetails: (updates: Record<string, any>) => Promise<{ success: boolean; message?: string }>;
  acceptPrivacy: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoggedin: false,
  userData: null,
  profile: null,
  loading: true,
  session: null,
  user: null,
  setIsLoggedin: () => {},
  setUserData: () => {},
  getUserData: async () => {},
  logout: async () => {},
  logoutAllDevices: async () => {},
  deleteAccount: async () => ({ success: false }),
  updateProfileDetails: async () => ({ success: false }),
  acceptPrivacy: async () => {},
});

const LOCAL_STORAGE_USER_KEY = 'mep_calculator_user_data';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedin, setIsLoggedin] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !!(localStorage.getItem(LOCAL_STORAGE_USER_KEY) || localStorage.getItem('mep_user_data') || localStorage.getItem('mep_profile') || localStorage.getItem('auth_token'));
    }
    return false;
  });
  const [userData, setUserDataState] = useState<AuthUserData | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY) || localStorage.getItem('mep_user_data') || localStorage.getItem('mep_profile');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (e) {}
      }
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY) || localStorage.getItem('mep_user_data') || localStorage.getItem('mep_profile');
      return !saved;
    }
    return true;
  });

  const setUserData = (data: AuthUserData | null) => {
    if (data && typeof window !== 'undefined') {
      if (localStorage.getItem('privacy_policy_accepted') === 'true') {
        data = { ...data, privacyPolicyAccepted: true };
      }
      if (data.id) {
        if (data.profile_photo) {
          localStorage.setItem(`mep_profile_photo_${data.id}`, data.profile_photo);
        } else if (data.profile_photo === '') {
          localStorage.removeItem(`mep_profile_photo_${data.id}`);
        } else {
          const savedPhoto = localStorage.getItem(`mep_profile_photo_${data.id}`);
          if (savedPhoto) {
            data = { ...data, profile_photo: savedPhoto };
          }
        }
      }
      // Remove legacy un-scoped photo key if it exists
      localStorage.removeItem('mep_profile_photo');
    }
    setUserDataState(data);
    if (typeof window !== 'undefined') {
      if (data) {
        const jsonStr = JSON.stringify(data);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, jsonStr);
        localStorage.setItem('mep_user_data', jsonStr);
        localStorage.setItem('mep_profile', jsonStr);
        setIsLoggedin(true);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        localStorage.removeItem('mep_user_data');
        localStorage.removeItem('mep_profile');
        setIsLoggedin(false);
      }
    }
  };

  const handleUnauthResponse = (res: any) => {
    if (!res) return;
    if (res.sessionRevoked || res.message?.includes('another device')) {
      toast.error(res.message || "Your account was logged in on another device.", { duration: 6000 });
      clearAllAuthStorage();
      setUserDataState(null);
      setIsLoggedin(false);
    } else if (res.message?.includes('deactivated') || res.message?.includes('deleted')) {
      toast.error(res.message, { duration: 6000 });
      clearAllAuthStorage();
      setUserDataState(null);
      setIsLoggedin(false);
    } else if (res.success === false) {
      clearAllAuthStorage();
      setUserDataState(null);
      setIsLoggedin(false);
    }
  };

  const getUserData = async () => {
    const res = await authService.getUserData();
    if (res.success && res.userData) {
      setUserData(res.userData);
      return res;
    } else if (res.success === false) {
      handleUnauthResponse(res);
    }
    return res;
  };

  const checkAuth = async () => {
    try {
      const authState = await authService.getAuthState();
      if (authState.success && authState.userData) {
        setUserData(authState.userData);
      } else if (authState.success === false) {
        handleUnauthResponse(authState);
      } else {
        const res = await authService.getUserData();
        if (res.success && res.userData) {
          setUserData(res.userData);
        } else if (res.success === false) {
          handleUnauthResponse(res);
        }
      }
    } catch (e) {
      console.warn('Auth check error:', e);
    } finally {
      setLoading(false);
    }

    // Sync latest profile updates asynchronously in the background
    try {
      const currentEmail = userData?.email;
      if (currentEmail) {
        const allUsers = await api.getUsers();
        if (Array.isArray(allUsers)) {
          const match = allUsers.find((u: any) => u.email?.toLowerCase() === currentEmail.toLowerCase());
          if (match) {
            setUserDataState(prev => {
              const updated = prev ? { ...prev, ...match } : match;
              if (typeof window !== 'undefined') {
                localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updated));
                if (updated.company && updated.company !== 'Consitent' && updated.id) {
                  localStorage.setItem(`mep_user_company_${updated.id}`, updated.company);
                }
                if (updated.id) {
                  const resDesig = updated.designation || updated.role;
                  if (resDesig) {
                    localStorage.setItem(`mep_user_designation_${updated.id}`, resDesig);
                  }
                }
              }
              return updated;
            });
          }
        }
      }
    } catch (e) {}
  };

  const logout = async () => {
    clearAllAuthStorage();
    await authService.logout();
    setUserData(null);
    try {
      const { workspaceStore } = await import('@/lib/workspace-store');
      workspaceStore.clearWorkspace();
    } catch (e) {
      console.error(e);
    }
  };

  const logoutAllDevices = async () => {
    await authService.logoutOthers();
    await logout();
  };

  const deleteAccount = async (password?: string) => {
    const res = await authService.deleteAccount(password, true);
    if (res.success) {
      setUserData(null);
      try {
        const { workspaceStore } = await import('@/lib/workspace-store');
        workspaceStore.clearWorkspace();
      } catch (e) {
        console.error(e);
      }
    }
    return res;
  };

  const updateProfileDetails = async (updates: Record<string, any>) => {
    const res = await authService.updateProfile(updates);
    if (res.success && res.userData) {
      setUserData(res.userData);
    }
    return res;
  };

  const acceptPrivacy = async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('privacy_policy_accepted', 'true');
    }
    if (userData) {
      setUserData({ ...userData, privacyPolicyAccepted: true });
    }
    try {
      const { api } = await import('@/services/api');
      await api.acceptPrivacyPolicy();
    } catch (e) {
      console.error("Failed to sync privacy policy acceptance with cloud backend", e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    checkAuth().finally(() => {
      clearTimeout(timer);
    });

    const handleRevoked = (e: any) => {
      const msg = e.detail || "Your account was logged in on another device.";
      toast.error(msg, { duration: 6000 });
      clearAllAuthStorage();
      setUserDataState(null);
      setIsLoggedin(false);
    };

    const handleProfileUpdate = (e?: any) => {
      if (e?.detail?.updates) {
        const updates = e.detail.updates;
        const targetId = String(e.detail.profileId || '').toLowerCase();
        setUserDataState(prev => {
          if (!prev) return prev;
          const matches = !targetId || 
            String(prev.id || '').toLowerCase() === targetId || 
            String(prev.email || '').toLowerCase() === targetId ||
            (updates.email && String(prev.email || '').toLowerCase() === String(updates.email).toLowerCase());
          if (matches) {
            const updated = {
              ...prev,
              ...updates,
              designation: updates.designation || prev.designation,
              features: {
                ...(prev.features || {}),
                ...(updates.features || {}),
                designation: updates.designation || (prev.features as any)?.designation
              }
            };
            const jsonStr = JSON.stringify(updated);
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, jsonStr);
            localStorage.setItem('mep_user_data', jsonStr);
            localStorage.setItem('mep_profile', jsonStr);
            if (updates.designation && prev.id) {
              localStorage.setItem(`mep_user_designation_${prev.id}`, updates.designation);
            }
            return updated;
          }
          return prev;
        });
      }
      getUserData();
    };
    window.addEventListener('mep_user_profile_updated', handleProfileUpdate as EventListener);
    window.addEventListener('storage', handleProfileUpdate);

    return () => {
      window.removeEventListener('mep_session_revoked', handleRevoked as EventListener);
      window.removeEventListener('mep_user_profile_updated', handleProfileUpdate as EventListener);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, []);

  // Periodic heartbeat session check (every 15s) and on window focus when logged in
  useEffect(() => {
    if (!isLoggedin) return;

    const performSessionCheck = async () => {
      const res = await getUserData();
      if (res && res.success === false && (res.requireForceLogout || res.message?.includes('another device'))) {
        toast.error(res.message || "Your account was logged in on another device.", { duration: 6000 });
        clearAllAuthStorage();
        setUserDataState(null);
        setIsLoggedin(false);
      }
    };

    const interval = setInterval(performSessionCheck, 15000);
    const handleFocus = () => { performSessionCheck(); };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isLoggedin]);

  const session = userData ? { user: { id: userData.id, email: userData.email } } : null;
  const user = session?.user ?? null;
  const profile: Profile | null = userData ? (() => {
    let hierarchyDesignation = '';
    let hierarchyRole = '';
    if (typeof window !== 'undefined') {
      try {
        const members = loadOrgHierarchyFromStorage(userData);
        if (members && Array.isArray(members)) {
          const uEmail = String(userData.email || '').toLowerCase().trim();
          const uName = String(userData.name || '').toLowerCase().trim();
          const uId = String(userData.id || '').toLowerCase().trim();
          const found = members.find((m: any) => {
            const mEmail = String(m.email || '').toLowerCase().trim();
            const mName = String(m.name || '').toLowerCase().trim();
            const mId = String(m.id || '').toLowerCase().trim();
            return (uEmail && mEmail === uEmail) || 
                   (uId && mId === uId) ||
                   (uName && mName === uName) ||
                   (uEmail && mEmail && (uEmail.includes(mEmail) || mEmail.includes(uEmail))) ||
                   (uName && mName && (uName.includes(mName) || mName.includes(uName)));
          });
          if (found) {
            hierarchyDesignation = found.designation || '';
            hierarchyRole = found.role || '';
          }
        }
      } catch (e) {}
    }

    const ROLE_MAP: Record<string, string> = {
      SUPER_ADMIN: "Super Admin",
      ORG_ADMIN: "Organization Admin",
      PROJECT_MANAGER: "Project Manager",
      TEAM_LEADER: "Team Leader",
      DISCIPLINE_COORDINATOR: "Discipline Coordinator",
      SR_DESIGN_ENGINEER: "Sr. Design Engineer",
      DESIGN_ENGINEER: "Design Engineer",
      JR_DESIGN_ENGINEER: "Jr. Design Engineer",
      BIM_COORDINATOR: "BIM Coordinator",
      BIM_MODELER: "BIM Modeler",
      DRAFTSMAN_2D: "2D Draftsman",
      VIEWER: "Viewer",
      CLIENT: "Client",
      ENGINEER: "Design Engineer",
      USER: "Jr. Design Engineer"
    };

    const effectiveRole = hierarchyRole || (userData.features as any)?.role || (userData.role !== 'USER' ? userData.role : null);
    const finalRole = effectiveRole || (userData.email === 'admin@tarv.ai' ? 'SUPER_ADMIN' : 'Jr. Design Engineer');
    const effectiveDesignation = hierarchyDesignation || (hierarchyRole ? (ROLE_MAP[hierarchyRole] || hierarchyRole) : '') || userData.designation || (userData.features as any)?.designation || ROLE_MAP[finalRole] || finalRole;

    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: finalRole as any,
      subscription_status: 'ACTIVE',
      isAccountVerified: userData.isAccountVerified,
      features: userData.features || {},
      subscription_expires: userData.subscription_expires || '2026-10-01T00:00:00.000Z',
      company: userData.company || '',
      designation: effectiveDesignation,
      profile_photo: userData.profile_photo || '',
      settings: userData.settings || {},
      status: userData.status
    };
  })() : null;

  return (
    <AuthContext.Provider value={{
      isLoggedin,
      userData,
      profile,
      loading,
      session,
      user,
      setIsLoggedin,
      setUserData,
      getUserData,
      logout,
      logoutAllDevices,
      deleteAccount,
      updateProfileDetails,
      acceptPrivacy
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
