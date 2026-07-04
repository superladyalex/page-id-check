import path from "path";

export const config: {
  repoRoot: string;
  pages: string[];
  exclude: string[];
  duplicateAttributes: string[];
} = {
  repoRoot: path.resolve("../sample-app-for-page-id-check"),
  // repoRoot: path.resolve("."),
  pages: ["src/pages/**/*.tsx", "src/screens/**/*.tsx"],
  exclude: ["**/node_modules/**", "**/*.test.tsx", "**/*.spec.tsx"],
  duplicateAttributes: ["id", "data-testid"],
};
