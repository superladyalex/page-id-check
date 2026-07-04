import fs from "fs";
import { resolveImport } from "./resolveImport.js";
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

export function resolveExportTargets(
  filePath: string,
  exportedName: string
): string[] {
  return resolveExportTargetsRecursive(filePath, exportedName, new Set<string>());
}

function resolveExportTargetsRecursive(
  filePath: string,
  exportedName: string,
  seen: Set<string>
): string[] {
  const cacheKey = `${filePath}\u0000${exportedName}`;
  if (seen.has(cacheKey)) return [];
  seen.add(cacheKey);

  const content = fs.readFileSync(filePath, "utf-8");
  const targets = new Set<string>();

  const namedExportRegex =
    /export\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.+)['"]/g;
  const starExportRegex = /export\s+\*\s+from\s+['"](.+)['"]/g;

  for (const match of content.matchAll(namedExportRegex)) {
    const modulePath = match[2];

    for (const exported of match[1]
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)) {
      const parts = exported.split(/\s+as\s+/i).map((name) => name.trim());
      const barrelExportName = parts[1] ?? parts[0];

      if (barrelExportName !== exportedName) {
        continue;
      }

      const resolved = resolveImport(filePath, modulePath);
      if (!resolved) continue;

      const nestedTargets = resolveExportTargetsRecursive(
        resolved,
        exportedName,
        seen
      );

      if (nestedTargets.length === 0) {
        targets.add(resolved);
      } else {
        for (const nestedTarget of nestedTargets) {
          targets.add(nestedTarget);
        }
      }
    }
  }

  for (const match of content.matchAll(starExportRegex)) {
    const resolved = resolveImport(filePath, match[1]);
    if (!resolved) continue;

    const nestedTargets = resolveExportTargetsRecursive(
      resolved,
      exportedName,
      seen
    );

    if (nestedTargets.length === 0) {
      targets.add(resolved);
    } else {
      for (const nestedTarget of nestedTargets) {
        targets.add(nestedTarget);
      }
    }
  }

  return [...targets];
}
