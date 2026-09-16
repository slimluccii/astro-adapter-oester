// Only the Deno surface the runtime uses; the package is typed against Node
// and the full Deno lib would conflict with it.
declare const Deno: {
  env: { get(key: string): string | undefined };
};
