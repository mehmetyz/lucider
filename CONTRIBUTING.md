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

**Preferred:** push a semver tag. Title and notes are generated; npm publish follows.

```bash
git tag v0.0.2
git push origin v0.0.2
```

1. `.github/workflows/create-release.yml` runs `gh release create --generate-notes` (no manual title/notes).
2. `.github/workflows/publish.yml` runs on that published release.

**UI:** Releases → Draft a new release → choose tag → **Generate release notes**. Categories come from `.github/release.yml` on the default branch.

npm publish uses GitHub OIDC (Trusted Publisher on `lucider`). No `NPM_TOKEN`, no `--otp`.
The publish job runs Node 24 so the npm CLI is ≥ 11.5.1 (Node 20’s npm 10 cannot complete
the OIDC handshake and the registry returns a misleading 404).

On [npm package settings](https://www.npmjs.com/package/lucider) → **Trusted Publisher**:

- Organization or user: `mehmetyz`
- Repository: `lucider`
- Workflow filename: `publish.yml` (filename only, including `.yml`)
- Environment: leave empty (the workflow does not use a GitHub environment)

Do not `npm publish` from a laptop with 2FA unless you pass `--otp`.

CI also runs `pnpm audit --prod` and `pnpm check:pack` so the tarball cannot
include `src/`, tests, specs, or secrets. Actions are pinned to commit SHAs.

Do not commit tokens.

## License

By contributing you agree that your work is licensed under the MIT License in `LICENSE`.
