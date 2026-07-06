import assert from "node:assert/strict";
import test from "node:test";

import { buildPageAnalysis } from "../buildPageAnalysis.js";
import { formatRenderPath } from "../index.js";
import { isExcluded } from "../isExcluded.js";
import { resolveExportTargets } from "../resolveExport.js";
import { validate, type ValidationIssue } from "../validator.js";
import { createTempProject, fixturePath } from "./testUtils.js";
import {
  TEST_DUPLICATE_ATTRIBUTES,
  TEST_EXCLUDE,
} from "./testConfig.js";

test("buildPageAnalysis tracks nested render paths", () => {
  const root = createTempProject({
    "src/pages/NestedRenderPage.tsx": `import Layout from "../components/Layout";

export default function NestedRenderPage() {
  return <Layout />;
}
`,
    "src/components/Layout.tsx": `import Section from "./Section";

export default function Layout() {
  return <Section />;
}
`,
    "src/components/Section.tsx": `import Button from "./Button";

export default function Section() {
  return <Button />;
}
`,
    "src/components/Button.tsx": `export default function Button() {
  return <button id="nested-button" data-testid="nested-button" />;
}
`,
  });

  const analysis = buildPageAnalysis(
    fixturePath(root, "src/pages/NestedRenderPage.tsx"),
    root,
    TEST_EXCLUDE
  );
  const buttonAttr = analysis.attributes.find(
    (attr) => attr.name === "id" && attr.value === "nested-button"
  );

  assert.equal(buttonAttr?.renderPath.length, 3);
  assert.equal(buttonAttr?.renderPath[0]?.name, "Layout");
  assert.equal(buttonAttr?.renderPath[1]?.name, "Section");
  assert.equal(buttonAttr?.renderPath[2]?.name, "Button");
});

test("buildPageAnalysis resolves namespace imports", () => {
  const root = createTempProject({
    "src/pages/NamespacePage.tsx": `import * as UI from "../components/ui";

export default function NamespacePage() {
  return (
    <>
      <UI.Button />
      <UI.Button />
    </>
  );
}
`,
    "src/components/ui/index.ts": `export { Button } from "./Button";
`,
    "src/components/ui/Button.tsx": `export default function Button() {
  return <button id="namespace-button" data-testid="namespace-button" />;
}
`,
  });

  const issues = validate(
    [
      buildPageAnalysis(fixturePath(root, "src/pages/NamespacePage.tsx"), root, TEST_EXCLUDE),
    ],
    TEST_DUPLICATE_ATTRIBUTES
  );

  assert.deepEqual(summary(issues), [
    "data-testid:namespace-button:2",
    "id:namespace-button:2",
  ]);
});

test("buildPageAnalysis resolves aliased named imports", () => {
  const root = createTempProject({
    "src/pages/AliasedPage.tsx": `import { Button as PrimaryButton } from "../components/ui";

export default function AliasedPage() {
  return (
    <>
      <PrimaryButton />
      <PrimaryButton />
    </>
  );
}
`,
    "src/components/ui/index.ts": `export { Button } from "./Button";
`,
    "src/components/ui/Button.tsx": `export default function Button() {
  return <button id="aliased-button" data-testid="aliased-button" />;
}
`,
  });

  const issues = validate(
    [
      buildPageAnalysis(fixturePath(root, "src/pages/AliasedPage.tsx"), root, TEST_EXCLUDE),
    ],
    TEST_DUPLICATE_ATTRIBUTES
  );

  assert.deepEqual(summary(issues), [
    "data-testid:aliased-button:2",
    "id:aliased-button:2",
  ]);
});

test("resolveExportTargets follows star barrel chains", () => {
  const root = createTempProject({
    "src/components/ui/index.ts": `export * from "./moreButtons";
`,
    "src/components/ui/moreButtons.ts": `export { Button } from "./Button";
`,
    "src/components/ui/Button.tsx": `export default function Button() { return null; }
`,
  });

  assert.deepEqual(resolveExportTargets(fixturePath(root, "src/components/ui/index.ts"), "Button"), [
    fixturePath(root, "src/components/ui/Button.tsx"),
  ]);
});

test("broken imports do not break traversal", () => {
  const root = createTempProject({
    "src/pages/BrokenImportPage.tsx": `import Missing from "../components/Missing";

export default function BrokenImportPage() {
  return <main />;
}
`,
  });

  const issues = validate(
    [
      buildPageAnalysis(fixturePath(root, "src/pages/BrokenImportPage.tsx"), root, TEST_EXCLUDE),
    ],
    TEST_DUPLICATE_ATTRIBUTES
  );

  assert.deepEqual(issues, []);
});

