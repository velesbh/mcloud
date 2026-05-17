import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { SignUp } from "@clerk/nextjs";
import { MCloudLogo } from "@/components/layout/MCloudLogo";

interface Props {
  params: Promise<{ locale: string; code: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { locale, code } = await params;
  const supabase = createAdminSupabaseClient();

  // Validate the invite code
  const { data: invite, error } = await supabase
    .from("invite_links")
    .select("*")
    .eq("code", code)
    .single();

  if (error || !invite) {
    return (
      <div className="text-center space-y-3">
        <MCloudLogo size={40} />
        <h1 className="text-xl font-semibold">Invalid Invite</h1>
        <p className="text-muted-foreground text-sm">
          This invite link is invalid or has been removed.
        </p>
      </div>
    );
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return (
      <div className="text-center space-y-3">
        <MCloudLogo size={40} />
        <h1 className="text-xl font-semibold">Invite Expired</h1>
        <p className="text-muted-foreground text-sm">
          This invite link has expired.
        </p>
      </div>
    );
  }

  if (invite.uses >= invite.max_uses) {
    return (
      <div className="text-center space-y-3">
        <MCloudLogo size={40} />
        <h1 className="text-xl font-semibold">Invite Fully Used</h1>
        <p className="text-muted-foreground text-sm">
          This invite link has reached its maximum number of uses.
        </p>
      </div>
    );
  }

  // Store the invite code in a cookie so it can be redeemed after sign-up
  const cookieStore = await cookies();
  cookieStore.set("mcloud_invite_code", code, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
    sameSite: "lax",
  });

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">You've been invited to MCloud!</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          Create your account to get started with Minecraft hosting. Your account will be pre-configured with a custom quota.
        </p>
      </div>
      <SignUp
        signInUrl={`/${locale}/sign-in`}
        forceRedirectUrl={`/api/invite/redeem/${code}`}
        appearance={{
          elements: {
            footerActionLink: "text-primary hover:text-primary/80",
          },
        }}
      />
    </div>
  );
}
