import type { Metrics } from "../types.js";

/**
 * Deterministic, dependency-free approximate token count: words and individual
 * punctuation marks each count as one token (research R6). Sufficient to
 * demonstrate and verify context reduction (Constitution Principle III).
 */
export function approxTokens(text: string): number {
  const matches = text.match(/\w+|[^\s\w]/g);
  return matches ? matches.length : 0;
}

export interface EmittedContext {
  context: string;
  body: string | null;
}

export function computeMetrics(rawSource: string, emitted: EmittedContext[]): Metrics {
  const rawTokens = approxTokens(rawSource);
  const rawBytes = Buffer.byteLength(rawSource, "utf8");

  let emittedTokens = 0;
  let emittedBytes = 0;
  for (const e of emitted) {
    const chunk = e.body === null ? e.context : `${e.context}\n${e.body}`;
    emittedTokens += approxTokens(chunk);
    emittedBytes += Buffer.byteLength(chunk, "utf8");
  }

  const reductionRatio =
    rawTokens === 0 ? 0 : Math.max(0, Math.min(1, 1 - emittedTokens / rawTokens));

  return { rawTokens, emittedTokens, reductionRatio, rawBytes, emittedBytes };
}
