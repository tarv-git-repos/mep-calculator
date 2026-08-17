import { Profile } from "@/contexts/AuthContext";

export const isFeatureLocked = (path: string | undefined, profile?: Profile | null): boolean => {
  if (!path) return false;
  
  // SUPER_ADMIN and ORG_ADMIN should never be locked out of admin or hierarchy pages
  if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN') {
    if (path === '/admin' || path === '/company-hierarchy') return false;
  }

  // System pages should never be locked
  const systemPaths = ["", "/", "/projects", "/reports", "/teams", "/settings", "/admin", "/company-hierarchy", "/login", "/register"];
  if (systemPaths.includes(path)) {
    return false;
  }

  const routeKey = path.startsWith('/') ? path.substring(1) : path;
  const features = profile?.features || {};

  // Ventilation is enabled by default (unlocked unless explicitly set to false)
  if (routeKey === 'ventilation') {
    return features.ventilation === false;
  }

  // All other features are disabled by default (locked unless explicitly set to true)
  
  // Legacy groupings backwards compatibility
  if (path === '/cable-voltage-drop' || path === '/busbar-voltage-drop') {
    return features.voltageDrop !== true;
  }
  if (path === '/project-load-schedule') {
    return features.loadSchedule !== true;
  }
  if (path === '/cable-tray-sizing' || path === '/conductor-sizing') {
    return features.cableSizing !== true;
  }
  if (path === '/short-circuit-calculations') {
    return features.shortCircuit !== true;
  }

  return features[routeKey] !== true;
};
