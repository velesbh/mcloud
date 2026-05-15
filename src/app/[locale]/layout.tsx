import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { Providers } from "@/components/layout/Providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "MCloud — Minecraft Hosting",
    template: "%s | MCloud",
  },
  description: "Host Minecraft servers effortlessly with MCloud by Enzonic LLC.",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Providers>{children}</Providers>
    </NextIntlClientProvider>
  );
}
