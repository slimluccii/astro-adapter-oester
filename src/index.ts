import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroConfig, AstroIntegration, IntegrationResolvedRoute } from "astro";
import { bundleServer } from "./build/bundle.ts";
import { resolveImageService } from "./build/image-config.ts";
import { buildManifest } from "./build/manifest.ts";
import { createServerAliases } from "./build/node-compat.ts";
import {
  CLIENT_DIRECTORY,
  DEFAULT_SERVER_ENTRY,
  MANIFEST_FILE,
  OUTPUT_DIRECTORY,
  validateManifest,
} from "./build-output/index.ts";
import type { Options } from "./types.ts";

// The published package runs from compiled .js files, the tests from the .ts sources.
const runtimeExtension = import.meta.url.endsWith(".ts") ? ".ts" : ".js";

function runtimePath(name: string): string {
  return fileURLToPath(new URL(`./runtime/${name}${runtimeExtension}`, import.meta.url));
}

export default function createIntegration(options: Options = {}): AstroIntegration {
  let resolvedConfig: AstroConfig;
  let resolvedRoutes: IntegrationResolvedRoute[] = [];
  const staticHeaders: Record<string, Record<string, string>> = {};

  return {
    name: "astro-adapter-oester",
    hooks: {
      "astro:config:setup": ({ updateConfig, config, command }) => {
        const imageService = resolveImageService(
          options.imageService,
          config,
          command,
          runtimePath("image"),
        );
        if (imageService) {
          updateConfig({ image: { service: imageService } });
        }
      },
      "astro:config:done": ({ setAdapter, config }) => {
        resolvedConfig = config;
        setAdapter({
          name: "astro-adapter-oester",
          entrypointResolution: "auto",
          serverEntrypoint: runtimePath("handler"),
          adapterFeatures: {
            staticHeaders: true,
            preserveBuildClientDir: true,
            preserveBuildServerDir: true,
          },
          supportedAstroFeatures: {
            hybridOutput: "stable",
            staticOutput: "stable",
            serverOutput: "stable",
            envGetSecret: "stable",
            sharpImageService: {
              support: "limited",
              message:
                "Sharp is not available on the target runtime. The adapter falls back to the noop image service; set imageService: 'bunny' for Bunny Optimizer.",
            },
          },
        });
      },
      "astro:build:setup": ({ vite, target }) => {
        if (target === "server") {
          vite.resolve = vite.resolve ?? {};
          vite.resolve.alias = vite.resolve.alias ?? {};

          const aliases = createServerAliases();
          if (Array.isArray(vite.resolve.alias)) {
            vite.resolve.alias = [...vite.resolve.alias, ...aliases];
          } else {
            for (const alias of aliases) {
              (vite.resolve.alias as Record<string, string>)[alias.find] = alias.replacement;
            }
          }
        }
      },
      "astro:routes:resolved": ({ routes }) => {
        resolvedRoutes = routes;
      },
      "astro:build:generated": ({ routeToHeaders }) => {
        for (const [pathname, { headers }] of routeToHeaders) {
          const entries: Record<string, string> = {};
          headers.forEach((value, key) => {
            entries[key] = value;
          });
          if (Object.keys(entries).length > 0) {
            staticHeaders[pathname] = entries;
          }
        }
      },
      "astro:build:done": async ({ logger }) => {
        const root = fileURLToPath(resolvedConfig.root);
        const clientDir = fileURLToPath(resolvedConfig.build.client);
        const serverDir = fileURLToPath(resolvedConfig.build.server);
        const outputDir = join(root, OUTPUT_DIRECTORY);

        // In compile mode prerendering already ran with sharp; leaving the
        // lazy `import("sharp")` unresolved keeps the native module out of
        // the deployed bundle, and nothing prerendered ever executes it.
        const external = options.imageService === "compile" ? ["sharp"] : [];
        const bundle = await bundleServer(
          join(serverDir, resolvedConfig.build.serverEntry),
          logger,
          external,
        );

        const manifest = buildManifest({
          buildFormat: resolvedConfig.build.format,
          assetsDir: resolvedConfig.build.assets,
          routes: resolvedRoutes,
          staticHeaders,
          base: resolvedConfig.base,
        });
        const validation = validateManifest(manifest);
        if (!validation.ok) throw new Error(`oester manifest: ${validation.errors.join("; ")}`);

        await rm(outputDir, { recursive: true, force: true });
        await mkdir(dirname(join(outputDir, DEFAULT_SERVER_ENTRY)), { recursive: true });
        await cp(clientDir, join(outputDir, CLIENT_DIRECTORY), { recursive: true });
        await writeFile(join(outputDir, DEFAULT_SERVER_ENTRY), bundle);
        await writeFile(join(outputDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
        logger.info(
          `Wrote ${OUTPUT_DIRECTORY} (bundle ${Math.round(bundle.byteLength / 1024)}KB, ${manifest.routes.length} routes)`,
        );
      },
    },
  };
}
