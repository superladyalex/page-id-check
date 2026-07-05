import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { discover } from "../discover.js";
import { createTempProject } from "./testUtils.js";
import { TEST_EXCLUDE } from "./testConfig.js";

test("discover finds page and screen entries in a temp project", async () => {
  const root = createTempProject({
    "src/pages/DashboardPage.tsx": "export default function DashboardPage() { return null; }\n",
    "src/screens/LoginScreen.tsx": "export default function LoginScreen() { return null; }\n",
    "src/pages/DashboardPage.test.tsx": "export default function DashboardPageTest() { return null; }\n",
    "src/components/Button.tsx": "export default function Button() { return null; }\n",
    "dist/GeneratedPage.tsx": "export default function GeneratedPage() { return null; }\n",
    "node_modules/pkg/HiddenPage.tsx": "export default function HiddenPage() { return null; }\n",
  });

  const pages = await discover(
    ["src/pages/**/*.tsx", "src/screens/**/*.tsx"],
    root,
    TEST_EXCLUDE
  );
  const names = pages.map((file) => path.basename(file)).sort();

  assert.deepEqual(names, ["DashboardPage.tsx", "LoginScreen.tsx"]);
});
