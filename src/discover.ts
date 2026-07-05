import fg from "fast-glob";

/** Discover page entry files relative to the configured root. */
export async function discover(
  patterns: string[],
  root: string,
  exclude: string[]
): Promise<string[]> {
  const files = await fg(patterns, {
    cwd: root,
    absolute: true,
    ignore: exclude,
    onlyFiles: true,
  });

  return files;
}
