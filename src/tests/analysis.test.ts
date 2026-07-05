import assert from "node:assert/strict";
import test from "node:test";

import { buildPageAnalysis } from "../buildPageAnalysis.js";
import { validate, type ValidationIssue } from "../validator.js";
import { createTempProject, fixturePath } from "./testUtils.js";
import {
  TEST_DUPLICATE_ATTRIBUTES,
  TEST_EXCLUDE,
} from "./testConfig.js";

function createTraversalProject(): string {
  return createTempProject({
    "src/pages/ImportedButUnusedPage.tsx": `import SearchBox from "../components/ui/SearchBox";
import SearchResults from "../components/ui/SearchResults";

export default function ImportedButUnusedPage() {
  return <SearchBox />;
}
`,
    "src/pages/ComponentReusePage.tsx": `import Button from "../components/ui/Button";

export default function ComponentReusePage() {
  return (
    <>
      <Button />
      <Button />
      <Button />
    </>
  );
}
`,
    "src/pages/ConditionalBranchPage.tsx": `import ConditionalPrimaryButton from "../components/ui/ConditionalPrimaryButton";
import ConditionalSecondaryButton from "../components/ui/ConditionalSecondaryButton";

const usePrimaryAction = true;

export default function ConditionalBranchPage() {
  return usePrimaryAction ? (
    <ConditionalPrimaryButton />
  ) : (
    <ConditionalSecondaryButton />
  );
}
`,
    "src/pages/CleanPage.tsx": `export default function CleanPage() {
  return <main />;
}
`,
    "src/components/ui/SearchBox.tsx": `export default function SearchBox() {
  return <input data-testid="search-input" />;
}
`,
    "src/components/ui/SearchResults.tsx": `export default function SearchResults() {
  return <div data-testid="search-input" />;
}
`,
    "src/components/ui/Button.tsx": `export default function Button() {
  return <button id="submit-button" data-testid="submit-button" />;
}
`,
    "src/components/ui/ConditionalPrimaryButton.tsx": `export default function ConditionalPrimaryButton() {
  return <button id="conditional-action" data-testid="conditional-action" />;
}
`,
    "src/components/ui/ConditionalSecondaryButton.tsx": `export default function ConditionalSecondaryButton() {
  return <button id="conditional-action" data-testid="conditional-action" />;
}
`,
  });
}

test("buildPageAnalysis ignores imported but unused components", () => {
  const root = createTraversalProject();
  const page = fixturePath(root, "src/pages/ImportedButUnusedPage.tsx");
  const issues = validate(
    [buildPageAnalysis(page, root, TEST_EXCLUDE)],
    TEST_DUPLICATE_ATTRIBUTES
  );

  assert.deepEqual(issues, []);
});

test("buildPageAnalysis keeps repeated renders in the page scope", () => {
  const root = createTraversalProject();
  const page = fixturePath(root, "src/pages/ComponentReusePage.tsx");
  const issues = validate(
    [buildPageAnalysis(page, root, TEST_EXCLUDE)],
    TEST_DUPLICATE_ATTRIBUTES
  );
  const idIssue = issues.find((issue) => issue.attribute === "id");
  const dataTestIdIssue = issues.find((issue) => issue.attribute === "data-testid");

  assert.deepEqual(summary(issues), [
    "data-testid:submit-button:3",
    "id:submit-button:3",
  ]);

  assert.equal(idIssue?.occurrences.length, 3);
  assert.equal(dataTestIdIssue?.occurrences.length, 3);
  assert.match(
    idIssue?.occurrences[0]?.renderPath
      .map((step) => step.file)
      .join(" -> ") ?? "",
    /ComponentReusePage\.tsx/
  );
});

test("buildPageAnalysis follows conditional JSX branches", () => {
  const root = createTraversalProject();
  const page = fixturePath(root, "src/pages/ConditionalBranchPage.tsx");
  const issues = validate(
    [buildPageAnalysis(page, root, TEST_EXCLUDE)],
    TEST_DUPLICATE_ATTRIBUTES
  );

  assert.deepEqual(summary(issues), [
    "data-testid:conditional-action:2",
    "id:conditional-action:2",
  ]);
});

test("buildPageAnalysis can produce a clean page with no duplicate issues", () => {
  const root = createTraversalProject();
  const page = fixturePath(root, "src/pages/CleanPage.tsx");
  const issues = validate(
    [buildPageAnalysis(page, root, TEST_EXCLUDE)],
    TEST_DUPLICATE_ATTRIBUTES
  );

  assert.deepEqual(issues, []);
});

function summary(issues: ValidationIssue[]): string[] {
  return issues
    .map((issue) => `${issue.attribute}:${issue.value}:${issue.occurrences.length}`)
    .sort();
}
