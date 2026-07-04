import fg from "fast-glob";
import { config } from "./config.js";

/** Discover page entry files relative to the configured root. */
export async function discover(
  patterns: string[],
  root: string
): Promise<string[]> {
  const files = await fg(patterns, {
    cwd: root,
    absolute: true,
    ignore: config.exclude,
    onlyFiles: true,
  });

  return files;
}
