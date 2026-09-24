import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import markdown from "@eslint/markdown";
import { Linter, RuleTester } from "eslint";
import plugin from "../src/index.mjs";
import { linkRoot, normalizeRoots, resolveLink } from "../src/relative-links.mjs";
import { repositoryPathsFor } from "../src/repository-paths.mjs";
import {
  RULE_ID,
  brokenTargets,
  createDirectory,
  createGitRepository,
  lintMarkdown,
  removeDirectory,
  writeFiles,
} from "./markdown-helpers.mjs";

let root;

before(() => {
  root = createGitRepository({
    tracked: {
      "README.md": "# Readme\n",
      "docs/setup.md": "# Setup\n",
      "packages/sdk/README.md": "# SDK\n",
      "packages/sdk/docs/guide.md": "# Guide\n",
      "packages/sdk/docs/api/index.md": "# API\n",
    },
  });
});

after(() => removeDirectory(root));

test("RuleTester runs the rule on the Markdown language with exact locations", () => {
  const ruleTester = new RuleTester({
    plugins: { markdown },
    language: "markdown/gfm",
    languageOptions: { frontmatter: "yaml" },
  });
  const filename = path.join(root, "docs/page.md");

  ruleTester.run("no-broken-relative-links", plugin.rules["no-broken-relative-links"], {
    valid: [
      { code: "[setup](./setup.md) ![readme](../README.md)", filename },
      { code: "[sdk](/README.md)", filename: path.join(root, "packages/sdk/docs/guide.md"), options: [{ roots: ["packages/sdk"] }] },
    ],
    invalid: [
      {
        code: "Intro\n\nSee [gone](./gone.md \"title\").\n\n[ref]: ../nope/\n",
        filename,
        errors: [
          { messageId: "broken", data: { target: "./gone.md" }, line: 3, column: 5, endLine: 3, endColumn: 30 },
          { messageId: "broken", data: { target: "../nope/" }, line: 5, column: 1, endLine: 5, endColumn: 16 },
        ],
      },
      {
        code: "![logo](../assets/logo.png)",
        filename,
        errors: [{ messageId: "broken", data: { target: "../assets/logo.png" } }],
      },
    ],
  });
});

test("the roots option accepts only an array of unique non-empty strings", () => {
  const linter = new Linter({ cwd: root });
  const verify = (options) =>
    linter.verify("[x](./setup.md)", [{ files: ["**/*.md"], plugins: { markdown, "codebase-ai-rules": plugin }, language: "markdown/gfm", rules: { [RULE_ID]: ["error", options] } }], {
      filename: path.join(root, "docs/page.md"),
    });

  assert.deepEqual(verify({ roots: [] }), []);
  for (const options of [{ roots: "packages/sdk" }, { roots: [""] }, { roots: ["a", "a"] }, { other: true }]) {
    assert.throws(() => verify(options), /Key "codebase-ai-rules\/no-broken-relative-links"/, JSON.stringify(options));
  }
});

test("the longest matching root wins and root spellings are normalized", () => {
  const roots = ["./packages/sdk/", "packages/sdk/docs"];
  assert.deepEqual(normalizeRoots(roots), ["packages/sdk", "packages/sdk/docs"]);
  assert.equal(linkRoot("packages/sdk/docs/api/index.md", roots), "packages/sdk/docs");
  assert.equal(linkRoot("packages/sdk/README.md", roots), "packages/sdk");
  assert.equal(linkRoot("packages/sdk-other/README.md", roots), "");
  assert.equal(resolveLink("packages/sdk/docs/api/index.md", "/guide.md", roots), "packages/sdk/docs/guide.md");
  assert.equal(resolveLink("packages/sdk/docs/api/index.md", "../../README.md", roots), null);
  assert.equal(resolveLink("docs/page.md", "../..hidden.md"), "..hidden.md");
});

test("links outside every configured root resolve against the repository root", () => {
  const options = { roots: ["packages/sdk"] };
  assert.deepEqual(brokenTargets(lintMarkdown(root, "docs/page.md", "[r](/README.md) [s](/packages/sdk/README.md)", options)), []);
  assert.deepEqual(
    brokenTargets(lintMarkdown(root, "packages/sdk/docs/api/index.md", "[g](/docs/guide.md) [out](/docs/setup.md)", options)),
    ["1:/docs/setup.md"],
  );
});

function withRepository(tracked, run) {
  const repository = createGitRepository({ tracked });
  try {
    run(repository, (...args) => execFileSync("git", args, { cwd: repository, stdio: "pipe" }));
  } finally {
    removeDirectory(repository);
  }
}

