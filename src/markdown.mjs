import markdown from "@eslint/markdown";
import plugin from "./index.mjs";

const markdownConfig = [
  {
    files: ["**/*.md"],
    plugins: {
      markdown,
      "codebase-ai-rules": plugin,
    },
    language: "markdown/gfm",
    languageOptions: {
      frontmatter: "yaml",
    },
    rules: {
      "codebase-ai-rules/no-broken-relative-links": "error",
    },
  },
];

export { markdownConfig as markdown };
export default markdownConfig;
