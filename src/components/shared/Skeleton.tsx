import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/60",
        className
      )}
    />
  );
}

export function ServerCardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Skeleton className="w-10 h-10 rounded-md" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-9 rounded-md" />
      <div className="space-y-2">
        <Skeleton className="h-3" />
        <Skeleton className="h-3" />
      </div>
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-20" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4 flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-md" />
      <div className="space-y-1.5 flex-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-12" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  );
}
