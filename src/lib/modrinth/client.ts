import type {
  ModrinthSearchParams,
  ModrinthSearchResult,
  ModrinthVersion,
} from "./types";

const BASE = "https://api.modrinth.com/v2";
const USER_AGENT =
  process.env.MODRINTH_USER_AGENT ?? "MCloud/1.0 (admin@enzonic.com)";

async function modrinthFetch<T>(
  path: string,
  params?: Record<string, string>,
  revalidate = 60
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    next: { revalidate },
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Modrinth API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function searchModrinth(
  params: ModrinthSearchParams
): Promise<ModrinthSearchResult> {
  const searchParams: Record<string, string> = {};
  if (params.query) searchParams.query = params.query;
  if (params.index) searchParams.index = params.index;
  if (params.offset !== undefined)
    searchParams.offset = String(params.offset);
  if (params.limit !== undefined) searchParams.limit = String(params.limit);
  if (params.facets && params.facets.length > 0) {
    searchParams.facets = JSON.stringify(params.facets);
  }
  return modrinthFetch<ModrinthSearchResult>("/search", searchParams);
}

export async function getProjectVersions(
  projectId: string,
  loaders?: string[],
  gameVersions?: string[]
): Promise<ModrinthVersion[]> {
  const params: Record<string, string> = {};
  if (loaders && loaders.length > 0)
    params.loaders = JSON.stringify(loaders);
  if (gameVersions && gameVersions.length > 0)
    params.game_versions = JSON.stringify(gameVersions);
  return modrinthFetch<ModrinthVersion[]>(
    `/project/${projectId}/version`,
    params
  );
}
