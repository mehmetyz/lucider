# Security

Report vulnerabilities privately: open a GitHub Security Advisory on
[mehmetyz/lucider](https://github.com/mehmetyz/lucider/security/advisories/new)
or email the maintainer listed on [npm lucider](https://www.npmjs.com/package/lucider).

Please do not file public issues for undisclosed supply-chain or RCE reports.

## What we ship

The npm tarball is only `dist/`, `README.md`, `LICENSE`, and `package.json`.
CI runs `pnpm audit --prod` and `scripts/check-pack.mjs` before publish.
Releases use npm provenance (`--provenance`) from GitHub Actions via Trusted Publisher
OIDC (Node 24 / npm 11 in `.github/workflows/publish.yml`).
