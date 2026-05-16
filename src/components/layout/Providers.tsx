"use client";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";

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
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      appearance={{
        // Official dark baseTheme — fixes light-mode bleed in UserButton popovers,
        // checkout drawer, sign-in/up, etc.
        baseTheme: dark,
        variables: {
          colorPrimary: "#5a9a2e",
          colorBackground: "#0a0a0a",
          colorInputBackground: "#1a1a1a",
          colorInputText: "#e5e5e5",
          colorText: "#e5e5e5",
          colorTextSecondary: "#9a9a9a",
          colorTextOnPrimaryBackground: "#ffffff",
          colorNeutral: "#9a9a9a",
          colorDanger: "#d92424",
          colorSuccess: "#5a9a2e",
          colorWarning: "#e8c93a",
          // Pixel-art = chunky, no rounded
          borderRadius: "0px",
          fontFamily: "var(--font-geist-sans)",
          fontSize: "13px",
          spacingUnit: "0.875rem",
        },
        elements: {
          // Card — chunky 2px border like our PixelPanel
          card: "bg-[#0a0a0a] border-2 border-[#3a3a3a] shadow-[3px_3px_0_rgba(0,0,0,0.5)]",
          rootBox: "bg-transparent",
          // Buttons — square, beveled
          formButtonPrimary:
            "bg-[#5a9a2e] hover:bg-[#6db535] text-white border-2 border-[#4a7a1e] shadow-[inset_1px_1px_0_#6db535,2px_2px_0_rgba(0,0,0,0.4)] active:translate-y-px font-medium",
          formButtonReset:
            "bg-transparent border-2 border-[#3a3a3a] text-[#e5e5e5] hover:bg-[#1a1a1a]",
          socialButtonsBlockButton:
            "bg-[#1a1a1a] border-2 border-[#3a3a3a] text-[#e5e5e5] hover:bg-[#2a2a2a] shadow-[2px_2px_0_rgba(0,0,0,0.3)]",
          socialButtonsIconButton:
            "bg-[#1a1a1a] border-2 border-[#3a3a3a]",
          // Inputs
          formFieldInput:
            "bg-[#1a1a1a] border-2 border-[#3a3a3a] focus:border-[#5a9a2e] text-[#e5e5e5]",
          // Headings
          headerTitle: "text-[#e5e5e5] font-semibold",
          headerSubtitle: "text-[#9a9a9a]",
          // Links / footer
          footerActionLink: "text-[#5a9a2e] hover:text-[#6db535] underline-offset-2",
          identityPreviewEditButton: "text-[#5a9a2e]",
          // UserButton popover
          userButtonPopoverCard: "bg-[#0a0a0a] border-2 border-[#3a3a3a]",
          userButtonPopoverActionButton: "text-[#e5e5e5] hover:bg-[#1a1a1a]",
          userPreviewMainIdentifier: "text-[#e5e5e5]",
          userPreviewSecondaryIdentifier: "text-[#9a9a9a]",
          // Modal/Drawer (checkout)
          modalBackdrop: "bg-black/70",
          modalContent: "bg-[#0a0a0a] border-2 border-[#3a3a3a]",
          drawerRoot: "bg-[#0a0a0a]",
          drawerContent: "bg-[#0a0a0a] border-l-2 border-[#3a3a3a]",
          // Dividers
          dividerLine: "bg-[#3a3a3a]",
          dividerText: "text-[#9a9a9a]",
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "#0a0a0a",
                border: "2px solid #3a3a3a",
                borderRadius: 0,
                color: "#e5e5e5",
                fontFamily: "var(--font-geist-sans)",
                boxShadow: "3px 3px 0 rgba(0,0,0,0.4)",
              },
            }}
          />
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
