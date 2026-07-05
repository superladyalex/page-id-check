import micromatch from "micromatch";
import { config } from "./config.js";
import path from "path";

// Shared exclusion filter for tests, build output, and dependencies.
export function isExcluded(filePath: string, repoRoot = config.repoRoot): boolean {
  const relative = path.relative(repoRoot, filePath);

  return micromatch.isMatch(relative, config.exclude);
}
