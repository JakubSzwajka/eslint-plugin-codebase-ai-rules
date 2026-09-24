# eslint-plugin-codebase-ai-rules

A small, private-GitHub-installable ESLint plugin with six rules:

- `comment-discipline`, Hosti's comment rule for JavaScript and TypeScript, enabled by `configs.recommended`.
- `no-broken-relative-links`, which reports relative Markdown links whose target git does not track, enabled by the `eslint-plugin-codebase-ai-rules/markdown` preset.
- Four design-token rules, enabled by the `design()` factory from `eslint-plugin-codebase-ai-rules/design`:
  - `design-no-raw-color`: raw colours in CSS.
  - `design-no-raw-color-literal`: raw colours in JS and TS strings.
  - `design-no-unknown-token`: `var(--name)` with no definition.
  - `design-scale-value`: values off a fixed scale.

The package is ESM, runs directly from checked-in source, and supports `^20.19.0 || ^22.13.0 || >=24.0.0`, matching the ESLint 10 toolchain used by this repository.

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

## Configure Markdown link checks

The Markdown preset is a separate entry point, so only projects that import it need `@eslint/markdown`. Install it next to ESLint:

```sh
npm install --save-dev @eslint/markdown
```

```js
// eslint.config.mjs
import codebaseAiRules from "eslint-plugin-codebase-ai-rules";
import codebaseAiMarkdown from "eslint-plugin-codebase-ai-rules/markdown";

export default [
  ...codebaseAiRules.configs.recommended,
  ...codebaseAiMarkdown,
];
```

The Markdown preset applies to `**/*.md`, uses the `markdown/gfm` language with YAML front matter, and enables `no-broken-relative-links` at error level. It does not enable the rules from `@eslint/markdown`'s own recommended config. Add them yourself if you want them.

The rule counts a target only when `git ls-files` lists it, with exact case. A link to an untracked file, or to `./README.md` when the file is `readme.md`, is an error even when your disk can open it. See [the rule documentation](docs/no-broken-relative-links.md) for skipped targets, the `roots` option, and the behavior outside a git repository.

## Configure design-token checks

The design rules are a separate entry point, so only projects that import it need `@eslint/css`. Install it next to ESLint:

```sh
npm install --save-dev @eslint/css
```

`design()` is a factory, not a fixed preset, because every project keeps its tokens in a different file. It returns flat-config blocks to spread into `eslint.config.mjs`. Here is Hosti's setup:

```js
// eslint.config.mjs
import codebaseAiRules from "eslint-plugin-codebase-ai-rules";
import design from "eslint-plugin-codebase-ai-rules/design";

export default [
  ...codebaseAiRules.configs.recommended,
  ...design({
    tokenFiles: ["apps/web/src/styles/hosti.css"],
    css: { files: ["apps/**/*.css"] },
    source: { files: ["apps/**/*.{ts,tsx}"] },
    rules: {
      "design-scale-value": [
        {
          property: "^border(-(top|bottom|start|end)-(left|right|start|end))?-radius$",
          allowed: ["0", "50%", "2px", "3px", "4px", "5px", "6px", "8px", "10px", "12px", "999px"],
        },
        { property: "^(box|text)-shadow$", allowed: ["none"] },
        { property: "^(transition|animation)(-duration)?$", allowed: ["none"], requireVar: "--t" },
      ],
    },
  }),
];
```

The options:

| Option | Default | Meaning |
| --- | --- | --- |
| `tokenFiles` | `[]` | CSS files whose custom properties are the design tokens, relative to ESLint's working directory. Passed to `design-no-raw-color` and `design-no-unknown-token`. |
| `css.files` | `["**/*.css"]` | Files for the CSS block. It uses the `css/css` language and runs `design-no-raw-color`, `design-no-unknown-token` and `design-scale-value`. Pass `css: false` to leave it out. |
| `source.files` | `["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"]` | Files for the source block. It uses `@typescript-eslint/parser` with JSX, like `recommended`, and runs `design-no-raw-color-literal`. Pass `source: false` to leave it out. |
| `rules` | `{}` | Options per rule, keyed by rule name. `false` turns a rule off. An unknown rule name throws. |

Every rule runs at error level, except `design-scale-value`, which stays off until you give it a scale. To use separate token files for two parts of a repository, call `design()` twice with different `css.files`, and pass `source: false` to one of the calls.

See the rule documentation for what each rule reports and its options:

- [design-no-raw-color](docs/design-no-raw-color.md)
- [design-no-raw-color-literal](docs/design-no-raw-color-literal.md)
- [design-no-unknown-token](docs/design-no-unknown-token.md)
- [design-scale-value](docs/design-scale-value.md)

Do not turn on `@eslint/css`'s own `no-invalid-properties` rule for a project whose tokens live in another file. It cannot see the token file, so it reports every token use as an unknown variable.

## Overrides

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

## Comment policy

A comment is accepted when it is one physical line, sits beside constrained code inside a function, class, or method body, and states a necessary non-obvious reason. A comment group of adjacent line comments is treated as one group. Blank lines or code split groups.

The rule rejects top-level narrative, comments in declaration headers, parameters, decorators, interfaces, type literals, module blocks, bodyless TypeScript signatures, multiline block or JSX comments, and adjacent line-comment groups. It reports one diagnostic for each rejected group and does not autofix.

The exception list is closed. It covers syntax-owned directives only when they match the owning tool's accepted form: TypeScript directives and triple-slash directives, ESLint controls and inline configuration, Biome controls, coverage controls, source maps, Vite, webpack, optimization markers, and legal headers before the first code token. Near-matches and explanatory prose remain errors. See [the focused rule documentation](docs/comment-discipline.md) for the complete list and examples.

## Limitations

- This package checks comment discipline, relative Markdown links and design-token use only. It does not replace a project's normal ESLint rules.
- It uses ESLint flat config and requires ESLint 9 or newer.
- The TypeScript parser is supplied by this package, but TypeScript type-aware linting is not enabled.
- The rule has no autofix. A human must decide whether to rename, type, assert, test, or retain the constrained code.
- The parser still needs syntactically valid source to report comment discipline.
- `no-broken-relative-links` does not check heading fragments or raw HTML links. ESLint `--cache` can miss a broken link when only the target file was deleted or renamed.
- The design rules read token files outside the linted file. ESLint `--cache` can miss a finding when only a token file changed.

## Upgrade flow

1. Review the pinned commit diff and the rule documentation between the current and candidate commit.
2. Update the Git commit pin in `package.json` and regenerate `package-lock.json` with `npm install`.
3. Run `npm run check`, `npm run pack:check`, and the consuming project's `npx eslint .`.
4. Merge the lockfile and config change together. Do not npm-publish this package.

The repository is private. Access, GitHub Actions, and Git commit history are the distribution boundary.
