// Auto-generate this file with: npx supabase gen types typescript --project-id YOUR_PROJECT_ID
// Manually maintained placeholder until the generator is run.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ServerStatus =
  | "creating"
  | "offline"
  | "starting"
  | "running"
  | "stopping"
  | "restarting"
  | "error"
  | "suspended"
  | "hibernated";

export type NodeStatus = "online" | "offline" | "maintenance" | "unknown";
export type ServerLoader =
  | "vanilla"
  | "paper"
  | "spigot"
  | "fabric"
  | "forge"
  | "neoforge"
  | "quilt"
  | "bedrock";
export type BackupStatus = "creating" | "available" | "restoring" | "failed";
export type UserRole = "user" | "admin";
export type GameEdition = "java" | "bedrock";

export interface Database {
  // All MCloud objects live in the `mcloud` Postgres schema.
  // The Supabase clients are configured with { db: { schema: 'mcloud' } }
  // so the JS layer's .from() / .rpc() calls resolve here automatically.
  mcloud: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          clerk_user_id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          role: UserRole;
          plan_tier: string;
          max_servers: number;
          max_ram_mb: number;
          max_disk_mb: number;
          max_cpu_percent: number;
          max_allocations: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clerk_user_id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          plan_tier?: string;
          max_servers?: number;
          max_ram_mb?: number;
          max_disk_mb?: number;
          max_cpu_percent?: number;
          max_allocations?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clerk_user_id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          plan_tier?: string;
          max_servers?: number;
          max_ram_mb?: number;
          max_disk_mb?: number;
          max_cpu_percent?: number;
          max_allocations?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      regions: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          flag_emoji: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          flag_emoji?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          flag_emoji?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      nodes: {
        Row: {
          id: string;
          region_id: string | null;
          name: string;
          fqdn: string;
          ip: string;
          total_ram_mb: number;
          total_cpu: number;
          total_disk_mb: number;
          status: NodeStatus;
          is_public: boolean;
          memory_overcommit_percent: number;
          overallocation_percent: number;
          last_seen_at: string | null;
          running_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          region_id?: string | null;
          name: string;
          fqdn: string;
          ip: string;
          total_ram_mb: number;
          total_cpu: number;
          total_disk_mb: number;
          status?: NodeStatus;
          is_public?: boolean;
          memory_overcommit_percent?: number;
          overallocation_percent?: number;
          last_seen_at?: string | null;
          running_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          region_id?: string;
          name?: string;
          fqdn?: string;
          ip?: string;
          total_ram_mb?: number;
          total_cpu?: number;
          total_disk_mb?: number;
          status?: NodeStatus;
          is_public?: boolean;
          memory_overcommit_percent?: number;
          overallocation_percent?: number;
          last_seen_at?: string | null;
          running_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      allocations: {
        Row: {
          id: string;
          node_id: string;
          ip: string;
          local_ip: string;
          port: number;
          server_id: string | null;
          assigned_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          node_id: string;
          ip: string;
          local_ip?: string;
          port: number;
          server_id?: string | null;
          assigned_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string;
          ip?: string;
          port?: number;
          server_id?: string | null;
          assigned_at?: string | null;
        };
        Relationships: [];
      };
      servers: {
        Row: {
          id: string;
          user_id: string;
          clerk_user_id: string;
          name: string;
          edition: GameEdition;
          game_version: string;
          loader: ServerLoader;
          loader_version: string | null;
          ram_mb: number;
          cpu_percent: number;
          disk_mb: number;
          status: ServerStatus;
          node_id: string | null;
          allocation_id: string | null;
          region_id: string | null;
          motd: string | null;
          max_players: number;
          java_flags: string | null;
          env_vars: Json;
          installed_at: string;
          last_started_at: string | null;
          last_active_at: string | null;
          hibernated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          clerk_user_id: string;
          name: string;
          edition: GameEdition;
          game_version: string;
          loader: ServerLoader;
          loader_version?: string | null;
          ram_mb: number;
          cpu_percent?: number;
          disk_mb: number;
          status?: ServerStatus;
          node_id?: string | null;
          allocation_id?: string | null;
          region_id?: string | null;
          motd?: string | null;
          max_players?: number;
          java_flags?: string | null;
          env_vars?: Json;
          installed_at?: string;
          last_started_at?: string | null;
          last_active_at?: string | null;
          hibernated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          clerk_user_id?: string;
          name?: string;
          edition?: GameEdition;
          game_version?: string;
          loader?: ServerLoader;
          loader_version?: string | null;
          ram_mb?: number;
          cpu_percent?: number;
          disk_mb?: number;
          status?: ServerStatus;
          node_id?: string | null;
          allocation_id?: string | null;
          region_id?: string | null;
          motd?: string | null;
          max_players?: number;
          java_flags?: string | null;
          env_vars?: Json;
          installed_at?: string;
          last_started_at?: string | null;
          last_active_at?: string | null;
          hibernated_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      server_backups: {
        Row: {
          id: string;
          server_id: string;
          name: string;
          size_bytes: number;
          status: BackupStatus;
          storage_path: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          server_id: string;
          name: string;
          size_bytes?: number;
          status?: BackupStatus;
          storage_path?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          server_id?: string;
          name?: string;
          size_bytes?: number;
          status?: BackupStatus;
          storage_path?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      mod_installations: {
        Row: {
          id: string;
          server_id: string;
          modrinth_project_id: string;
          version_id: string;
          name: string;
          icon_url: string | null;
          type: string;
          loader: string | null;
          game_version: string | null;
          installed_at: string;
        };
        Insert: {
          id?: string;
          server_id: string;
          modrinth_project_id: string;
          version_id: string;
          name: string;
          icon_url?: string | null;
          type: string;
          loader?: string | null;
          game_version?: string | null;
          installed_at?: string;
        };
        Update: {
          id?: string;
          server_id?: string;
          modrinth_project_id?: string;
          version_id?: string;
          name?: string;
          icon_url?: string | null;
          type?: string;
          loader?: string | null;
          game_version?: string | null;
        };
        Relationships: [];
      };
      console_events: {
        Row: {
          id: number;
          server_id: string;
          line: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          server_id: string;
          line: string;
          source: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          server_id?: string;
          line?: string;
          source?: string;
        };
        Relationships: [];
      };
      server_files: {
        Row: {
          id: string;
          server_id: string;
          path: string;
          name: string;
          is_directory: boolean;
          size_bytes: number;
          mime_type: string | null;
          storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          server_id: string;
          path: string;
          name: string;
          is_directory?: boolean;
          size_bytes?: number;
          mime_type?: string | null;
          storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          server_id?: string;
          path?: string;
          name?: string;
          is_directory?: boolean;
          size_bytes?: number;
          mime_type?: string | null;
          storage_path?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_plans: {
        Row: {
          id: string;
          plan_key: string;
          clerk_plan_id: string | null;
          name: string;
          description: string | null;
          monthly_price_usd: number | null;
          max_servers: number;
          max_ram_mb: number;
          max_disk_mb: number;
          max_cpu_percent: number;
          features: Json;
          sort_order: number;
          is_visible: boolean;
          is_highlighted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_key: string;
          clerk_plan_id?: string | null;
          name: string;
          description?: string | null;
          monthly_price_usd?: number | null;
          max_servers?: number;
          max_ram_mb?: number;
          max_disk_mb?: number;
          max_cpu_percent?: number;
          features?: Json;
          sort_order?: number;
          is_visible?: boolean;
          is_highlighted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_key?: string;
          clerk_plan_id?: string | null;
          name?: string;
          description?: string | null;
          monthly_price_usd?: number | null;
          max_servers?: number;
          max_ram_mb?: number;
          max_disk_mb?: number;
          max_cpu_percent?: number;
          features?: Json;
          sort_order?: number;
          is_visible?: boolean;
          is_highlighted?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      public_ips: {
        Row: {
          id: string;
          node_id: string;
          ip: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          node_id: string;
          ip: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          node_id?: string;
          ip?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      server_metrics: {
        Row: {
          id: number;
          server_id: string;
          sampled_at: string;
          ram_used_mb: number;
          cpu_percent: number;
          player_count: number;
        };
        Insert: {
          server_id: string;
          ram_used_mb?: number;
          cpu_percent?: number;
          player_count?: number;
          sampled_at?: string;
        };
        Update: {
          server_id?: string;
          ram_used_mb?: number;
          cpu_percent?: number;
          player_count?: number;
          sampled_at?: string;
        };
        Relationships: [];
      };
      admin_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      invite_links: {
        Row: {
          id: string;
          code: string;
          created_by: string;
          max_uses: number;
          uses: number;
          max_servers: number;
          max_ram_mb: number;
          max_disk_mb: number;
          max_cpu_percent: number;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code?: string;
          created_by: string;
          max_uses?: number;
          uses?: number;
          max_servers?: number;
          max_ram_mb?: number;
          max_disk_mb?: number;
          max_cpu_percent?: number;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          created_by?: string;
          max_uses?: number;
          uses?: number;
          max_servers?: number;
          max_ram_mb?: number;
          max_disk_mb?: number;
          max_cpu_percent?: number;
          expires_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      pick_node_with_stock: {
        Args: { want_region: string | null; want_ram_mb: number; want_cpu: number; want_disk_mb: number };
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** RPC argument helper — kept outside Database to avoid Supabase TS recursion. */
export interface PickNodeWithStockArgs {
  want_region: string | null;
  want_ram_mb: number;
  want_cpu: number;
  want_disk_mb: number;
}

/** node_stock view row — kept outside Database for the same reason. */
export interface NodeStock {
  id: string;
  name: string;
  region_id: string;
  total_ram_mb: number;
  total_cpu: number;
  total_disk_mb: number;
  overallocation_percent: number;
  allowed_ram_mb: number;
  allowed_cpu: number;
  allowed_disk_mb: number;
  used_ram_mb: number;
  used_cpu: number;
  used_disk_mb: number;
  free_ram_mb: number;
  free_cpu: number;
  free_disk_mb: number;
  status: NodeStatus;
  last_seen_at: string | null;
  running_count: number;
}

export type Profile = Database["mcloud"]["Tables"]["profiles"]["Row"];
export type Region = Database["mcloud"]["Tables"]["regions"]["Row"];
export type Node = Database["mcloud"]["Tables"]["nodes"]["Row"];
export type Allocation = Database["mcloud"]["Tables"]["allocations"]["Row"];
export type Server = Database["mcloud"]["Tables"]["servers"]["Row"];
export type ServerBackup = Database["mcloud"]["Tables"]["server_backups"]["Row"];
export type ModInstallation = Database["mcloud"]["Tables"]["mod_installations"]["Row"];
export type ConsoleEvent = Database["mcloud"]["Tables"]["console_events"]["Row"];
export type ServerFile = Database["mcloud"]["Tables"]["server_files"]["Row"];
export type PublicIp = Database["mcloud"]["Tables"]["public_ips"]["Row"];
export type BillingPlan = Database["mcloud"]["Tables"]["billing_plans"]["Row"];
export type InviteLink = Database["mcloud"]["Tables"]["invite_links"]["Row"];
export type ServerMetric = Database["mcloud"]["Tables"]["server_metrics"]["Row"];
