import axios from 'axios';
import { getHardwareFingerprint } from '@/lib/hardwareFingerprint';

const getBackendUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
      return `http://${host}:4000`;
    }
    if ((window as any).__TAURI_INTERNALS__ || window.location.protocol === 'tauri:' || window.location.protocol === 'asset:') {
      return 'http://localhost:4000';
    }
  }
  return 'http://localhost:4000';
};

// axios.defaults.withCredentials = true; // Disabled to prevent stale cookie conflicts with Authorization header

export interface UserSettings {
  theme?: 'light' | 'dark' | 'system';
  default_units?: 'IP' | 'SI';
  auto_save?: boolean;
  autosave_path?: string;
  autosave_interval?: number;
  [key: string]: any;
}

export interface AuthUserData {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ORG_ADMIN' | 'jr. Design Engineer' | 'Design Engineer' | 'Sr. Design Engineer' | 'Discipline Coordinator' | 'BIM Modeler' | 'BIM Coordinator' | 'Team Leader' | '2D Draftsman' | 'Viewer' | 'Client' | 'PROJECT_MANAGER' | 'ENGINEER' | 'USER' | string;
  organization_id?: string;
  status?: string;
  company?: string;
  designation?: string;
  profile_photo?: string;
  settings?: UserSettings;
  isAccountVerified: boolean;
  privacyPolicyAccepted?: boolean;
  features?: Record<string, boolean>;
  subscription_expires?: string;
  is_founding_pioneer?: boolean;
  pioneer_number?: number | null;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  userData?: AuthUserData;
  requireForceLogout?: boolean;
  sessionRevoked?: boolean;
}

export const clearAllAuthStorage = () => {
  if (typeof window !== 'undefined') {
    const clientId = localStorage.getItem('mep_device_client_id');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('mep_user_data');
    localStorage.removeItem('mep_profile');
    localStorage.removeItem('mep_auth_token');
    // Clear grid column width memory on logout
    localStorage.removeItem('mep_grid_spaces_grid');
    localStorage.removeItem('mep_grid_zones_grid');
    localStorage.removeItem('mep_grid_equipment_grid');
    if (clientId) {
      localStorage.setItem('mep_device_client_id', clientId);
    }
  }
};

export const authService = {
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      clearAllAuthStorage();
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/auth/register`, {
        name,
        email,
        password,
      });
      if (data.success && data.token) {
        localStorage.setItem('auth_token', data.token);
        if (data.userData) {
          localStorage.setItem('mep_user_data', JSON.stringify(data.userData));
          localStorage.setItem('mep_profile', JSON.stringify(data.userData));
        }
      }
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Registration failed',
      };
    }
  },

  async login(email: string, password: string, force: boolean = false): Promise<AuthResponse> {
    try {
      clearAllAuthStorage();
      const hwid = getHardwareFingerprint();
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/auth/login`, {
        email,
        password,
        hwid,
        force,
      });
      if (data.success && data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Login failed. Could not reach server.',
      };
    }
  },

  async logout(): Promise<AuthResponse> {
    try {
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/auth/logout`);
      clearAllAuthStorage();
      return data;
    } catch (error: any) {
      clearAllAuthStorage();
      return {
        success: false,
        message: error.message || 'Logout failed',
      };
    }
  },

  async logoutOthers(): Promise<AuthResponse> {
    try {
      const token = localStorage.getItem('auth_token');
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/user/logout-others`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Logout others failed',
      };
    }
  },

  async deleteAccount(password?: string, confirmed: boolean = true): Promise<AuthResponse> {
    try {
      const token = localStorage.getItem('auth_token');
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/user/delete-account`, {
        password,
        confirmed
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (data.success) {
        localStorage.removeItem('auth_token');
      }
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Delete account failed',
      };
    }
  },

  async updateProfile(updates: Record<string, any>): Promise<AuthResponse> {
    try {
      const token = localStorage.getItem('auth_token');
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/user/update-profile`, updates, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Profile update failed',
      };
    }
  },

  async sendVerifyOtp(email?: string): Promise<AuthResponse> {
    try {
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/auth/send-verify-otp`, { email });
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to send OTP',
      };
    }
  },

  async verifyAccount(otp: string, email?: string): Promise<AuthResponse> {
    try {
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/auth/verify-account`, {
        otp,
        email,
      });
      clearAllAuthStorage();
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Verification failed',
      };
    }
  },

  async getAuthState(): Promise<AuthResponse> {
    try {
      const { data } = await axios.get<AuthResponse>(`${getBackendUrl()}/api/auth/is-auth`);
      return data;
    } catch (error: any) {
      if (error.response?.data?.sessionRevoked || error.response?.data?.message?.includes('another device')) {
        return { success: false, message: error.response.data.message || 'Your account was logged in on another device.' };
      }
      return { success: false };
    }
  },

  async getUserData(): Promise<AuthResponse> {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        return { success: false, message: 'No auth token' };
      }
      const { data } = await axios.get<AuthResponse>(`${getBackendUrl()}/api/user/data`);
      return data;
    } catch (error: any) {
      if (error.response?.data?.sessionRevoked || error.response?.data?.message?.includes('another device')) {
        return { success: false, sessionRevoked: true, message: error.response.data.message || 'Your account was logged in on another device.' };
      }
      if (error.response?.data?.accountDeactivated || error.response?.data?.accountDeleted) {
        return { success: false, accountDeactivated: true, message: 'Your account has been deleted or deactivated by an administrator.' };
      }
      return { success: false };
    }
  },

  async sendResetOtp(email: string): Promise<AuthResponse> {
    try {
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/auth/send-reset-otp`, { email });
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to send reset code',
      };
    }
  },

  async resetPassword(email: string, otp: string, newPassword: string): Promise<AuthResponse> {
    try {
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/auth/reset-password`, {
        email,
        otp,
        newPassword,
      });
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Password reset failed',
      };
    }
  },

  // --- LICENSING & SUBSCRIPTION METHODS ---
  async initHardwareTrial(hwid: string, email?: string): Promise<any> {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/license/hardware-trial`, { hwid, email });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Trial initialization failed' };
    }
  },

  async getLicenseStatus(hwid: string, email?: string): Promise<any> {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/license/status`, { hwid, email });
      return data;
    } catch (error: any) {
      return { success: false, plan: 'FREE', status: 'UNLICENSED', remainingDays: 0, watermark: 'UNLICENSED / DEMO VERSION' };
    }
  },

  async checkoutPlan(email: string, planTier: string, durationDays: number, hwid?: string): Promise<any> {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/license/checkout`, { email, planTier, durationDays, hwid });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Checkout failed' };
    }
  },

  async activateLicenseKey(key: string, email?: string, hwid?: string): Promise<any> {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/license/activate`, { key, email, hwid });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'License activation failed' };
    }
  },

  async adminListLicenses(): Promise<any> {
    try {
      const { data } = await axios.get(`${getBackendUrl()}/api/admin/licenses/list`);
      return data;
    } catch (error: any) {
      return { success: false, licenses: [], trials: [] };
    }
  },

  async adminGenerateLicenseKey(tier: string, durationDays: number, targetEmail?: string): Promise<any> {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/licenses/generate`, { tier, durationDays, targetEmail });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Key generation failed' };
    }
  },

  async adminRevokeLicenseKey(key: string): Promise<any> {
    try {
      const { data } = await axios.post(`${getBackendUrl()}/api/admin/licenses/revoke`, { key });
      return data;
    } catch (error: any) {
      return { success: false, message: error.response?.data?.message || 'Revocation failed' };
    }
  },
};
