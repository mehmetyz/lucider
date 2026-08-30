# Contract: GitHub Pages static site

**Host:** GitHub Pages, project site  
**Expected URL:** `https://mehmetyz.github.io/lucider/`  
**Source:** `/docs` on the default branch  

## Files

| Path | Role |
|------|------|
| `docs/.nojekyll` | Disable Jekyll so HTML/CSS are served verbatim |
| `docs/index.html` | Landing page |
| `docs/performance.html` | Human-readable performance analysis |
| `docs/performance.md` | Canonical markdown report (also linked from README) |
| `docs/styles.css` | Shared stylesheet |

## URL rules

- All href/src values MUST be relative (`styles.css`, `performance.html`, `./performance.md`).
- Do not use root-absolute paths (`/styles.css`) — they resolve to `https://mehmetyz.github.io/styles.css` on project Pages.
- Do not require a trailing-slash redirect for CSS; `index.html` and `performance.html` sit in the same directory as `styles.css`.

## Constraints

- No bundler, no `package.json` script required to “build” the site.
- No inline tracking, no auth.
- Pages must remain readable if Google Fonts is blocked (system sans/mono fallbacks).
- `prefers-reduced-motion: reduce` MUST disable non-essential animation.

## Maintainer action (outside the repo)

Enable Pages: Settings → Pages → Deploy from a branch → `/docs`.
