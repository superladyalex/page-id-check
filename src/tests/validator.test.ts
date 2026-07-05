import assert from "node:assert/strict";
import test from "node:test";

import { validate } from "../validator.js";
import { TEST_DUPLICATE_ATTRIBUTES } from "./testConfig.js";

test("validator ignores empty values", () => {
  const page = {
    file: "/tmp/fake.tsx",
    attributes: [
      {
        file: "/tmp/fake.tsx",
        name: "id",
        value: "",
        line: 1,
        column: 1,
        renderPath: [],
      },
      {
        file: "/tmp/fake.tsx",
        name: "id",
        value: "",
        line: 2,
        column: 1,
        renderPath: [],
      },
    ],
    imports: [],
    componentUsages: [],
  };

  assert.deepEqual(validate([page], TEST_DUPLICATE_ATTRIBUTES), []);
});
