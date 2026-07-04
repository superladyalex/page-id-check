import { analyzeTsxFile } from "./parser.js";
import { resolveImport } from "./resolveImport.js";
import { resolveExports } from "./resolveExport.js";
import { isExcluded } from "./isExcluded.js";
import { normalizePath } from "./normalizePath.js";

import type { FileAnalysis, DomAttribute } from "./types.js";

export function buildPageAnalysis(entryFile: string): FileAnalysis {
  const visited = new Set<string>();
  const analysesByFile = new Map<string, FileAnalysis>();

  function walk(filePath: string) {
    const id = normalizePath(filePath);

    if (visited.has(id)) return;
    if (isExcluded(id)) return;

    visited.add(id);
    const analysis = analyzeTsxFile(id);
    analysesByFile.set(id, analysis);

    for (const imp of analysis.imports) {
      const resolved = resolveImport(id, imp.module);
      if (resolved) {
        walk(resolved);
      }
    }

    for (const exp of resolveExports(id)) {
      const resolved = resolveImport(id, exp.module);
      if (resolved) {
        walk(resolved);
      }
    }
  }

  walk(entryFile);

  const allAttributes: DomAttribute[] = [];
  const allImports: FileAnalysis["imports"] = [];
  const allComponentUsages: FileAnalysis["componentUsages"] = [];

  for (const analysis of analysesByFile.values()) {
    allAttributes.push(...analysis.attributes);
    allImports.push(...analysis.imports);
    allComponentUsages.push(...analysis.componentUsages);
  }

  return {
    file: entryFile,
    attributes: allAttributes,
    imports: allImports,
    componentUsages: allComponentUsages,
  };
}
