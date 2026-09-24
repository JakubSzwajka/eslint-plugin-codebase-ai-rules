const NAMED_HEX = {
  aliceblue: "f0f8ff", antiquewhite: "faebd7", aqua: "00ffff", aquamarine: "7fffd4", azure: "f0ffff",
  beige: "f5f5dc", bisque: "ffe4c4", black: "000000", blanchedalmond: "ffebcd", blue: "0000ff",
  blueviolet: "8a2be2", brown: "a52a2a", burlywood: "deb887", cadetblue: "5f9ea0", chartreuse: "7fff00",
  chocolate: "d2691e", coral: "ff7f50", cornflowerblue: "6495ed", cornsilk: "fff8dc", crimson: "dc143c",
  cyan: "00ffff", darkblue: "00008b", darkcyan: "008b8b", darkgoldenrod: "b8860b", darkgray: "a9a9a9",
  darkgreen: "006400", darkgrey: "a9a9a9", darkkhaki: "bdb76b", darkmagenta: "8b008b", darkolivegreen: "556b2f",
  darkorange: "ff8c00", darkorchid: "9932cc", darkred: "8b0000", darksalmon: "e9967a", darkseagreen: "8fbc8f",
  darkslateblue: "483d8b", darkslategray: "2f4f4f", darkslategrey: "2f4f4f", darkturquoise: "00ced1",
  darkviolet: "9400d3", deeppink: "ff1493", deepskyblue: "00bfff", dimgray: "696969", dimgrey: "696969",
  dodgerblue: "1e90ff", firebrick: "b22222", floralwhite: "fffaf0", forestgreen: "228b22", fuchsia: "ff00ff",
  gainsboro: "dcdcdc", ghostwhite: "f8f8ff", gold: "ffd700", goldenrod: "daa520", gray: "808080",
  green: "008000", greenyellow: "adff2f", grey: "808080", honeydew: "f0fff0", hotpink: "ff69b4",
  indianred: "cd5c5c", indigo: "4b0082", ivory: "fffff0", khaki: "f0e68c", lavender: "e6e6fa",
  lavenderblush: "fff0f5", lawngreen: "7cfc00", lemonchiffon: "fffacd", lightblue: "add8e6", lightcoral: "f08080",
  lightcyan: "e0ffff", lightgoldenrodyellow: "fafad2", lightgray: "d3d3d3", lightgreen: "90ee90",
  lightgrey: "d3d3d3", lightpink: "ffb6c1", lightsalmon: "ffa07a", lightseagreen: "20b2aa",
  lightskyblue: "87cefa", lightslategray: "778899", lightslategrey: "778899", lightsteelblue: "b0c4de",
  lightyellow: "ffffe0", lime: "00ff00", limegreen: "32cd32", linen: "faf0e6", magenta: "ff00ff",
  maroon: "800000", mediumaquamarine: "66cdaa", mediumblue: "0000cd", mediumorchid: "ba55d3",
  mediumpurple: "9370db", mediumseagreen: "3cb371", mediumslateblue: "7b68ee", mediumspringgreen: "00fa9a",
  mediumturquoise: "48d1cc", mediumvioletred: "c71585", midnightblue: "191970", mintcream: "f5fffa",
  mistyrose: "ffe4e1", moccasin: "ffe4b5", navajowhite: "ffdead", navy: "000080", oldlace: "fdf5e6",
  olive: "808000", olivedrab: "6b8e23", orange: "ffa500", orangered: "ff4500", orchid: "da70d6",
  palegoldenrod: "eee8aa", palegreen: "98fb98", paleturquoise: "afeeee", palevioletred: "db7093",
  papayawhip: "ffefd5", peachpuff: "ffdab9", peru: "cd853f", pink: "ffc0cb", plum: "dda0dd",
  powderblue: "b0e0e6", purple: "800080", rebeccapurple: "663399", red: "ff0000", rosybrown: "bc8f8f",
  royalblue: "4169e1", saddlebrown: "8b4513", salmon: "fa8072", sandybrown: "f4a460", seagreen: "2e8b57",
  seashell: "fff5ee", sienna: "a0522d", silver: "c0c0c0", skyblue: "87ceeb", slateblue: "6a5acd",
  slategray: "708090", slategrey: "708090", snow: "fffafa", springgreen: "00ff7f", steelblue: "4682b4",
  tan: "d2b48c", teal: "008080", thistle: "d8bfd8", tomato: "ff6347", turquoise: "40e0d0", violet: "ee82ee",
  wheat: "f5deb3", white: "ffffff", whitesmoke: "f5f5f5", yellow: "ffff00", yellowgreen: "9acd32",
};

