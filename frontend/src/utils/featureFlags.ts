import { Profile } from "@/contexts/AuthContext";

export const DEFAULT_UNLOCKED_FEATURES = [
  'ventilation',
  'preliminary-cooling-load',
  'plumbing-loading-unit',
  'busbar-calculation',
  'plumbing-sprinkler-kfactor',
  'k-factor',
  'plumbing-sprinkler-density',
  'sprinkler-density',
  'chw-pipe-sizer',
  'chw-pump-head',
  'condensate-drain',
  'condensate-drain-calc',
  'condensate',
  'condensate-calc'
];

export const isFeatureLocked = (path: string | undefined, profile?: Profile | null): boolean => {
  if (!path) return false;

  // System pages should never be locked
  const systemPaths = ["", "/", "/dashboard", "/projects", "/bim-viewer", "/3d-view", "/reports", "/notifications", "/teams", "/settings", "/admin", "/company-hierarchy", "/login", "/register", "/privacy", "/reset-password"];
  if (systemPaths.includes(path) || systemPaths.includes(`/${path.replace(/^\//, '')}`)) {
    return false;
  }

  // SUPER_ADMIN accounts bypass feature locks unless explicitly toggled off in permissions
  if (profile?.role === 'SUPER_ADMIN') {
    const rawKey = path.startsWith('/') ? path.substring(1) : path;
    const routeKey = rawKey.split('?')[0].toLowerCase().replace(/\/$/, '');
    if (profile?.features && profile.features[routeKey] === false) {
      return true;
    }
    return false;
  }

  // Subscription expiry check (non-SUPER_ADMIN)
  const expStr = profile?.subscription_expires || profile?.features?.subscription_expires;
  if (expStr && typeof expStr === 'string') {
    const expDate = new Date(expStr);
    if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
      return true;
    }
  }

  const rawKey = path.startsWith('/') ? path.substring(1) : path;
  const routeKey = rawKey.split('?')[0].toLowerCase().replace(/\/$/, '');

  // Keep Loading Unit, Fixture Unit, CHW Pipe Sizer, CHW Pump Head, Sprinkler Density & Condensate Drain Calculators unlocked for everyone right now
  if (
    routeKey === 'plumbing-loading-unit' ||
    routeKey === 'loading-unit' ||
    routeKey === 'plumbing-fixture-unit' ||
    routeKey === 'fixture-unit' ||
    routeKey === 'chw-pipe-sizer' ||
    routeKey === 'chw-pump-head' ||
    routeKey === 'plumbing-sprinkler-density' ||
    routeKey === 'sprinkler-density' ||
    routeKey === 'condensate-drain' ||
    routeKey === 'condensate-drain-calc' ||
    routeKey === 'condensate' ||
    routeKey === 'condensate-calc'
  ) {
    return false;
  }
  const features = profile?.features || {};

  // Check if explicitly set in user features (from SuperAdmin App Permissions toggle)
  if (features[routeKey] !== undefined) {
    return features[routeKey] === false;
  }

  // Legacy groupings backwards compatibility fallback if routeKey was not explicitly toggled
  if (routeKey === 'cable-voltage-drop' || routeKey === 'busbar-voltage-drop') {
    if (features.voltageDrop === false) return true;
    if (features.voltageDrop === true) return false;
  }
  if (routeKey === 'project-load-schedule') {
    if (features.loadSchedule === false) return true;
    if (features.loadSchedule === true) return false;
  }
  if (routeKey === 'cable-tray-sizing' || routeKey === 'conductor-sizing') {
    if (features.cableSizing === false) return true;
    if (features.cableSizing === true) return false;
  }
  if (routeKey === 'short-circuit-calculations') {
    if (features.shortCircuit === false) return true;
    if (features.shortCircuit === true) return false;
  }

  // Fallback to default unlocked features list for untoggled modules
  if (DEFAULT_UNLOCKED_FEATURES.includes(routeKey)) {
    return false;
  }

  return true;
};
