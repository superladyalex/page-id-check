export interface DomAttribute {
  file: string;
  name: string;
  value: string | null;
  line: number;
  column: number;
  renderPath: RenderStep[];
}

export interface FileAnalysis {
  file: string;
  attributes: DomAttribute[];
  imports: ImportInfo[];
  componentUsages: ComponentUsage[];
}

export interface ImportInfo {
  module: string;
  namedImports: string[];
  defaultImport: string | null;
  namedImportAliases?: Record<string, string>;
  namespaceImport?: string | null;
}

export interface ComponentUsage {
  name: string;
  line: number;
  column: number;
}

export interface RenderStep {
  file: string;
  line: number;
  column: number;
  name: string;
}

export interface ReExport {
  exportedName: string;
  module: string;
}
