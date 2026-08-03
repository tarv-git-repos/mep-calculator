import axios from 'axios';

const getBackendUrl = () => {
  if (import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:4000`;
  }
  return 'http://localhost:4000';
};

axios.defaults.withCredentials = true;

export interface AuthUserData {
  id: string;
  name: string;
  email: string;
  isAccountVerified: boolean;
  privacyPolicyAccepted?: boolean;
  features?: Record<string, boolean>;
  subscription_expires?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  userData?: AuthUserData;
}

export const authService = {
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/auth/register`, {
        name,
        email,
        password,
      });
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Registration failed',
      };
    }
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/auth/login`, {
        email,
        password,
      });
      if (data.success && data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      return data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Login failed',
      };
    }
  },

  async logout(): Promise<AuthResponse> {
    try {
      const { data } = await axios.post<AuthResponse>(`${getBackendUrl()}/api/auth/logout`);
      localStorage.removeItem('auth_token');
      return data;
    } catch (error: any) {
      localStorage.removeItem('auth_token');
      return {
        success: false,
        message: error.message || 'Logout failed',
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
      return { success: false };
    }
  },

  async getUserData(): Promise<AuthResponse> {
    try {
      const { data } = await axios.get<AuthResponse>(`${getBackendUrl()}/api/user/data`);
      return data;
    } catch (error: any) {
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
