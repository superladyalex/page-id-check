import micromatch from "micromatch";
import { config } from "./config.js";
import { normalizePath } from "./normalizePath.js";
import path from "path";

/** Shared exclusion filter for tests, build output, and dependencies. */
export function isExcluded(filePath: string, repoRoot = config.repoRoot): boolean {
  const normalized = normalizePath(filePath);
  const relative = path.relative(repoRoot, normalized);

  return micromatch.isMatch(relative, config.exclude);
}
