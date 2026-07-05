import path from "path";
import fs from "fs";

// Resolve relative imports to source files.
export function resolveImport(fromFile: string, module: string): string | null {
  if (!module.startsWith(".")) return null;

  const baseDir = path.dirname(fromFile);
  const cleanedModule = normalizeModule(module);
  const candidates = [
    path.resolve(baseDir, cleanedModule + ".tsx"),
    path.resolve(baseDir, cleanedModule + ".ts"),
    path.resolve(baseDir, cleanedModule + ".jsx"),
    path.resolve(baseDir, cleanedModule + ".js"),
    path.resolve(baseDir, cleanedModule, "index.tsx"),
    path.resolve(baseDir, cleanedModule, "index.ts"),
    path.resolve(baseDir, cleanedModule, "index.jsx"),
    path.resolve(baseDir, cleanedModule, "index.js"),
  ];

  const seen = new Set<string>();
  for (const filePath of candidates) {
    const resolved = path.resolve(filePath);

    if (seen.has(resolved)) continue;
    seen.add(resolved);

    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
}

function normalizeModule(module: string): string {
  return module.replace(/\/+$/, "");
}
