import tsParser from "@typescript-eslint/parser";
import { commentDisciplineRule } from "./comment-discipline.mjs";
import { designNoRawColorLiteralRule } from "./design-no-raw-color-literal.mjs";
import { designNoRawColorRule } from "./design-no-raw-color.mjs";
import { designNoUnknownTokenRule } from "./design-no-unknown-token.mjs";
import { designScaleValueRule } from "./design-scale-value.mjs";
import { noBrokenRelativeLinksRule } from "./no-broken-relative-links.mjs";

const plugin = {
  meta: {
    name: "eslint-plugin-codebase-ai-rules",
    version: "0.3.0",
  },
  rules: {
    "comment-discipline": commentDisciplineRule,
    "no-broken-relative-links": noBrokenRelativeLinksRule,
    "design-no-raw-color": designNoRawColorRule,
    "design-no-raw-color-literal": designNoRawColorLiteralRule,
    "design-no-unknown-token": designNoUnknownTokenRule,
    "design-scale-value": designScaleValueRule,
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
