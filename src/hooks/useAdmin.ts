"use client";
import { useUser } from "@clerk/nextjs";
import { ADMIN_EMAIL } from "@/lib/constants";

export function useAdmin(): boolean {
  const { user } = useUser();
  if (!user) return false;
  const email = user.emailAddresses[0]?.emailAddress;
  const role = user.publicMetadata?.role as string | undefined;
  return role === "admin" || email === ADMIN_EMAIL;
}