export const COLOR_KEYWORDS = new Set([...Object.keys(NAMED_HEX), "transparent", "currentcolor"]);
export const COLOR_FUNCTIONS = new Set(["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color"]);
export const HEX_DIGITS = /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function fromHex(digits) {
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
  const channel = (index) => parseInt(full.slice(index, index + 2), 16) / 255;
  return { r: channel(0), g: channel(2), b: channel(4), alpha: full.length === 8 ? channel(6) : 1 };
}

function number(part, percentScale = 1) {
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|grad|rad|turn)?$/i.exec(part);
  if (!match) return part.toLowerCase() === "none" ? 0 : null;
  const value = Number(match[1]);
  switch (match[2]?.toLowerCase()) {
    case "%":
      return (value / 100) * percentScale;
    case "grad":
      return value * 0.9;
    case "rad":
      return (value * 180) / Math.PI;
    case "turn":
      return value * 360;
    default:
      return value;
  }
}

function hslToRgb(hue, saturation, lightness) {
  const h = (((hue % 360) + 360) % 360) / 30;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n) => {
    const k = (n + h) % 12;
    return lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return { r: f(0), g: f(8), b: f(4) };
}

function linearToSrgb(value) {
  return value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
}

function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function oklabToRgb(lightness, a, b) {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

export function toOklab({ r, g, b }) {
  const [lr, lg, lb] = [r, g, b].map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function channels(args) {
  const parts = args.replace(/\//g, " / ").split(/[\s,]+/).filter(Boolean);
  const slash = parts.indexOf("/");
  if (slash !== -1) return { values: parts.slice(0, slash), alpha: parts.slice(slash + 1) };
  return { values: parts.slice(0, 3), alpha: parts.slice(3) };
}

function fromFunction(name, args) {
  const { values, alpha } = channels(args);
  if (values.length !== 3 || alpha.length > 1) return null;
  const opacity = alpha.length ? number(alpha[0], 1) : 1;
  if (opacity === null) return null;
  const color = channelsFor(name, values);
  return color ? { ...color, alpha: opacity } : null;
}

function channelsFor(name, values) {
  switch (name) {
    case "rgb":
    case "rgba": {
      const [r, g, b] = values.map((part) => number(part, 255));
      return [r, g, b].includes(null) ? null : { r: r / 255, g: g / 255, b: b / 255 };
    }
    case "hsl":
    case "hsla": {
      const [h, s, l] = [number(values[0]), number(values[1], 100), number(values[2], 100)];
      return [h, s, l].includes(null) ? null : hslToRgb(h, s / 100, l / 100);
    }
    case "hwb": {
      const [h, white, black] = [number(values[0]), number(values[1], 100), number(values[2], 100)];
      if ([h, white, black].includes(null)) return null;
      const [w, b] = [white / 100, black / 100];
      if (w + b >= 1) return { r: w / (w + b), g: w / (w + b), b: w / (w + b) };
      const pure = hslToRgb(h, 1, 0.5);
      const mix = (c) => c * (1 - w - b) + w;
      return { r: mix(pure.r), g: mix(pure.g), b: mix(pure.b) };
    }
    case "oklab": {
      const [l, a, b] = [number(values[0], 1), number(values[1], 0.4), number(values[2], 0.4)];
      return [l, a, b].includes(null) ? null : oklabToRgb(l, a, b);
    }
    case "oklch": {
      const [l, c, h] = [number(values[0], 1), number(values[1], 0.4), number(values[2])];
      if ([l, c, h].includes(null)) return null;
      const radians = (h * Math.PI) / 180;
      return oklabToRgb(l, c * Math.cos(radians), c * Math.sin(radians));
    }
    default:
      return null;
  }
}

// Returns sRGB channels in 0..1 for the colour forms whose nearest token can be computed, else null.
export function parseColor(text) {
  const value = text.trim().toLowerCase();
  if (value.startsWith("#")) return HEX_DIGITS.test(value.slice(1)) ? fromHex(value.slice(1)) : null;
  if (Object.hasOwn(NAMED_HEX, value)) return fromHex(NAMED_HEX[value]);
  if (value === "transparent") return { r: 0, g: 0, b: 0, alpha: 0 };
  const call = /^([a-z]+)\(([^()]*)\)$/.exec(value);
  return call ? fromFunction(call[1], call[2]) : null;
}

export function colorDistance(left, right) {
  const [a, b] = [toOklab(left), toOklab(right)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function nearestToken(color, palette) {
  let best = null;
  for (const entry of palette) {
    const distance = colorDistance(color, entry.color);
    if (best === null || distance < best.distance) best = { name: entry.name, distance, alpha: entry.color.alpha };
  }
  return best;
}