const MOVE_LINKS = "[o](./old.md) [n](./new.md)";

test("a file staged with git add mid-process stops being broken", () => {
  withRepository({ "README.md": "# Readme\n" }, (repository, git) => {
    assert.deepEqual(brokenTargets(lintMarkdown(repository, "README.md", "[n](./new.md)")), ["1:./new.md"]);
    writeFiles(repository, { "new.md": "# New\n" });
    git("add", "new.md");
    assert.deepEqual(brokenTargets(lintMarkdown(repository, "README.md", "[n](./new.md)")), []);
  });
});

test("a file renamed with git mv mid-process moves the broken link to the old name", () => {
  withRepository({ "README.md": "# Readme\n", "old.md": "# Old\n" }, (repository, git) => {
    assert.deepEqual(brokenTargets(lintMarkdown(repository, "README.md", MOVE_LINKS)), ["1:./new.md"]);
    git("mv", "old.md", "new.md");
    assert.deepEqual(brokenTargets(lintMarkdown(repository, "README.md", MOVE_LINKS)), ["1:./old.md"]);
  });
});

test("a file removed with git rm mid-process becomes broken", () => {
  withRepository({ "README.md": "# Readme\n", "gone.md": "# Gone\n" }, (repository, git) => {
    assert.deepEqual(brokenTargets(lintMarkdown(repository, "README.md", "[g](./gone.md)")), []);
    git("rm", "--quiet", "-f", "gone.md");
    assert.deepEqual(brokenTargets(lintMarkdown(repository, "README.md", "[g](./gone.md)")), ["1:./gone.md"]);
  });
});

test("a repository with no index yet has an empty tracked set until the first git add", () => {
  withRepository({}, (repository, git) => {
    writeFiles(repository, { "README.md": "# Readme\n" });
    assert.deepEqual(brokenTargets(lintMarkdown(repository, "page.md", "[r](./README.md)")), ["1:./README.md"]);
    git("add", "README.md");
    assert.deepEqual(brokenTargets(lintMarkdown(repository, "page.md", "[r](./README.md)")), []);
  });
});

test("git ls-files runs once per repository root while the index is unchanged", { skip: process.platform === "win32" }, () => {
  const shim = createDirectory("codebase-ai-rules-git-shim-");
  const log = path.join(shim, "calls.log");
  const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
  writeFiles(shim, { git: `#!/bin/sh\necho "$*" >> "${log}"\nexec "${realGit}" "$@"\n` });
  chmodSync(path.join(shim, "git"), 0o755);
  const originalPath = process.env.PATH;
  process.env.PATH = `${shim}${path.delimiter}${originalPath}`;
  const lsFilesCalls = () => (existsSync(log) ? readFileSync(log, "utf8").split("\n").filter((line) => line.startsWith("ls-files")).length : 0);
  try {
    withRepository({ "README.md": "# Readme\n", "docs/setup.md": "# Setup\n" }, (repository, git) => {
      for (const file of ["README.md", "docs/setup.md", "docs/page.md", "README.md"]) {
        assert.deepEqual(brokenTargets(lintMarkdown(repository, file, "[r](/README.md) [s](/docs/setup.md)")), []);
      }
      assert.equal(lsFilesCalls(), 1);
      writeFiles(repository, { "new.md": "# New\n" });
      git("add", "new.md");
      assert.deepEqual(brokenTargets(lintMarkdown(repository, "README.md", "[n](./new.md)")), []);
      assert.deepEqual(brokenTargets(lintMarkdown(repository, "README.md", "[n](./new.md)")), []);
      assert.equal(lsFilesCalls(), 2);
    });
  } finally {
    process.env.PATH = originalPath;
    removeDirectory(shim);
  }
});

test("outside a git repository the rule checks the file system under cwd with exact case", () => {
  const plain = createDirectory("codebase-ai-rules-plain-");
  try {
    assert.throws(() => execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: plain, stdio: "pipe" }));
    writeFiles(plain, { "README.md": "# Readme\n", "docs/setup.md": "# Setup\n" });
    const markdownText = "[a](./setup.md) [b](../README.md) [c](/docs) [d](./Setup.md) [e](./missing.md) [f](../../out.md)";
    assert.deepEqual(brokenTargets(lintMarkdown(plain, "docs/page.md", markdownText)), [
      "1:./Setup.md",
      "1:./missing.md",
      "1:../../out.md",
    ]);
    assert.equal(repositoryPathsFor(path.join(plain, "page.md"), path.join(plain, "docs")), null);
  } finally {
    removeDirectory(plain);
  }
});
