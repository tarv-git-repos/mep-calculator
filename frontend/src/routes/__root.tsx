if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).AsyncLocalStorage) {
    (globalThis as any).AsyncLocalStorage = class AsyncLocalStorage {
      getStore() { return undefined; }
      run(store: any, fn: any) { return fn(); }
      enterWith() {}
      disable() {}
    };
  }
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { dirtyStore } from "@/lib/dirty-store";
import { ConfirmProvider } from "@/hooks/use-confirm";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { useAutoBackup } from "@/hooks/useAutoBackup";
import { Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isFeatureLocked } from "@/utils/featureFlags";

import { PricingModal } from "@/components/workspace/PricingModal";
import { useState } from "react";
import { AutoUpdaterPopup } from "@/components/AutoUpdaterPopup";

function AuthGuard({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [safetyTimePassed, setSafetyTimePassed] = useState(false);
  const { session, profile, loading, isLoggedin, logout } = useAuth();
  const routerState = useRouterState();
  const [showPricing, setShowPricing] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => {
      setSafetyTimePassed(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  if ((!mounted || loading) && !safetyTimePassed) return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
      <div className="text-sky-400 font-medium">Loading session...</div>
    </div>
  );
  
  const isLoginPage = routerState.location.pathname === '/login';
  const isPrivacyPage = routerState.location.pathname === '/privacy';
  const isAdminPage = routerState.location.pathname.startsWith('/admin');
  
  if (!isLoggedin && !isLoginPage) {
    return <Navigate to="/login" replace />;
  }

  // Unverified user guard
  if (session && profile && !isLoginPage) {
    if (profile.isAccountVerified === false) {
      return <Navigate to="/login" replace />;
    }
  }

  // Primary Policy (EULA) Acceptance Gating for Authenticated Users (ID 1)
  if (session && profile && !isLoginPage && !isPrivacyPage) {
    const hasAccepted = profile.privacyPolicyAccepted === true ||
      (typeof window !== 'undefined' && localStorage.getItem('privacy_policy_accepted') === 'true');
    if (!hasAccepted) {
      return <Navigate to="/privacy" replace />;
    }
  }

  // Security & Smart Routing
  if (session && profile && !isLoginPage && !isPrivacyPage) {
    if (profile.role !== 'SUPER_ADMIN' && profile.role !== 'ORG_ADMIN' && isAdminPage) {
      return <Navigate to="/" replace />;
    }
  }

  // Subscription Enforcement
  if (session && profile && !isLoginPage && !isPrivacyPage) {
    if (profile.role !== 'SUPER_ADMIN' && profile.subscription_expires) {
      const expiryDate = new Date(profile.subscription_expires);
      if (new Date() > expiryDate) {
        return (
          <div className="flex flex-col h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
            <Clock className="w-16 h-16 text-amber-500 mb-4" />
            <h2 className="text-2xl font-bold">Subscription Expired</h2>
            <p className="text-muted-foreground mt-2 max-w-md">
              Your access to the MEP Calculator has expired. Please renew your subscription or contact your administrator to continue.
            </p>
            <div className="mt-8 p-4 bg-slate-200 dark:bg-slate-800 rounded-lg">
              <p className="text-sm">Expired on: {expiryDate.toLocaleDateString()}</p>
            </div>
            
            <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-sm">
              <button 
                onClick={() => setShowPricing(true)}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold shadow-md shadow-blue-500/20 hover:bg-blue-700 transition-all"
              >
                Renew Subscription
              </button>
              <button 
                onClick={async () => {
                  try {
                    await logout();
                    // We can also force a reload if context doesn't clear immediately
                    window.location.href = "/login";
                  } catch (e) {
                    console.error("Logout failed", e);
                  }
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-all"
              >
                Sign out
              </button>
            </div>
            
            {showPricing && <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} />}
          </div>
        );
      }
    }
  }
  
  return <>{children}</>;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const isKFactor = import.meta.env.VITE_APP_MODE === 'kfactor';
    const isFirefighting = import.meta.env.VITE_APP_MODE === 'firefighting';
    const isBasement = import.meta.env.VITE_APP_MODE === 'basement';
    
    let titleText = "Airflow \u2014 Ventilation Calculation Platform";
    let descText = "Enterprise MEP ventilation calculation platform for spaces, zones, and equipment at scale.";
    let authorText = "Airflow";

    if (isKFactor) {
      titleText = "Sprinkler K-Factor Calculator";
      descText = "Sprinkler K-Factor calculation platform for fire protection systems.";
      authorText = "K-Factor Calc";
    } else if (isFirefighting) {
      titleText = "Fire Fighting Sizing \u2014 MEP Calc";
      descText = "Fire Fighting sprinkler, hydraulics, and suppression calculation platform.";
      authorText = "MEP Fire Sizing";
    } else if (isBasement) {
      titleText = "Basement Smoke Sizing \u2014 MEP Calc";
      descText = "Basement smoke ventilation and fan head sizer.";
      authorText = "Basement Calc";
    }

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: titleText },
        { name: "description", content: descText },
        { name: "author", content: authorText },
        { property: "og:title", content: titleText },
        { property: "og:description", content: descText },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:site", content: "@Lovable" },
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return <>{children}</>;
  }

  let initialDark = false;
  if (typeof window !== "undefined") {
    try {
      const t = localStorage.getItem('mep_theme') || 'dark';
      if (t === 'dark') {
        initialDark = true;
      } else if (t === 'light') {
        initialDark = false;
      } else {
        initialDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch (e) {}
  }

  return (
    <html lang="en" className={initialDark ? "dark" : ""}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mep_theme')||'dark';var d=false;if(t==='dark')d=true;else if(t==='light')d=false;else d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ThemeWatcher() {
  useEffect(() => {
    const applyCurrentTheme = () => {
      if (typeof window === "undefined") return;
      const savedTheme = localStorage.getItem("mep_theme") || "dark";
      let isDark = false;
      if (savedTheme === "dark") {
        isDark = true;
      } else if (savedTheme === "light") {
        isDark = false;
      } else {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    applyCurrentTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const savedTheme = localStorage.getItem("mep_theme") || "dark";
      if (savedTheme === "system" || savedTheme === "dark") {
        applyCurrentTheme();
      }
    };

    const handleThemeEvent = () => applyCurrentTheme();

    mediaQuery.addEventListener("change", handleSystemChange);
    window.addEventListener("mep-theme-change", handleThemeEvent);
    window.addEventListener("storage", handleThemeEvent);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
      window.removeEventListener("mep-theme-change", handleThemeEvent);
      window.removeEventListener("storage", handleThemeEvent);
    };
  }, []);

  return null;
}


function DirtyWatcher() {
  const router = useRouter();

  useEffect(() => {
    // Override window.alert globally with a custom Sonner Toast
    if (typeof window !== "undefined") {
      window.alert = (message: any) => {
        toast(String(message), {
          duration: 4000,
        });
      };
    }

    // Mark dirty on any input/change inside the main content area, bypassing projects page
    const onInput = (e: Event) => {
      if ((window as any).__mep_is_restoring) return;
      const target = e.target as HTMLElement;
      if (target && (target.closest("aside") || target.closest("header") || target.closest("[data-ignore-persist]"))) {
        return;
      }
      const path = window.location.pathname || "";
      if (path === "/projects" || path.endsWith("/projects")) return;
      dirtyStore.set(true);
    };
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);

    // Clear dirty after every successful navigation
    const unsub = router.subscribe("onResolved", () => dirtyStore.set(false));

    // Handle browser refresh/close
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyStore.isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      unsub();
    };
  }, [router]);

  return null;
}

import { NetworkConnectionGuard } from "@/components/NetworkConnectionGuard";
import { workspaceStore } from "@/lib/workspace-store";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useAutoBackup();

  useEffect(() => {
    workspaceStore.initCloud();
  }, []);

  return (
    <NetworkConnectionGuard>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ConfirmProvider>
            <ThemeWatcher />
            <DirtyWatcher />
            <AutoUpdaterPopup />
            {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
            <AuthGuard>
              <Outlet />
            </AuthGuard>
            <Toaster />
          </ConfirmProvider>
        </AuthProvider>
      </QueryClientProvider>
    </NetworkConnectionGuard>
  );
}

