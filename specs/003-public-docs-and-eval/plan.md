# Implementation Plan: Public Docs, Eval Cleanup, and GitHub Pages

**Branch**: `003-public-docs-and-eval` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-public-docs-and-eval/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Replace internal Turkish eval scratch files with one English performance report, bring repository markdown up to open-source front-door quality, and ship a static GitHub Pages site from `docs/`. No Lucider runtime or grammar change. Numbers are frozen from the 2026-08-30 cl100k_base / isolated-agent runs.

## Technical Context

**Language/Version**: Static HTML5 + CSS3 for Pages; Markdown for README, CONTRIBUTING, and the canonical performance report. Lucider itself remains TypeScript on Node.js ≥ 18 (unchanged).

**Primary Dependencies**: None at runtime for the site (no Jekyll, no npm build). Google Fonts loaded from the CDN for the Pages site only.

**Storage**: Files under `docs/`, plus `README.md`, `CONTRIBUTING.md`, `package.json` metadata. No database.

**Testing**: Manual: open `docs/index.html` and `docs/performance.html` in a browser; confirm relative CSS; confirm `evals/` is empty of markdown. No new Vitest cases (docs-only).

**Target Platform**: GitHub Pages (project site, `/docs` on the default branch). Also readable as files in the repo.

**Project Type**: Documentation / static site overlay on the existing single-project CLI+library

**Performance Goals**: First paint of the static pages without a bundler; assets small enough to load on GitHub Pages (single CSS, no JS framework).

**Constraints**: Relative URLs only (project pages live at `/lucider/`). `.nojekyll` so GitHub does not process HTML. Constitution IV: do not rewrite user source. Do not invent token counts.

**Scale/Scope**: One landing page, one HTML performance page, one markdown report, README + CONTRIBUTING + package metadata. No blog, no search, no i18n.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Directive-Driven Context | Public docs must not invent undocumented directive keys | PASS — README/site document existing grammar 1.1.0 only |
| II. Deterministic Graph Output | Docs must not claim non-deterministic behavior | PASS — no runtime change |
| III. Context Minimization | Report MUST teach query packs over full-index dump | PASS — central finding of the performance report |
| IV. Non-Destructive Source Handling | This feature writes only docs/metadata, never user trees | PASS — `evals/` deletion and `docs/` writes only |
| V. Language-Agnostic Core | Site must not imply JS-only forever | PASS — README still says pluggable Tree-sitter parsers |

**Result:** No violations. Complexity Tracking empty.

**Post-design re-check:** Contracts are documentation/site layout only. Still no parser, grammar, or artifact-schema change. Gates remain PASS.

## Project Structure

### Documentation (this feature)

```text
specs/003-public-docs-and-eval/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── github-pages.md
    └── performance-report.md
```

### Source Code (repository root)

```text
docs/
├── .nojekyll
├── index.html
├── performance.html
├── performance.md
└── styles.css

README.md
CONTRIBUTING.md
package.json          # homepage, repository, bugs, keywords
evals/                # emptied of scratch markdown
```

**Structure Decision**: Keep the existing single-project `src/` / `tests/` tree. Public documentation lives in `docs/` (GitHub Pages source) rather than a separate frontend app.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None.
