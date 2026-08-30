# Contract: Command-Line Interface

The CLI is a thin wrapper over the library core. It reads sources, writes the JSON artifact,
and never modifies source files (Constitution Principle IV).

## Invocation

```
lucider <path> [options]
```

- `<path>` — file or directory to process (required). Directories are scanned recursively for
  files matching a registered `LanguageAdapter`'s extensions.

## Options

| Option | Values | Default | Meaning |
|--------|--------|---------|---------|
| `--out <file>` | path | stdout | Where to write the JSON artifact. |
| `--strict` | flag | off | Exit non-zero if any stale or malformed directive is present (FR-010, SC-006). |
| `--baseline <file>` | path | `.lucider/baseline.json` | Sidecar file for staleness comparison. |
| `--update-baseline` | flag | off | Accept current fingerprints for authored nodes and write the baseline. |
| `--default-body <on\|off>` | enum | `on` | Body inclusion when `ai-body` is unspecified. |
| `--prefix <name>` | string | `ai` | Directive prefix to recognize. |

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success; artifact produced (warnings may still be present in non-strict mode). |
| 1 | Strict-mode violation: stale or malformed directives detected. |
| 2 | Usage error (bad arguments / missing path). |
| 3 | Unrecoverable error (e.g. path not found). |

## Output

- On success, a single JSON document conforming to `artifact.schema.json` is written to `--out`
  (or stdout).
- Warnings are included in the artifact's `warnings` array and also summarized to stderr as
  human-readable lines. No directive is ever silently dropped (FR-009, SC-005).

## Determinism

For identical inputs and options, the emitted artifact MUST be byte-identical across runs
(Constitution Principle II): nodes sorted by `id`, edges by (`type`,`from`,`to`), fixed key
ordering.
