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

export const logActivity = async (userId: string | undefined, action: ActivityAction, details: Record<string, any> = {}) => {
  try {
    const state = workspaceStore.getState();
    const projectName = state.project?.name || 'Unknown Project';
    const path = window.location.pathname;
    const calcTitle = getCalculatorTitleFromPath(path) || 'GENERAL';

    let storedUserData: any = null;
    try {
      const raw = localStorage.getItem('mep_user_data') || localStorage.getItem('mep_profile');
      if (raw) storedUserData = JSON.parse(raw);
    } catch (e) {}

    const enrichedDetails = {
      project_name: projectName,
      calculator: calcTitle.toUpperCase(),
      calculator_name: calcTitle,
      path: path,
      timestamp: new Date().toISOString(),
      user_email: storedUserData?.email || '',
      user_name: storedUserData?.name || storedUserData?.email || '',
      ...details
    };

    await api.logActivity(action, enrichedDetails);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

export const logCalculatorView = async (calculatorTitle: string, pathName?: string) => {
  const currentPath = pathName || window.location.pathname;
  const now = Date.now();
  
  // Prevent logging duplicate view events within 3 seconds for the same route
  if (lastLoggedView.path === currentPath && (now - lastLoggedView.timestamp) < 3000) {
    return;
  }
  
  lastLoggedView = { path: currentPath, timestamp: now };
  const calcTitle = getCalculatorTitleFromPath(currentPath) || calculatorTitle;
  
  await logActivity(undefined, 'UPDATED', {
    calculator_name: calcTitle,
    message: `Updated ${calcTitle}`,
  });
};

export const logCalculatorUpdate = async (calculatorTitle: string, details?: string | Record<string, any>) => {
  const currentPath = window.location.pathname;
  const calcTitle = getCalculatorTitleFromPath(currentPath) || calculatorTitle;
  const detailPayload = typeof details === 'string' ? { summary: details } : (details || {});
  
  return await logActivity(undefined, 'UPDATED', {
    calculator_name: calcTitle,
    message: `Changes occurred in ${calcTitle}`,
    ...detailPayload
  });
};

