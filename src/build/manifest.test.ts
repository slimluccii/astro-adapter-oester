import { expect, test } from "vitest";
import { validateManifest } from "../build-output/index.ts";
import { buildManifest, prerenderedFile, type RouteInfo } from "./manifest.ts";

const baseInput = {
  buildFormat: "directory" as const,
  assetsDir: "_astro",
  staticHeaders: {},
};

const routes: RouteInfo[] = [
  {
    type: "page",
    pattern: "/",
    patternRegex: { source: "^\\/$" },
    isPrerendered: true,
    pathname: "/",
  },
  {
    type: "page",
    pattern: "/blog/[slug]",
    patternRegex: { source: "^\\/blog\\/([^/]+?)\\/?$" },
    isPrerendered: false,
  },
  {
    type: "page",
    pattern: "/projects/[id]",
    patternRegex: { source: "^\\/projects\\/([^/]+?)\\/?$" },
    isPrerendered: true,
  },
  {
    type: "endpoint",
    pattern: "/robots.txt",
    patternRegex: { source: "^\\/robots\\.txt$" },
    isPrerendered: true,
    pathname: "/robots.txt",
  },
  {
    type: "redirect",
    pattern: "/old",
    patternRegex: { source: "^\\/old$" },
    isPrerendered: false,
    redirect: { status: 308, destination: "/new" },
  },
  {
    type: "fallback",
    pattern: "/[...locale]",
    patternRegex: { source: "^\\/(.*)$" },
    isPrerendered: false,
  },
];

test("builds a valid manifest with ssr regex, prerendered files and redirects", () => {
  const manifest = buildManifest({ ...baseInput, routes });
  expect(validateManifest(manifest).ok).toBe(true);
  expect(manifest.routes).toEqual([
    { pattern: "/", type: "prerendered", file: "index.html" },
    {
      pattern: "/blog/[slug]",
      type: "server",
      regex: "^\\/blog\\/([^/]+?)\\/?$",
    },
    { pattern: "/robots.txt", type: "prerendered", file: "robots.txt" },
  ]);
  expect(manifest.redirects).toEqual([{ from: "/old", to: "/new", status: 308 }]);
  expect(manifest).toMatchObject({
    version: 2,
    framework: { name: "astro" },
    server: { entry: "server/entry.js", format: "iife-global" },
  });
});

test("dynamic prerendered routes get no entry", () => {
  const manifest = buildManifest({ ...baseInput, routes });
  const patterns = manifest.routes.map((route) => route.pattern);
  expect(patterns).not.toContain("/projects/[id]");
});

test("assets directory always gets the immutable cache header", () => {
  const manifest = buildManifest({ ...baseInput, routes: [] });
  expect(manifest.headers).toEqual([
    {
      path: "/_astro/*",
      headers: { "cache-control": "public, max-age=31536000, immutable" },
    },
  ]);
});

test("static headers from the build land in the manifest", () => {
  const manifest = buildManifest({
    ...baseInput,
    routes: [],
    staticHeaders: { "/": { "content-security-policy": "default-src 'self'" } },
  });
  expect(manifest.headers[0]).toEqual({
    path: "/",
    headers: { "content-security-policy": "default-src 'self'" },
  });
});

test("an invalid redirect status falls back to 301", () => {
  const manifest = buildManifest({
    ...baseInput,
    routes: [
      {
        type: "redirect",
        pattern: "/a",
        patternRegex: { source: "^\\/a$" },
        isPrerendered: false,
        redirect: { status: 303, destination: "/b" },
      },
    ],
  });
  expect(manifest.redirects[0]?.status).toBe(301);
});

test("prerenderedFile follows the build format", () => {
  expect(prerenderedFile("/", "page", "directory")).toBe("index.html");
  expect(prerenderedFile("/about", "page", "directory")).toBe("about/index.html");
  expect(prerenderedFile("/about", "page", "file")).toBe("about.html");
  expect(prerenderedFile("/404.html", "page", "directory")).toBe("404.html");
  expect(prerenderedFile("/robots.txt", "endpoint", "directory")).toBe("robots.txt");
});

test("tells Oester the base, and keeps routes and redirects as Astro wrote them", () => {
  const manifest = buildManifest({
    ...baseInput,
    base: "/docs",
    routes: [
      {
        type: "page",
        pattern: "/",
        patternRegex: { source: "^\\/$" },
        isPrerendered: true,
        pathname: "/",
      },
      {
        type: "endpoint",
        pattern: "/api/hello",
        patternRegex: { source: "^\\/api\\/hello\\/?$" },
        isPrerendered: false,
      },
      {
        type: "redirect",
        pattern: "/old",
        patternRegex: { source: "^\\/old$" },
        isPrerendered: false,
        redirect: "/docs/new",
      },
    ],
  });
  expect(manifest.base).toBe("/docs");
  expect(validateManifest(manifest)).toMatchObject({ ok: true, manifest: { base: "/docs/" } });
  expect(manifest.routes).toEqual([
    { pattern: "/", type: "prerendered", file: "index.html" },
    { pattern: "/api/hello", type: "server", regex: "^\\/api\\/hello\\/?$" },
  ]);
  expect(manifest.redirects).toEqual([{ from: "/old", to: "/docs/new", status: 301 }]);
});

test("leaves the base out for a site at the root", () => {
  expect(buildManifest({ ...baseInput, routes, base: "/" })).not.toHaveProperty("base");
});
