#!/usr/bin/env node
/**
 * MCP stdio server: lucider_query + lucider_expand.
 * JSON-RPC 2.0, newline-delimited messages (MCP 2024-11-05).
 */
import { createInterface } from "node:readline";
import { join, dirname } from "node:path";
import { statSync } from "node:fs";
import { FileParseCache } from "../core/parse-cache.js";
import { packFromDisk } from "../core/pack.js";
import type { QueryArgs, QueryLineRange } from "../core/query.js";

const PROTOCOL = "2024-11-05";
const DEFAULT_MAX_TOKENS = 2000;

interface RpcReq {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

function reply(id: number | string | null | undefined, result: unknown): void {
  if (id === undefined || id === null) return;
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function fail(id: number | string | null | undefined, code: number, message: string): void {
  if (id === undefined || id === null) return;
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n",
  );
}

function cacheFor(target: string): FileParseCache {
  let dir = target;
  try {
    if (statSync(target).isFile()) dir = dirname(target);
  } catch {
    /* keep target */
  }
  return new FileParseCache(join(dir, ".lucider", "parse-cache.json"));
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function asInt(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asStringList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return out.length ? out : undefined;
}

function asLineRanges(v: unknown): QueryLineRange[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: QueryLineRange[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const file = asString(rec.file);
    const startLine = asInt(rec.startLine, 0);
    const endLine = asInt(rec.endLine, 0);
    if (!file || startLine < 1 || endLine < startLine) continue;
    out.push({ file, startLine, endLine });
  }
  return out.length ? out : undefined;
}

export function luciderQueryArgs(params: Record<string, unknown>): {
  target: string;
  query: QueryArgs;
} {
  const target = asString(params.path) ?? asString(params.target);
  if (!target) throw new Error("path is required");
  const maxTokens = params.maxTokens === undefined ? DEFAULT_MAX_TOKENS : asInt(params.maxTokens, DEFAULT_MAX_TOKENS);
  return {
    target,
    query: {
      search: asString(params.search),
      files: asStringList(params.files),
      lineRanges: asLineRanges(params.lineRanges),
      depth: asInt(params.depth, 0),
      includeSeedBodies: true,
      maxTokens,
    },
  };
}

export function luciderExpandArgs(params: Record<string, unknown>): {
  target: string;
  query: QueryArgs;
} {
  const target = asString(params.path) ?? asString(params.target);
  const nodeId = asString(params.nodeId) ?? asString(params.node_id);
  if (!target) throw new Error("path is required");
  if (!nodeId) throw new Error("nodeId is required");
  const maxTokens = params.maxTokens === undefined ? DEFAULT_MAX_TOKENS : asInt(params.maxTokens, DEFAULT_MAX_TOKENS);
  return {
    target,
    query: {
      nodeId,
      depth: asInt(params.depth, 0),
      includeSeedBodies: true,
      maxTokens,
    },
  };
}

export function runLuciderTool(name: string, params: Record<string, unknown>): string {
  const parsed = name === "lucider_expand" ? luciderExpandArgs(params) : luciderQueryArgs(params);
  const cache = cacheFor(parsed.target);
  const { chunk, artifact } = packFromDisk({
    target: parsed.target,
    query: parsed.query,
    parseCache: cache,
    packBodies: true,
  });
  if (!chunk) return "_No matching symbols._\n";
  const ids = chunk.nodes.map((n) => n.id).join("\n");
  const header = [
    `packTokens: ${chunk.packTokens}`,
    `truncated: ${chunk.truncated}`,
    `nodes: ${chunk.nodes.length}`,
    `catalogSymbols: ${artifact.nodes.length}`,
    ids ? `ids:\n${ids}` : "ids:",
    "",
  ].join("\n");
  return header + chunk.markdown;
}

const TOOLS = [
  {
    name: "lucider_query",
    description:
      "Build a budgeted Lucider pack from a project path. Prefer this over dumping the catalog. Start small (depth 0); call lucider_expand with a node id if more is needed. Default maxTokens is 2000.",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string", description: "Project directory or file to index" },
        search: { type: "string", description: "Symbol name search" },
        files: {
          type: "array",
          items: { type: "string" },
          description: "Seed all symbols in these files",
        },
        lineRanges: {
          type: "array",
          items: {
            type: "object",
            required: ["file", "startLine", "endLine"],
            properties: {
              file: { type: "string" },
              startLine: { type: "integer" },
              endLine: { type: "integer" },
            },
          },
          description: "Inclusive line ranges (stack trace / diff hunks)",
        },
        depth: { type: "integer", description: "Graph hops. Default 0." },
        maxTokens: { type: "integer", description: "Pack cap (approxTokens). Default 2000." },
      },
    },
  },
  {
    name: "lucider_expand",
    description:
      "Follow-up pack for one catalog node id from a previous lucider_query. Does not reprint the first pack.",
    inputSchema: {
      type: "object",
      required: ["path", "nodeId"],
      properties: {
        path: { type: "string" },
        nodeId: { type: "string" },
        depth: { type: "integer", description: "Graph hops. Default 0." },
        maxTokens: { type: "integer", description: "Pack cap. Default 2000." },
      },
    },
  },
];

function handle(msg: RpcReq): void {
  const method = msg.method ?? "";
  const id = msg.id;
  const params = msg.params ?? {};

  if (method === "initialize") {
    reply(id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: { name: "lucider", version: "0.0.1" },
    });
    return;
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return;
  }
  if (method === "tools/list") {
    reply(id, { tools: TOOLS });
    return;
  }
  if (method === "ping") {
    reply(id, {});
    return;
  }
  if (method === "tools/call") {
    const name = asString(params.name);
    const args =
      params.arguments && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>)
        : {};
    if (name !== "lucider_query" && name !== "lucider_expand") {
      fail(id, -32601, `Unknown tool: ${name ?? ""}`);
      return;
    }
    try {
      const text = runLuciderTool(name, args);
      reply(id, { content: [{ type: "text", text }] });
    } catch (err) {
      const message = (err as Error).message;
      reply(id, {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      });
    }
    return;
  }
  if (id !== undefined && id !== null) {
    fail(id, -32601, `Unknown method: ${method}`);
  }
}

function isCliEntry(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  return argv1.includes("mcp/stdio") || argv1.endsWith("stdio.js");
}

export function startStdioServer(): void {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: RpcReq;
    try {
      msg = JSON.parse(trimmed) as RpcReq;
    } catch {
      return;
    }
    handle(msg);
  });
}

if (isCliEntry()) {
  startStdioServer();
}
