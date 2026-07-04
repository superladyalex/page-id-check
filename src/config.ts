import path from "path";

export const config: {
  repoRoot: string;
  pages: string[];
  exclude: string[];
  duplicateAttributes: string[];
} = {
  repoRoot: path.resolve("../sample-app-for-page-id-check"),
  pages: ["src/pages/**/*.tsx", "src/screens/**/*.tsx"],
  exclude: ["**/node_modules/**", "**/*.test.tsx", "**/*.spec.tsx", "**/dist/**"],
  duplicateAttributes: ["id", "data-testid"],
};
