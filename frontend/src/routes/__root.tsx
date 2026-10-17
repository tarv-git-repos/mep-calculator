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
  const { session, profile, loading, isLoggedin, logout } = useAuth();
  const routerState = useRouterState();
  const [showPricing, setShowPricing] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoginPage = routerState.location.pathname === '/login' || routerState.location.pathname.startsWith('/login');
  const isPrivacyPage = routerState.location.pathname === '/privacy' || routerState.location.pathname.startsWith('/privacy');
  const isAdminPage = routerState.location.pathname.startsWith('/admin');

  // Allow login page to render immediately without session loading screen
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Only show loading screen if initial client mounting is pending and user is not yet loaded from localStorage
  if (!mounted && loading && !isLoggedin) return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
      <div className="text-sky-400 font-medium">Loading session...</div>
    </div>
  );
  
  if (!isLoggedin) {
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
    const roleUpper = String(profile?.role || (profile as any)?.features?.role || '').toUpperCase().trim();
    const desigUpper = String(profile?.designation || (profile as any)?.features?.designation || '').toUpperCase().trim();
    const userEmail = String(profile?.email || session?.user?.email || '').toLowerCase().trim();
    const isSuperAdmin = roleUpper === 'SUPER_ADMIN' || userEmail === 'admin@tarv.ai';
    const isOrgAdmin = isSuperAdmin ||
      roleUpper === 'ORG_ADMIN' ||
      roleUpper === 'ORGANIZATION_ADMIN' ||
      roleUpper === 'ORGANIZATION ADMIN' ||
      roleUpper === 'ORG ADMIN' ||
      (roleUpper.includes('ORG') && roleUpper.includes('ADMIN')) ||
      desigUpper.includes('ORG ADMIN') ||
      desigUpper.includes('ORGANIZATION ADMIN');

    if (!isSuperAdmin && !isOrgAdmin && isAdminPage) {
      return <Navigate to="/" replace />;
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
      <div className="max-w-xl text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {error?.message && (
          <pre className="mt-3 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs text-left rounded-xl overflow-auto max-h-48 font-mono whitespace-pre-wrap select-all">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
        )}
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

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mep_theme');if(!t){var u=localStorage.getItem('mep_calculator_user_data')||localStorage.getItem('mep_profile')||localStorage.getItem('mep_user_data');if(u){try{var p=JSON.parse(u);if(p&&p.settings&&p.settings.theme){t=p.settings.theme;localStorage.setItem('mep_theme',t);}}catch(_){}}}t=t||'dark';var d=false;if(t==='dark')d=true;else if(t==='light')d=false;else d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(d){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`,
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
  const router = useRouter();

  useEffect(() => {
    const getResolvedTheme = (): 'light' | 'dark' => {
      if (typeof window === "undefined") return "dark";
      try {
        let t = localStorage.getItem("mep_theme");
        if (!t) {
          const u = localStorage.getItem("mep_calculator_user_data") || localStorage.getItem("mep_profile") || localStorage.getItem("mep_user_data");
          if (u) {
            const p = JSON.parse(u);
            if (p?.settings?.theme) {
              t = p.settings.theme;
              localStorage.setItem("mep_theme", t);
            }
          }
        }
        t = t || "dark";
        if (t === "dark") return "dark";
        if (t === "light") return "light";
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } catch {
        return "dark";
      }
    };

    const applyCurrentTheme = () => {
      if (typeof window === "undefined") return;
      const target = getResolvedTheme();
      const isDark = target === "dark";
      const hasDark = document.documentElement.classList.contains("dark");
      if (isDark && !hasDark) {
        document.documentElement.classList.add("dark");
      } else if (!isDark && hasDark) {
        document.documentElement.classList.remove("dark");
      }
    };

    // Apply immediately on mount
    applyCurrentTheme();

    // Re-verify on navigation without flashing
    const unsubRouter = router.subscribe("onResolved", () => {
      applyCurrentTheme();
    });

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const savedTheme = localStorage.getItem("mep_theme");
      if (!savedTheme || savedTheme === "system") {
        applyCurrentTheme();
      }
    };

    const handleThemeEvent = () => applyCurrentTheme();

    const handleStorage = (e: StorageEvent) => {
      // Only react if mep_theme or user data explicitly changed in another tab
      if (e.key === "mep_theme" || e.key === "mep_calculator_user_data" || e.key === "mep_profile") {
        applyCurrentTheme();
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    window.addEventListener("mep-theme-change", handleThemeEvent);
    window.addEventListener("storage", handleStorage);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
      window.removeEventListener("mep-theme-change", handleThemeEvent);
      window.removeEventListener("storage", handleStorage);
      unsubRouter();
    };
  }, [router]);

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

