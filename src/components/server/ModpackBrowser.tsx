"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, Download, Loader2 } from "lucide-react";
import { PixelPanel, PixelButton } from "@/components/pixel/PixelPanel";
import { useDebounce } from "@/hooks/useDebounce";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";

export interface PickedModpack {
  project_id: string;
  title: string;
  version_id: string;
  version_number: string;
  game_version: string;
  loader: string;
  download_url: string;
  icon_url?: string;
}

interface Hit {
  project_id: string;
  title: string;
  description: string;
  downloads: number;
  icon_url?: string;
  versions?: string[];
  categories?: string[];
}

interface Version {
  id: string;
  name: string;
  version_number: string;
  game_version: string | null;
  loader: string | null;
  download_url: string | null;
  filename: string | null;
  published: string;
}

export function ModpackBrowser({
  onPick,
  onClose,
}: {
  onPick: (mp: PickedModpack) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 300);
  const [chosen, setChosen] = useState<Hit | null>(null);

  const { data: search, isLoading: searching } = useQuery<{ hits: Hit[] }>({
    queryKey: ["modpack-search", dq],
    queryFn: () => fetch(`/api/modrinth/search?query=${encodeURIComponent(dq)}&type=modpack&limit=18`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: versions = [], isLoading: loadingVersions } = useQuery<Version[]>({
    queryKey: ["modpack-versions", chosen?.project_id],
    queryFn: () => fetch(`/api/modrinth/modpack-versions/${chosen!.project_id}`).then((r) => r.json()),
    enabled: !!chosen,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl max-h-[85vh] flex flex-col">
        <PixelPanel
          variant="stone"
          title="Browse Modpacks"
          icon={<Package className="w-3 h-3" />}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {!chosen ? (
            <div className="flex flex-col overflow-hidden">
              {/* Search */}
              <div className="p-3 border-b-2 border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    autoFocus
                    placeholder="Search Modrinth modpacks (e.g. Fabulously Optimized, Better MC)..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-background border-2 border-border focus:border-primary outline-none"
                    style={{ borderRadius: 0 }}
                  />
                </div>
              </div>

              {/* Results grid */}
              <div className="flex-1 overflow-y-auto p-3">
                {searching ? (
                  <div className="flex justify-center py-12"><LoadingSpinner size={24} /></div>
                ) : !search?.hits?.length ? (
                  <div className="text-center py-12 text-muted-foreground text-sm font-minecraft">
                    No modpacks match — try a different search
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {search.hits.map((h) => (
                      <button
                        key={h.project_id}
                        onClick={() => setChosen(h)}
                        className="text-left p-3 flex items-start gap-3 hover:bg-accent transition-colors border border-border/40"
                        style={{ borderRadius: 0 }}
                      >
                        {h.icon_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={h.icon_url} alt="" className="w-10 h-10 shrink-0" style={{ imageRendering: "pixelated" }} />
                        ) : (
                          <div className="w-10 h-10 bg-muted shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{h.title}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{h.description}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                            {h.downloads?.toLocaleString()} downloads
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col overflow-hidden">
              {/* Detail header */}
              <div className="p-3 border-b-2 border-border flex items-center gap-3">
                {chosen.icon_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={chosen.icon_url} alt="" className="w-12 h-12" style={{ imageRendering: "pixelated" }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-minecraft text-[11px]">{chosen.title}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mt-1">{chosen.description}</p>
                </div>
                <PixelButton size="sm" variant="ghost" onClick={() => setChosen(null)}>← Back</PixelButton>
              </div>

              {/* Versions */}
              <div className="flex-1 overflow-y-auto">
                {loadingVersions ? (
                  <div className="flex justify-center py-12"><LoadingSpinner size={24} /></div>
                ) : versions.length === 0 ? (
                  <p className="text-center py-12 text-xs text-muted-foreground font-minecraft">No versions available</p>
                ) : (
                  versions.map((v) => {
                    const usable = !!v.download_url && !!v.game_version && !!v.loader;
                    return (
                      <div
                        key={v.id}
                        className="flex items-center gap-3 px-3 py-2.5 border-b border-border/30"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono truncate">{v.version_number}</p>
                          <p className="text-[10px] text-muted-foreground font-minecraft uppercase">
                            MC {v.game_version} · {v.loader}
                          </p>
                        </div>
                        <PixelButton
                          size="sm"
                          variant="green"
                          disabled={!usable}
                          onClick={() => onPick({
                            project_id: chosen.project_id,
                            title: chosen.title,
                            version_id: v.id,
                            version_number: v.version_number,
                            game_version: v.game_version!,
                            loader: v.loader!,
                            download_url: v.download_url!,
                            icon_url: chosen.icon_url,
                          })}
                        >
                          <Download className="w-3 h-3" />
                          Pick
                        </PixelButton>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="p-3 border-t-2 border-border flex justify-end">
            <PixelButton variant="ghost" onClick={onClose}>Close</PixelButton>
          </div>
        </PixelPanel>
      </div>
    </div>
  );
}
