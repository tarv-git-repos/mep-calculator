import { api } from '@/services/api';
import { workspaceStore } from '@/lib/workspace-store';

export type ActivityAction = 'LOGIN' | 'VIEW_CALCULATOR' | 'EXPORT' | 'LOGOUT' | 'UPDATE_SETTINGS' | 'VIEWED' | 'UPDATED';

let lastLoggedView = { path: '', timestamp: 0 };
let lastLoggedUpdate = { path: '', timestamp: 0 };

export function getCalculatorTitleFromPath(pathname: string): string {
  if (!pathname || pathname === '/login' || pathname === '/privacy' || pathname.includes('admin')) {
    return '';
  }
  if (pathname === '/' || pathname === '/ventilation') {
    return 'Ventilation';
  }
  return pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Calculator';
}

export const logActivity = async (_userId?: string, _action?: ActivityAction, _details: Record<string, any> = {}) => {
  // Activity logging disabled
  return Promise.resolve();
};

export const logCalculatorView = async (_calculatorTitle?: string, _pathName?: string) => {
  // Activity logging disabled
  return Promise.resolve();
};

export const logCalculatorUpdate = async (_calculatorTitle?: string, _details?: string | Record<string, any>) => {
  // Activity logging disabled
  return Promise.resolve();
};

