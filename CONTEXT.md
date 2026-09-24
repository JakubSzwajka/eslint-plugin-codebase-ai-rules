# eslint-plugin-codebase-ai-rules

This repository contains a private GitHub package with two ESLint rules. It extracts Hosti's comment-discipline rule without changing the rule's semantics, and adds a Markdown rule that reports relative links to paths git does not track.

## Vocabulary

- **Rule**: one of the two lint rules in this package, `comment-discipline` or `no-broken-relative-links`.
- **Preset**: a flat-config array a consumer spreads into `eslint.config.mjs`. There are two:
  - `recommended`, exported as `plugin.configs.recommended` from the package root. It runs `comment-discipline` on JS, JSX, MJS, CJS, TS, TSX, MTS, and CTS.
  - `markdown`, the default export of the `eslint-plugin-codebase-ai-rules/markdown` subpath. It runs `no-broken-relative-links` on `**/*.md` through the `@eslint/markdown` GFM language.
- **Consumer**: a repository that installs this package from GitHub and spreads one or both presets in `eslint.config.mjs`.
- **Exception**: one closed, syntax-owned directive or legal header accepted by `comment-discipline`.
- **Relative link**: a Markdown link, image, or link reference definition whose target has no URI scheme, is not a pure anchor, is not protocol-relative, and contains no `{` placeholder.
- **Tracked path**: a file listed by `git ls-files` for the repository that holds the linted file, or a parent directory of one. Matching is exact and case-sensitive.
- **Root**: a subdirectory named in the `roots` option. Links from files under a root resolve `/` against it and may not leave it.

## Contract

- Package name and version stay `eslint-plugin-codebase-ai-rules@0.2.0` until an intentional release decision changes them. `package.json` and `plugin.meta.version` carry the same version.
- The package is ESM, runs checked-in `.mjs` source directly, and supports Node `^20.19.0 || ^22.13.0 || >=24.0.0`, matching the checked-in ESLint 10 toolchain.
- `private: true` stays set. Do not npm-publish.
- The plugin key is `codebase-ai-rules`.
- `@typescript-eslint/parser` is a runtime dependency so consumers install no parser separately.
- ESLint is a peer dependency and a development dependency for this repository.
- `@eslint/markdown` is an optional peer dependency and a development dependency. Only `src/markdown.mjs` imports it. The package root must never load it, so `recommended` consumers install nothing new.
- Consumer path ignores do not belong in the preset.
- The `comment-discipline` source and tests are ported from Hosti. Packaging and config are generalized; its semantics are not changed.
- The `no-broken-relative-links` resolution logic and tests are ported from `pubnub/blocksnetwork` `scripts/check-md-links.mjs`. `@eslint/markdown` does the parsing. The hard-coded published subtree became the `roots` option.
- The `recommended` preset does not change when Markdown support changes.

## Layout

```text
src/      checked-in plugin source
 tests/   unit and exported-preset tests
docs/     focused rule documentation
```

Keep source modules small. Tests should import the package entry point or exercise the exported presets. The pure link-resolution helpers in `src/relative-links.mjs` and `src/repository-paths.mjs` may also be unit tested directly. Do not add a build step.

## Verification

Run `npm run check` and `npm run pack:check`. For release or dependency changes, install the package from a fresh fixture using a pinned Git spec and run ESLint against JavaScript, TypeScript, and Markdown pass/fail fixtures. The Markdown fixture must be a git repository with its files added to the index.
