import { Profile } from "@/contexts/AuthContext";

export const DEFAULT_UNLOCKED_FEATURES = [
  'ventilation',
  'preliminary-cooling-load',
  'fresh-air-cooling-load',
  'fresh-air-cooling',
  'fresh-air',
  'fresh-air-load',
  'plumbing-loading-unit',
  'plumbing-water-demand',
  'water-demand',
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
  'condensate-calc',
  'generator-sizing',
  'generator',
  'cable-tray-sizing',
  'cable-tray',
  'cable-sizing',
  'cablesizing',
  'smoke-extract-fan',
  'smoke-extract',
  'basement-smoke-calc',
  'basement-smoke',
  'lobby-pressurisation',
  'staircase-pressurization',
  'psychrometric',
  'psychrometric-calculator',
  'psychrometric-calc',
  'sanity-check-tool',
  'sanity-check',
  'diffuser-selector',
  'diffuser',
  'diffuser-selection',
  'duct-sizer',
  'duct-sizing',
  'ductsizer',
  'plumbing-fm200',
  'fm200',
  'fm-200',
  'plumbing-fm-200',
  'plumbing-fire-water-demand',
  'fire-water-demand',
  'firewaterdemand',
  'plumbing-fire-water',
  'plumbing-sewage-pump',
  'sewage-pump',
  'sewage-pump-sizing',
  'sewagepump',
  'heating-load',
  'heating',
  'heating-calc',
  'heating-load-calc',
  'plumbing-drainage',
  'drainage',
  'drainage-sizing',
  'drainage-pipe-sizing',
  'plumbing-drainage-sizing',
  'plumbing-pump-sizing',
  'pump-sizing'
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

  const features = profile?.features || {};

  // Check if explicitly set in user features (from SuperAdmin App Permissions toggle)
  if (features[routeKey] !== undefined) {
    return features[routeKey] === false;
  }

  // Keep Cable Tray Sizing, Water Demand, Loading Unit, Fixture Unit, CHW Pipe Sizer, CHW Pump Head, Sprinkler Density, Condensate Drain, Smoke Extract & Psychrometric Calculators unlocked for everyone by default
  if (
    routeKey === 'fresh-air-cooling-load' ||
    routeKey === 'fresh-air-cooling' ||
    routeKey === 'fresh-air' ||
    routeKey === 'fresh-air-load' ||
    routeKey === 'cable-tray-sizing' ||
    routeKey === 'cable-tray' ||
    routeKey === 'cable-sizing' ||
    routeKey === 'cablesizing' ||
    routeKey === 'plumbing-water-demand' ||
    routeKey === 'water-demand' ||
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
    routeKey === 'condensate-calc' ||
    routeKey === 'smoke-extract-fan' ||
    routeKey === 'smoke-extract' ||
    routeKey === 'basement-smoke-calc' ||
    routeKey === 'basement-smoke' ||
    routeKey === 'lobby-pressurisation' ||
    routeKey === 'staircase-pressurization' ||
    routeKey === 'psychrometric' ||
    routeKey === 'psychrometric-calc' ||
    routeKey === 'psychrometric-calculator' ||
    routeKey === 'sanity-check-tool' ||
    routeKey === 'sanity-check' ||
    routeKey === 'diffuser-selector' ||
    routeKey === 'diffuser' ||
    routeKey === 'diffuser-selection' ||
    routeKey === 'duct-sizer' ||
    routeKey === 'duct-sizing' ||
    routeKey === 'ductsizer' ||
    routeKey === 'plumbing-fm200' ||
    routeKey === 'fm200' ||
    routeKey === 'fm-200' ||
    routeKey === 'plumbing-fm-200' ||
    routeKey === 'plumbing-fire-water-demand' ||
    routeKey === 'fire-water-demand' ||
    routeKey === 'firewaterdemand' ||
    routeKey === 'plumbing-fire-water' ||
    routeKey === 'plumbing-sewage-pump' ||
    routeKey === 'sewage-pump' ||
    routeKey === 'sewage-pump-sizing' ||
    routeKey === 'sewagepump' ||
    routeKey === 'heating-load' ||
    routeKey === 'heating' ||
    routeKey === 'heating-calc' ||
    routeKey === 'heating-load-calc' ||
    routeKey === 'plumbing-drainage' ||
    routeKey === 'drainage' ||
    routeKey === 'drainage-sizing' ||
    routeKey === 'drainage-pipe-sizing' ||
    routeKey === 'plumbing-drainage-sizing' ||
    routeKey === 'plumbing-pump-sizing' ||
    routeKey === 'pump-sizing'
  ) {
    return false;
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
