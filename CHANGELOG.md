# astro-adapter-oester

## 0.2.1

### Patch Changes

- c465fe6: Files that another integration writes into the client directory, such as a sitemap, now reach the deployed output. The adapter copied that directory from its own build hook, which Astro runs before the hooks of the integrations a site lists.

## 0.2.0

### Minor Changes

- 7027afc: The manifest now carries Astro's `base`, so Oester serves a site with a base under that path and redirects the root of the domain there.

## 0.1.0

### Minor Changes

- b042f72: First release on npm. The adapter used to be installed from a local copy as `@oester/astro`; install `astro-adapter-oester` instead and change the import in `astro.config`.
