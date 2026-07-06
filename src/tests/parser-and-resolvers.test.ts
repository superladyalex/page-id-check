import assert from "node:assert/strict";
import test from "node:test";

import { analyzeTsxFile } from "../parser.js";
import { createTempProject, fixturePath } from "./testUtils.js";

test("parser normalizes JSX expressions and preserves repeated component usages", () => {
  const root = createTempProject({
    "src/ParserFixture.tsx": `export default function ParserFixture() {
  return (
    <>
      <button id="plain-id" data-testid={"parser-fixture"} />
      <Button />
      <Button />
    </>
  );
}
`,
  });

  const analysis = analyzeTsxFile(fixturePath(root, "src/ParserFixture.tsx"));

  const dataTestId = analysis.attributes.find(
    (attr) => attr.name === "data-testid"
  );
  assert.equal(dataTestId?.value, "parser-fixture");

  const buttonUsages = analysis.componentUsages.filter(
    (usage) => usage.name === "Button"
  );
  assert.equal(buttonUsages.length, 2);
});

test("parser normalizes string and template literal attribute values", () => {
  const root = createTempProject({
    "src/ParserFixture.tsx": `export default function ParserFixture() {
  return (
    <button id={"string-id"} data-testid={\`template-id\`} aria-label="plain-label" />
  );
}
`,
  });

  const analysis = analyzeTsxFile(fixturePath(root, "src/ParserFixture.tsx"));
  const attributes = new Map(analysis.attributes.map((attr) => [attr.name, attr.value]));

  assert.equal(attributes.get("id"), "string-id");
  assert.equal(attributes.get("data-testid"), "template-id");
  assert.equal(attributes.get("aria-label"), "plain-label");
});
