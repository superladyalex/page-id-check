import assert from "node:assert/strict";
import test from "node:test";

import { formatIssueOutput } from "../index.js";

test("formatIssueOutput renders the no-issues message", () => {
  const output = formatIssueOutput([], "/tmp/project");

  assert.match(output, /No duplicate DOM attributes found/);
});

test("formatIssueOutput includes render-path provenance", () => {
  const output = formatIssueOutput(
    [
      {
        page: "/tmp/project/src/pages/ComponentReusePage.tsx",
        attribute: "id",
        value: "submit-button",
        message: 'Duplicate id "submit-button" found in page',
        occurrences: [
          {
            file: "/tmp/project/src/components/ui/Button.tsx",
            line: 18,
            column: 7,
            renderPath: [
              {
                file: "/tmp/project/src/pages/ComponentReusePage.tsx",
                line: 12,
                column: 9,
                name: "Button",
              },
            ],
          },
        ],
      },
    ],
    "/tmp/project"
  );

  assert.match(
    output,
    /components\/ui\/Button\.tsx:18:7 via src\/pages\/ComponentReusePage\.tsx:12:9/
  );
  assert.match(output, /Found 1 duplicate issue\(s\)\./);
});
