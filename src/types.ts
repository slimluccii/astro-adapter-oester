export interface Options {
  /**
   * Which image service to configure:
   * - "passthrough" (default): originals are served untouched. A non-sharp
   *   `image.service` you configured yourself is left alone.
   * - "bunny": images are transformed through Bunny Optimizer URL parameters
   *   (requires the Optimizer add-on with the Dynamic Image API enabled on
   *   the pull zone). `astro dev` uses sharp so images work locally.
   * - "compile": sharp optimizes images at build time for prerendered pages
   *   only; on-demand rendered pages serve originals.
   * - "custom": the adapter never touches the image configuration.
   */
  imageService?: "passthrough" | "bunny" | "compile" | "custom";
}
