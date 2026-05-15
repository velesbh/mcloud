export function MinecraftLoader({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: "grass-spin 1.2s linear infinite" }}
      aria-label="Loading"
    >
      {/* Top face (green grass) */}
      <rect x="8" y="8" width="24" height="8" fill="#5a9a2e" />
      <rect x="10" y="9" width="4" height="2" fill="#6db535" />
      <rect x="16" y="9" width="3" height="2" fill="#6db535" />
      <rect x="22" y="10" width="4" height="2" fill="#6db535" />
      <rect x="28" y="9" width="3" height="2" fill="#4a7a24" />

      {/* Side face (dirt) */}
      <rect x="8" y="16" width="24" height="16" fill="#866043" />
      {/* Dirt texture lines */}
      <rect x="10" y="18" width="3" height="2" fill="#7a5538" opacity="0.6" />
      <rect x="20" y="20" width="4" height="2" fill="#7a5538" opacity="0.6" />
      <rect x="14" y="24" width="3" height="2" fill="#7a5538" opacity="0.6" />
      <rect x="25" y="26" width="4" height="2" fill="#7a5538" opacity="0.6" />
      <rect x="10" y="28" width="5" height="2" fill="#7a5538" opacity="0.6" />

      {/* Grass border on top of dirt side */}
      <rect x="8" y="15" width="24" height="2" fill="#3e7a1a" />
    </svg>
  );
}

export function LoadingSpinner({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ animation: "grass-spin 0.8s linear infinite" }}
      aria-label="Loading"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="31.4"
        strokeDashoffset="10"
        opacity="0.3"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="hsl(142.1 70.6% 45.3%)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="31.4"
        strokeDashoffset="24"
      />
    </svg>
  );
}
