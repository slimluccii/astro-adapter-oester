import { describe, expect, it } from "vitest";
import { type Manifest, matchRoute, validateManifest } from "./manifest.ts";

const staticSite = {
  version: 1,
  framework: "astro",
  routes: [{ pattern: "/", type: "prerendered", file: "index.html" }],
  redirects: [],
  headers: [],
};

const hybridSite = {
  version: 1,
  framework: "nuxt",
  routes: [
    { pattern: "/", type: "prerendered", file: "index.html" },
    { pattern: "/blog/[slug]", type: "server", regex: "^/blog/([^/]+?)/?$" },
    { pattern: "/api/*", type: "server", regex: "^/api(?:/(.*?))?/?$" },
  ],
  redirects: [{ from: "/old", to: "/new", status: 301 }],
  headers: [
    { path: "/_astro/*", headers: { "cache-control": "public, max-age=31536000, immutable" } },
  ],
  server: { entry: "server/entry.js" },
};

function errorsOf(json: unknown): string[] {
  const result = validateManifest(json);
  return result.ok ? [] : result.errors;
}

describe("validateManifest", () => {
  it("accepts a static site without a server entry", () => {
    const result = validateManifest(staticSite);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.server).toBeUndefined();
  });

  it("accepts a hybrid site with server routes and an entry", () => {
    const result = validateManifest(hybridSite);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.server?.entry).toBe("server/entry.js");
  });

  it("rejects anything that is not an object", () => {
    expect(errorsOf(null)).toEqual(["manifest must be an object"]);
    expect(errorsOf("{}")).toEqual(["manifest must be an object"]);
  });

  it("rejects an unknown version", () => {
    expect(errorsOf({ ...staticSite, version: 3 })).toContain("version must be 1 or 2");
  });

  it("requires a framework name", () => {
    expect(errorsOf({ ...staticSite, framework: "" })).toContain(
      "framework must be a non-empty string",
    );
  });

  it("requires a pattern and a known type on every route", () => {
    const errors = errorsOf({
      ...staticSite,
      routes: [
        { type: "prerendered", file: "a.html" },
        { pattern: "/x", type: "edge" },
      ],
    });
    expect(errors).toContain("routes[0].pattern must be a string starting with /");
    expect(errors).toContain("routes[1].type must be prerendered or server");
  });

  it("requires a file on prerendered routes and a regex on server routes", () => {
    const errors = errorsOf({
      ...hybridSite,
      routes: [
        { pattern: "/", type: "prerendered" },
        { pattern: "/api/*", type: "server" },
      ],
    });
    expect(errors).toContain("routes[0].file is required on a prerendered route");
    expect(errors).toContain("routes[1].regex is required on a server route");
  });

  it("rejects a regex that does not compile", () => {
    const errors = errorsOf({
      ...hybridSite,
      routes: [{ pattern: "/x", type: "server", regex: "[" }],
    });
    expect(errors).toContain("routes[0].regex is not a valid regular expression");
  });

  it("requires a server entry when a route needs the server, and forbids one when none does", () => {
    expect(errorsOf({ ...hybridSite, server: undefined })).toContain(
      "server.entry is required because a route has type server",
    );
    expect(errorsOf({ ...staticSite, server: { entry: "server/entry.js" } })).toContain(
      "server.entry is set but no route has type server",
    );
  });

  it("keeps every file path inside the Build Output", () => {
    expect(
      errorsOf({
        ...staticSite,
        routes: [{ pattern: "/", type: "prerendered", file: "../index.html" }],
      }),
    ).toContain("routes[0].file must be a relative path without .. segments");
    expect(errorsOf({ ...hybridSite, server: { entry: "/etc/passwd" } })).toContain(
      "server.entry must be a relative path without .. segments",
    );
  });

  it("only allows redirect statuses a browser follows as redirects", () => {
    expect(
      errorsOf({ ...staticSite, redirects: [{ from: "/a", to: "/b", status: 200 }] }),
    ).toContain("redirects[0].status must be 301, 302, 307 or 308");
    expect(
      errorsOf({ ...staticSite, redirects: [{ from: "a", to: "/b", status: 301 }] }),
    ).toContain("redirects[0].from must be a string starting with /");
  });

  it("requires header rules to have a path and string values", () => {
    expect(errorsOf({ ...staticSite, headers: [{ path: "_astro/*", headers: {} }] })).toContain(
      "headers[0].path must be a string starting with /",
    );
    expect(errorsOf({ ...staticSite, headers: [{ path: "/x", headers: { "x-a": 1 } }] })).toContain(
      "headers[0].headers values must be strings",
    );
  });

  it("defaults redirects and headers to empty lists when they are absent", () => {
    const result = validateManifest({ version: 1, framework: "astro", routes: [] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.redirects).toEqual([]);
      expect(result.manifest.headers).toEqual([]);
    }
  });

  it("reports every problem at once instead of the first one", () => {
    const errors = errorsOf({ version: 3, framework: "", routes: "no" });
    expect(errors).toEqual([
      "version must be 1 or 2",
      "framework must be a non-empty string",
      "routes must be an array",
    ]);
  });
});

