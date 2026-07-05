import micromatch from "micromatch";
import path from "path";

// Shared exclusion filter for tests, build output, and dependencies.
export function isExcluded(
  filePath: string,
  repoRoot: string,
  exclude: string[]
): boolean {
  const relative = path.relative(repoRoot, filePath);

  return micromatch.isMatch(relative, exclude);
}
