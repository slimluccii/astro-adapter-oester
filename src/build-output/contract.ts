export const OUTPUT_DIRECTORY = ".oester/output";
export const MANIFEST_FILE = "manifest.json";
export const CLIENT_DIRECTORY = "client";
export const DEFAULT_SERVER_ENTRY = "server/entry.js";
export const DEFAULT_NOT_FOUND = "404.html";

export const MODULE_GLOBAL = "__oesterModule";
export const HANDLER_GLOBAL = "__oesterHandler";
// __env__ is where unenv's process.env shim looks, so nitro bundles read the same environment.
export const ENV_GLOBALS = ["__oesterEnv", "__env__"] as const;
export const BUNDLE_FOOTER = `globalThis.${HANDLER_GLOBAL} = ${MODULE_GLOBAL}.default;`;
// The one bundle format: an iife ending in BUNDLE_FOOTER that reads its environment from ENV_GLOBALS.
export const BUNDLE_FORMAT = "iife-global";

export type Handler = (request: Request) => Promise<Response>;

export const RESERVED_VARIABLE_PREFIX = "OESTER_";

export interface Build {
  branch: string;
  commitSha: string;
  deploymentId: string;
  environment: "production" | "preview";
}

export function buildEnvironment(build: Build): Record<string, string> {
  return {
    CI: "true",
    OESTER: "1",
    OESTER_BRANCH: build.branch,
    OESTER_COMMIT_SHA: build.commitSha,
    OESTER_DEPLOYMENT_ID: build.deploymentId,
    OESTER_ENVIRONMENT: build.environment,
  };
}
