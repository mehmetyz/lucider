# Feature Specification: Public Docs, Eval Cleanup, and GitHub Pages

**Feature Branch**: `003-public-docs-and-eval`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "Delete evals/, write one English performance-analysis markdown, update project markdown as a proper open-source project, create a static GitHub Pages site in docs/"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Replace scratch evals with a public performance report (Priority: P1)

A visitor or contributor who finds Lucider should see one English performance analysis that reports measured context size and agent quality, not a folder of Turkish scratch notes. The old `evals/` write-ups are removed so they cannot be mistaken for project documentation.

**Why this priority**: Scratch evals are not publishable; they are the only record of the measurements. Replacing them is the source of truth for the rest of this feature.

**Independent Test**: `evals/` contains no remaining analysis markdown. A single English report exists under `docs/` and can be read without the deleted files.

**Acceptance Scenarios**:

1. **Given** the four Turkish eval markdown files under `evals/`, **When** this feature ships, **Then** those files are gone and their numbers live in one English report.
2. **Given** a reader who does not speak Turkish, **When** they open the performance report, **Then** they can follow method, corpora, token tables, quality scores, and caveats in English.

---

### User Story 2 - README that reads as an open-source project (Priority: P1)

A developer landing on the GitHub repository understands what Lucider is, how to install and run it, how to use query packs with Claude or Codex, where the docs site and performance report live, and how to contribute — without needing internal spec-kit vocabulary.

**Why this priority**: The repository front door is how most people discover the tool.

**Independent Test**: A new contributor can install, run a one-liner, and find license, contributing, and docs links from the README alone.

**Acceptance Scenarios**:

1. **Given** a clone of the repo, **When** the reader opens `README.md`, **Then** they see install, CLI, directives, library import, development commands, license, and links to the docs site and performance report.
2. **Given** product positioning, **When** the README describes assistants, **Then** it names Claude/Codex (and similar) as the intended consumers and does not present Aider as a Lucider product surface.

---

### User Story 3 - Static GitHub Pages site in `docs/` (Priority: P1)

A visitor opens the GitHub Pages site (project pages from `/docs`) and gets a self-contained static landing page plus a readable performance page, with no build step and no server.

**Why this priority**: The user asked for a GitHub Pages site in `docs/`; it is the public face of the measurements.

**Independent Test**: Opening `docs/index.html` in a browser (or via Pages) shows the product pitch and numbers; internal links work with relative URLs suitable for `https://mehmetyz.github.io/lucider/`.

**Acceptance Scenarios**:

1. **Given** GitHub Pages source set to `/docs`, **When** a visitor loads the site, **Then** they see a static homepage that explains Lucider and links to the performance analysis.
2. **Given** a project-pages base path (`/lucider/`), **When** CSS and page links are resolved, **Then** they use relative paths (not site-root `/styles.css`).

---

### Edge Cases

- Empty `evals/` after deletion is acceptable; the directory need not be kept.
- GitHub Pages Jekyll must not swallow or rewrite static HTML (use `.nojekyll`).
- The performance report must stand alone if the HTML site is not opened.
- Aider appears only as a measured repo-map baseline, never as a required runtime.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST delete the scratch eval markdown currently under `evals/` (`raw-aider-lucider.md`, `zod-annotated-feature.md`, `zod-complex-feature.md`, `hono-complex-feature.md`).
- **FR-002**: The repository MUST publish one English performance-analysis markdown under `docs/` that records method, corpora, token counts, agent quality scores, the “do not dump the full index” finding, and limitations.
- **FR-003**: Token counts in that report MUST match the already-measured runs (cl100k_base) rather than being invented; quality scores MUST match the completed agent rubrics (all arms tied on correctness).
- **FR-004**: `README.md` MUST read as a public open-source project: purpose, install, CLI, directives, assistant workflow, development, license, and links to docs and the performance report.
- **FR-005**: A static site MUST live in `docs/` suitable for GitHub Pages (HTML + CSS, relative URLs, `.nojekyll`).
- **FR-006**: The site MUST present Lucider as a context packer for Claude/Codex-style assistants using this CLI, not as an Aider plugin.
- **FR-007**: Package metadata (`package.json` homepage/repository/bugs) MUST point at the GitHub repo and Pages URL so the project is discoverable as OSS.
- **FR-008**: A short `CONTRIBUTING.md` MUST exist so first-time contributors know how to build and test.
- **FR-009**: Lucider MUST NOT modify user source as part of this feature (docs-only change).

### Key Entities

- **Performance report**: Canonical English write-up of eval method, corpora, arms (raw / repo-map baseline / Lucider pack), tokens, and rubric scores.
- **Docs site page**: Static HTML document in `docs/` sharing one stylesheet.
- **Project front matter**: README, CONTRIBUTING, package metadata, LICENSE (already MIT).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero remaining markdown files under `evals/` after the change.
- **SC-002**: A reader can find install, CLI, license, and performance numbers without opening `specs/`.
- **SC-003**: `docs/index.html` and `docs/performance.html` render without a bundler; CSS loads via relative links.
- **SC-004**: The performance report states the three coding-task token triples (Zod helper, Zod graph walk, Hono pipeline) and that quality was tied across arms.

## Assumptions

- GitHub Pages will be enabled by the maintainer (Settings → Pages → Deploy from branch → `/docs`); this feature ships the files, not the GitHub UI toggle.
- Measured numbers from 2026-08-30 runs are frozen; this feature does not re-run agents.
- Project Pages URL is `https://mehmetyz.github.io/lucider/`.
- Spec-kit internal docs stay under `specs/`; they are not the public site.
