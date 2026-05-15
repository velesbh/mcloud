import Link from "next/link";
import { MCloudLogo, MCloudWordmark } from "@/components/layout/MCloudLogo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-2">
          <MCloudLogo size={24} />
          <MCloudWordmark />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-12">
        <article className="prose prose-zinc dark:prose-invert max-w-none">
          {children}
        </article>
      </main>
      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap gap-4 text-sm text-muted-foreground justify-center">
          <Link href="/en/privacy" className="hover:text-foreground">Privacy Policy</Link>
          <Link href="/en/terms" className="hover:text-foreground">Terms of Service</Link>
          <Link href="/en/aup" className="hover:text-foreground">Acceptable Use Policy</Link>
          <span>© 2026 Enzonic LLC. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