test("exclude patterns are honored", () => {
  const root = createTempProject({
    "src/pages/VisiblePage.tsx": "export default function VisiblePage() { return null; }\n",
    "src/pages/VisiblePage.test.tsx": "export default function VisiblePageTest() { return null; }\n",
    "node_modules/pkg/HiddenPage.tsx": "export default function HiddenPage() { return null; }\n",
  });

  assert.equal(
    isExcluded(fixturePath(root, "src/pages/VisiblePage.tsx"), root, TEST_EXCLUDE),
    false
  );
  assert.equal(
    isExcluded(
      fixturePath(root, "src/pages/VisiblePage.test.tsx"),
      root,
      TEST_EXCLUDE
    ),
    true
  );
  assert.equal(
    isExcluded(
      fixturePath(root, "node_modules/pkg/HiddenPage.tsx"),
      root,
      TEST_EXCLUDE
    ),
    true
  );
});

test("buildPageAnalysis reports duplicate attributes from separate branches", () => {
  const root = createTempProject({
    "src/pages/BranchDuplicatePage.tsx": `import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";

const usePrimaryAction = true;

export default function BranchDuplicatePage() {
  return usePrimaryAction ? (
    <PrimaryButton />
  ) : (
    <SecondaryButton />
  );
}
`,
    "src/components/PrimaryButton.tsx": `export default function PrimaryButton() {
  return <button id="branch-duplicate" data-testid="branch-duplicate" />;
}
`,
    "src/components/SecondaryButton.tsx": `export default function SecondaryButton() {
  return <button id="branch-duplicate" data-testid="branch-duplicate" />;
}
`,
  });

  const issues = validate(
    [
      buildPageAnalysis(fixturePath(root, "src/pages/BranchDuplicatePage.tsx"), root, TEST_EXCLUDE),
    ],
    TEST_DUPLICATE_ATTRIBUTES
  );

  assert.deepEqual(summary(issues), [
    "data-testid:branch-duplicate:2",
    "id:branch-duplicate:2",
  ]);
});

test("buildPageAnalysis stops on circular component imports", () => {
  const root = createTempProject({
    "src/pages/CyclePage.tsx": `import ComponentA from "../components/ComponentA";

export default function CyclePage() {
  return <ComponentA />;
}
`,
    "src/components/ComponentA.tsx": `import ComponentB from "./ComponentB";

export default function ComponentA() {
  return <ComponentB />;
}
`,
    "src/components/ComponentB.tsx": `import ComponentA from "./ComponentA";

export default function ComponentB() {
  return <button id="cycle-button" data-testid="cycle-button" />;
}
`,
  });

  const analysis = buildPageAnalysis(
    fixturePath(root, "src/pages/CyclePage.tsx"),
    root,
    TEST_EXCLUDE
  );

  const idAttr = analysis.attributes.find(
    (attr) => attr.name === "id" && attr.value === "cycle-button"
  );

  assert.equal(idAttr?.renderPath.length, 2);
  assert.equal(idAttr?.renderPath[0]?.name, "ComponentA");
  assert.equal(idAttr?.renderPath[1]?.name, "ComponentB");
});

test("resolveExportTargets handles circular barrel chains", () => {
  const root = createTempProject({
    "src/components/ui/index.ts": `export * from "./more";
`,
    "src/components/ui/more.ts": `export * from "./index";
export { Button } from "./Button";
`,
    "src/components/ui/Button.tsx": `export default function Button() {
  return null;
}
`,
  });

  const targets = resolveExportTargets(
    fixturePath(root, "src/components/ui/index.ts"),
    "Button"
  );

  assert.ok(targets.includes(fixturePath(root, "src/components/ui/Button.tsx")));
  assert.ok(targets.includes(fixturePath(root, "src/components/ui/index.ts")));
  assert.equal(new Set(targets).size, targets.length);
});

test("formatRenderPath shortens a render path to relative file segments", () => {
  const output = formatRenderPath(
    [
      {
        file: "/tmp/project/src/pages/Page.tsx",
        line: 4,
        column: 2,
        name: "Layout",
      },
      {
        file: "/tmp/project/src/components/Layout.tsx",
        line: 10,
        column: 4,
        name: "Button",
      },
    ],
    "/tmp/project"
  );

  assert.equal(output, "src/pages/Page.tsx:4:2 -> src/components/Layout.tsx:10:4");
});

function summary(issues: ValidationIssue[]): string[] {
  return issues
    .map((issue) => `${issue.attribute}:${issue.value}:${issue.occurrences.length}`)
    .sort();
}
