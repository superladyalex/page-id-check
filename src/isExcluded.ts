import micromatch from "micromatch";
import { config } from "./config.js";
import { normalizePath } from "./normalizePath.js";
import path from "path";

/** Shared exclusion filter for tests, build output, and dependencies. */
export function isExcluded(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  const relative = path.relative(config.repoRoot, normalized);

  return micromatch.isMatch(relative, config.exclude);
}
