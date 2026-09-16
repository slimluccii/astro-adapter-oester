import type { ExternalImageService } from "astro";

const QUALITY_PRESETS: Record<string, number> = {
  low: 50,
  mid: 75,
  high: 90,
  max: 100,
};

/**
 * Image service backed by Bunny Optimizer: images are transformed by the
 * pull zone itself via query parameters, so nothing runs in the edge script.
 * Requires Bunny Optimizer with the Dynamic Image API enabled on the zone;
 * without it the parameters are ignored and originals are served.
 */
const service: ExternalImageService = {
  validateOptions(options) {
    if (options.width) options.width = Math.round(options.width);
    if (options.height) options.height = Math.round(options.height);
    return options;
  },
  getURL(options) {
    const src = typeof options.src === "string" ? options.src : options.src.src;
    // Absolute URLs point at other hosts the Optimizer cannot process.
    if (/^https?:\/\//.test(src)) return src;
    const params = new URLSearchParams();
    if (options.width) params.set("width", String(options.width));
    if (options.height) params.set("height", String(options.height));
    if (options.quality) {
      const quality =
        typeof options.quality === "number" ? options.quality : QUALITY_PRESETS[options.quality];
      if (quality) params.set("quality", String(quality));
    }
    if (options.format) params.set("format", options.format);
    const query = params.toString();
    return query ? `${src}${src.includes("?") ? "&" : "?"}${query}` : src;
  },
  getSrcSet(options) {
    const widths = options.widths ?? [];
    return widths.map((width) => ({
      transform: { ...options, width, height: undefined },
      descriptor: `${width}w`,
    }));
  },
  getHTMLAttributes(options) {
    const {
      src: _src,
      width,
      height,
      format: _format,
      quality: _quality,
      widths: _widths,
      densities: _densities,
      ...attributes
    } = options;
    return {
      ...attributes,
      width,
      height,
      loading: attributes.loading ?? "lazy",
      decoding: attributes.decoding ?? "async",
    };
  },
};

export default service;
