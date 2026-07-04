import assert from "node:assert/strict";
import test from "node:test";

import { resolveImport } from "../resolveImport.js";
import { resolveExportTargets } from "../resolveExport.js";
import { createTempProject, fixturePath } from "./testUtils.js";

test("resolveImport resolves direct files and barrel folders", () => {
  const root = createTempProject({
    "src/pages/DashboardPage.tsx": `import Button from "../components/ui";

export default function DashboardPage() {
  return <Button />;
}
`,
    "src/components/ui/index.ts": `export { default as Button } from "./Button";
`,
    "src/components/ui/Button.tsx": "export default function Button() { return null; }\n",
    "src/components/Footer.tsx": "export default function Footer() { return null; }\n",
  });

  const dashboardPage = fixturePath(root, "src/pages/DashboardPage.tsx");
  const uiIndex = fixturePath(root, "src/components/ui/index.ts");

  assert.equal(resolveImport(dashboardPage, "../components/ui"), uiIndex);
  assert.equal(
    resolveImport(dashboardPage, "../components/Footer"),
    fixturePath(root, "src/components/Footer.tsx")
  );
});

test("resolveImport returns null for missing relative modules", () => {
  const root = createTempProject({
    "src/pages/DashboardPage.tsx": `export default function DashboardPage() {
  return null;
}
`,
  });

  assert.equal(
    resolveImport(
      fixturePath(root, "src/pages/DashboardPage.tsx"),
      "../components/Missing"
    ),
    null
  );
});

test("resolveExportTargets resolves barrel re-exports", () => {
  const root = createTempProject({
    "src/components/ui/index.ts": `export { Button } from "./Button";
export { SearchResults } from "./SearchResults";
`,
    "src/components/ui/Button.tsx": "export default function Button() { return null; }\n",
    "src/components/ui/SearchResults.tsx":
      "export default function SearchResults() { return null; }\n",
  });

  const uiIndex = fixturePath(root, "src/components/ui/index.ts");

  assert.deepEqual(resolveExportTargets(uiIndex, "Button"), [
    fixturePath(root, "src/components/ui/Button.tsx"),
  ]);

  assert.deepEqual(resolveExportTargets(uiIndex, "SearchResults"), [
    fixturePath(root, "src/components/ui/SearchResults.tsx"),
  ]);
});
