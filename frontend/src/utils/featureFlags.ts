import { Profile } from "@/contexts/AuthContext";

export const DEFAULT_UNLOCKED_FEATURES = [
  'dashboard',
  '3d-view',
  'preliminary-cooling-load',
  'chw-pipe-sizer',
  'chw-pump-head',
  'ventilation',
  'fresh-air-cooling-load',
  'condensate-drain-calc',
  'heating-load',
  'lobby-pressurisation',
  'staircase-pressurization',
  'smoke-extract-fan',
  'basement-smoke-calc',
  'duct-sizer',
  'diffuser-selector',
  'refrigerant-pipe-sizing',
  'condensate-drain',
  'sanity-check-tool',
  'psychrometric',
  'central-battery-sizing',
  'ups-sizing-calculation',
  'generator-sizing',
  'lighting-lux-calculation',
  'lpd-calculation',
  'transformer-sizing',
  'circuit-breaker-sizing',
  'busbar-calculation',
  'cable-tray-sizing',
  'capacitor-bank-sizing',
  'conductor-sizing',
  'cable-voltage-drop',
  'busbar-voltage-drop',
  'short-circuit-calculations',
  'load-summary',
  'project-load-schedule',
  'plumbing-loading-unit',
  'plumbing-fixture-unit',
  'plumbing-water-demand',
  'plumbing-supply-pipe-sizer',
  'plumbing-pump-sizing',
  'plumbing-pressure-vessel',
  'plumbing-sump-pump',
  'plumbing-drainage',
  'plumbing-discharge-unit',
  'plumbing-sewage-pump',
  'plumbing-storm-water',
  'plumbing-tank-sizing',
  'plumbing-gas-tank',
  'plumbing-sprinkler-kfactor',
  'k-factor',
  'plumbing-sprinkler-density',
  'plumbing-hazen-williams',
  'plumbing-fm200',
  'plumbing-fire-water-demand',
  'plumbing-fire-pump-duty',
  'plumbing-fire-tank-capacity',
  'plumbing-fire-tank-duration'
];

export const isFeatureLocked = (path: string | undefined, profile?: Profile | null): boolean => {
  if (!path) return false;
  
  // SUPER_ADMIN and ORG_ADMIN should never be locked out of admin or hierarchy pages
  if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN') {
    return false;
  }

  // System pages should never be locked
  const systemPaths = ["", "/", "/dashboard", "/projects", "/bim-viewer", "/3d-view", "/reports", "/notifications", "/teams", "/settings", "/admin", "/company-hierarchy", "/login", "/register", "/privacy", "/reset-password"];
  if (systemPaths.includes(path) || systemPaths.includes(`/${path.replace(/^\//, '')}`)) {
    return false;
  }

  // Subscription expiry check (non-SUPER_ADMIN)
  const expStr = profile?.subscription_expires || profile?.features?.subscription_expires;
  if (profile?.role !== 'SUPER_ADMIN' && expStr) {
    const expDate = new Date(expStr);
    if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
      return true;
    }
  }

  const rawKey = path.startsWith('/') ? path.substring(1) : path;
  const routeKey = rawKey.split('?')[0].toLowerCase().replace(/\/$/, '');
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
  if (routeKey.startsWith('plumbing-sprinkler') || routeKey.startsWith('plumbing-fire') || routeKey === 'plumbing-hazen-williams' || routeKey === 'plumbing-fm200' || routeKey === 'k-factor') {
    if (features.fireFighting === false || features.kfactor === false || features.sprinkler === false) return true;
    if (features.fireFighting === true || features.kfactor === true || features.sprinkler === true) return false;
  }

  // Fallback to default unlocked features list for untoggled modules
  if (DEFAULT_UNLOCKED_FEATURES.includes(routeKey)) {
    return false;
  }

  return true;
};
