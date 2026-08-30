# Quickstart: Public docs and GitHub Pages

## Prerequisites

- A clone of this repository
- A browser (no Lucider build required to view `docs/`)

## Validate locally

1. Confirm scratch evals are gone:

   ```bash
   ls evals 2>/dev/null || echo "evals/ absent or empty"
   ```

   Expected: no `raw-aider-lucider.md`, `zod-annotated-feature.md`, `zod-complex-feature.md`, or `hono-complex-feature.md`.

2. Open the site without a server (file URLs work because assets are relative):

   ```bash
   open docs/index.html          # macOS
   # or: python3 -m http.server --directory docs 8000
   ```

   Expected: landing page loads with stylesheet; **Performance** navigates to `performance.html`; numbers match [performance-report.md](./contracts/performance-report.md).

3. Read the canonical markdown:

   ```bash
   head -n 40 docs/performance.md
   ```

   Expected: English title, method, and the three task token triples.

4. README front door:

   ```bash
   grep -n "License\|Contributing\|docs/performance" README.md
   ```

   Expected: install/CLI still present; links to Pages-oriented docs and the performance report.

## GitHub Pages

After merge, set **Settings → Pages → Deploy from a branch → `/docs`**.  
Visit `https://mehmetyz.github.io/lucider/`. CSS must load (relative `styles.css`).

## Out of scope here

CLI behavior, grammar, and tests are unchanged. To validate Lucider itself, see [../../002-dynamic-context-chunks/quickstart.md](../002-dynamic-context-chunks/quickstart.md).
