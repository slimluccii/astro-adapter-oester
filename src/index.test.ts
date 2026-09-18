import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  AstroConfig,
  AstroIntegration,
  AstroIntegrationLogger,
  IntegrationResolvedRoute,
} from "astro";
import { expect, test } from "vitest";
import createIntegration from "./index.ts";

const logger = { info: () => {}, warn: () => {} } as unknown as AstroIntegrationLogger;

async function siteRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "oester-astro-adapter-"));
  await mkdir(join(root, "dist", "client"), { recursive: true });
  await mkdir(join(root, "dist", "server"), { recursive: true });
  await writeFile(join(root, "dist", "client", "index.html"), "<h1>home</h1>");
  await writeFile(
    join(root, "dist", "server", "entry.mjs"),
    "export default async function handler() { return new Response('ok'); }",
  );
  return root;
}

function configFor(root: string): AstroConfig {
  return {
    root: pathToFileURL(`${root}/`),
    base: "/",
    image: { service: { entrypoint: "astro/assets/services/sharp", config: {} } },
    build: {
      client: pathToFileURL(join(root, "dist", "client/")),
      server: pathToFileURL(join(root, "dist", "server/")),
      serverEntry: "entry.mjs",
      format: "directory",
      assets: "_astro",
    },
  } as unknown as AstroConfig;
}

const homeRoute = {
  type: "page",
  pattern: "/",
  patternRegex: { source: "^\\/$" },
  isPrerendered: true,
  pathname: "/",
} as unknown as IntegrationResolvedRoute;

// Astro runs the hooks of every integration in configuration order, and the
// adapter comes before the integrations the site lists.
async function build(root: string, alongside: AstroIntegration[]): Promise<void> {
  const adapter = createIntegration();
  const added: AstroIntegration[] = [];
  const config = configFor(root);

  await adapter.hooks["astro:config:setup"]?.({
    config,
    command: "build",
    updateConfig: (update: { integrations?: AstroIntegration[] }) => {
      added.push(...(update.integrations ?? []));
      return config;
    },
  } as never);
  await adapter.hooks["astro:config:done"]?.({ config, setAdapter: () => {} } as never);
  await adapter.hooks["astro:routes:resolved"]?.({ routes: [homeRoute] } as never);
  await adapter.hooks["astro:build:generated"]?.({ routeToHeaders: new Map() } as never);

  for (const integration of [adapter, ...alongside, ...added]) {
    await integration.hooks["astro:build:done"]?.({ logger } as never);
  }
}

test("deploys the files an integration writes into the client directory after the adapter", async () => {
  const root = await siteRoot();
  const sitemap: AstroIntegration = {
    name: "sitemap",
    hooks: {
      "astro:build:done": async () => {
        await writeFile(join(root, "dist", "client", "sitemap-index.xml"), "<urlset />");
      },
    },
  };

  await build(root, [sitemap]);

  const output = join(root, ".oester", "output");
  expect(await readFile(join(output, "client", "sitemap-index.xml"), "utf8")).toBe("<urlset />");
  expect(await readFile(join(output, "client", "index.html"), "utf8")).toBe("<h1>home</h1>");
  expect(JSON.parse(await readFile(join(output, "manifest.json"), "utf8")).routes).toEqual([
    { pattern: "/", type: "prerendered", file: "index.html" },
  ]);
});
