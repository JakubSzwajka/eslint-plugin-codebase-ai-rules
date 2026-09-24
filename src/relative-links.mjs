import path from "node:path";

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function relativeLinkPath(target) {
  const trimmed = target.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;
  if (SCHEME.test(trimmed) || trimmed.includes("{")) return null;
  const bare = trimmed.split("#")[0].split("?")[0];
  try {
    return decodeURIComponent(bare);
  } catch {
    return bare;
  }
}

export function trackedPaths(files) {
  const paths = new Set([""]);
  for (const file of files) {
    const parts = file.split("/");
    for (let index = 1; index <= parts.length; index += 1) paths.add(parts.slice(0, index).join("/"));
  }
  return paths;
}

export function normalizeRoots(roots = []) {
  return roots
    .map((root) => path.posix.normalize(root.replaceAll("\\", "/")).replace(/^\.\/|\/+$/g, ""))
    .filter((root) => root && root !== ".");
}

export function linkRoot(fromFile, roots = []) {
  return (
    normalizeRoots(roots)
      .filter((root) => fromFile.startsWith(`${root}/`))
      .sort((left, right) => right.length - left.length)[0] ?? ""
  );
}

export function resolveLink(fromFile, linkedPath, roots = []) {
  const root = linkRoot(fromFile, roots);
  const joined = linkedPath.startsWith("/")
    ? path.posix.join(root, linkedPath.slice(1))
    : path.posix.join(path.posix.dirname(fromFile), linkedPath);
  const normalized = path.posix.normalize(joined || ".").replace(/\/+$/, "");
  const resolved = normalized === "." ? "" : normalized;
  const insideRoot = root
    ? resolved === root || resolved.startsWith(`${root}/`)
    : resolved !== ".." && !resolved.startsWith("../");
  return insideRoot ? resolved : null;
}
