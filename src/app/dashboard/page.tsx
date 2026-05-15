import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function DashboardRedirect() {
  // Get the accept-language header to determine locale
  const headersList = await headers();
  const acceptLanguage = headersList.get("accept-language") || "";

  // Default to English, but check for Spanish preference
  const locale = acceptLanguage.includes("es") ? "es" : "en";

  redirect(`/${locale}/dashboard`);
}
