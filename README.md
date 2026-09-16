# astro-adapter-oester

The [Astro](https://astro.build) adapter for Oester. It turns an Astro build into the Oester build output in `.oester/output`: the client files, one server bundle and a `manifest.json` with the routes, redirects and headers.

## Install

```sh
npm install astro-adapter-oester
```

Then set it as the adapter; `astro add` does not configure it for you.

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import oester from "astro-adapter-oester";

export default defineConfig({
  adapter: oester(),
});
```

Add `.oester` to your `.gitignore`.

A `base` in your Astro config works as it does on other hosts: Oester serves the site under that path and redirects the root of the domain there. Write redirect destinations with the base in them, as Astro expects.

## Options

`imageService` decides what happens to Astro's image service, because sharp cannot run on the Oester runtime:

- `"passthrough"` (default): images are served as they are. A non-sharp service you configured yourself is left alone.
- `"bunny"`: images are transformed by Bunny Optimizer through URL parameters. `astro dev` keeps using sharp.
- `"compile"`: sharp optimizes images at build time for prerendered pages only.
- `"custom"`: the adapter does not touch the image configuration.

```js
adapter: oester({ imageService: "bunny" }),
```

## Versions

Two dist-tags are published:

- `latest`: the stable release, installed by default.
- `dev`: a snapshot of every change on `main` that is not released yet, for example `0.2.0-dev-20260916101500`. Install it with `npm install astro-adapter-oester@dev`. Version ranges such as `^0.1.0` never resolve to it.

## Releasing

Every change that users notice gets a changeset, committed with the change:

```sh
pnpm changeset
```

While changesets are pending on `main`, every push to `main` publishes them as a snapshot under `dev` and keeps a "Version Packages" pull request up to date with the next versions and changelog. Merging that pull request is the release: the version it contains is published under `latest`, tagged, and gets a GitHub release.

Publishing uses npm trusted publishing from `.github/workflows/release.yml` in the `npm` environment, so the repository holds no npm token.

`src/build-output` is a copy of the Oester build output contract. Change it in the Oester platform first, then copy it here.
