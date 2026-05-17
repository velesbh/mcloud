"use client";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ThemeProvider, useTheme } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Appearance = any;

// ── Clerk appearance tokens ───────────────────────────────────────────────────

const SHARED: Appearance = {
  variables: {
    colorPrimary: "#5a9a2e",
    colorSuccess: "#5a9a2e",
    colorDanger: "#d92424",
    colorWarning: "#e8c93a",
    colorTextOnPrimaryBackground: "#ffffff",
    borderRadius: "0px",
    fontFamily: "var(--font-geist-sans)",
    fontSize: "13px",
    spacingUnit: "0.875rem",
  },
  elements: {
    rootBox: "bg-transparent",
    formButtonPrimary:
      "bg-[#5a9a2e] hover:bg-[#6db535] text-white border-2 border-[#4a7a1e] shadow-[inset_1px_1px_0_#6db535,2px_2px_0_rgba(0,0,0,0.4)] active:translate-y-px font-medium",
    footerActionLink: "text-[#5a9a2e] hover:text-[#6db535] underline-offset-2",
    identityPreviewEditButton: "text-[#5a9a2e]",
    dividerLine: "bg-[var(--border)]",
    dividerText: "text-[var(--muted-foreground)]",
  },
};

const DARK_APPEARANCE: Appearance = {
  baseTheme: dark,
  variables: {
    ...SHARED.variables,
    colorBackground: "#0a0a0a",
    colorInputBackground: "#1a1a1a",
    colorInputText: "#e5e5e5",
    colorText: "#e5e5e5",
    colorTextSecondary: "#9a9a9a",
    colorNeutral: "#9a9a9a",
  },
  elements: {
    ...SHARED.elements,
    card: "bg-[#0a0a0a] border-2 border-[#3a3a3a] shadow-[3px_3px_0_rgba(0,0,0,0.5)]",
    formButtonReset: "bg-transparent border-2 border-[#3a3a3a] text-[#e5e5e5] hover:bg-[#1a1a1a]",
    socialButtonsBlockButton: "bg-[#1a1a1a] border-2 border-[#3a3a3a] text-[#e5e5e5] hover:bg-[#2a2a2a] shadow-[2px_2px_0_rgba(0,0,0,0.3)]",
    socialButtonsIconButton: "bg-[#1a1a1a] border-2 border-[#3a3a3a]",
    formFieldInput: "bg-[#1a1a1a] border-2 border-[#3a3a3a] focus:border-[#5a9a2e] text-[#e5e5e5]",
    headerTitle: "text-[#e5e5e5] font-semibold",
    headerSubtitle: "text-[#9a9a9a]",
    userButtonPopoverCard: "bg-[#0a0a0a] border-2 border-[#3a3a3a]",
    userButtonPopoverActionButton: "text-[#e5e5e5] hover:bg-[#1a1a1a]",
    userPreviewMainIdentifier: "text-[#e5e5e5]",
    userPreviewSecondaryIdentifier: "text-[#9a9a9a]",
    modalBackdrop: "bg-black/70",
    modalContent: "bg-[#0a0a0a] border-2 border-[#3a3a3a]",
    drawerRoot: "bg-[#0a0a0a]",
    drawerContent: "bg-[#0a0a0a] border-l-2 border-[#3a3a3a]",
  },
};

const LIGHT_APPEARANCE: Appearance = {
  // no baseTheme → Clerk renders its default light UI
  variables: {
    ...SHARED.variables,
    colorBackground: "#ffffff",
    colorInputBackground: "#f5f5f5",
    colorInputText: "#111111",
    colorText: "#111111",
    colorTextSecondary: "#555555",
    colorNeutral: "#555555",
  },
  elements: {
    ...SHARED.elements,
    card: "bg-white border-2 border-[#d4d4d4] shadow-[3px_3px_0_rgba(0,0,0,0.08)]",
    formButtonReset: "bg-transparent border-2 border-[#d4d4d4] text-[#111111] hover:bg-[#f5f5f5]",
    socialButtonsBlockButton: "bg-[#f5f5f5] border-2 border-[#d4d4d4] text-[#111111] hover:bg-[#ebebeb]",
    socialButtonsIconButton: "bg-[#f5f5f5] border-2 border-[#d4d4d4]",
    formFieldInput: "bg-[#f5f5f5] border-2 border-[#d4d4d4] focus:border-[#5a9a2e] text-[#111111]",
    headerTitle: "text-[#111111] font-semibold",
    headerSubtitle: "text-[#555555]",
    userButtonPopoverCard: "bg-white border-2 border-[#d4d4d4]",
    userButtonPopoverActionButton: "text-[#111111] hover:bg-[#f5f5f5]",
    userPreviewMainIdentifier: "text-[#111111]",
    userPreviewSecondaryIdentifier: "text-[#555555]",
    modalBackdrop: "bg-black/40",
    modalContent: "bg-white border-2 border-[#d4d4d4]",
    drawerRoot: "bg-white",
    drawerContent: "bg-white border-l-2 border-[#d4d4d4]",
  },
};

// ── Inner wrapper — has access to useTheme ────────────────────────────────────

function ClerkThemeSync({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const appearance = resolvedTheme === "light" ? LIGHT_APPEARANCE : DARK_APPEARANCE;

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      appearance={appearance}
    >
      {children}
    </ClerkProvider>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  return (
    <Toaster
      position="bottom-right"
      theme={isDark ? "dark" : "light"}
      toastOptions={{
        style: {
          background: isDark ? "#0a0a0a" : "#ffffff",
          border: `2px solid ${isDark ? "#3a3a3a" : "#d4d4d4"}`,
          borderRadius: 0,
          color: isDark ? "#e5e5e5" : "#111111",
          fontFamily: "var(--font-geist-sans)",
          boxShadow: "3px 3px 0 rgba(0,0,0,0.2)",
        },
      }}
    />
  );
}

// ── Root provider ─────────────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ClerkThemeSync>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>{children}</TooltipProvider>
          <ThemedToaster />
        </QueryClientProvider>
      </ClerkThemeSync>
    </ThemeProvider>
  );
}
