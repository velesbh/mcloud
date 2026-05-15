import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "running":
      return "text-green-500";
    case "starting":
    case "restarting":
      return "text-yellow-500";
    case "error":
      return "text-red-500";
    case "suspended":
      return "text-orange-500";
    default:
      return "text-zinc-400";
  }
}

export function getStatusDotColor(status: string): string {
  switch (status) {
    case "running":
      return "bg-green-500";
    case "starting":
    case "restarting":
      return "bg-yellow-500";
    case "error":
      return "bg-red-500";
    case "suspended":
      return "bg-orange-500";
    default:
      return "bg-zinc-400";
  }
}
