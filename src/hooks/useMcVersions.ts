import { useQuery } from "@tanstack/react-query";

export function useMcVersions() {
  return useQuery<string[]>({
    queryKey: ["mc-versions"],
    queryFn: async () => {
      const res = await fetch("/api/mc-versions");
      const data = await res.json();
      return data.versions as string[];
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 2 * 60 * 60 * 1000,
  });
}
