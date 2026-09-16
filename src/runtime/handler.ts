import { createApp } from "astro/app/entrypoint";
import { setGetEnv } from "astro/env/setup";
import { ENV_GLOBALS } from "../build-output/contract.ts";

// Snapshot at evaluation: outside a request the router exposes the environment only while this bundle loads.
const env: Record<string, string> = {
  ...(globalThis as unknown as Record<string, Record<string, string> | undefined>)[ENV_GLOBALS[0]],
};
setGetEnv((key) => env[key]);

const app = createApp();

export default async function handler(request: Request): Promise<Response> {
  const clientAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const routeData = app.match(request);
  const response = await app.render(request, {
    addCookieHeader: true,
    ...(routeData ? { routeData } : {}),
    ...(clientAddress ? { clientAddress } : {}),
  });
  return response;
}
