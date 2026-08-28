import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, clearAllAuthStorage, AuthUserData } from '@/services/authService';
import { api } from '@/services/api';
import { toast } from 'sonner';

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
      return localStorage.getItem(LOCAL_STORAGE_USER_KEY) !== null;
    }
    return false;
  });
  const [userData, setUserDataState] = useState<AuthUserData | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LOCAL_STORAGE_USER_KEY) === null;
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
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(data));
        setIsLoggedin(true);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
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

    window.addEventListener('mep_session_revoked', handleRevoked as EventListener);
    const handleProfileUpdate = () => {
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
  const profile: Profile | null = userData ? {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    role: (userData.role === 'USER' || !userData.role) ? (userData.email === 'admin@tarv.ai' ? 'SUPER_ADMIN' : 'Jr. Design Engineer') : userData.role,
    subscription_status: 'ACTIVE',
    isAccountVerified: userData.isAccountVerified,
    features: userData.features || {},
    subscription_expires: userData.subscription_expires,
    company: userData.company || '',
    designation: userData.designation || '',
    profile_photo: userData.profile_photo || '',
    settings: userData.settings || {},
    status: userData.status
  } : null;

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
