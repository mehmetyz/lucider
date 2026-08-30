import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RefNode } from "../parsers/adapter.js";
import type { Warning } from "../types.js";
import type { RawNode } from "./nodes.js";

export const PARSE_CACHE_VERSION = 1;

export interface CachedFileParse {
  raws: RawNode[];
  refs: RefNode[];
  warnings: Warning[];
}

export interface ParseCache {
  load(file: string, source: string, prefix: string): CachedFileParse | undefined;
  save(file: string, source: string, prefix: string, value: CachedFileParse): void;
  flush(): void;
}

interface DiskFileEntry {
  hash: string;
  prefix: string;
  raws: RawNode[];
  refs: RefNode[];
  warnings: Warning[];
}

interface DiskCache {
  version: number;
  files: Record<string, DiskFileEntry>;
}

export function contentHash(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex");
}

/**
 * Sidecar map of `file → content hash → decls/refs`. Hash mismatch reparses
 * that file only. Warm serialize MUST match a cold rebuild (FR-012).
 */
export class FileParseCache implements ParseCache {
  private readonly path: string;
  private data: DiskCache;
  private dirty = false;

  constructor(path: string) {
    this.path = path;
    this.data = this.read();
  }

  load(file: string, source: string, prefix: string): CachedFileParse | undefined {
    const entry = this.data.files[file];
    if (!entry) return undefined;
    if (entry.prefix !== prefix) return undefined;
    if (entry.hash !== contentHash(source)) return undefined;
    return { raws: entry.raws, refs: entry.refs, warnings: entry.warnings ?? [] };
  }

  save(file: string, source: string, prefix: string, value: CachedFileParse): void {
    this.data.files[file] = {
      hash: contentHash(source),
      prefix,
      raws: value.raws,
      refs: value.refs,
      warnings: value.warnings,
    };
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) return;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.data) + "\n", "utf8");
    this.dirty = false;
  }

  private read(): DiskCache {
    try {
      const parsed = JSON.parse(readFileSync(this.path, "utf8")) as DiskCache;
      if (parsed.version !== PARSE_CACHE_VERSION || !parsed.files) {
        return { version: PARSE_CACHE_VERSION, files: {} };
      }
      return parsed;
    } catch {
      return { version: PARSE_CACHE_VERSION, files: {} };
    }
  }
}
