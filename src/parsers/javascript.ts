import JavaScript from "tree-sitter-javascript";
import { TreeSitterAdapter } from "./tree-sitter-adapter.js";

export const JS_DECL_KINDS: Record<string, string> = {
  function_declaration: "function",
  generator_function_declaration: "function",
  class_declaration: "class",
  method_definition: "method",
};

export class JavaScriptAdapter extends TreeSitterAdapter {
  constructor() {
    super({
      name: "javascript",
      extensions: [".js", ".mjs", ".cjs", ".jsx"],
      language: JavaScript,
      declKinds: JS_DECL_KINDS,
    });
  }
}
