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
