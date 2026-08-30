import type { Location } from "../types.js";

/**
 * Stable, deterministic node id. Same input always yields the same id, and the
 * occurrence index disambiguates same-named symbols within a file
 * (Constitution Principle II; research R3).
 */
export function makeNodeId(
  file: string,
  name: string,
  kind: string,
  index: number,
): string {
  return `${file}::${name}#${kind}@${index}`;
}

export function makeLocation(
  file: string,
  startLine: number,
  endLine: number,
): Location {
  return { file, startLine, endLine };
}
