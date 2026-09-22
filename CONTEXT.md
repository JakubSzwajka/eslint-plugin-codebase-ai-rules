# eslint-plugin-codebase-ai-rules

This repository contains a private GitHub package that extracts Hosti's comment-discipline ESLint rule without changing the rule's semantics.

## Vocabulary

- **Rule**: `comment-discipline`, the only lint rule in this package.
- **Preset**: `plugin.configs.recommended`, a flat-config array for JS, JSX, MJS, CJS, TS, TSX, MTS, and CTS.
- **Consumer**: a repository that installs this package from GitHub and spreads the preset in `eslint.config.mjs`.
- **Exception**: one closed, syntax-owned directive or legal header accepted by the rule.

## Contract

- Package name and version stay `eslint-plugin-codebase-ai-rules@0.1.0` until an intentional release decision changes them.
- The package is ESM, runs checked-in `.mjs` source directly, and supports Node `^20.19.0 || ^22.13.0 || >=24.0.0`, matching the checked-in ESLint 10 toolchain.
- `private: true` stays set. Do not npm-publish.
- The plugin key is `codebase-ai-rules`.
- `@typescript-eslint/parser` is a runtime dependency so consumers install no parser separately.
- ESLint is a peer dependency and a development dependency for this repository.
- Consumer path ignores do not belong in the preset.
- The rule source and tests are ported from Hosti. Packaging and config are generalized; rule semantics are not.

## Layout

```text
src/      checked-in plugin source
 tests/   unit and exported-preset tests
docs/     focused rule documentation
```

Keep source modules small. Tests should import the package entry point or exercise the exported preset. Do not add a build step.

## Verification

Run `npm run check` and `npm run pack:check`. For release or dependency changes, install the package from a fresh fixture using a pinned Git spec and run ESLint against JavaScript and TypeScript pass/fail fixtures.
