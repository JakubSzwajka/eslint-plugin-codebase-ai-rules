import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

async function writeFixtureFiles(fixtureDirectory) {
  await writeFile(
    path.join(fixtureDirectory, "package.json"),
    JSON.stringify(
      {
        name: "packed-plugin-fixture",
        private: true,
        type: "module",
        dependencies: {
          eslint: JSON.parse(await readFile(path.join(repositoryRoot, "package-lock.json"), "utf8")).packages[
            "node_modules/eslint"
          ].version,
        },
      },
      null,
      2,
    ) + "\n",
  );

  await writeFile(
    path.join(fixtureDirectory, "eslint.config.mjs"),
    'import codebaseAiRules from "eslint-plugin-codebase-ai-rules";\n\nexport default [\n  ...codebaseAiRules.configs.recommended,\n];\n',
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

  await writeFile(
    path.join(fixtureDirectory, "verify-install.mjs"),
    `import assert from "node:assert/strict";
import { ESLint } from "eslint";
import codebaseAiRules from "eslint-plugin-codebase-ai-rules";

assert.equal(codebaseAiRules.meta.name, "eslint-plugin-codebase-ai-rules");
assert.equal(codebaseAiRules.configs.recommended[0].rules["codebase-ai-rules/comment-discipline"], "error");
assert.match(import.meta.resolve("eslint-plugin-codebase-ai-rules"), /node_modules/);

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
`,
  );
}

test("packs and installs the exact package before linting a fresh JS and TS fixture", async () => {
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

    // ESLint is installed at the version resolved by this repository's lockfile. npm ci populated the cache first,
    // so --offline keeps this fixture from silently selecting a different toolchain or making a network request.
    execFileSync("npm", ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"], {
      cwd: fixtureDirectory,
      stdio: "pipe",
    });
    execFileSync(process.execPath, ["verify-install.mjs"], {
      cwd: fixtureDirectory,
      stdio: "pipe",
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

