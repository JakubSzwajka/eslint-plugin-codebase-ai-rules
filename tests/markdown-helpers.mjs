import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Linter } from "eslint";
import markdownConfig from "../src/markdown.mjs";

export const RULE_ID = "codebase-ai-rules/no-broken-relative-links";

export function writeFiles(root, files) {
  for (const [file, content] of Object.entries(files)) {
    const absolute = path.join(root, file);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  }
}

export function createDirectory(prefix) {
  return realpathSync(mkdtempSync(path.join(os.tmpdir(), prefix)));
}

export function createGitRepository({ tracked = {}, untracked = {} } = {}) {
  const root = createDirectory("codebase-ai-rules-git-");
  execFileSync("git", ["init", "--quiet"], { cwd: root, stdio: "pipe" });
  writeFiles(root, tracked);
  writeFiles(root, untracked);
  const trackedFiles = Object.keys(tracked);
  if (trackedFiles.length) execFileSync("git", ["add", "--", ...trackedFiles], { cwd: root, stdio: "pipe" });
  return root;
}

export function removeDirectory(root) {
  rmSync(root, { recursive: true, force: true });
}

export function markdownConfigWith(options) {
  if (!options) return markdownConfig;
  return [...markdownConfig, { files: ["**/*.md"], rules: { [RULE_ID]: ["error", options] } }];
}

export function lintMarkdown(root, file, markdown, options) {
  return new Linter({ cwd: root }).verify(markdown, markdownConfigWith(options), {
    filename: path.join(root, file),
  });
}

export function brokenTargets(messages) {
  return messages.map((message) => {
    if (message.ruleId !== RULE_ID) throw new Error(`Unexpected message: ${message.message}`);
    return `${message.line}:${message.message.match(/^Broken relative link "(.*)": /s)[1]}`;
  });
}
