# What problem you chose and why it interested you

I come from a heavy testing and statically typed language background. I never understood how, on the for web, you can just freely structure things and end up with duplicates of attributes that are supposed to be unique.

Given how important certain attributes are—and how many systems assume uniqueness—I never understood how you were just “allowed” to have multiple of the same ones.

When you start writing tests or working on accessibility features, you quickly run into the problems this causes. Duplicates break assumptions that other parts of the system rely on.

For example:

Accessibility and screen readers: Assistive technologies rely on IDs to connect labels, inputs, and structure. Duplicate IDs can cause broken or skipped form controls and table relationships.
Anchor navigation: IDs are used as targets for fragment links (e.g. site.com/page#section). If IDs aren’t unique, links can jump to the wrong place or fail entirely.

I've always thought that there should be a simple way to detect duplicate attributes early and surface them before they turn into subtle, hard-to-track bugs.

## Why I Chose a Static JSX Analyzer

I wanted a static way to catch duplicate DOM attributes in React-style UI code without executing the app. The analyzer therefore builds a deterministic component graph directly from TSX/JSX source: it parses the page file, finds JSX component usages, resolves the imports behind those usages, and walks the resulting tree. That lets it report potential duplicates from the structure of the code alone.

### Why it is React-specific

- It parses `.tsx` files and JSX nodes.
- It treats PascalCase JSX tags as components.
- It follows component composition through imports and barrels.
- It handles conditional rendering by keeping both branches.
- It records DOM attributes on lowercase HTML elements, but does not traverse into them as components.

### How HTML elements are treated

The parser only treats PascalCase JSX tags as components. Lowercase tags like `div`, `button`, and `input` are terminal DOM nodes: their attributes are recorded, but the traversal does not recurse into them as components.

```ts
function isComponentTag(tag: string): boolean {
  return /^[A-Z]/.test(tag);
}
```

That means the analyzer checks DOM attributes on real rendered elements, but only traverses into custom React components.

### Framework boundaries

This model fits React and other JSX-based frameworks like React. It is not a good fit for template-driven frameworks like Vue, Svelte, or Angular, because their component trees are not expressed through JSX and import relationships in the same way.


# How you used AI and what worked or didn’t

I used Codex throughout the development process. Overall, it was helpful in accelerating implementation, but there were several areas where we had misalignment that required iteration and clarification.
I also used Codex to refine the documentation and to review my work, helping identify assumptions that were worth revisiting.


## Areas of miscommunication

One key challenge was around scope and framework coupling. There was initial ambiguity about how tightly the analyzer 
should be tied to a specific framework versus remaining framework-agnostic. This led to back-and-forth adjustments in design
decisions.


We also had repeated misalignment around *how page traversal should work and what should be considered part of a “page graph.”
In particular, there was confusion around:

- whether unused imports should be traversed
- how conditional JSX should be interpreted
- whether traversal should follow full import graphs or strictly JSX render trees

These decisions significantly affected the correctness of the analyzer’s output.

Another area of divergence was barrel file handling. We iterated between:

- traversing all exported modules from barrel files
- versus only traversing components that are actually reached through JSX usage

This had a major impact on traversal correctness and performance.

## Output format evolution

We also iterated multiple times on output structure and formatting. Early versions of the analyzer produced less structured and harder-to-interpret outputs. Over time, we refined the format to include:

- clearer duplicate grouping
- improved traceability through render paths
- more consistent representation of occurrences

## Testing approach

There was also initial misalignment around testing strategy. I intended for the test suite to be made of
small, deterministic unit tests, but at first we leaned too heavily on the sample application as the source
of truth.

That worked for demonstrating the analyzer end-to-end, but it made the tests more coupled than necessary:

- they depended on a sibling repository being present in a specific path
- they relied on shared repo config instead of explicit test inputs
- they made it harder to reason about whether a failure came from traversal, validation, or fixture setup

We corrected that by moving the tests to temporary, self-contained fixtures.

That split the suite into focused unit-level coverage:

- parser tests for JSX normalization and component usage detection
- resolver tests for relative imports and barrel exports
- traversal tests for nested render paths, aliases, namespace imports, and conditional branches
- validator tests for duplicate grouping and empty-value handling
- formatter tests for report output

The main benefit was that each test now owns its own mini project and its own config inputs. That means a
failure is usually local to one concern, and the suite no longer depends on the sample app for basic
correctness checks.

We also removed hidden config fallback from the helper functions, so the tests pass their own roots,
ignore lists, and duplicate-attribute settings explicitly. That made the suite genuinely self-contained
and kept the test behavior independent from the repo’s live configuration.

The sample apps are still useful as a demonstration of the real analyzer behavior, but the tests themselves
now stay deterministic and isolated.

## Outcome

Despite these areas of miscommunication, the collaboration was productive. We were able to:

- converge on a stable and deterministic traversal model
- build representative sample applications covering key edge cases
- refine the analyzer to correctly identify intended duplicate attribute scenarios
- improve clarity and structure of output reporting

Overall, the process helped progressively clarify the design boundaries and led to a more robust and predictable system.


# Where the AI got things wrong and how you dealt with it

## Summary

The main mistakes fell into three buckets:

- traversal scope was too broad and too dependent on imports
- JSX values were not consistently normalized before validation
- the report format lost useful provenance or compressed repeated occurrences too aggressively

Those issues mattered because they affected both correctness and trust. A tool like this needs to answer two questions clearly:

- what is actually part of the page?
- where did each duplicate come from?

## Traversal scope was too broad

The biggest early mistake was treating imports as if they defined page scope.

That caused two related problems:

- imported-but-unused components were pulled into the analysis
- the same file could be traversed multiple times through different import shapes

Example:

```tsx
import SearchBox from "../components/ui/SearchBox";
import SearchResults from "../components/ui/SearchResults";

export default function ImportedButUnusedPage() {
  return <SearchBox />;
}
```

If traversal is driven by imports alone, both `SearchBox` and `SearchResults` look relevant. In reality, only `SearchBox` is rendered here. `SearchResults` should be ignored because it never appears in the JSX tree.

Before:
```typescript
for (const imp of analysis.imports) {
  const resolvedPath = resolveImport(filePath, imp.module);

  if (!resolvedPath) continue;

  walk(resolvedPath);
}
```

That approach walked the file graph, not the render tree. It also made barrel files and re-export chains more fragile than they needed to be.

After ([src/buildPageAnalysis.ts]):
```typescript
export function buildPageAnalysis(
  entryFile: string,
  repoRoot: string,
  exclude: string[]
): FileAnalysis {
  // Excerpt: the inner walk loop uses JSX usage to decide which imports to follow.
  for (const usage of analysis.componentUsages) {
    for (const imp of analysis.imports) {
      const exportName = getExportNameForUsage(imp, usage);
      if (!exportName) continue;

      const resolved = resolveImport(id, imp.module);
      if (!resolved) continue;

      const nextRenderPath = [
        ...renderPath,
        {
          file: id,
          line: usage.line,
          column: usage.column,
          name: usage.name,
        },
      ];

      const exportTargets = resolveExportTargets(resolved, exportName);
      if (exportTargets.length === 0) {
        walk(resolved, nextPathStack, nextRenderPath);
        continue;
      }

      for (const exportTarget of exportTargets) {
        walk(exportTarget, nextPathStack, nextRenderPath);
      }
    }
  }

}
```

That change tied traversal to JSX usage instead of “anything imported,” which made the page scope much closer to the actual render tree.
In the current code, tests pass their own `repoRoot` and `exclude` values directly, so the helper no longer reads repo config internally. In other words, this is not the full function body; it is the part that changed the traversal rule from import-driven to JSX-driven.

## JSX values needed normalization

The next problem was that attribute values were being compared in their raw AST form instead of as normalized semantic values.

Before:
```typescript
function getValue(initializer: any) {
  return initializer?.getText();
}
```

That led to duplicate reports that looked different even when they represented the same value.

Example:

```tsx
<input data-testid={"search-input"} />
<input data-testid="search-input" />
```

Without normalization, those can be treated as different syntax shapes even though the underlying attribute value is the same.

After ([src/parser.ts]):
```typescript
function normalizeAttributeValue(initializer: any): string | null {
  if (!initializer) return null;

  if (
    Node.isStringLiteral(initializer) ||
    Node.isNoSubstitutionTemplateLiteral(initializer)
  ) {
    return initializer.getLiteralText();
  }

  if (Node.isJsxExpression(initializer)) {
    const expression = initializer.getExpression();

    if (
      expression &&
      (Node.isStringLiteral(expression) ||
        Node.isNoSubstitutionTemplateLiteral(expression))
    ) {
      return expression.getLiteralText();
    }

    return expression?.getText() ?? null;
  }

  const text = initializer.getText();
  const singleQuoted = text.match(/^'(.*)'$/s);
  if (singleQuoted) return singleQuoted[1];

  const doubleQuoted = text.match(/^"(.*)"$/s);
  if (doubleQuoted) return doubleQuoted[1];

  return text;
}
```

That normalization made duplicate detection and output much more stable.
It ensures that string literals, template literals, and JSX expression wrappers all collapse to the same comparison value when they represent the same DOM attribute.

## The report needed more provenance

The report initially showed where the duplicate existed, but not how the component was reached.

Before:
```typescript
export interface ValidationIssue {
  page: string;
  attribute: string;
  value: string;
  message: string;
  occurrences: {
    file: string;
    line: number;
    column: number;
  }[];
}
```

That made it harder to understand repeated renders or nested component paths.

Before output:

```text
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx
data-testid: "conditional-action"

1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalPrimaryButton.tsx:8:37
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalSecondaryButton.tsx:8:37
```

This told you which files had the duplicate, but not which branch or render site pulled them in.

After ([src/validator.ts]):
```typescript
export interface ValidationIssue {
  page: string;
  attribute: string;
  value: string;
  message: string;
  occurrences: {
    file: string;
    line: number;
    column: number;
    renderPath: {
      file: string;
      line: number;
      column: number;
      name: string;
    }[];
  }[];
}
```

And the output became ([src/index.ts]):

```text
1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalPrimaryButton.tsx:8:37 via /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx:21:9
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalSecondaryButton.tsx:8:37 via /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx:23:9
```

That extra path context shows which render site led to each duplicate, which is the piece that was missing before.

## Repeated occurrences were compressed too aggressively

At one point, repeated renders were collapsed into a single `(x3)` entry.

That was concise, but it hid where the repeated renders came from.

Before:
```text
1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:17:7 (x3)
```

After ([src/index.ts]):
```text
1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:18:7 via /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ComponentReusePage.tsx:31:9
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:18:7 via /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ComponentReusePage.tsx:33:9
3. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:18:7 via /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ComponentReusePage.tsx:35:9
```

The improved version is longer, but it is far more useful when you need to trace the source of duplicates.

## Smaller cleanup passes

There were also a few smaller cleanups that reduced noise:

- duplicate attribute names were made injectable instead of being hardcoded into validation
- discovery and exclusion logic were parameterized so tests could supply their own roots and ignore lists
- unnecessary wrapper abstractions were removed when they added no behavior
- some traversal and output helpers were simplified once the new structure was stable

Those changes were less dramatic than the traversal and reporting fixes, but they helped keep the codebase easier to reason about.


# What I'd Improve with More Time

I'm intentionally keeping this section short as there are a number of potential improvements that could be made to the analyzer (many of which are discussed in the limitations section). These are a few that I either started exploring or would prioritize next.

## Cleaner output paths

I wanted the report to display shorter, repository-relative paths instead of absolute filesystem paths.

My first attempt trimmed too much information, producing output like:

```text
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/SettingsPage.tsx
data-testid: "search-input"

1. SearchBox.tsx:18:7 via sample-app-for-page-id-check:33:9
2. SearchResults.tsx:15:7 via sample-app-for-page-id-check:35:9
```

While this shortened the component file paths, it also removed useful context from the render path, making it difficult to determine where a component was rendered.

I experimented with changes:

- replacing `${occurrence.file}` with `path.basename(occurrence.file)`
- replacing `path.relative(...)` with `path.basename(...)`

Neither produced an output format that I was happy with. Given more time, I'd revisit the formatting so the report is concise while still preserving enough context to be useful.

---

## Turn it into a GitHub Action

I would also consider packaging the analyzer as a GitHub Action so it can run automatically in CI.

That would make the tool easier to adopt because teams could:

- run it on pull requests
- fail the check when duplicates are introduced
- annotate the changed files directly in the review

The implementation would likely be straightforward because the CLI already exits with a success/failure code. The main work would be:

- accepting repository configuration through inputs or env vars
- documenting a simple workflow file
- making the output concise enough for CI logs

## Add a cleaner test seam for the CLI

I would also separate the CLI orchestration from the file analysis logic a bit more.

Right now, the core analyzer pieces are easy to unit test because they take explicit inputs and return values. The CLI entrypoint is less clean because it:

- reads shared config directly
- prints to stdout
- exits the process

That makes `main()` harder to test unit test style because a test would need to intercept console output and stop the process from exiting. If I were extending this further, I would split the code into two layers:

- a small CLI wrapper that reads `config` and calls `process.exit()`
- a pure `runAnalyzer(config, writeOutput)` style function that returns a result object instead of exiting

Something like this 

```typescript
async function main() {
  const result = await runAnalyzer(config, console.log);
  process.exit(result.exitCode);
}
```

In that setup, I would not focus unit tests on `main()` minus a small wiring check. The main tests would target `runAnalyzer(...)` directly, because that is where the real behavior lives. Those tests could assert on the returned status, captured output, and any reported issues without needing to stub global process behavior. The wrapper would stay tiny, and the rest of the CLI logic would become testable with the same self-contained unit-test style used elsewhere in the repo.

---

## Run tests and publish artifacts in CI

I would also set up CI to build, test, and publish artifacts from the analyzer.

The basic flow would be:

- run the unit test suite on every pull request
- build the CLI on merge to main or on release tags
- upload the built output as a CI artifact or publish it to an artifact repository

That would make it easier to:

- verify the analyzer stays healthy over time
- keep a reproducible build artifact around for release or debugging
- avoid relying on a local checkout when someone wants to inspect a specific build

If I had more time, I would probably pair this with a small release workflow so tagged versions of the CLI could be distributed in a predictable way.

---


# Any limitations/rough edges you’re aware of

The analyzer is intentionally deterministic and static. It builds a compile-time component graph directly from source code and never executes application code or simulates a runtime environment.

This approach favors predictability and repeatability over runtime accuracy. Rather than attempting to determine which code paths will execute, the analyzer reports every potential duplicate visible in the static component graph.

To keep the implementation focused and deterministic, several features are intentionally out of scope. Others reflect implementation trade-offs made to balance complexity, correctness, and development time. The known limitations are outlined below.

### Framework boundaries

The analyzer fits React and other JSX-based frameworks best. It is not a good fit for template-driven frameworks like Vue, Svelte, or Angular without a different parser and traversal model.


## Runtime Semantics

### No runtime code execution

Application code is never executed.

```tsx
const value = Math.random() > 0.5;

return value ? <PrimaryButton /> : <SecondaryButton />;
```

Both `PrimaryButton` and `SecondaryButton` are included in the graph.

Runtime values such as:

- state
- props
- `Math.random()`
- API responses

are ignored.

---

### Limited support of React framework semantics

While the analyzer is designed around React-style JSX, it does not fully implement React’s runtime behavior.

Specifically, it does not model:

hooks (useState, useEffect, etc.)
context propagation
memoization (React.memo)
reconciliation behavior
component lifecycle

It only models component composition as expressed in source code.

---

### No dynamic imports

```ts
const Button = await import("./Button");
```

Dynamic imports are ignored because they cannot be resolved statically.

---

### No React.lazy resolution

```tsx
const LazyButton = React.lazy(() => import("./Button"));
```

`React.lazy()` boundaries are not currently traversed.

---

## Module Resolution


### No TypeScript path alias resolution

```ts
import Button from "@/components/Button";
```

Only relative imports are currently resolved. The resolver (`resolveImport.ts`) performs manual filesystem-based resolution and does not use TypeScript’s module resolution pipeline (tsconfig paths, baseUrl, etc.).

---

## No package resolution

```ts
import React from "react";
import { Button } from "@company/ui";
```

Only files within the analyzed repository are included in the component graph.
`resolveImport.ts` performs manual filesystem probing instead of using TypeScript’s module resolver.

---

### Barrel export resolution is regex-based

Barrel resolution (`resolveExport.ts`) uses regex parsing instead of AST analysis:

```typescript
export { Button } from "./Button";
export * from "./ui";
```

This works for simple cases, but breaks with:
* multiline exports
* aliased exports (as)
* formatted exports across lines
* commented or generated exports

Export resolution is not structurally aware, meaning correctness depends on formatting rather than syntax validity.

---

## JSX Analysis

### Limited evaluation of JSX expressions

Only string-like JSX attribute values are normalized.

For example:

```tsx
id="button"
id={"button"}
```
are treated identically.

More complex expressions such as
```typescript
id={buttonId}
id={getButtonId()}
```
are recorded as their source expressions rather than evaluated.

This preserves deterministic static analysis but means runtime-computed values cannot be compared accurately.

---

### No support for JSX spread attributes
```typescript
<div {...props} />
```
Spread attributes are not expanded or resolved.

Any duplicate attribute passed via props spreading is invisible to the analyzer, which may result in under-reporting of duplicates in real-world component patterns.

---

## Performance

### No shared analysis cache across pages

Each page builds its analysis independently. If multiple pages render the same component, that component is parsed and resolved repeatedly.

For example:
```
LoginPage    → Button.tsx parsed and resolved
SettingsPage → Button.tsx parsed and resolved again
ProfilePage  → Button.tsx parsed and resolved again
```

This results in repeated:
* ts-morph AST parsing
* import resolution (`resolveImport.ts`)
* export resolution (`resolveExport.ts`)

even when the underlying file has not changed.

This affects:
* performance (duplicate parsing and resolution work)
* scalability across large multi-page repositories
* consistency of analysis cost across runs

If I were extending this, I would likely introduce three cache layers:

* parsed file analysis cache keyed by absolute file path
* import resolution cache keyed by `(fromFile, moduleSpecifier)`
* barrel export resolution cache keyed by `(filePath, exportedName)`

That would let repeated references reuse the same results instead of re-reading and re-parsing the same files over and over.

The one thing I would watch carefully is invalidation. If the analyzer ever became a watch mode or a long-lived service, the caches would need to be aware of file changes so stale results do not leak into later runs.

---

### No deduplication of traversal paths

Within a single page traversal, identical component subtrees can be visited multiple times when reached through different JSX usage points.
Because traversal is recursive and path-driven (`buildPageAnalysis.ts`), the same component graph can be expanded repeatedly.

```
Page
 ├── Button → Icon
 ├── Button → Icon
 ├── Button → Icon
```
Even if file-level analysis is cached, the traversal still re-enters the same component subtree for each JSX usage.

This affects:
* performance (repeated AST + import work)
* determinism of traversal cost (not result correctness)

This is intentional for correctness—the analyzer needs to count multiple rendered instances—but portions of the traversal work could potentially be memoized to improve performance.

---

## Styling

### No Style Analysis

The analyzer only inspects JSX structure and configured validation attributes.

It does not analyze:

- `className`
- CSS Modules
- Tailwind
- styled-components
- Emotion
- runtime styling logic

--- 

## Design Decisions

### Component detection follows JSX naming conventions

Traversal follows React's standard PascalCase convention.
```tsx
<Button />
<Modal.Header />
```
are treated as traversable components, while lowercase elements such as:
```typescript
<div />
<input />
<button />
```
are treated as terminal DOM nodes.

This matches common React conventions but assumes component naming follows standard JSX practices.

---
