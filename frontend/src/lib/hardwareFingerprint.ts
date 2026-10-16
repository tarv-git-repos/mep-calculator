/**
 * Hardware Fingerprint Generator for MEP Calculator
 * Combines browser/system hardware properties into a unique, deterministic 
 * hash for physical device binding.
 */

function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).toUpperCase();
}

export function getHardwareFingerprint(): string {
  if (typeof window === "undefined") {
    return "NODE_SERVER_ENVIRONMENT";
  }

  try {
    const cached = localStorage.getItem("mep_stable_hwid_v2");
    if (cached && cached.startsWith("HWID-")) {
      return cached;
    }

    const nav = window.navigator as any;

    // Static, deterministic hardware parameters unique to physical machine & browser environment
    const platform = nav.platform || "";
    const hardwareConcurrency = nav.hardwareConcurrency || 4;
    const deviceMemory = nav.deviceMemory || 8;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const language = nav.language || "";

    const rawString = [
      "MEP-PHYSICAL-HWID-V2",
      platform,
      hardwareConcurrency,
      deviceMemory,
      timezone,
      language
    ].join("||");

    const hash1 = cyrb53(rawString, 42);
    const hash2 = cyrb53(rawString, 1337);
    const generated = `HWID-${hash1}-${hash2}`;

    localStorage.setItem("mep_stable_hwid_v2", generated);
    return generated;
  } catch (err) {
    return "HWID-FALLBACK-DEVICE-0001";
  }
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    return "SERVER_DEV_ID";
  }
  try {
    let id = sessionStorage.getItem("mep_session_device_id");
    if (!id) {
      id = localStorage.getItem("mep_persistent_device_id");
    }
    if (!id) {
      const hwid = getHardwareFingerprint();
      const randomSuffix = Math.random().toString(36).substring(2, 9);
      id = `${hwid}_${Date.now()}_${randomSuffix}`;
      localStorage.setItem("mep_persistent_device_id", id);
      sessionStorage.setItem("mep_session_device_id", id);
    }
    return id;
  } catch (e) {
    return getHardwareFingerprint();
  }
}
