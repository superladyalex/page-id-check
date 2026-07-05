import {config} from "./config.js";
import {discover} from "./discover.js";
import {buildPageAnalysis} from "./buildPageAnalysis.js";
import {validate, type ValidationIssue} from "./validator.js";
import type {FileAnalysis} from "./types.js";
import path from "path";
import {fileURLToPath} from "node:url";

export async function main(): Promise<void> {
    const root = config.repoRoot;

    console.log("\nPage ID Check\n");
    console.log(`Repository: ${root}`);

    // Step 1 - Discover page entry points
    const pages = await discover(config.pages, root, config.exclude);

    if (pages.length === 0) {
        console.log("\n⚠️  No pages matched your configuration.\n");

        console.log("Searching for:");

        for (const pattern of config.pages) {
            console.log(`  • ${pattern}`);
        }

        console.log(`
Repository root: ${root}

Suggestions:
  • Verify repoRoot is correct.
  • Verify the page glob patterns.
  • Try a broader pattern like 'src/**/*.tsx'.
`);
        
        process.exit(0);
    }

    console.log(`📄 Found ${pages.length} page(s).\n`);

    // Step 2 - Build rendered page analyses
    const pageAnalyses: FileAnalysis[] = [];

    for (const page of pages) {
        console.log(`➡️  ${page}`);

        pageAnalyses.push(
            buildPageAnalysis(page, root, config.exclude)
        );
    }

    const issues = validate(pageAnalyses, config.duplicateAttributes);

    if (issues.length === 0) {
        console.log("\n✅ No duplicate DOM attributes found.\n");
        process.exit(0);
    }

    printIssues(issues);

    process.exit(1);
}

export function printIssues(issues: ValidationIssue[]): void {
    console.log(formatIssueOutput(issues, config.repoRoot));
}

export function formatIssueOutput(
    issues: ValidationIssue[],
    repoRoot: string
): string {
    if (issues.length === 0) {
        return "\n✅ No duplicate DOM attributes found.\n";
    }

    const lines: string[] = ["\n🚨 Duplicate DOM attributes detected\n"];

    for (const issue of issues) {
        lines.push("────────────────────────────────────────");
        lines.push(`Page: ${issue.page}`);
        lines.push(`${issue.attribute}: "${issue.value}"`);
        lines.push("");

        issue.occurrences.forEach((occurrence, index) => {
            const renderPath = formatRenderPath(occurrence.renderPath, repoRoot);
            const suffix = renderPath ? ` via ${renderPath}` : "";
            lines.push(
                `${index + 1}. ${occurrence.file}:${occurrence.line}:${occurrence.column}${suffix}`
            );
        });

        lines.push("");
    }

    lines.push(`Found ${issues.length} duplicate issue(s).\n`);

    return lines.join("\n");
}

export function formatRenderPath(
    renderPath: ValidationIssue["occurrences"][number]["renderPath"],
    repoRoot: string
): string {
    if (renderPath.length === 0) {
        return "";
    }

    return renderPath
        .map(
            (step) =>
                `${path.relative(repoRoot, step.file)}:${step.line}:${step.column}`
        )
        .join(" -> ");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    void main().catch((error) => {
        console.error("\n❌ Unexpected error\n");

        if (error instanceof Error) {
            console.error(error.message);
            console.error(error.stack);
        } else {
            console.error(error);
        }

        process.exit(1);
    });
}
