import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";
import plugin from "../src/index.mjs";

test("the preset lints supported files and leaves path ignores to consumers", async () => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfigFile: true,
    overrideConfig: plugin.configs.recommended,
  });
  const filePaths = [
    "src/data/arbitrary.ts",
    "src/fixtures/arbitrary.ts",
    "src/__fixtures__/arbitrary.ts",
    "packages/example/build/generated.ts",
    "packages/example/dist/generated.ts",
    "packages/example/coverage/generated.ts",
  ];

  for (const filePath of filePaths) {
    const [result] = await eslint.lintText("// Must be linted.\nconst value = 1;", { filePath });
    assert.deepEqual(
      result.messages.map((message) => message.ruleId),
      ["codebase-ai-rules/comment-discipline"],
      filePath,
    );
    assert.equal(await eslint.isPathIgnored(filePath), false, filePath);
  }
});
