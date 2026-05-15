import { MCloudLogo, MCloudWordmark } from "@/components/layout/MCloudLogo";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="mb-8 flex flex-col items-center gap-3">
        <MCloudLogo size={48} />
        <MCloudWordmark className="text-2xl" />
        <p className="text-sm text-muted-foreground text-center">
          Minecraft hosting, simplified.
        </p>
      </div>
      {children}
      <p className="mt-8 text-xs text-muted-foreground text-center">
        By continuing, you agree to our{" "}
        <Link href="/en/terms" className="underline hover:text-foreground">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/en/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
