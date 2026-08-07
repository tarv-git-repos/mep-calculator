import { authService } from "@/services/authService";
import { getHardwareFingerprint } from "@/lib/hardwareFingerprint";

export interface LicenseStatusInfo {
  plan: "FREE" | "PRO" | "ENTERPRISE";
  status: "ACTIVE" | "FREE_TRIAL" | "EXPIRED_TRIAL" | "UNLICENSED";
  key?: string;
  expiresAt?: number;
  remainingDays: number;
  watermark: string;
  sessionInvalidated?: boolean;
}

export async function fetchLicenseStatus(email?: string): Promise<LicenseStatusInfo> {
  try {
    const hwid = getHardwareFingerprint();
    const res = await authService.getLicenseStatus(hwid, email);
    
    if (res && res.sessionInvalidated) {
      return {
        plan: "FREE",
        status: "UNLICENSED",
        remainingDays: 0,
        watermark: "SESSION_INVALIDATED",
        sessionInvalidated: true,
      };
    }

    if (res && res.success) {
      return {
        plan: res.plan || "FREE",
        status: res.status || "FREE_TRIAL",
        key: res.key,
        expiresAt: res.expiresAt,
        remainingDays: res.remainingDays ?? 0,
        watermark: res.watermark || "FREE TRIAL",
      };
    }
  } catch (err) {}
  
  return {
    plan: "FREE",
    status: "UNLICENSED",
    remainingDays: 0,
    watermark: "UNLICENSED / DEMO VERSION",
  };
}

export async function getLicenseWatermark(email?: string): Promise<string> {
  const status = await fetchLicenseStatus(email);
  return status.watermark;
}
