import React, { useState } from "react";
import { X, Check, ShieldCheck, Zap, Key, CreditCard, Sparkles, AlertTriangle, Lock, Copy } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import { getHardwareFingerprint } from "@/lib/hardwareFingerprint";
import { useAuth } from "@/contexts/AuthContext";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentStatus?: any;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onSuccess, currentStatus }) => {
  const { userData } = useAuth();
  const userEmail = userData?.email || "";
  const hwid = getHardwareFingerprint();

  const [selectedPlan, setSelectedPlan] = useState<"PRO_MONTHLY" | "PRO_ANNUAL" | "ENTERPRISE">("PRO_ANNUAL");
  const [checkoutStep, setCheckoutStep] = useState<"SELECT" | "PAYMENT" | "SUCCESS">("SELECT");
  const [loading, setLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string>("");

  // Existing key activation input
  const [inputKey, setInputKey] = useState("");
  const [activating, setActivating] = useState(false);

  // Promo Code
  const [promoInput, setPromoInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; percent: number } | null>(null);

  const PROMO_CODES: Record<string, number> = {
    "MEP50": 0.5, // 50% off
    "WELCOME20": 0.2, // 20% off
    "FREE100": 1.0, // 100% off
  };

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (PROMO_CODES[code]) {
      setAppliedDiscount({ code, percent: PROMO_CODES[code] });
      toast.success(`Promo code ${code} applied! ${PROMO_CODES[code] * 100}% off.`);
    } else {
      toast.error("Invalid or expired promo code.");
      setAppliedDiscount(null);
    }
  };

  if (!isOpen) return null;

  const plans = [
    {
      id: "PRO_MONTHLY",
      name: "Pro Monthly",
      tier: "PRO",
      durationDays: 30,
      price: "$29",
      billing: "per month",
      popular: false,
      features: [
        "Full access to all 25+ MEP calculation modules",
        "Clean exports without DEMO watermarks",
        "Hardware fingerprinted license seat",
        "Export to PDF, Excel, & CAD",
        "Email support",
      ],
    },
    {
      id: "PRO_ANNUAL",
      name: "Pro Annual",
      tier: "PRO",
      durationDays: 365,
      price: "$249",
      billing: "per year (Save 30%)",
      popular: true,
      features: [
        "Everything in Pro Monthly",
        "Priority calculation engine speed",
        "Automatic cloud sync & team sharing",
        "Priority 24/7 dedicated support",
        "Free minor & major updates",
      ],
    },
    {
      id: "ENTERPRISE",
      name: "Enterprise Multi-Seat",
      tier: "ENTERPRISE",
      durationDays: 365,
      price: "$599",
      billing: "per year / 5 Seats",
      popular: false,
      features: [
        "Up to 5 multi-device hardware seats",
        "Custom company watermark branding on exports",
        "Real-time cloud collaboration rooms",
        "Dedicated account manager",
        "Custom code standards integration",
      ],
    },
  ];

  const targetPlan = plans.find((p) => p.id === selectedPlan) || plans[1];
  
  const getFinalPrice = () => {
    const originalPrice = parseFloat(targetPlan.price.replace("$", ""));
    if (appliedDiscount) {
      return `$${(originalPrice * (1 - appliedDiscount.percent)).toFixed(2)}`;
    }
    return targetPlan.price;
  };

  const handleMockPayment = async () => {
    if (!userEmail) {
      toast.error("Please sign in or enter your email to bind the license key.");
      return;
    }

    setLoading(true);
    try {
      const res = await authService.checkoutPlan(userEmail, targetPlan.tier, targetPlan.durationDays, hwid);
      if (res && res.success) {
        setGeneratedKey(res.key);
        setCheckoutStep("SUCCESS");
        toast.success("Payment completed! License key generated and bound to your email.");
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.message || "Payment checkout failed. Please try again.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error processing checkout");
    } finally {
      setLoading(false);
    }
  };

  const handleActivateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      toast.error("Please enter a valid license key.");
      return;
    }

    setActivating(true);
    try {
      const res = await authService.activateLicenseKey(inputKey.trim(), userEmail, hwid);
      if (res && res.success) {
        toast.success(res.message || "License key activated successfully!");
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(res.message || "Invalid or expired license key.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error activating key.");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div className="relative w-full max-w-4xl bg-[#090d16] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Zap className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                MEP Calculator Pro Licensing
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  HWID Fingerprinted
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Device Fingerprint: <code className="font-mono text-neutral-300">{hwid.slice(0, 18)}...</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl border border-white/10 hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {checkoutStep === "SELECT" && (
            <>
              {/* Plan Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => {
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id as any)}
                      className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-lg shadow-primary/10"
                          : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                          Most Popular
                        </div>
                      )}
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-white">{plan.name}</h3>
                          {isSelected && <Check className="size-4 text-primary" />}
                        </div>
                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-white">{plan.price}</span>
                          <span className="text-xs text-neutral-400">{plan.billing}</span>
                        </div>
                        <ul className="mt-4 space-y-2 text-xs text-neutral-300">
                          {plan.features.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlan(plan.id as any);
                          setCheckoutStep("PAYMENT");
                        }}
                        className={`mt-6 w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                          isSelected
                            ? "bg-primary text-primary-foreground hover:opacity-95"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        Purchase {plan.name}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Enter Existing Key Box */}
              <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Key className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Already have a License Key?</h4>
                    <p className="text-[11px] text-neutral-400">
                      Enter your unique key (formatted <code className="font-mono text-amber-300">MEP-PRO-XXXX-XXXX-XXXX</code>) to activate.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleActivateKey} className="flex items-center gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="MEP-PRO-XXXX-XXXX-XXXX"
                    className="h-9 px-3 bg-black/40 border border-white/15 rounded-xl text-xs font-mono text-white placeholder:text-neutral-500 outline-none focus:border-amber-400 w-full md:w-60"
                  />
                  <button
                    type="submit"
                    disabled={activating}
                    className="h-9 px-4 bg-amber-500 text-black hover:bg-amber-400 font-bold text-xs rounded-xl transition cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {activating ? "Activating..." : "Activate Key"}
                  </button>
                </form>
              </div>
            </>
          )}

          {checkoutStep === "PAYMENT" && (
            <div className="max-w-xl mx-auto space-y-5 animate-fade-in">
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Selected Plan</span>
                  <h3 className="text-base font-bold text-white">{targetPlan.name} ({targetPlan.price})</h3>
                </div>
                <button
                  onClick={() => setCheckoutStep("SELECT")}
                  className="text-xs text-neutral-400 hover:text-white underline cursor-pointer"
                >
                  Change Plan
                </button>
              </div>

              {/* Mock Checkout Box */}
              <div className="p-5 bg-white/[0.02] border border-white/10 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <CreditCard className="size-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Payment Gateway (Mock Checkout)</h4>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-400 mb-1">Registered Account Email</label>
                    <input
                      type="email"
                      value={userEmail}
                      readOnly
                      className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-xl text-xs text-neutral-300 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">Card / Payment Method</label>
                      <input
                        type="text"
                        value="•••• •••• •••• 4242 (Test Gateway)"
                        readOnly
                        className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-xl text-xs text-neutral-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-neutral-400 mb-1">Expiry / CVV</label>
                      <input
                        type="text"
                        value="12/28 - 123"
                        readOnly
                        className="w-full h-9 px-3 bg-black/40 border border-white/10 rounded-xl text-xs text-neutral-300 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Promo Code (e.g. MEP50)"
                    className="flex-1 h-9 px-3 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder:text-neutral-500 outline-none focus:border-primary uppercase"
                  />
                  <button
                    onClick={handleApplyPromo}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl transition cursor-pointer"
                  >
                    Apply
                  </button>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <Lock className="size-3.5" />
                    <span>Instant Unique License Binding to {userEmail}</span>
                  </div>

                  <button
                    onClick={handleMockPayment}
                    disabled={loading}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? "Processing Payment..." : (
                      <>
                        Complete Payment 
                        <span className="bg-black/20 px-2 py-0.5 rounded text-[10px]">
                          {appliedDiscount ? (
                            <>
                              <span className="line-through text-black/50 mr-1">{targetPlan.price}</span>
                              {getFinalPrice()}
                            </>
                          ) : (
                            getFinalPrice()
                          )}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {checkoutStep === "SUCCESS" && (
            <div className="max-w-md mx-auto text-center space-y-5 animate-fade-in py-6">
              <div className="size-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <Sparkles className="size-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">License Key Generated & Activated!</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Your unique non-repeatable key is bound to <span className="text-emerald-400 font-mono">{userEmail}</span> and saved in Supabase.
                </p>
              </div>

              <div className="p-4 bg-black/60 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3">
                <code className="text-base font-mono font-bold text-emerald-400 tracking-widest">{generatedKey}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKey);
                    toast.success("License key copied to clipboard!");
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                  title="Copy Key"
                >
                  <Copy className="size-4" />
                </button>
              </div>

              <button
                onClick={() => {
                  onClose();
                  if (onSuccess) onSuccess();
                }}
                className="w-full py-3 bg-primary text-primary-foreground font-bold text-xs rounded-xl transition cursor-pointer shadow-md"
              >
                Return to Calculator
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
