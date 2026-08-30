export interface DeprecationEntry {
  key: string;
  replacedBy: string;
  deprecatedInGrammar: string;
  removedInGrammar: string;
}

export interface Registry {
  isKnown(key: string): boolean;
  deprecationOf(key: string): DeprecationEntry | undefined;
}

export interface RegistryOptions {
  knownKeys?: string[];
  deprecations?: DeprecationEntry[];
}

const DEFAULT_KNOWN_KEYS = ["context", "body", "ignore", "deps"];

/**
 * The directive registry tracks recognized keys and deprecated aliases. v1
 * defines no deprecations, but the mechanism is present and testable (FR-008).
 */
export function createRegistry(options: RegistryOptions = {}): Registry {
  const known = new Set(options.knownKeys ?? DEFAULT_KNOWN_KEYS);
  const deprecations = new Map<string, DeprecationEntry>();
  for (const dep of options.deprecations ?? []) {
    deprecations.set(dep.key, dep);
    known.add(dep.key);
  }

  return {
    isKnown: (key) => known.has(key),
    deprecationOf: (key) => deprecations.get(key),
  };
}
