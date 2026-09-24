import { execFileSync } from "node:child_process";
import { readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { trackedPaths } from "./relative-links.mjs";

const GIT_OUTPUT_LIMIT = 512 * 1024 * 1024;
const topLevelByDirectory = new Map();
const indexPathByTopLevel = new Map();
const trackedByTopLevel = new Map();
const EMPTY_TRACKED = trackedPaths([]);

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: GIT_OUTPUT_LIMIT,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function realDirectory(directory) {
  try {
    return realpathSync(directory);
  } catch {
    return directory;
  }
}

function gitTopLevel(directory) {
  if (!topLevelByDirectory.has(directory)) {
    let topLevel = null;
    try {
      topLevel = realDirectory(path.resolve(git(["rev-parse", "--show-toplevel"], directory).trim()));
    } catch {
      topLevel = null;
    }
    topLevelByDirectory.set(directory, topLevel);
  }
  return topLevelByDirectory.get(directory);
}

// Worktrees and submodules keep the index outside `<top-level>/.git`, so ask git where it is.
function gitIndexPath(topLevel) {
  if (!indexPathByTopLevel.has(topLevel)) {
    indexPathByTopLevel.set(topLevel, path.resolve(topLevel, git(["rev-parse", "--git-path", "index"], topLevel).trim()));
  }
  return indexPathByTopLevel.get(topLevel);
}

function indexStamp(indexPath) {
  try {
    const stats = statSync(indexPath);
    return `${stats.mtimeMs}:${stats.size}:${stats.ino}`;
  } catch {
    return null;
  }
}

// `git add`, `git mv` and `git rm` rewrite the index, so a long-lived process re-reads it only when it changed.
function gitTrackedPaths(topLevel) {
  const stamp = indexStamp(gitIndexPath(topLevel));
  if (stamp === null) {
    trackedByTopLevel.delete(topLevel);
    return EMPTY_TRACKED;
  }
  const cached = trackedByTopLevel.get(topLevel);
  if (cached?.stamp === stamp) return cached.paths;
  const files = git(["ls-files", "-z"], topLevel).split("\0").filter(Boolean);
  const paths = trackedPaths(files);
  trackedByTopLevel.set(topLevel, { stamp, paths });
  return paths;
}

function gitTrackedPathsOrNull(topLevel) {
  try {
    return gitTrackedPaths(topLevel);
  } catch {
    return null;
  }
}

function existsWithExactCase(root, relativePath) {
  let directory = root;
  for (const segment of relativePath ? relativePath.split("/") : []) {
    try {
      if (!readdirSync(directory).includes(segment)) return false;
    } catch {
      return false;
    }
    directory = path.join(directory, segment);
  }
  return true;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

export function repositoryPathsFor(filename, cwd) {
  const absolute = path.resolve(cwd, filename);
  const directory = realDirectory(path.dirname(absolute));
  const topLevel = gitTopLevel(directory);
  const root = topLevel ?? realDirectory(path.resolve(cwd));
  const fromFile = toPosix(path.relative(root, path.join(directory, path.basename(absolute))));
  if (!fromFile || fromFile === ".." || fromFile.startsWith("../") || path.isAbsolute(fromFile)) return null;

  const tracked = topLevel ? gitTrackedPathsOrNull(topLevel) : null;
  if (tracked) return { fromFile, has: (relativePath) => tracked.has(relativePath) };
  return { fromFile, has: (relativePath) => existsWithExactCase(root, relativePath) };
}
