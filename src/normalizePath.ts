import path from "path";

/** Normalize a path to an absolute filesystem path. */
export function normalizePath(filePath: string): string {
  return path.resolve(filePath);
}
