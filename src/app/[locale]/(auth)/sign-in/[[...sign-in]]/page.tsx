"use client";
import { SignIn } from "@clerk/nextjs";
import { useLocale } from "next-intl";

export default function SignInPage() {
  const locale = useLocale();

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
