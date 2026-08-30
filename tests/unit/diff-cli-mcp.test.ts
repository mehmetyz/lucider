import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { runLuciderTool } from "../../src/mcp/stdio.js";

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "eval",
  GIT_AUTHOR_EMAIL: "eval@local",
  GIT_COMMITTER_NAME: "eval",
  GIT_COMMITTER_EMAIL: "eval@local",
};

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, env: gitEnv, stdio: "pipe" });
}

describe("diff seed + MCP tools", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
  });

  it("seeds a pack from unstaged git diff, not the catalog", () => {
    const dir = mkdtempSync(join(tmpdir(), "lucider-diff-"));
    dirs.push(dir);
    writeFileSync(
      join(dir, "auth.js"),
      "function hashPassword(p) { return p; }\nfunction login() { return hashPassword(1); }\nfunction other() { return 0; }\n",
    );
    git(dir, ["init"]);
    git(dir, ["add", "auth.js"]);
    git(dir, ["commit", "-m", "init"]);
    writeFileSync(
      join(dir, "auth.js"),
      "function hashPassword(p) { return p; }\nfunction login() { return hashPassword(2); }\nfunction other() { return 0; }\n",
    );

    let stdout = "";
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    }) as typeof process.stdout.write;
    try {
      const code = runCli([dir, "--diff", "--depth", "0", "--no-cache"]);
      expect(code).toBe(0);
    } finally {
      process.stdout.write = orig;
    }
    expect(stdout).toContain("### login");
    expect(stdout).not.toContain("### other");
    expect(stdout).not.toContain("_No matching symbols._");
    expect(stdout).not.toMatch(/"schemaVersion"/);
  });

  it("lucider_query / lucider_expand return a pack and a follow-up id", () => {
    const dir = mkdtempSync(join(tmpdir(), "lucider-mcp-"));
    dirs.push(dir);
    mkdirSync(join(dir, "src"));
    writeFileSync(
      join(dir, "src", "auth.js"),
      "function hashPassword(p) { return p; }\nfunction login() { return hashPassword(1); }\n",
    );
    const first = runLuciderTool("lucider_query", {
      path: dir,
      search: "login",
      depth: 1,
      maxTokens: 2000,
    });
    expect(first).toContain("login");
    expect(first).toContain("hashPassword");
    expect(first).toContain("packTokens:");
    const idLine = first.split("\n").find((l) => l.includes("::login#"));
    expect(idLine).toBeDefined();
    const nodeId = idLine!.trim();
    const second = runLuciderTool("lucider_expand", { path: dir, nodeId, depth: 0, maxTokens: 2000 });
    expect(second).toContain("login");
    expect(second).not.toContain("schemaVersion");
  });
});
