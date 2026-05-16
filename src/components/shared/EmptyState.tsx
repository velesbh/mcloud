import { cn } from "@/lib/utils";

function CreeperFace({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="64" height="64" fill="#3d7a3d" rx="6" />
      {/* Eyes */}
      <rect x="14" y="18" width="10" height="10" fill="#1a1a1a" />
      <rect x="40" y="18" width="10" height="10" fill="#1a1a1a" />
      {/* Nose */}
      <rect x="28" y="28" width="8" height="8" fill="#1a1a1a" />
      <rect x="24" y="36" width="8" height="6" fill="#1a1a1a" />
      <rect x="32" y="36" width="8" height="6" fill="#1a1a1a" />
      {/* Mouth */}
      <rect x="20" y="42" width="8" height="6" fill="#1a1a1a" />
      <rect x="36" y="42" width="8" height="6" fill="#1a1a1a" />
    </svg>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-5 py-20 px-6 text-center rounded-2xl border border-border bg-card/50 bg-pixel-grid",
        className
      )}
    >
      <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-background elev-1">
        {icon ?? <CreeperFace size={56} />}
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
