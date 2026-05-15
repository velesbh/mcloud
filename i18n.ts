import { defineRouting } from "next-intl/routing";
import { getRequestConfig } from "next-intl/server";

export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localeDetection: true,
});

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "en" | "es")) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
