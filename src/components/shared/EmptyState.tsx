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
      <rect width="64" height="64" fill="#3d7a3d" rx="4" />
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
        "flex flex-col items-center justify-center gap-4 py-16 px-4 text-center",
        className
      )}
    >
      {icon ?? <CreeperFace size={56} />}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
