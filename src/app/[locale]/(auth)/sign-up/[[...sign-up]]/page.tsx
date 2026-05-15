"use client";
import { SignUp } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignUpPage() {
  const locale = useLocale();
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If already signed in, redirect to dashboard
    if (isLoaded && isSignedIn) {
      router.push(`/${locale}/dashboard`);
    }
  }, [isLoaded, isSignedIn, locale, router]);

  // Don't render the sign-up form while checking auth or if already signed in
  if (!isLoaded || isSignedIn) {
    return null;
  }

  return (
    <SignUp
      signInUrl={`/${locale}/sign-in`}
      appearance={{
        elements: {
          footerActionLink: "text-primary hover:text-primary/80",
        },
      }}
    />
  );
}
