import { cn } from "@/lib/utils";

export function MCloudLogo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
      aria-label="MCloud"
    >
      {/* Cloud shape */}
      <path
        d="M8 20C5.79 20 4 18.21 4 16C4 14.05 5.4 12.4 7.27 12.07C7.1 11.57 7 11.04 7 10.5C7 8.01 9.01 6 11.5 6C12.84 6 14.04 6.57 14.89 7.48C15.53 6.57 16.61 6 17.83 6C19.76 6 21.37 7.37 21.72 9.17C22.14 9.06 22.56 9 23 9C25.21 9 27 10.79 27 13C27 15.21 25.21 17 23 17H22C22 18.66 20.66 20 19 20H8Z"
        fill="hsl(142.1 70.6% 45.3%)"
      />
      {/* Grass block under cloud */}
      <rect x="11" y="22" width="10" height="4" fill="#866043" rx="1" />
      <rect x="11" y="21" width="10" height="2" fill="#5a9a2e" rx="0.5" />
      {/* Pixel highlight */}
      <rect x="13" y="22" width="2" height="1" fill="#9a7055" opacity="0.5" />
      <rect x="20" y="23" width="2" height="1" fill="#9a7055" opacity="0.5" />
    </svg>
  );
}

export function MCloudWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-bold text-xl tracking-tight text-foreground",
        className
      )}
    >
      M<span className="text-primary">Cloud</span>
    </span>
  );
}
