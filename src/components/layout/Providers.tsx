"use client";
import { ClerkProvider } from "@clerk/nextjs";
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
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: "#22c55e",
          colorBackground: "hsl(0 0% 5%)",
          colorInputBackground: "hsl(0 0% 8%)",
          colorInputText: "hsl(0 0% 98%)",
          colorText: "hsl(0 0% 98%)",
          colorTextSecondary: "hsl(0 0% 63.9%)",
          borderRadius: "0.5rem",
          fontFamily: "var(--font-geist-sans)",
        },
        elements: {
          card: "bg-card border border-border shadow-none",
          headerTitle: "text-foreground font-semibold",
          formButtonPrimary:
            "bg-primary hover:bg-primary/90 text-primary-foreground",
          footerActionLink: "text-primary hover:text-primary/80",
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
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "hsl(0 0% 8%)",
                border: "1px solid hsl(0 0% 14.9%)",
                color: "hsl(0 0% 98%)",
              },
            }}
          />
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
