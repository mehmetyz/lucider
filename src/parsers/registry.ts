import { extname } from "node:path";
import type { LanguageAdapter } from "./adapter.js";
import { JavaScriptAdapter } from "./javascript.js";
import { TypeScriptAdapter, TsxAdapter } from "./typescript.js";

/** All language adapters shipped by default. */
export function allAdapters(): LanguageAdapter[] {
  return [new JavaScriptAdapter(), new TypeScriptAdapter(), new TsxAdapter()];
}

/** Pick the adapter whose extensions include the given file's extension. */
export function resolveAdapter(
  file: string,
  adapters: LanguageAdapter[],
): LanguageAdapter | undefined {
  const ext = extname(file);
  return adapters.find((a) => a.extensions.includes(ext));
}

/** Union of all extensions handled by the given adapters. */
export function supportedExtensions(adapters: LanguageAdapter[]): string[] {
  return [...new Set(adapters.flatMap((a) => a.extensions))];
}
