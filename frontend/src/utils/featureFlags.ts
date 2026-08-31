import { Profile } from "@/contexts/AuthContext";

export const DEFAULT_UNLOCKED_FEATURES = [
  'preliminary-cooling-load',
  'chw-pipe-sizer',
  'chw-pump-head',
  'ventilation',
  'fresh-air-cooling-load',
  'condensate-drain-calc',
  'condensate-drain',
  'plumbing-loading-unit',
  'plumbing-fixture-unit',
  'plumbing-water-demand',
  'plumbing-supply-pipe-sizer',
  'busbar-calculation',
  'busbar-voltage-drop',
  'generator-sizing',
  'cable-tray-sizing',
  'capacitor-bank-sizing',
  'lighting-lux-calculation',
  'project-load-schedule',
  'load-summary'
];

export const isFeatureLocked = (path: string | undefined, profile?: Profile | null): boolean => {
  if (!path) return false;
  
  // SUPER_ADMIN and ORG_ADMIN should never be locked out of admin or hierarchy pages
  if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN') {
    if (path === '/admin' || path === '/company-hierarchy') return false;
  }

  // System pages should never be locked
  const systemPaths = ["", "/", "/projects", "/bim-viewer", "/reports", "/notifications", "/teams", "/settings", "/admin", "/company-hierarchy", "/login", "/register"];
  if (systemPaths.includes(path)) {
    return false;
  }

  const rawKey = path.startsWith('/') ? path.substring(1) : path;
  const routeKey = rawKey.split('?')[0].toLowerCase().replace(/\/$/, '');
  const features = profile?.features || {};

  // Unlocked by default during development (unconditional for unlocked features)
  if (DEFAULT_UNLOCKED_FEATURES.includes(routeKey)) {
    return false;
  }

  // Check if explicitly set in user features (from SuperAdmin App Permissions toggle)
  if (features[routeKey] !== undefined) {
    return features[routeKey] === false;
  }

  // Legacy groupings backwards compatibility fallback if routeKey was not explicitly toggled
  if (routeKey === 'cable-voltage-drop' || routeKey === 'busbar-voltage-drop') {
    if (features.voltageDrop === true) return false;
  }
  if (routeKey === 'project-load-schedule') {
    if (features.loadSchedule === true) return false;
  }
  if (routeKey === 'cable-tray-sizing' || routeKey === 'conductor-sizing') {
    if (features.cableSizing === true) return false;
  }
  if (routeKey === 'short-circuit-calculations') {
    if (features.shortCircuit === true) return false;
  }

  // All other features are disabled by default (locked unless explicitly set to true)
  return true;
};
