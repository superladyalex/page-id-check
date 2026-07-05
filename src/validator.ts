import type { FileAnalysis, DomAttribute } from "./types.js";

export interface ValidationIssue {
  page: string;
  attribute: string;
  value: string;
  message: string;
  occurrences: {
    file: string;
    line: number;
    column: number;
    renderPath: {
      file: string;
      line: number;
      column: number;
      name: string;
    }[];
  }[];
}

export function validate(
  pages: FileAnalysis[],
  duplicateAttributes: string[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const page of pages) {
    const seen = new Map<string, DomAttribute[]>();

    for (const attr of page.attributes) {
      if (!duplicateAttributes.includes(attr.name)) {
        continue;
      }

      if (!attr.value) continue;

      // Use a separator that will not collide with normal attribute values.
      const key = `${attr.name}\u0000${attr.value}`;

      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, [attr]);
      } else {
        existing.push(attr);
      }
    }

    for (const [key, occurrences] of seen.entries()) {
      if (occurrences.length <= 1) continue;

      const [attribute, value] = key.split("\u0000");

      issues.push({
        page: page.file,
        attribute,
        value,
        message: `Duplicate ${attribute} "${value}" found in page`,
        occurrences: occurrences.map((o) => ({
          file: o.file,
          line: o.line,
          column: o.column,
          renderPath: o.renderPath,
        })),
      });
    }
  }

  return issues;
}
