import tsParser from "@typescript-eslint/parser";
import { commentDisciplineRule } from "./comment-discipline.mjs";
import { noBrokenRelativeLinksRule } from "./no-broken-relative-links.mjs";

const plugin = {
  meta: {
    name: "eslint-plugin-codebase-ai-rules",
    version: "0.2.0",
  },
  rules: {
    "comment-discipline": commentDisciplineRule,
    "no-broken-relative-links": noBrokenRelativeLinksRule,
  },
  configs: {},
};

plugin.configs.recommended = [
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "codebase-ai-rules": plugin,
    },
    rules: {
      "codebase-ai-rules/comment-discipline": "error",
    },
  },
];

export { plugin };
export default plugin;
