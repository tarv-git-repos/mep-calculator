import { api } from '@/services/api';

export type ActivityAction = 'LOGIN' | 'VIEW_CALCULATOR' | 'EXPORT' | 'LOGOUT' | 'UPDATE_SETTINGS'

export const logActivity = async (userId: string | undefined, action: ActivityAction, details: Record<string, any> = {}) => {
  try {
    await api.logActivity(action, details);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};
