import { redirect } from "next/navigation";

/**
 * /servers is the dashboard — keep one source of truth.
 * The sidebar has both "Dashboard" and "Servers" entries pointing here
 * because users think in either word.
 */
export default async function ServersIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
