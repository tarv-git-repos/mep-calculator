import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, AuthUserData } from '@/services/authService';

export type Profile = {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  subscription_status: string;
  isAccountVerified: boolean;
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
  const [loading, setLoading] = useState<boolean>(true);

  const setUserData = (data: AuthUserData | null) => {
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

  const getUserData = async () => {
    const res = await authService.getUserData();
    if (res.success && res.userData) {
      setUserData(res.userData);
    } else if (res.success === false) {
      // Keep existing local state if offline or standalone
    }
  };

  const checkAuth = async () => {
    try {
      const authState = await authService.getAuthState();
      if (authState.success && authState.userData) {
        setUserData(authState.userData);
      } else {
        const res = await authService.getUserData();
        if (res.success && res.userData) {
          setUserData(res.userData);
        }
      }
    } catch (e) {
      console.warn('Auth check error:', e);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUserData(null);
  };

  const acceptPrivacy = async () => {
    try {
      const { api } = await import('@/services/api');
      const res = await api.acceptPrivacyPolicy();
      if (res.success && userData) {
        setUserData({ ...userData, privacyPolicyAccepted: true });
      }
    } catch (e) {
      console.error("Failed to accept privacy policy", e);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const session = userData ? { user: { id: userData.id, email: userData.email } } : null;
  const user = session?.user ?? null;
  const profile: Profile | null = userData ? {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    role: userData.role || 'USER',
    subscription_status: 'ACTIVE',
    isAccountVerified: userData.isAccountVerified,
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
      acceptPrivacy
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
