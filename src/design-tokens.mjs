import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { parseColor } from "./colors.mjs";
import { stripCssComments } from "./css-values.mjs";

const definitionsByFile = new Map();

function realFile(file) {
  try {
    return realpathSync(file);
  } catch {
    return file;
  }
}

function readValue(text, index) {
  let depth = 0;
  let quote = null;
  for (let end = index; end < text.length; end += 1) {
    const character = text[end];
    if (quote) {
      if (character === "\\") end += 1;
      else if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(" || character === "[" || character === "{") {
      depth += 1;
    } else if (character === ")" || character === "]" || (character === "}" && depth > 0)) {
      depth -= 1;
    } else if (depth === 0 && (character === ";" || character === "}")) {
      return end;
    }
  }
  return text.length;
}

// Finds every `--name: value` declaration in a stylesheet, in source order, without a CSS parser.
// The package root registers the rules, so this must not load the optional @eslint/css peer.
export function customPropertyDefinitions(css) {
  const text = stripCssComments(css);
  const definitions = [];
  const declaration = /(^|[{;])(\s*)(--[A-Za-z0-9_\-\u0080-\uffff]+)\s*:/g;
  let match;
  while ((match = declaration.exec(text)) !== null) {
    const valueStart = match.index + match[0].length;
    const valueEnd = readValue(text, valueStart);
    definitions.push({ name: match[3], value: text.slice(valueStart, valueEnd).replace(/!important\s*$/i, "").trim() });
    declaration.lastIndex = valueEnd;
  }
  return definitions;
}

function stampOf(file) {
  const stats = statSync(file);
  return `${stats.mtimeMs}:${stats.size}`;
}

function fileDefinitions(file) {
  let stamp;
  try {
    stamp = stampOf(file);
  } catch {
    throw new Error(`codebase-ai-rules: token file "${file}" does not exist or cannot be read.`);
  }
  const cached = definitionsByFile.get(file);
  if (cached?.stamp === stamp) return cached.definitions;
  const definitions = customPropertyDefinitions(readFileSync(file, "utf8"));
  definitionsByFile.set(file, { stamp, definitions });
  return definitions;
}

function resolveValue(name, values, seen = new Set()) {
  const value = values.get(name);
  if (value === undefined || seen.has(name)) return undefined;
  const reference = /^var\(\s*(--[^\s,()]+)\s*\)$/.exec(value);
  if (!reference) return value;
  seen.add(name);
  return resolveValue(reference[1], values, seen);
}

// Token files resolve from ESLint's cwd. A token's first definition wins; later ones are theme overrides.
export function readTokens(cwd, tokenFiles) {
  const files = tokenFiles.map((file) => realFile(path.resolve(cwd, file)));
  const values = new Map();
  for (const file of files) {
    for (const { name, value } of fileDefinitions(file)) if (!values.has(name)) values.set(name, value);
  }
  let palette;
  return {
    files: new Set(files),
    names: new Set(values.keys()),
    isTokenFile: (filename) => files.includes(realFile(path.resolve(cwd, filename))),
    get palette() {
      palette ??= [...values.keys()].flatMap((name) => {
        const value = resolveValue(name, values);
        const color = value === undefined ? null : parseColor(value);
        return color ? [{ name, color }] : [];
      });
      return palette;
    },
  };
}
