import fs from "fs";
import { ReExport } from "./types.js";

/** Extract re-export targets from barrel files. */
export function resolveExports(filePath: string): ReExport[] {
  const content = fs.readFileSync(filePath, "utf-8");

  const matches: ReExport[] = [];
  const namedExportRegex = /export\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.+)['"]/g;
  const starExportRegex = /export\s+\*\s+from\s+['"](.+)['"]/g;

  for (const match of content.matchAll(namedExportRegex)) {
    const modulePath = match[2];

    for (const exportedName of match[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)) {
      matches.push({ exportedName, module: modulePath });
    }
  }

  for (const match of content.matchAll(starExportRegex)) {
    matches.push({
      exportedName: "*",
      module: match[1],
    });
  }

  return matches;
}
