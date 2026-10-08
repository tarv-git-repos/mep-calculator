import { Profile } from "@/contexts/AuthContext";

export const DEFAULT_UNLOCKED_FEATURES = [
  // HVAC
  'ventilation',
  'preliminary-cooling-load',
  'preliminary-cooling',
  'fresh-air-cooling-load',
  'fresh-air-cooling',
  'fresh-air',
  'fresh-air-load',
  'chw-pump-head',
  'condensate-drain-calc',
  'condensate-calc',
  'heating-load',
  'heating',
  'heating-calc',
  'heating-load-calc',
  'lobby-pressurisation',
  'lobby-pressurization',
  'staircase-pressurization',
  'liftwell-pressurization',
  'smoke-extract-fan',
  'smoke-extract',
  'basement-smoke-calc',
  'basement-smoke',
  'duct-sizer',
  'duct-sizing',
  'ductsizer',
  'refrigerant-pipe-sizing',
  'refrigerant-pipe',
  'ref-pipe',
  'refrigerant-sizing',
  'refrigerant',
  'condensate-drain',
  'condensate',
  'chw-pipe-sizer',
  'diffuser-selector',
  'diffuser',
  'diffuser-selection',
  'psychrometric',
  'psychrometric-calculator',
  'psychrometric-calc',
  'sanity-check-tool',
  'sanity-check',

  // ELECTRICAL (Fully Unlocked)
  'central-battery-sizing',
  'central-battery',
  'centralbattery',
  'ups-sizing-calculation',
  'ups-sizing',
  'ups',
  'generator-sizing',
  'generator',
  'lighting-lux-calculation',
  'lighting-lux',
  'lux-calculation',
  'lux',
  'lighting',
  'lpd-calculation',
  'lpd',
  'lpd-calc',
  'transformer-sizing',
  'transformer',
  'circuit-breaker-sizing',
  'circuit-breaker',
  'breaker-sizing',
  'busbar-calculation',
  'busbar',
  'cable-tray-sizing',
  'cable-tray',
  'cable-sizing',
  'cablesizing',
  'capacitor-bank-sizing',
  'capacitor-bank',
  'capacitor',
  'conductor-sizing',
  'conductor',
  'cable-voltage-drop',
  'cable-voltage',
  'voltage-drop',
  'busbar-voltage-drop',
  'busbar-voltage',
  'short-circuit-calculations',
  'short-circuit',
  'shortcircuit',
  'load-summary',
  'loadsummary',
  'project-load-schedule',
  'load-schedule',
  'project-load',

  // FIRE FIGHTING
  'plumbing-sprinkler-kfactor',
  'k-factor',
  'sprinkler-kfactor',
  'plumbing-sprinkler-density',
  'sprinkler-density',
  'sprinkler-density-flow',
  'plumbing-hazen-williams',
  'hazen-williams',
  'hazen',
  'hazenwilliams',
  'plumbing-fm200',
  'fm200',
  'fm-200',
  'plumbing-fm-200',
  'plumbing-fire-water-demand',
  'fire-water-demand',
  'firewaterdemand',
  'plumbing-fire-water',
  'plumbing-fire-pump-duty',
  'fire-pump-duty',
  'firepumpduty',
  'fire-pump',
  'plumbing-fire-pump',
  'plumbing-fire-tank-capacity',
  'fire-tank-capacity',
  'firetankcapacity',
  'plumbing-fire-tank',
  'plumbing-fire-tank-duration',
  'fire-tank-duration',
  'tank-duration',
  'fire-tank',
  'plumbing-tank-duration',

  // PLUMBING
  'plumbing-water-demand',
  'water-demand',
  'plumbing-fixture-unit',
  'fixture-unit',
  'plumbing-loading-unit',
  'loading-unit',
  'plumbing-supply-pipe-sizer',
  'supply-pipe-sizer',
  'supply-pipe',
  'plumbing-pump-sizing',
  'pump-sizing',
  'plumbing-pressure-vessel',
  'pressure-vessel',
  'pressure-vessel-sizing',
  'plumbing-sump-pump',
  'sump-pump',
  'plumbing-drainage',
  'drainage',
  'drainage-sizing',
  'drainage-pipe-sizing',
  'plumbing-drainage-sizing',
  'plumbing-discharge-unit',
  'discharge-unit',
  'plumbing-sewage-pump',
  'sewage-pump',
  'sewage-pump-sizing',
  'sewagepump',
  'plumbing-storm-water',
  'storm-water',
  'stormwater',
  'storm-water-sizing',
  'storm-water-runoff',
  'plumbing-tank-sizing',
  'tank-sizing',
  'water-tank-sizing',
  'tank',
  'plumbing-gas-tank',
  'gas-tank',
  'gas-storage',
  'gas-storage-capacity',
  'gas-tank-sizing'
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
    let expDate = new Date(expStr);
    
    // Fix DD/MM/YYYY or DD-MM-YYYY formats parsing as MM/DD/YYYY
    if (!isNaN(expDate.getTime()) && /^\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(expStr)) {
      const parts = expStr.split(/[\/\-T ]/);
      if (parts.length >= 3) {
        expDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`);
      }
    }

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

  // Legacy groupings backwards compatibility fallback if routeKey was explicitly toggled
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

  // All standard calculators in DEFAULT_UNLOCKED_FEATURES are unlocked by default
  if (DEFAULT_UNLOCKED_FEATURES.includes(routeKey)) {
    return false;
  }

  // Default to unlocked for all active application routes
  return false;
};
