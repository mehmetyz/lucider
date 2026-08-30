# Research: Public Docs, Eval Cleanup, and GitHub Pages

## 1. Where the canonical performance report lives

**Decision:** One English markdown file at `docs/performance.md`, mirrored as a styled `docs/performance.html` for Pages visitors who should not read raw markdown on a static host.

**Rationale:** GitHub Pages from `/docs` with `.nojekyll` serves files as-is. `.md` is downloadable/viewable on github.com but is not rendered as HTML on Pages. The markdown remains the citeable, diffable source of truth; HTML is the reading surface on the site.

**Alternatives considered:**
- Keep `evals/` and add an English file there — rejected; user asked to delete `evals/` contents and not treat scratch notes as docs.
- Root `PERFORMANCE.md` only — workable, but then Pages would need a copy or a redirect. Colocating under `docs/` keeps the public site one tree.
- Jekyll markdown pages — rejected; adds a build/theme and fights `.nojekyll` static HTML.

## 2. GitHub Pages hosting mode

**Decision:** Project Pages, source = `/docs` folder on the default branch. Relative asset URLs. `docs/.nojekyll` present. No CNAME (github.io project URL).

**Rationale:** Matches the user request (“static webpage … docs olsun”). Project URL is `https://mehmetyz.github.io/lucider/`. Root-absolute `/styles.css` would 404 on project Pages.

**Alternatives considered:**
- `docs/` as a Jekyll site with a theme — extra moving parts, generic look.
- GitHub Actions to build a SPA — overkill for a landing + report.
- User Pages repo (`mehmetyz.github.io`) — would split the project from its docs.

## 3. Product positioning vs Aider

**Decision:** Lucider is a CLI/library that emits query packs for Claude, Codex, and similar assistants. Aider’s `--show-repo-map` is a **measurement baseline** in the performance report only.

**Rationale:** Prior evals used Aider as a comparable “what would we paste” arm. The product is not an Aider integration.

**Alternatives considered:**
- Lead the README with Aider comparison — confuses the product.
- Drop Aider from the report — would hide the useful “map vs pack” contrast.

## 4. Frozen metrics (do not re-run)

**Decision:** Publish the 2026-08-30 measurements as-is (tokenizer `gpt-tokenizer` cl100k_base; isolated Cursor agents; one context file per arm).

**Rationale:** User asked to delete evals and write the analysis, not to regenerate agent runs. Inventing new numbers would violate FR-003.

**Alternatives considered:**
- Re-run all agents in-repo — expensive, nondeterministic quality, not requested.
- Omit quality scores and publish tokens only — weaker than the actual finding (quality tied, tokens not).

## 5. Open-source README shape

**Decision:** Standard OSS front door: one-liner, why, install from source (`pnpm`), CLI table, assistant workflow (query not dump), grammar sketch, library snippet, development, contributing link, MIT. `package.json` gets `repository`, `homepage`, `bugs`, `keywords`, `engines`.

**Rationale:** GitHub’s implied contract for a public repo. Spec-kit files stay under `specs/` for implementers, not the first scroll of README.

**Alternatives considered:**
- README that only links to Pages — github.com visitors would see almost nothing.
- Duplicating the full spec in README — too long.

## 6. Site visual direction

**Decision:** Static HTML/CSS, no JS framework. Blueprint-paper field (cool gray-blue, not warm cream), copper “cut” accent for the selected subgraph, Syne-class display avoided in favor of **Bricolage Grotesque** + **IBM Plex Mono**. Signature: dump-vs-pack split, not a giant hero number.

**Rationale:** Frontend-design skill: avoid the three AI-default looks. The product’s characteristic object is a *cut* through a graph, not a dashboard KPI.

**Alternatives considered:**
- Dark acid-green terminal clone — default look #2.
- Broadsheet / newspaper — default look #3.
- React/Vite docs app — violates “static webpage” and adds a build.
