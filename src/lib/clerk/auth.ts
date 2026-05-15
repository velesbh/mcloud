import { auth, currentUser } from "@clerk/nextjs/server";
import { ADMIN_EMAIL } from "@/lib/constants";

export async function getAuthUser() {
  const { userId } = await auth();
  return userId;
}

export async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const email = user.emailAddresses[0]?.emailAddress;
  const role = user.publicMetadata?.role as string | undefined;
  return role === "admin" || email === ADMIN_EMAIL;
}

export async function requireAdmin() {
  const admin = await isAdmin();
  if (!admin) throw new Error("Forbidden");
}