describe("version 2", () => {
  const v2 = {
    ...hybridSite,
    version: 2,
    framework: { name: "nuxt", version: "4.1.0" },
    server: { entry: "server/entry.js", format: "iife-global" },
    notFound: "errors/404.html",
  };

  it("reads a framework object, the declared bundle format and the not-found page", () => {
    const result = validateManifest(v2);
    expect(result.ok && result.manifest).toMatchObject({
      version: 2,
      framework: { name: "nuxt", version: "4.1.0" },
      server: { entry: "server/entry.js", format: "iife-global" },
      notFound: "errors/404.html",
    });
  });

  it("reads a version 1 manifest in the version 2 shape, so a consumer handles one shape", () => {
    const result = validateManifest({ ...hybridSite, notFound: "errors/404.html" });
    expect(result.ok && result.manifest).toMatchObject({
      version: 2,
      framework: { name: "nuxt" },
      server: { entry: "server/entry.js", format: "iife-global" },
    });
    expect(result.ok && result.manifest.notFound).toBeUndefined();
  });

  it("names what a version 2 manifest gets wrong", () => {
    expect(errorsOf({ ...v2, framework: "nuxt" })).toContain(
      "framework must be an object with a non-empty name",
    );
    expect(errorsOf({ ...v2, framework: { name: "nuxt", version: 4 } })).toContain(
      "framework.version must be a string",
    );
    expect(errorsOf({ ...v2, server: { entry: "server/entry.js" } })).toContain(
      "server.format must be iife-global",
    );
    expect(errorsOf({ ...v2, server: { entry: "server/entry.js", format: "module" } })).toContain(
      "server.format must be iife-global",
    );
    expect(errorsOf({ ...v2, notFound: "../404.html" })).toContain(
      "notFound must be a relative path without .. segments",
    );
  });
});

describe("base", () => {
  const staticV2 = { ...staticSite, version: 2, framework: { name: "wald" } };
  const baseOf = (base: unknown) => {
    const result = validateManifest({ ...staticV2, base });
    return result.ok ? result.manifest.base : result.errors;
  };

  it("reads the path a build is served from, always with a trailing slash", () => {
    expect(baseOf("/docs/")).toBe("/docs/");
    expect(baseOf("/docs")).toBe("/docs/");
    expect(baseOf("/guides/v2")).toBe("/guides/v2/");
  });

  it("leaves the base out for a build served from the root", () => {
    expect(baseOf("/")).toBeUndefined();
    expect(baseOf(undefined)).toBeUndefined();
  });

  it("rejects a base that is not a path under the hostname", () => {
    for (const base of [
      "docs/",
      "./",
      "",
      "https://cdn.example.com/site/",
      "/../",
      "/./",
      "/docs//v2/",
      5,
    ]) {
      expect(errorsOf({ ...staticV2, base })).toContain("base must be a path such as /docs/");
    }
  });

  it("ignores a base on a version 1 manifest, as it does the not-found page", () => {
    const result = validateManifest({ ...staticSite, base: "/docs/" });
    expect(result.ok && result.manifest.base).toBeUndefined();
  });
});

