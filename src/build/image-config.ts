import type { AstroConfig } from "astro";
import type { Options } from "../types.ts";

type ImageServiceConfig = { entrypoint: string; config: Record<string, never> };

/**
 * Resolves which image service the adapter should configure, or undefined to
 * leave the user's configuration untouched. Astro's default sharp service
 * cannot run on the Bunny runtime (native bindings, child_process), so it is
 * swapped out unless a mode explicitly builds with it.
 */
export function resolveImageService(
  imageService: Options["imageService"],
  config: AstroConfig,
  command: string,
  bunnyServiceEntrypoint: string,
): ImageServiceConfig | undefined {
  if (imageService === "bunny" && command !== "dev") {
    return { entrypoint: bunnyServiceEntrypoint, config: {} };
  }
  const isSharp = String(config.image?.service?.entrypoint).includes("services/sharp");
  if ((imageService === undefined || imageService === "passthrough") && isSharp) {
    return { entrypoint: "astro/assets/services/noop", config: {} };
  }
  // "compile" and "custom" keep the configured service; compile additionally
  // leaves sharp external at bundle time so it never ships to Bunny.
  return undefined;
}
