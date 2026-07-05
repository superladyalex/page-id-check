import { analyzeTsxFile } from "./parser.js";
import { resolveImport } from "./resolveImport.js";
import { resolveExportTargets } from "./resolveExport.js";
import { isExcluded } from "./isExcluded.js";

import type { FileAnalysis, DomAttribute } from "./types.js";
import type { RenderStep } from "./types.js";

export function buildPageAnalysis(
  entryFile: string,
  repoRoot: string,
  exclude: string[]
): FileAnalysis {
  const analysisCache = new Map<string, FileAnalysis>();
  const allAttributes: DomAttribute[] = [];
  const allImports: FileAnalysis["imports"] = [];
  const allComponentUsages: FileAnalysis["componentUsages"] = [];

  function walk(
    filePath: string,
    pathStack: Set<string>,
    renderPath: RenderStep[]
  ) {
    const id = filePath;

    if (isExcluded(id, repoRoot, exclude)) return;
    if (pathStack.has(id)) return;

    const analysis = getAnalysis(id);
    allAttributes.push(
      ...analysis.attributes.map((attr) => ({
        ...attr,
        renderPath: [...renderPath],
      }))
    );
    allImports.push(...analysis.imports);
    allComponentUsages.push(...analysis.componentUsages);

    const nextPathStack = new Set(pathStack);
    nextPathStack.add(id);

    for (const usage of analysis.componentUsages) {
      for (const imp of analysis.imports) {
        const exportName = getExportNameForUsage(imp, usage);
        if (!exportName) continue;

        const resolved = resolveImport(id, imp.module);
        if (!resolved) continue;

        const nextRenderPath = [
          ...renderPath,
          {
            file: id,
            line: usage.line,
            column: usage.column,
            name: usage.name,
          },
        ];

        const exportTargets = resolveExportTargets(resolved, exportName);
        if (exportTargets.length === 0) {
          walk(resolved, nextPathStack, nextRenderPath);
          continue;
        }

        for (const exportTarget of exportTargets) {
          walk(exportTarget, nextPathStack, nextRenderPath);
        }
      }
    }
  }

  function getAnalysis(filePath: string): FileAnalysis {
    const id = filePath;
    const cached = analysisCache.get(id);

    if (cached) {
      return cached;
    }

    const analysis = analyzeTsxFile(id);
    analysisCache.set(id, analysis);
    return analysis;
  }

  function getExportNameForUsage(
    imp: FileAnalysis["imports"][number],
    usage: FileAnalysis["componentUsages"][number]
  ): string | null {
    const [usageRoot, usageMember] = usage.name.split(".");

    if (imp.namespaceImport === usageRoot) {
      return usageMember ?? null;
    }

    if (imp.defaultImport === usageRoot) {
      return usageRoot;
    }

    if (imp.namedImports.includes(usageRoot)) {
      return imp.namedImportAliases?.[usageRoot] ?? usageRoot;
    }

    if (imp.namedImportAliases && usageRoot in imp.namedImportAliases) {
      return imp.namedImportAliases[usageRoot];
    }

    return null;
  }

  walk(entryFile, new Set<string>(), []);

  return {
    file: entryFile,
    attributes: allAttributes,
    imports: allImports,
    componentUsages: allComponentUsages,
  };
}
