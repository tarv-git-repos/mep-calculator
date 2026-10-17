import React, { useState } from "react";
import { X, Key, CheckCircle2, AlertCircle, Loader2, Sparkles, Building2 } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import { getHardwareFingerprint } from "@/lib/hardwareFingerprint";
import { useAuth } from "@/contexts/AuthContext";

interface EnterLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isExpired?: boolean;
  onOpenPricing?: () => void;
}

export const EnterLicenseModal: React.FC<EnterLicenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isExpired = false,
  onOpenPricing,
}) => {
  const { userData, profile, getUserData } = useAuth();
  const userEmail = userData?.email || profile?.email || "";
  const hwid = getHardwareFingerprint();

  const [inputKey, setInputKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{
    orgName?: string;
    plan?: string;
    expiresAt?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = inputKey.trim();
    if (!cleanKey) {
      toast.error("Please enter your license key.");
      return;
    }

    setActivating(true);
    try {
      const res = await authService.activateLicenseKey(cleanKey, userEmail, hwid);
      if (res && res.success) {
        const activatedOrgName = res.organization || res.company || res.organization_name;
        const activatedOrgId = res.organization_id || res.orgId;

        // Persist organization binding immediately in local caches
        try {
          const currentUserStr = localStorage.getItem("mep_user");
          if (currentUserStr) {
            const u = JSON.parse(currentUserStr);
            if (activatedOrgId) u.organization_id = activatedOrgId;
            if (activatedOrgName) {
              u.organization_name = activatedOrgName;
              u.organization = activatedOrgName;
              u.company = activatedOrgName;
            }
            if (!u.features) u.features = {};
            if (activatedOrgId) u.features.organization_id = activatedOrgId;
            if (activatedOrgName) {
              u.features.organization_name = activatedOrgName;
              u.features.company = activatedOrgName;
            }
            u.plan = res.plan || res.tier || "PRO";
            localStorage.setItem("mep_user", JSON.stringify(u));
            if (u.id && activatedOrgName) {
              localStorage.setItem(`mep_user_company_${u.id}`, activatedOrgName);
            }
          }

          const localUsersStr = localStorage.getItem("mep_local_users");
          if (localUsersStr) {
            const usersArr = JSON.parse(localUsersStr);
            const updatedUsers = usersArr.map((u: any) => {
              if (u.email && u.email.toLowerCase() === (userEmail || "").toLowerCase()) {
                return {
                  ...u,
                  ...(activatedOrgId ? { organization_id: activatedOrgId } : {}),
                  ...(activatedOrgName ? { organization_name: activatedOrgName, company: activatedOrgName } : {}),
                  plan: res.plan || res.tier || "PRO",
                };
              }
              return u;
            });
            localStorage.setItem("mep_local_users", JSON.stringify(updatedUsers));
          }
        } catch (e) {
          console.warn("Storage sync warning", e);
        }

        setSuccessInfo({
          orgName: activatedOrgName,
          plan: res.plan || res.tier || "ENTERPRISE",
          expiresAt: res.expiresAt,
        });

        toast.success(res.message || "License activated successfully!");

        if (getUserData) {
          try {
            await getUserData();
          } catch (e) {}
        }

        window.dispatchEvent(new CustomEvent("mep_user_profile_updated"));
        if (onSuccess) onSuccess();

        // Close after brief success confirmation
        setTimeout(() => {
          onClose();
          setSuccessInfo(null);
        }, 1800);
      } else {
        toast.error(res?.message || "Invalid or expired license key.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "Error activating license key.");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-lg bg-card dark:bg-[#111318] border border-border dark:border-[#272a33] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border/80 dark:border-[#272a33] flex items-center justify-between bg-muted/30 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Key className="size-4.5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground dark:text-white">Enter License</h2>
              <p className="text-xs text-muted-foreground">MEP Calculator License Activation</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-transparent hover:border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {isExpired && !successInfo && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>
                Your <strong>14-day Free Trial</strong> has expired. Please enter the license key provided by your organization admin to continue.
              </span>
            </div>
          )}

          {successInfo ? (
            <div className="py-4 text-center space-y-3 animate-in fade-in zoom-in-95">
              <div className="size-14 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="size-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground dark:text-white">License Validated & Active!</h3>
                {successInfo.orgName && (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center justify-center gap-1.5">
                    <Building2 className="size-3.5" />
                    <span>Bound to: {successInfo.orgName}</span>
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Plan: <span className="font-bold text-foreground">{successInfo.plan}</span> • Ready to use
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40">
                <div className="p-2 rounded-lg bg-purple-600 text-white shrink-0 shadow-xs">
                  <Key className="size-4" />
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-white mb-0.5">
                    Please enter your license key to continue.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Get this key from your company administrator (format: <code className="font-mono text-purple-600 dark:text-purple-400 font-bold">MEP-XXXX-XXXX-...</code>).
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="text"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                  placeholder="Paste your license key here"
                  autoFocus
                  className="flex-1 h-11 px-3.5 bg-background dark:bg-black/40 border border-border dark:border-white/15 rounded-xl text-xs font-mono font-bold tracking-wider placeholder:tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                />
                <button
                  type="submit"
                  disabled={activating || !inputKey.trim()}
                  className="h-11 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
                >
                  {activating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Validating...</span>
                    </>
                  ) : (
                    <span>Activate</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer note */}
          <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1 font-mono text-[10px]">
              Device HWID: {hwid.slice(0, 14)}...
            </span>
            {onOpenPricing && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPricing();
                }}
                className="text-primary hover:underline font-semibold cursor-pointer"
              >
                Purchase New License →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
