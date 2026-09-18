---
"astro-adapter-oester": patch
---

Files that another integration writes into the client directory, such as a sitemap, now reach the deployed output. The adapter copied that directory from its own build hook, which Astro runs before the hooks of the integrations a site lists.
