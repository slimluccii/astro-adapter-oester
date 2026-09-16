// Node builtins that the Bunny runtime (Deno-based) polyfills.
// REF: https://github.com/denoland/deno/tree/main/ext/node/polyfills
const COMPATIBLE_NODE_MODULES = [
  "assert",
  "assert/strict",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "events",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "path/posix",
  "path/win32",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "stream/promises",
  "stream/web",
  "string_decoder",
  "sys",
  "timers",
  "timers/promises",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "util/types",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
];

export interface Alias {
  find: string;
  replacement: string;
}

export function createServerAliases(): Alias[] {
  return [
    {
      find: "react-dom/server",
      replacement: "react-dom/server.browser",
    },
    ...COMPATIBLE_NODE_MODULES.map((mod) => ({
      find: mod,
      replacement: `node:${mod}`,
    })),
  ];
}
