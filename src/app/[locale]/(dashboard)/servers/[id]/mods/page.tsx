"use client";
import { use, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ModCard } from "@/components/modrinth/ModCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { toast } from "sonner";
import type { ModrinthSearchResult } from "@/lib/modrinth/types";
import type { ModInstallation, Server } from "@/lib/supabase/types";
import { MC_JAVA_VERSIONS, MODRINTH_PROJECT_TYPES } from "@/lib/constants";
import { useDebounce } from "@/hooks/useDebounce";

/** Map our internal loader names → Modrinth category names */
function toModrinthLoader(loader: string): string | null {
  const map: Record<string, string> = {
    paper: "paper",
    spigot: "spigot",
    fabric: "fabric",
    forge: "forge",
    neoforge: "neoforge",
    quilt: "quilt",
    purpur: "purpur",
    vanilla: "",
    bedrock: "",
  };
  return map[loader] ?? loader;
}

export default function ModsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("mod");
  const [version, setVersion] = useState<string>("");
  const [installing, setInstalling] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 400);

  // Fetch server info to seed version + loader
  const { data: server } = useQuery<Server>({
    queryKey: ["server", id],
    queryFn: () => fetch(`/api/servers/${id}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  // Seed version from server once loaded
  useEffect(() => {
    if (server?.game_version && !version) {
      setVersion(server.game_version);
    }
  }, [server?.game_version, version]);

  const serverLoader = server?.loader ?? "paper";
  const modrinthLoader = toModrinthLoader(serverLoader);
  // Use server version as default if not yet set
  const effectiveVersion = version || server?.game_version || "1.21.4";

  const { data: installed = [], isLoading: loadingInstalled } = useQuery<ModInstallation[]>({
    queryKey: ["mods", id],
    queryFn: () => fetch(`/api/servers/${id}/mods`).then((r) => r.json()),
  });

  const { data: searchResult, isLoading: loadingSearch } = useQuery<ModrinthSearchResult>({
    queryKey: ["modrinth-search", debouncedQuery, type, effectiveVersion, modrinthLoader],
    queryFn: () => {
      const p = new URLSearchParams({ query: debouncedQuery, type, version: effectiveVersion, limit: "20" });
      if (modrinthLoader) p.set("loader", modrinthLoader);
      return fetch(`/api/modrinth/search?${p}`).then((r) => r.json());
    },
    enabled: !!effectiveVersion,
    staleTime: 60_000,
  });

  const installedIds = new Set(installed.map((m) => m.modrinth_project_id));

  async function installMod(project: ModrinthSearchResult["hits"][0]) {
    setInstalling(project.project_id);
    try {
      const res = await fetch(`/api/servers/${id}/mods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modrinthProjectId: project.project_id,
          versionId: project.latest_version ?? "unknown",
          name: project.title,
          iconUrl: project.icon_url,
          type: project.project_type,
          loader: modrinthLoader || undefined,
          gameVersion: version,
        }),
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["mods", id] });
        toast.success(`${project.title} installed`);
      } else {
        toast.error("Installation failed");
      }
    } finally {
      setInstalling(null);
    }
  }

  async function uninstallMod(projectId: string, name: string) {
    await fetch(`/api/servers/${id}/mods`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    qc.invalidateQueries({ queryKey: ["mods", id] });
    toast.success(`${name} uninstalled`);
  }

  return (
    <div className="space-y-4">
      {/* Server context chip */}
      {server && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="gap-1 font-mono text-xs">
            {server.edition === "java" ? "☕" : "📱"} {server.game_version}
          </Badge>
          <Badge variant="secondary" className="capitalize text-xs">{server.loader}</Badge>
          <span className="text-xs text-muted-foreground">
            Showing {modrinthLoader ? `${modrinthLoader}-compatible` : "all"} content
          </span>
        </div>
      )}

      <Tabs defaultValue="browse">
        <div className="flex items-center gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="installed">Installed ({installed.length})</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Content type selector */}
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODRINTH_PROJECT_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* MC version — seeded from server, user can override for compat */}
            <Select value={effectiveVersion} onValueChange={setVersion}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MC_JAVA_VERSIONS.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search Modrinth for ${serverLoader} mods...`}
            className="pl-9"
          />
        </div>

        <TabsContent value="browse" className="mt-4">
          {loadingSearch ? (
            <PageLoader />
          ) : !searchResult?.hits?.length ? (
            <EmptyState
              title="No results"
              description={`No ${modrinthLoader ?? ""} content found for "${debouncedQuery || "your search"}". Try a different query or version.`}
              icon={<Package className="w-12 h-12 text-muted-foreground" />}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {searchResult.hits.map((project) => (
                <ModCard
                  key={project.project_id}
                  project={project}
                  installed={installedIds.has(project.project_id)}
                  installing={installing === project.project_id}
                  onInstall={() => installMod(project)}
                  onUninstall={() => uninstallMod(project.project_id, project.title)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="installed" className="mt-4">
          {loadingInstalled ? (
            <PageLoader />
          ) : installed.length === 0 ? (
            <EmptyState
              title="No mods installed"
              description="Browse and install mods from the Browse tab."
              icon={<Package className="w-12 h-12 text-muted-foreground" />}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {installed.map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{mod.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{mod.type}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => uninstallMod(mod.modrinth_project_id, mod.name)}
                  >
                    Uninstall
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
