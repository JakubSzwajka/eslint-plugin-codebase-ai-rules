# eslint-plugin-codebase-ai-rules

A small, private-GitHub-installable ESLint plugin with Hosti's comment-discipline rule. The package is ESM, runs directly from checked-in source, and supports Node 20 or newer.

The package is marked `private` in `package.json`. That blocks accidental npm publication. It does not block installation from GitHub.

## Install

```sh
npm install --save-dev eslint github:JakubSzwajka/eslint-plugin-codebase-ai-rules
```

A private repository requires GitHub authentication. Configure an SSH key accepted by GitHub, or configure a Git credential helper/token before running npm. Do not put a token in `package.json`, the lockfile, shell history, or the ESLint config.

For repeatable builds, pin the Git dependency to a commit or tag instead of the moving default branch. A commit pin looks like this:

```sh
npm install --save-dev github:JakubSzwajka/eslint-plugin-codebase-ai-rules#<full-commit-sha>
```

## Configure flat ESLint

```js
// eslint.config.mjs
import codebaseAiRules from "eslint-plugin-codebase-ai-rules";

export default [
  ...codebaseAiRules.configs.recommended,
  // Project-specific configs go after the preset.
];
```

The preset registers the plugin as `codebase-ai-rules`, enables `comment-discipline` at error level, supplies `@typescript-eslint/parser`, and applies to `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, and `.cts` files. Consumers need only ESLint and this Git dependency.

The package does not add path ignores. Add your own project-specific ignores before or after the preset:

```js
export default [
  { ignores: ["dist/**", "coverage/**", "generated/**"] },
  ...codebaseAiRules.configs.recommended,
];
```

Use a later config object for a deliberate override. Keep overrides narrow and document why the exception exists:

```js
export default [
  ...codebaseAiRules.configs.recommended,
  {
    files: ["scripts/vendor/**"],
    rules: { "codebase-ai-rules/comment-discipline": "off" },
  },
];
```

## Commands

```sh
npx eslint .
npm test
```

The package's own checks are:

```sh
npm run check
npm run pack:check
```

## Policy

A comment is accepted when it is one physical line, sits beside constrained code inside a function, class, or method body, and states a necessary non-obvious reason. A comment group of adjacent line comments is treated as one group. Blank lines or code split groups.

The rule rejects top-level narrative, comments in declaration headers, parameters, decorators, interfaces, type literals, module blocks, bodyless TypeScript signatures, multiline block or JSX comments, and adjacent line-comment groups. It reports one diagnostic for each rejected group and does not autofix.

The exception list is closed. It covers syntax-owned directives only when they match the owning tool's accepted form: TypeScript directives and triple-slash directives, ESLint controls and inline configuration, Biome controls, coverage controls, source maps, Vite, webpack, optimization markers, and legal headers before the first code token. Near-matches and explanatory prose remain errors. See [the focused rule documentation](docs/comment-discipline.md) for the complete list and examples.

## Limitations

- This package checks comments only. It does not replace a project's normal ESLint rules.
- It uses ESLint flat config and requires ESLint 9 or newer.
- The TypeScript parser is supplied by this package, but TypeScript type-aware linting is not enabled.
- The rule has no autofix. A human must decide whether to rename, type, assert, test, or retain the constrained code.
- The parser still needs syntactically valid source to report comment discipline.

## Upgrade flow

1. Review the package changelog in Git history and the diff between the current and candidate commit.
2. Update the Git commit pin in `package.json` and regenerate `package-lock.json` with `npm install`.
3. Run `npm run check`, `npm run pack:check`, and the consuming project's `npx eslint .`.
4. Merge the lockfile and config change together. Do not npm-publish this package.

The repository is private. Access, GitHub Actions, and Git commit history are the distribution boundary.
