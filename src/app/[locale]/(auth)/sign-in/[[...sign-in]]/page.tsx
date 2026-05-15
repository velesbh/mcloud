"use client";
import { SignIn } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignInPage() {
  const locale = useLocale();
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If already signed in, redirect to dashboard
    if (isLoaded && isSignedIn) {
      router.push(`/${locale}/dashboard`);
    }
  }, [isLoaded, isSignedIn, locale, router]);

  // Don't render the sign-in form while checking auth or if already signed in
  if (!isLoaded || isSignedIn) {
    return null;
  }

  return (
    <SignIn
      signUpUrl={`/${locale}/sign-up`}
      appearance={{
        elements: {
          footerActionLink: "text-primary hover:text-primary/80",
        },
      }}
    />
  );
}