describe("fallback for single page apps", () => {
  it("accepts a relative fallback file and rejects an escaping one", () => {
    expect(validateManifest({ ...staticSite, fallback: "index.html" }).ok).toBe(true);
    const bad = validateManifest({ ...staticSite, fallback: "../index.html" });
    expect(bad.ok).toBe(false);
    if (!bad.ok)
      expect(bad.errors).toContain("fallback must be a relative path without .. segments");
  });
});

describe("matchRoute with static-first routing", () => {
  const nuxt: Manifest = {
    version: 2,
    framework: { name: "nuxt" },
    routing: "static-first",
    routes: [
      { pattern: "/", type: "prerendered", file: "index.html" },
      { pattern: "/**", type: "server", regex: "^/.*$" },
    ],
    redirects: [],
    headers: [],
    server: { entry: "server/entry.js", format: "iife-global" },
  };

  it("still serves listed prerendered routes from their file", () => {
    expect(matchRoute(nuxt, "/")).toEqual({ kind: "prerendered", file: "index.html" });
  });

  it("tries the static file first and names the server route to fall back to", () => {
    expect(matchRoute(nuxt, "/_nuxt/app.js")).toEqual({
      kind: "static-then-server",
      files: ["_nuxt/app.js"],
      route: nuxt.routes[1],
    });
    expect(matchRoute(nuxt, "/blog/")).toEqual({
      kind: "static-then-server",
      files: ["blog/index.html", "blog.html"],
      route: nuxt.routes[1],
    });
  });

  it("tries every file a page path could be before rendering it", () => {
    expect(matchRoute(nuxt, "/blog")).toEqual({
      kind: "static-then-server",
      files: ["blog/index.html", "blog.html", "blog"],
      route: nuxt.routes[1],
    });
  });

  it("accepts the routing field only with the two known values", () => {
    expect(validateManifest({ ...nuxt, routing: "static-first" }).ok).toBe(true);
    expect(validateManifest({ ...nuxt, routing: "server-first" }).ok).toBe(true);
    const bad = validateManifest({ ...nuxt, routing: "magic" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors).toContain("routing must be server-first or static-first");
  });
});

describe("matchRoute", () => {
  const manifest = (validateManifest(hybridSite) as { ok: true; manifest: Manifest }).manifest;

  it("sends a path that matches a server regex to the server", () => {
    expect(matchRoute(manifest, "/blog/hello")).toEqual({
      kind: "server",
      route: manifest.routes[1],
    });
    expect(matchRoute(manifest, "/api/users/1")).toEqual({
      kind: "server",
      route: manifest.routes[2],
    });
  });

  it("serves a prerendered route from its file", () => {
    expect(matchRoute(manifest, "/")).toEqual({ kind: "prerendered", file: "index.html" });
  });

  it("treats a path with an extension as a static file under client", () => {
    expect(matchRoute(manifest, "/_astro/app.css")).toEqual({
      kind: "static",
      files: ["_astro/app.css"],
    });
  });

  it("resolves a directory path to its index.html or its html file", () => {
    expect(matchRoute(manifest, "/docs/")).toEqual({
      kind: "static",
      files: ["docs/index.html", "docs.html"],
    });
  });

  it("resolves a page path without a trailing slash to the same files", () => {
    expect(matchRoute(manifest, "/docs")).toEqual({
      kind: "static",
      files: ["docs/index.html", "docs.html", "docs"],
    });
    expect(matchRoute(manifest, "/en/about-me")).toEqual({
      kind: "static",
      files: ["en/about-me/index.html", "en/about-me.html", "en/about-me"],
    });
  });

  it("looks at the last segment only when deciding whether a path is a file", () => {
    expect(matchRoute(manifest, "/v1.2/docs")).toEqual({
      kind: "static",
      files: ["v1.2/docs/index.html", "v1.2/docs.html", "v1.2/docs"],
    });
  });

  it("resolves the root to index.html when no route lists it", () => {
    expect(matchRoute({ ...manifest, routes: [] }, "/")).toEqual({
      kind: "static",
      files: ["index.html"],
    });
  });

  it("lets a server route win over a prerendered route with the same pattern", () => {
    const both = {
      ...manifest,
      routes: [
        { pattern: "/", type: "prerendered", file: "index.html" },
        { pattern: "/", type: "server", regex: "^/$" },
      ],
    } as Manifest;
    expect(matchRoute(both, "/").kind).toBe("server");
  });
});
