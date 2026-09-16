import { describe, expect, it } from "vitest";
import {
  BUNDLE_FOOTER,
  BUNDLE_FORMAT,
  buildEnvironment,
  CLIENT_DIRECTORY,
  DEFAULT_NOT_FOUND,
  DEFAULT_SERVER_ENTRY,
  ENV_GLOBALS,
  HANDLER_GLOBAL,
  MANIFEST_FILE,
  MODULE_GLOBAL,
  OUTPUT_DIRECTORY,
  RESERVED_VARIABLE_PREFIX,
} from "./contract.ts";

describe("the build output contract", () => {
  it("keeps the names that adapters write and deployed bundles depend on", () => {
    expect({
      OUTPUT_DIRECTORY,
      MANIFEST_FILE,
      CLIENT_DIRECTORY,
      DEFAULT_SERVER_ENTRY,
      DEFAULT_NOT_FOUND,
      MODULE_GLOBAL,
      HANDLER_GLOBAL,
      ENV_GLOBALS,
      BUNDLE_FOOTER,
      BUNDLE_FORMAT,
      RESERVED_VARIABLE_PREFIX,
    }).toEqual({
      OUTPUT_DIRECTORY: ".oester/output",
      MANIFEST_FILE: "manifest.json",
      CLIENT_DIRECTORY: "client",
      DEFAULT_SERVER_ENTRY: "server/entry.js",
      DEFAULT_NOT_FOUND: "404.html",
      MODULE_GLOBAL: "__oesterModule",
      HANDLER_GLOBAL: "__oesterHandler",
      ENV_GLOBALS: ["__oesterEnv", "__env__"],
      BUNDLE_FOOTER: "globalThis.__oesterHandler = __oesterModule.default;",
      BUNDLE_FORMAT: "iife-global",
      RESERVED_VARIABLE_PREFIX: "OESTER_",
    });
  });

  it("tells the build commands which build they are part of", () => {
    expect(
      buildEnvironment({
        branch: "main",
        commitSha: "abc",
        deploymentId: "d1",
        environment: "production",
      }),
    ).toEqual({
      CI: "true",
      OESTER: "1",
      OESTER_BRANCH: "main",
      OESTER_COMMIT_SHA: "abc",
      OESTER_DEPLOYMENT_ID: "d1",
      OESTER_ENVIRONMENT: "production",
    });
  });
});
