import { useQuery } from "@tanstack/react-query";

export function useMcVersions(loader = "paper") {
  return useQuery<string[]>({
    queryKey: ["mc-versions", loader],
    queryFn: async () => {
      const res = await fetch(`/api/mc-versions?loader=${encodeURIComponent(loader)}`);
      const data = await res.json();
      return data.versions as string[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
