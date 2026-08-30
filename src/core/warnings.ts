import type { Location, Warning, WarningCode } from "../types.js";

export class WarningCollector {
  private warnings: Warning[] = [];

  add(code: WarningCode, message: string, location: Location | null = null): void {
    this.warnings.push({ code, message, location });
  }

  list(): Warning[] {
    return [...this.warnings].sort((a, b) => {
      const fa = a.location?.file ?? "";
      const fb = b.location?.file ?? "";
      if (fa !== fb) return fa < fb ? -1 : 1;
      const la = a.location?.startLine ?? 0;
      const lb = b.location?.startLine ?? 0;
      if (la !== lb) return la - lb;
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    });
  }
}
