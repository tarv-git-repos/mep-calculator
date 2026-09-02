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

export const logActivity = async (userId: string | undefined, action: ActivityAction = 'UPDATED', details: Record<string, any> = {}) => {
  try {
    const state = workspaceStore.getState();
    const projectName = state.project?.name || 'Unknown Project';
    const path = window.location.pathname;
    const calcTitle = getCalculatorTitleFromPath(path) || 'General';

    let storedUserData: any = null;
    try {
      const raw = localStorage.getItem('mep_user_data') || localStorage.getItem('mep_profile');
      if (raw) storedUserData = JSON.parse(raw);
    } catch (e) {}

    const userEmail = storedUserData?.email || '';
    const userName = storedUserData?.name || storedUserData?.email || 'User';

    const calcName = details.calculator_name || calcTitle;
    const actionMsg = details.message || `Calculation ${calcName} was updated and saved in project ${projectName}`;

    const enrichedDetails = {
      project_name: projectName,
      calculator_name: calcName,
      path: path,
      timestamp: new Date().toISOString(),
      user_email: userEmail,
      user_name: userName,
      message: actionMsg,
      ...details
    };

    await api.logActivity(action, enrichedDetails);
  } catch (error) {
    console.error('Failed to log audit activity:', error);
  }
};

export const logCalculatorView = async (_calculatorTitle?: string, _pathName?: string) => {
  // Page view auto-logging disabled to prevent audit log spam
  return Promise.resolve();
};

export const logCalculatorUpdate = async (calculatorTitle: string, details?: string | Record<string, any>) => {
  const currentPath = window.location.pathname;
  const now = Date.now();

  // Deduplicate save event logs within 5 seconds for the same route
  if (lastLoggedUpdate.path === currentPath && (now - lastLoggedUpdate.timestamp) < 5000) {
    return Promise.resolve();
  }

  lastLoggedUpdate = { path: currentPath, timestamp: now };
  const calcTitle = getCalculatorTitleFromPath(currentPath) || calculatorTitle || 'Calculation';
  const detailPayload = typeof details === 'string' ? { summary: details } : (details || {});
  
  const state = workspaceStore.getState();
  const projName = state.project?.name || 'Project';

  return await logActivity(undefined, 'UPDATED', {
    calculator_name: calcTitle,
    message: `Calculation ${calcTitle} was updated and saved in project ${projName}`,
    ...detailPayload
  });
};

