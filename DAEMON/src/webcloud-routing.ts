import { log } from "./logger.js";

/**
 * Routing-backend abstraction.
 *
 * In production every deployment ends with a route registration: the public
 * hostname (e.g. `myapp.enzonic.online`) is bound to `http://<node>:<port>`.
 * Two backends are supported per-region:
 *
 *   - PangolinRoutingClient  → preferred, uses Pangolin's REST API
 *   - TraefikRoutingClient   → fallback, talks Traefik's dynamic config API
 *
 * Both implement the same 3-method interface so the deploy pipeline doesn't
 * care which backend a region uses.
 */

export interface RoutingClient {
  createRoute(hostname: string, targetUrl: string): Promise<{ routeId: string }>;
  swapRoute(routeId: string, newTargetUrl: string): Promise<void>;
  deleteRoute(routeId: string): Promise<void>;
}

interface PangolinRegion {
  pangolin_api_url: string;
  pangolin_org_id: string;
  pangolin_site_id: string;
  pangolin_api_key: string;
}

interface TraefikRegion {
  pangolin_api_url: string; // reused as Traefik API URL
  pangolin_api_key: string; // reused as Traefik static-config token
}

export class PangolinRoutingClient implements RoutingClient {
  constructor(private region: PangolinRegion) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.region.pangolin_api_key}`,
    };
  }
  private base() {
    return `${this.region.pangolin_api_url.replace(/\/$/, "")}/api/v1/org/${this.region.pangolin_org_id}/site/${this.region.pangolin_site_id}/resource`;
  }

  async createRoute(hostname: string, targetUrl: string) {
    const res = await fetch(this.base(), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ name: hostname, subdomain: hostname, target: targetUrl }),
    });
    if (!res.ok) throw new Error(`pangolin createRoute ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { id?: string; resourceId?: string };
    const routeId = json.id ?? json.resourceId;
    if (!routeId) throw new Error("pangolin createRoute: no id in response");
    return { routeId };
  }

  async swapRoute(routeId: string, newTargetUrl: string) {
    const res = await fetch(`${this.base()}/${routeId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ target: newTargetUrl }),
    });
    if (!res.ok) throw new Error(`pangolin swapRoute ${res.status}: ${await res.text()}`);
  }

  async deleteRoute(routeId: string) {
    const res = await fetch(`${this.base()}/${routeId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`pangolin deleteRoute ${res.status}: ${await res.text()}`);
    }
  }
}

export class TraefikRoutingClient implements RoutingClient {
  constructor(private region: TraefikRegion) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.region.pangolin_api_key}`,
    };
  }

  async createRoute(hostname: string, targetUrl: string) {
    const routerName = `webcloud-${hostname.replace(/[^a-z0-9]/gi, "-")}`;
    const serviceName = `${routerName}-svc`;

    const svcRes = await fetch(
      `${this.region.pangolin_api_url}/api/http/services/${serviceName}`,
      {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({ loadBalancer: { servers: [{ url: targetUrl }] } }),
      },
    );
    if (!svcRes.ok) throw new Error(`traefik service ${svcRes.status}`);

    const rtrRes = await fetch(
      `${this.region.pangolin_api_url}/api/http/routers/${routerName}`,
      {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({
          rule: `Host(\`${hostname}\`)`,
          service: serviceName,
          tls: { certResolver: "letsencrypt" },
        }),
      },
    );
    if (!rtrRes.ok) throw new Error(`traefik router ${rtrRes.status}`);

    return { routeId: routerName };
  }

  async swapRoute(routeId: string, newTargetUrl: string) {
    const serviceName = `${routeId}-svc`;
    const res = await fetch(
      `${this.region.pangolin_api_url}/api/http/services/${serviceName}`,
      {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({ loadBalancer: { servers: [{ url: newTargetUrl }] } }),
      },
    );
    if (!res.ok) throw new Error(`traefik swap ${res.status}`);
  }

  async deleteRoute(routeId: string) {
    const serviceName = `${routeId}-svc`;
    await fetch(`${this.region.pangolin_api_url}/api/http/routers/${routeId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    await fetch(`${this.region.pangolin_api_url}/api/http/services/${serviceName}`, {
      method: "DELETE",
      headers: this.headers(),
    });
  }
}

/**
 * Build a routing client from a `webcloud.regions` row. Returns null when the
 * region isn't fully configured — the deploy pipeline will still build and
 * run the container but skip route registration (useful in dev).
 */
export function buildRoutingClient(region: {
  pangolin_api_url: string | null;
  pangolin_org_id: string | null;
  pangolin_site_id: string | null;
  pangolin_api_key: string | null;
  routing_backend: "pangolin" | "traefik";
}): RoutingClient | null {
  if (!region.pangolin_api_url || !region.pangolin_api_key) {
    log.warn("region missing routing creds — skipping route registration");
    return null;
  }
  if (region.routing_backend === "pangolin") {
    if (!region.pangolin_org_id || !region.pangolin_site_id) return null;
    return new PangolinRoutingClient({
      pangolin_api_url: region.pangolin_api_url,
      pangolin_org_id: region.pangolin_org_id,
      pangolin_site_id: region.pangolin_site_id,
      pangolin_api_key: region.pangolin_api_key,
    });
  }
  return new TraefikRoutingClient({
    pangolin_api_url: region.pangolin_api_url,
    pangolin_api_key: region.pangolin_api_key,
  });
}
