# Contributing to Lucider

Thanks for wanting to change Lucider. The constitution in `.specify/memory/constitution.md`
is the project’s hard rules: directives are explicit, output is deterministic, context stays
small, source is never rewritten, parsers stay pluggable.

## Setup

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

Node.js 18+ is required. The published npm name is [`lucider`](https://www.npmjs.com/package/lucider);
the CLI entry after build is `dist/cli/index.js`.

## What to touch

- Runtime: `src/` (CLI, graph, query, parsers, markdown/JSON output)
- Tests: `tests/unit/` and `tests/integration/`
- Public docs: `docs/` (GitHub Pages) and this README
- Feature specs: `specs/`

Do not check in secrets, `.env`, or regenerated eval dumps under `evals/`. Token measurements
belong in `docs/performance.md` and should not be invented.

## Pull requests

- Keep grammar and artifact schema versioned together when they change.
- New parsers need fixture tests for directive extraction and graph construction.
- Run `pnpm test` and `pnpm typecheck` before you push.

## Releasing

CI (`.github/workflows/ci.yml`) runs on every push and pull request.

npm publish (`.github/workflows/publish.yml`) runs when you **publish a GitHub Release**:

1. npmjs.com → Access Tokens → granular **Automation** token with read/write on `lucider`.
2. GitHub repo → Settings → Secrets and variables → Actions → **`NPM_TOKEN`**.
3. Releases → Draft a new release → tag `vX.Y.Z` (must be newer than the last npm version).
4. Publish the release. The workflow tests, builds, aligns `package.json` to the tag, and publishes.

Do not commit tokens. Use an automation token (no `--otp` in CI).

## License

By contributing you agree that your work is licensed under the MIT License in `LICENSE`.
