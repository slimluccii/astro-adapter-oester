import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AstroIntegrationLogger } from "astro";
import { expect, test } from "vitest";
import { HANDLER_GLOBAL, type Handler } from "../build-output/index.ts";
import { bundleServer } from "./bundle.ts";

test("bundles the server entry into a script that assigns the handler the router reads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "oester-astro-bundle-"));
  const entry = join(dir, "entry.mjs");
  await writeFile(
    entry,
    "export default async function handler(request) { return new Response('ok ' + new URL(request.url).pathname); }",
  );
  const logger = { warn: () => {} } as unknown as AstroIntegrationLogger;
  const code = new TextDecoder().decode(await bundleServer(entry, logger, []));
  const scope = globalThis as Record<string, unknown>;
  try {
    new Function("process", code)({ env: {} });
    const handler = scope[HANDLER_GLOBAL] as Handler;
    expect(await (await handler(new Request("https://blog.oester.app/a"))).text()).toBe("ok /a");
  } finally {
    delete scope[HANDLER_GLOBAL];
  }
});
