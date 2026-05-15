"use client";
import { SignUp } from "@clerk/nextjs";
import { useLocale } from "next-intl";

export default function SignUpPage() {
  const locale = useLocale();

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
