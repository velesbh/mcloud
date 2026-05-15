export interface ModrinthProject {
  project_id: string;
  project_type: "mod" | "modpack" | "resourcepack" | "shader";
  slug: string;
  author: string;
  title: string;
  description: string;
  categories: string[];
  versions: string[];
  downloads: number;
  follows: number;
  icon_url: string | null;
  date_created: string;
  date_modified: string;
  latest_version: string | null;
  license: string;
  client_side: string;
  server_side: string;
  gallery: string[];
  featured_gallery: string | null;
  color: number | null;
}

export interface ModrinthSearchResult {
  hits: ModrinthProject[];
  offset: number;
  limit: number;
  total_hits: number;
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  author_id: string;
  featured: boolean;
  name: string;
  version_number: string;
  changelog: string | null;
  changelog_url: string | null;
  date_published: string;
  downloads: number;
  version_type: "release" | "beta" | "alpha";
  status: string;
  requested_status: string | null;
  files: ModrinthFile[];
  dependencies: ModrinthDependency[];
  game_versions: string[];
  loaders: string[];
}

export interface ModrinthFile {
  hashes: { sha512: string; sha1: string };
  url: string;
  filename: string;
  primary: boolean;
  size: number;
  file_type: string | null;
}

export interface ModrinthDependency {
  version_id: string | null;
  project_id: string | null;
  file_name: string | null;
  dependency_type: "required" | "optional" | "incompatible" | "embedded";
}

export interface ModrinthSearchParams {
  query?: string;
  facets?: string[][];
  index?: "relevance" | "downloads" | "follows" | "newest" | "updated";
  offset?: number;
  limit?: number;
}
