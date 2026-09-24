import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

async function writeFixtureFiles(fixtureDirectory) {
  const lockedPackages = JSON.parse(await readFile(path.join(repositoryRoot, "package-lock.json"), "utf8")).packages;
  const packageVersion = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8")).version;
  await writeFile(
    path.join(fixtureDirectory, "package.json"),
    JSON.stringify(
      {
        name: "packed-plugin-fixture",
        private: true,
        type: "module",
        dependencies: {
          "@eslint/markdown": lockedPackages["node_modules/@eslint/markdown"].version,
          eslint: lockedPackages["node_modules/eslint"].version,
        },
      },
      null,
      2,
    ) + "\n",
  );

  await writeFile(
    path.join(fixtureDirectory, "eslint.config.mjs"),
    'import codebaseAiRules from "eslint-plugin-codebase-ai-rules";\nimport codebaseAiMarkdown from "eslint-plugin-codebase-ai-rules/markdown";\n\nexport default [\n  ...codebaseAiRules.configs.recommended,\n  ...codebaseAiMarkdown,\n];\n',
  );
  await writeFile(
    path.join(fixtureDirectory, "pass.js"),
    "function run() {\n  // The retry must stay bounded by the caller's deadline.\n  return true;\n}\n",
  );
  await writeFile(
    path.join(fixtureDirectory, "pass.ts"),
    "function run(value: string): string {\n  // The parser keeps this boundary typed.\n  return value;\n}\n",
  );
  await writeFile(path.join(fixtureDirectory, "fail.js"), "// This top-level comment is narrative.\nconst value = 1;\n");
  await writeFile(path.join(fixtureDirectory, "fail.ts"), "// This top-level comment is narrative.\nconst value: string = 'value';\n");
  await mkdir(path.join(fixtureDirectory, "docs"));
  await writeFile(path.join(fixtureDirectory, "pass.md"), "# Pass\n\nRead the [guide](docs/guide.md).\n");
  await writeFile(path.join(fixtureDirectory, "docs", "guide.md"), "# Guide\n\nBack to [pass](../pass.md).\n");
  await writeFile(path.join(fixtureDirectory, "fail.md"), "# Fail\n\nSee [missing](./missing.md) and [case](./PASS.md).\n");

  await writeFile(
    path.join(fixtureDirectory, "verify-install.mjs"),
    `import assert from "node:assert/strict";
import { ESLint } from "eslint";
import codebaseAiRules from "eslint-plugin-codebase-ai-rules";

assert.equal(codebaseAiRules.meta.name, "eslint-plugin-codebase-ai-rules");
assert.equal(codebaseAiRules.configs.recommended[0].rules["codebase-ai-rules/comment-discipline"], "error");
assert.match(import.meta.resolve("eslint-plugin-codebase-ai-rules"), /node_modules/);
assert.match(import.meta.resolve("eslint-plugin-codebase-ai-rules/markdown"), /node_modules/);
assert.equal(codebaseAiRules.meta.version, ${JSON.stringify(packageVersion)});

const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: "eslint.config.mjs" });
const passing = await eslint.lintFiles(["pass.js", "pass.ts"]);
assert.deepEqual(
  passing.map(({ errorCount, warningCount }) => ({ errorCount, warningCount })),
  [
    { errorCount: 0, warningCount: 0 },
    { errorCount: 0, warningCount: 0 },
  ],
);

const failing = await eslint.lintFiles(["fail.js", "fail.ts"]);
assert.deepEqual(
  failing.map(({ errorCount, warningCount, messages }) => ({
    errorCount,
    warningCount,
    ruleIds: messages.map(({ ruleId }) => ruleId),
  })),
  [
    { errorCount: 1, warningCount: 0, ruleIds: ["codebase-ai-rules/comment-discipline"] },
    { errorCount: 1, warningCount: 0, ruleIds: ["codebase-ai-rules/comment-discipline"] },
  ],
);

const markdownPassing = await eslint.lintFiles(["pass.md", "docs/guide.md"]);
assert.deepEqual(
  markdownPassing.map(({ errorCount, warningCount }) => ({ errorCount, warningCount })),
  [
    { errorCount: 0, warningCount: 0 },
    { errorCount: 0, warningCount: 0 },
  ],
);

const [markdownFailing] = await eslint.lintFiles(["fail.md"]);
assert.deepEqual(
  markdownFailing.messages.map(({ ruleId, line, column }) => ({ ruleId, line, column })),
  [
    { ruleId: "codebase-ai-rules/no-broken-relative-links", line: 3, column: 5 },
    { ruleId: "codebase-ai-rules/no-broken-relative-links", line: 3, column: 33 },
  ],
);
`,
  );
}

test("packs and installs the exact package before linting fresh JS, TS, and Markdown fixtures", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "codebase-ai-rules-pack-"));
  const packageDirectory = path.join(temporaryDirectory, "package");
  const fixtureDirectory = path.join(temporaryDirectory, "fixture");
  await Promise.all([mkdir(packageDirectory, { recursive: true }), mkdir(fixtureDirectory, { recursive: true })]);

  try {
    execFileSync("npm", ["pack", "--pack-destination", packageDirectory], {
      cwd: repositoryRoot,
      stdio: "pipe",
    });
    const [packageArchive] = (await readdir(packageDirectory)).filter((entry) => entry.endsWith(".tgz"));
    assert.ok(packageArchive, "npm pack did not produce a tarball");

    await writeFixtureFiles(fixtureDirectory);
    const packageJsonPath = path.join(fixtureDirectory, "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    packageJson.dependencies["eslint-plugin-codebase-ai-rules"] = `file:${path.join(packageDirectory, packageArchive)}`;
    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

    // ESLint is installed at the exact version resolved by this repository's lockfile.
    execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: fixtureDirectory,
      stdio: "pipe",
    });
    // The Markdown rule counts only git-tracked targets, so the fixture must be a repository.
    execFileSync("git", ["init", "--quiet"], { cwd: fixtureDirectory, stdio: "pipe" });
    execFileSync("git", ["add", "--", "pass.md", "docs/guide.md", "fail.md"], { cwd: fixtureDirectory, stdio: "pipe" });
    execFileSync(process.execPath, ["verify-install.mjs"], {
      cwd: fixtureDirectory,
      stdio: "pipe",
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
