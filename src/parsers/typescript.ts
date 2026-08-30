import TypeScriptGrammars from "tree-sitter-typescript";
import { TreeSitterAdapter } from "./tree-sitter-adapter.js";

export const TS_DECL_KINDS: Record<string, string> = {
  function_declaration: "function",
  generator_function_declaration: "function",
  class_declaration: "class",
  method_definition: "method",
  interface_declaration: "interface",
  enum_declaration: "enum",
  type_alias_declaration: "type",
};

export class TypeScriptAdapter extends TreeSitterAdapter {
  constructor() {
    super({
      name: "typescript",
      extensions: [".ts", ".mts", ".cts"],
      language: TypeScriptGrammars.typescript,
      declKinds: TS_DECL_KINDS,
    });
  }
}

export class TsxAdapter extends TreeSitterAdapter {
  constructor() {
    super({
      name: "tsx",
      extensions: [".tsx"],
      language: TypeScriptGrammars.tsx,
      declKinds: TS_DECL_KINDS,
    });
  }
}
