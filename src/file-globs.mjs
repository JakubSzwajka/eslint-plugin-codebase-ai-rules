import { realpathSync } from "node:fs";
import path from "node:path";

const compiled = new Map();
const GLOBSTAR = Symbol("**");

function escape(character) {
  return /[.+^$()|\\\]{}]/.test(character) ? `\\${character}` : character;
}

function closingBrace(glob, open) {
  let depth = 0;
  for (let index = open; index < glob.length; index += 1) {
    if (glob[index] === "{") depth += 1;
    else if (glob[index] === "}" && --depth === 0) return index;
  }
  return -1;
}

function splitAlternatives(body) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === "{") depth += 1;
    else if (body[index] === "}") depth -= 1;
    else if (body[index] === "," && depth === 0) {
      parts.push(body.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

function expandBraces(glob) {
  const open = glob.indexOf("{");
  const close = open === -1 ? -1 : closingBrace(glob, open);
  if (close === -1) return [glob];
  const head = glob.slice(0, open);
  const tails = expandBraces(glob.slice(close + 1));
  return splitAlternatives(glob.slice(open + 1, close)).flatMap((alternative) =>
    expandBraces(alternative).flatMap((middle) => tails.map((tail) => head + middle + tail)),
  );
}

// Like minimatch's default (`dot: false`), a wildcard never matches a leading `.` unless the pattern writes it.
function segmentMatcher(segment) {
  if (!/[*?[]/.test(segment)) return (name) => name === segment;
  let source = segment.startsWith(".") ? "" : "(?!\\.)";
  for (let index = 0; index < segment.length; index += 1) {
    const character = segment[index];
    if (character === "*") {
      while (segment[index + 1] === "*") index += 1;
      source += ".*";
    } else if (character === "?") {
      source += ".";
    } else if (character === "[") {
      const close = segment.indexOf("]", index + 1);
      if (close === -1) {
        source += "\\[";
      } else {
        source += `[${segment.slice(index + 1, close).replace(/^!/, "^").replace(/\\/g, "\\\\")}]`;
        index = close;
      }
    } else {
      source += escape(character);
    }
  }
  const regex = new RegExp(`^${source}$`);
  return (name) => regex.test(name);
}

function compileSegments(glob) {
  const segments = [];
  for (const segment of glob.split("/")) {
    if (segment === "**") {
      if (segments.at(-1) !== GLOBSTAR) segments.push(GLOBSTAR);
    } else {
      segments.push(segmentMatcher(segment));
    }
  }
  return segments;
}

// One pass per pattern segment over the path segments, so matching stays O(pattern × path) with no backtracking.
function matchSegments(segments, parts) {
  let reach = new Array(parts.length + 1).fill(false);
  reach[0] = true;
  for (const segment of segments) {
    const next = new Array(parts.length + 1).fill(false);
    if (segment === GLOBSTAR) {
      for (let index = 0; index <= parts.length; index += 1) {
        next[index] = reach[index] || (index > 0 && next[index - 1] && !parts[index - 1].startsWith("."));
      }
    } else {
      for (let index = 0; index < parts.length; index += 1) {
        if (reach[index] && segment(parts[index])) next[index + 1] = true;
      }
    }
    reach = next;
  }
  return reach[parts.length];
}

// Supports `**`, `*`, `?`, `[...]` and `{a,b}`: enough for flat-config style file globs.
export function compileGlob(glob) {
  const alternatives = expandBraces(glob).map(compileSegments);
  return {
    test(relativePath) {
      const parts = relativePath.split("/");
      return alternatives.some((segments) => matchSegments(segments, parts));
    },
  };
}

function matcher(glob) {
  if (!compiled.has(glob)) compiled.set(glob, compileGlob(glob.replace(/^\.\//, "")));
  return compiled.get(glob);
}

function real(file) {
  try {
    return realpathSync(file);
  } catch {
    return file;
  }
}

export function matchesAnyGlob(filename, cwd, globs) {
  if (!globs.length) return false;
  const absolute = path.resolve(cwd, filename);
  const file = path.join(real(path.dirname(absolute)), path.basename(absolute));
  const relative = path.relative(real(path.resolve(cwd)), file).split(path.sep).join("/");
  return globs.some((glob) => matcher(glob).test(relative));
}
