import { COLOR_FUNCTIONS, HEX_DIGITS } from "./colors.mjs";

function isDigit(character) {
  return character >= "0" && character <= "9";
}

function isNameStart(character) {
  return /[A-Za-z_\\]/.test(character ?? "") || (character ?? "") > "\u007f";
}

function isNameCharacter(character) {
  return isNameStart(character) || isDigit(character) || character === "-";
}

function startsIdentifier(text, index) {
  if (text[index] !== "-") return isNameStart(text[index]);
  return text[index + 1] === "-" || isNameStart(text[index + 1]);
}

function startsNumber(text, index) {
  const [first, second, third] = [text[index], text[index + 1], text[index + 2]];
  if (first === "+" || first === "-") return isDigit(second) || (second === "." && isDigit(third));
  return isDigit(first) || (first === "." && isDigit(second));
}

function readName(text, index) {
  let end = index;
  while (end < text.length && isNameCharacter(text[end])) end += text[end] === "\\" ? 2 : 1;
  return Math.min(end, text.length);
}

function skipString(text, index) {
  const quote = text[index];
  let end = index + 1;
  while (end < text.length && text[end] !== quote && text[end] !== "\n") end += text[end] === "\\" ? 2 : 1;
  return Math.min(end + 1, text.length);
}

function readNumber(text, index) {
  const match = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(index));
  const end = index + match[0].length;
  if (text[end] === "%") return end + 1;
  return startsIdentifier(text, end) ? readName(text, end) : end;
}

// Tokenizes one declaration value, parsed or raw, into the pieces the design rules inspect.
// Each item carries whether it sits in a var() fallback or inside a colour function.
export function scanCssValue(text) {
  const items = [];
  const frames = [];
  const inFallback = () => frames.some((frame) => frame.kind === "var" && frame.afterComma);
  const colorFrame = () => frames.findLast((frame) => frame.kind === "color");
  const push = (item) => {
    const owner = colorFrame();
    items.push({ ...item, inFallback: inFallback(), inColorFunction: Boolean(owner) });
    if (owner && item.type === "var") owner.item.hasVar = true;
  };
  let index = 0;

  while (index < text.length) {
    const character = text[index];
    if (character === "/" && text[index + 1] === "*") {
      const close = text.indexOf("*/", index + 2);
      index = close === -1 ? text.length : close + 2;
    } else if (character === '"' || character === "'") {
      index = skipString(text, index);
    } else if (character === "#") {
      const end = readName(text, index + 1);
      if (HEX_DIGITS.test(text.slice(index + 1, end))) push({ type: "hex", start: index, end, text: text.slice(index, end) });
      index = Math.max(end, index + 1);
    } else if (startsNumber(text, index)) {
      index = readNumber(text, index);
    } else if (startsIdentifier(text, index)) {
      const end = readName(text, index);
      const name = text.slice(index, end);
      const lower = name.toLowerCase();
      if (text[end] !== "(") {
        push({ type: "identifier", start: index, end, text: name });
        index = end;
      } else if (lower === "url") {
        const close = text.indexOf(")", end);
        index = close === -1 ? text.length : close + 1;
      } else if (lower === "var") {
        const reference = /^\s*(--[^\s,()]*)/.exec(text.slice(end + 1));
        if (reference) {
          const start = end + 1 + reference[0].length - reference[1].length;
          push({ type: "var", start, end: start + reference[1].length, text: reference[1], name: reference[1] });
        }
        frames.push({ kind: "var", afterComma: false });
        index = end + 1 + (reference ? reference[0].length : 0);
      } else if (COLOR_FUNCTIONS.has(lower)) {
        const item = { type: "color-function", start: index, end: text.length, text: "", name: lower, hasVar: false };
        push(item);
        frames.push({ kind: "color", item: items.at(-1) });
        index = end + 1;
      } else {
        frames.push({ kind: "function", name: lower });
        index = end + 1;
      }
    } else if (character === "(") {
      frames.push({ kind: "group" });
      index += 1;
    } else if (character === ")") {
      const frame = frames.pop();
      if (frame?.kind === "color") {
        frame.item.end = index + 1;
        frame.item.text = text.slice(frame.item.start, index + 1);
      }
      index += 1;
    } else {
      const frame = frames.at(-1);
      if (character === "," && frame?.kind === "var") frame.afterComma = true;
      index += 1;
    }
  }

  for (const frame of frames) {
    if (frame.kind === "color") frame.item.text = text.slice(frame.item.start);
  }
  return items;
}

function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0 && separator.test(character)) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function splitCommaList(text) {
  return splitTopLevel(text, /,/);
}

export function splitComponents(text) {
  return splitTopLevel(text, /[\s,/]/);
}

export function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ");
}

// Returns a declaration's value text and its offset in the file. Custom-property values arrive as Raw nodes.
export function declarationValue(sourceCode, declaration) {
  const value = declaration.value;
  if (!value?.loc) return null;
  const start = value.loc.start.offset;
  return { start, text: sourceCode.text.slice(start, value.loc.end.offset) };
}

export function locOf(sourceCode, start, end) {
  return { start: sourceCode.getLocFromIndex(start), end: sourceCode.getLocFromIndex(end) };
}
