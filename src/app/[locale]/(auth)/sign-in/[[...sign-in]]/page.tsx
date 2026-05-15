"use client";
import { SignIn, useAuth } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const locale = useLocale();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.push(`/${locale}/dashboard`);
    }
  }, [isSignedIn, locale, router]);

  return (
    <SignIn
      appearance={{
        elements: {
          footerActionLink: "text-primary hover:text-primary/80",
        },
      }}
      signUpUrl={`/${locale}/sign-up`}
    />
  );
}
