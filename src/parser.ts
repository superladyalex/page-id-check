import { Node, Project, SyntaxKind } from "ts-morph";

import type {
  DomAttribute,
  FileAnalysis,
  ImportInfo,
  ComponentUsage,
} from "./types.js";

const project = new Project();

function isComponentTag(tag: string): boolean {
  return /^[A-Z]/.test(tag);
}

export function analyzeTsxFile(filePath: string): FileAnalysis {
  const sourceFile = project.addSourceFileAtPath(filePath);

  // Reduce JSX initializers to plain values for duplicate matching.
  function normalizeAttributeValue(initializer: any): string | null {
    if (!initializer) return null;

    if (
      Node.isStringLiteral(initializer) ||
      Node.isNoSubstitutionTemplateLiteral(initializer)
    ) {
      return initializer.getLiteralText();
    }

    if (Node.isJsxExpression(initializer)) {
      const expression = initializer.getExpression();

      if (
        expression &&
        (Node.isStringLiteral(expression) ||
          Node.isNoSubstitutionTemplateLiteral(expression))
      ) {
        return expression.getLiteralText();
      }

      return expression?.getText() ?? null;
    }

    const text = initializer.getText();
    const singleQuoted = text.match(/^'(.*)'$/s);
    if (singleQuoted) return singleQuoted[1];

    const doubleQuoted = text.match(/^"(.*)"$/s);
    if (doubleQuoted) return doubleQuoted[1];

    return text;
  }

  const attributes: DomAttribute[] = sourceFile
    .getDescendantsOfKind(SyntaxKind.JsxAttribute)
    .map((attr: any) => {
      const pos = sourceFile.getLineAndColumnAtPos(attr.getStart());

      return {
        file: filePath,
        name: attr.getNameNode().getText(),
        value: normalizeAttributeValue(attr.getInitializer()),
        line: pos.line,
        column: pos.column,
      };
    });

  const imports: ImportInfo[] = sourceFile.getImportDeclarations().map((imp: any) => {
    const namedImportAliases: Record<string, string> = {};

    imp.getNamedImports().forEach((n: any) => {
      const name = n.getName();
      const alias = n.getAliasNode()?.getText();

      if (alias) {
        namedImportAliases[alias] = name;
      }
    });

    const namespaceImport = imp.getNamespaceImport()?.getText() ?? null;

    return {
      module: imp.getModuleSpecifierValue(),
      defaultImport: imp.getDefaultImport()?.getText() ?? null,
      namedImports: imp.getNamedImports().map((n: any) => n.getName()),
      namedImportAliases,
      namespaceImport,
    };
  });

  const componentUsages: ComponentUsage[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
  ]
    .map((el: any) => {
      const pos = sourceFile.getLineAndColumnAtPos(el.getStart());

      return {
        name: el.getTagNameNode().getText(),
        line: pos.line,
        column: pos.column,
      };
    })
    .filter((u) => isComponentTag(u.name));

  return {
    file: filePath,
    attributes,
    imports,
    componentUsages,
  };
}
