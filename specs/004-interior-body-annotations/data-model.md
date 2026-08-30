# Phase 1 Data Model: Interior Body Annotations

Extends feature 001/002. New and changed entities only.

## Statement range (adapter, not in the artifact JSON)

| Field | Type | Notes |
|-------|------|-------|
| `startIndex` | number | Inclusive, 0-based in the file |
| `endIndex` | number | Exclusive |
| `startLine` / `endLine` | number | 1-based, warnings and tests |

Contained in exactly one declaration’s span. Nested declarations are also `DeclNode`s; their leading comments are not interior omits (see research R1).

## Omit span

| Field | Type | Notes |
|-------|------|-------|
| `startIndex` | number | Start of the interior ignore comment |
| `endIndex` | number | End of the bound statement |

Stored on `RawNode` during build; **not** required on `AnnotatedNode`. Applied when producing `body`.

**Rules**:
- Overlaps: sort by `startIndex`; later spans that overlap an earlier omit are skipped (should not occur if statements are disjoint).
- Empty remainder: `body` may be a signature plus empty block (or equivalent sliced text). Node remains.

## Interior ignore mark

Same `Directive` record as today (`key: ignore`, valueless `ok`).

| Placement | Effect |
|-----------|--------|
| Associated with next **declaration** (existing) | Skip node creation |
| Associated with next **statement** (this feature) | Omit span from published body; node kept |
| Neither | `status: orphaned`, warning `orphaned_directive` |

## Published body

`AnnotatedNode.body` after:

1. Declaration-level `ai-body: off` or default-off → `null` (no slice needed).
2. Else splice all omit spans out of `DeclNode.text` (indexes relative to declaration `startIndex`).

Map markdown and query chunks both use this field (FR-006).

## Grammar version

| Field | Value |
|-------|-------|
| `ContextArtifact.grammarVersion` | `1.2.0` |

`schemaVersion` stays `1.0.0`.

## Warning codes

No new codes. Unbound interior ignore uses `orphaned_directive` with a message that names “no following instruction” (author-visible, FR-007). Unknown/malformed interior keys keep existing codes (FR-008).
