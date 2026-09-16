import { dirname, join } from "node:path";
import type { AstroIntegrationLogger } from "astro";
import { build } from "esbuild";
import { BUNDLE_FOOTER, MODULE_GLOBAL } from "../build-output/index.ts";

// Bunny's runtime refuses dynamic import(), so the router evaluates this bundle as a script.
export async function bundleServer(
  entryPath: string,
  logger: AstroIntegrationLogger,
  external: string[],
): Promise<Uint8Array> {
  const result = await build({
    entryPoints: [entryPath],
    outfile: join(dirname(entryPath), "entry.oester.js"),
    bundle: true,
    write: false,
    external,
    minify: true,
    format: "iife",
    globalName: MODULE_GLOBAL,
    footer: { js: BUNDLE_FOOTER },
    platform: "node",
    target: "esnext",
    conditions: ["deno"],
    logLevel: "silent",
  });
  for (const warning of result.warnings) {
    logger.warn(warning.text);
  }
  const output = result.outputFiles[0];
  if (!output) throw new Error("esbuild produced no output");
  return output.contents;
}
