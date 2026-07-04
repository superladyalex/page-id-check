import { config } from "./config.js";
import { discover } from "./discover.js";
import { buildPageAnalysis } from "./buildPageAnalysis.js";
import { validate, type ValidationIssue } from "./validator.js";
import type { FileAnalysis } from "./types.js";

async function main(): Promise<void> {
  const root = config.repoRoot;

  console.log("\nPage ID Check\n");
  console.log(`Repository: ${root}`);

  //
  // Step 1
  // Discover page entry points
  //
  const pages = await discover(config.pages, root);

  if (pages.length === 0) {
    console.log("\n⚠️  No pages matched your configuration.\n");

    console.log("Searching for:");

    for (const pattern of config.pages) {
      console.log(`  • ${pattern}`);
    }

    console.log(`\nRepository root: ${root}`);

    console.log("\nSuggestions:");
    console.log("  • Verify repoRoot is correct.");
    console.log("  • Verify the page glob patterns.");
    console.log("  • Try a broader pattern like 'src/**/*.tsx'.");

    process.exit(0);
  }

  console.log(`📄 Found ${pages.length} page(s).\n`);

  //
  // Step 2
  // Build rendered page analyses
  //
  const pageAnalyses: FileAnalysis[] = [];

  for (const page of pages) {
    console.log(`➡️  ${page}`);

    pageAnalyses.push(buildPageAnalysis(page));
  }

  const issues = validate(pageAnalyses);

  if (issues.length === 0) {
    console.log("\n✅ No duplicate DOM attributes found.\n");
    process.exit(0);
  }

  printIssues(issues);

  process.exit(1);
}

function printIssues(issues: ValidationIssue[]): void {
  console.log("\n🚨 Duplicate DOM attributes detected\n");

  for (const issue of issues) {
    console.log("────────────────────────────────────────");
    console.log(`Page: ${issue.page}`);
    console.log(`${issue.attribute}: "${issue.value}"`);
    console.log("");

    issue.occurrences.forEach((occurrence, index) => {
      console.log(
        `${index + 1}. ${occurrence.file}:${occurrence.line}:${occurrence.column}`
      );
    });

    console.log("");
  }

  console.log(`Found ${issues.length} duplicate issue(s).\n`);
}

main().catch((error) => {
  console.error("\n❌ Unexpected error\n");

  if (error instanceof Error) {
    console.error(error.message);
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exit(1);
});
