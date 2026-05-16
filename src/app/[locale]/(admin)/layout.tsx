import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ADMIN_EMAIL } from "@/lib/constants";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await currentUser();

  if (!user) redirect(`/${locale}/sign-in`);

  const email = user.emailAddresses[0]?.emailAddress;
  const role = user.publicMetadata?.role as string | undefined;
  const isAdmin = role === "admin" || email === ADMIN_EMAIL;

  if (!isAdmin) redirect(`/${locale}/dashboard`);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:flex">
        <AdminSidebar />
      </div>
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden surface">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 lg:py-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
