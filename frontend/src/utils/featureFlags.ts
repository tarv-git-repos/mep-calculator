import { Profile } from "@/contexts/AuthContext";

export const isFeatureLocked = (path: string | undefined, profile?: Profile | null): boolean => {
  if (!path) return false;
  
  // If the profile features are not loaded, or the user is not logged in, fallback to locked
  // SUPER_ADMIN should never be locked out
  if (profile?.role === 'SUPER_ADMIN') return false;

  const features = profile?.features || {};
  
  // Legacy groupings backwards compatibility
  if ((path === '/cable-voltage-drop' || path === '/busbar-voltage-drop') && features.voltageDrop === false) return true;
  if (path === '/project-load-schedule' && features.loadSchedule === false) return true;
  if ((path === '/cable-tray-sizing' || path === '/conductor-sizing') && features.cableSizing === false) return true;
  if (path === '/short-circuit-calculations' && features.shortCircuit === false) return true;

  // Dynamic path-based check
  const routeKey = path.startsWith('/') ? path.substring(1) : path;
  if (features[routeKey] === false) {
    return true;
  }

  return false;
};
