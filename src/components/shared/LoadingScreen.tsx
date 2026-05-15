import { MinecraftLoader } from "./MinecraftLoader";

export function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50 gap-4">
      <MinecraftLoader size={56} />
      <p className="text-muted-foreground text-sm font-medium">{message}</p>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <MinecraftLoader size={48} />
    </div>
  );
}
