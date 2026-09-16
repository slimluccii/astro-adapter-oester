import {
  BUNDLE_FORMAT,
  DEFAULT_SERVER_ENTRY,
  type HeaderRule,
  type Manifest,
  type Redirect,
  type Route,
} from "../build-output/index.ts";

// Structural subset of Astro's IntegrationResolvedRoute, so the builder
// can be tested without constructing a full route.
export interface RouteInfo {
  type: "page" | "endpoint" | "redirect" | "fallback";
  pattern: string;
  patternRegex: { source: string };
  isPrerendered: boolean;
  pathname?: string | undefined;
  redirect?: string | { status: number; destination: string } | undefined;
}

export interface ManifestInput {
  buildFormat: "directory" | "file" | "preserve";
  assetsDir: string;
  routes: RouteInfo[];
  staticHeaders: Record<string, Record<string, string>>;
  base?: string;
}

function redirectStatus(status: number): Redirect["status"] {
  return status === 302 || status === 307 || status === 308 ? status : 301;
}

export function buildManifest(input: ManifestInput): Manifest {
  const routes: Route[] = [];
  const redirects: Redirect[] = [];

  for (const route of input.routes) {
    if (route.type === "fallback") continue;
    if (route.type === "redirect") {
      const to = typeof route.redirect === "string" ? route.redirect : route.redirect?.destination;
      const status =
        typeof route.redirect === "object" && route.redirect ? route.redirect.status : 301;
      if (to) {
        redirects.push({
          from: route.pattern,
          to,
          status: redirectStatus(status),
        });
      }
      continue;
    }
    if (route.isPrerendered) {
      // Dynamic prerendered routes have multiple files; the router
      // finds them through the rewrite to client/, so only concrete paths
      // get a manifest entry. With build.format "preserve" the
      // file path cannot be derived from the path alone.
      if (route.pathname && input.buildFormat !== "preserve") {
        routes.push({
          pattern: route.pattern,
          type: "prerendered",
          file: prerenderedFile(route.pathname, route.type, input.buildFormat),
        });
      }
      continue;
    }
    routes.push({
      pattern: route.pattern,
      type: "server",
      regex: route.patternRegex.source,
    });
  }

  const headers: HeaderRule[] = Object.entries(input.staticHeaders).map(([path, values]) => ({
    path,
    headers: values,
  }));
  headers.push({
    path: `/${input.assetsDir}/*`,
    headers: { "cache-control": "public, max-age=31536000, immutable" },
  });

  const hasServer = routes.some((route) => route.type === "server");
  return {
    version: 2,
    framework: { name: "astro" },
    routes,
    redirects,
    headers,
    ...(hasServer ? { server: { entry: DEFAULT_SERVER_ENTRY, format: BUNDLE_FORMAT } } : {}),
    ...(input.base && input.base !== "/" ? { base: input.base } : {}),
  };
}

export function prerenderedFile(
  pathname: string,
  type: "page" | "endpoint",
  format: "directory" | "file",
): string {
  const clean = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  if (type === "endpoint") return clean;
  if (clean === "") return "index.html";
  if (clean.endsWith(".html")) return clean;
  return format === "file" ? `${clean}.html` : `${clean}/index.html`;
}
