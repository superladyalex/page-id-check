import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function createTempProject(
  files: Record<string, string>
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "page-id-check-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, "utf8");
  }

  return root;
}

export function fixturePath(root: string, relativePath: string): string {
  return path.join(root, relativePath);
}
