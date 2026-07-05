A short write-up. A few paragraphs that cover:


# What problem you chose and why it interested you

I come from a heavy testing and statically typed language background. I never understood how, on the for web, you can just freely structure things and end up with duplicates of attributes that are supposed to be unique.

Given how important certain attributes are—and how many systems assume uniqueness—I never understood how you were just “allowed” to have multiple of the same ones.

When you start writing tests or working on accessibility features, you quickly run into the problems this causes. Duplicates break assumptions that other parts of the system rely on.

For example:

Accessibility and screen readers: Assistive technologies rely on IDs to connect labels, inputs, and structure. Duplicate IDs can cause broken or skipped form controls and table relationships.
Anchor navigation: IDs are used as targets for fragment links (e.g. site.com/page#section). If IDs aren’t unique, links can jump to the wrong place or fail entirely.

I've always thought that there should be a simple way to detect duplicate attributes early and surface them before they turn into subtle, hard-to-track bugs.


# How you used AI and what worked or didn’t

I used Codex throughout the development process. Overall, it was helpful in accelerating implementation, but there were several areas where we had misalignment that required iteration and clarification.

## Areas of miscommunication

One key challenge was around **scope and framework coupling**. There was initial ambiguity about how tightly the analyzer 
should be tied to a specific framework versus remaining framework-agnostic. This led to back-and-forth adjustments in design
decisions.


We also had repeated misalignment around **how page traversal should work** and what should be considered part of a “page graph.”
In particular, there was confusion around:

- whether unused imports should be traversed
- how conditional JSX should be interpreted
- whether traversal should follow full import graphs or strictly JSX render trees

These decisions significantly affected the correctness of the analyzer’s output.

Another area of divergence was **barrel file handling**. We iterated between:

- traversing all exported modules from barrel files
- versus only traversing components that are actually reached through JSX usage

This had a major impact on traversal correctness and performance.

## Output format evolution

We also iterated multiple times on **output structure and formatting**. Early versions of the analyzer produced less structured and harder-to-interpret outputs. Over time, we refined the format to include:

- clearer duplicate grouping
- improved traceability through render paths
- more consistent representation of occurrences

## Testing approach

There was also initial misalignment around testing strategy. I intended for:

- unit tests for core logic
- integration-style tests against intentionally designed sample applications

Codex initially leaned toward more implementation-driven testing patterns, so we adjusted the approach to focus on deterministic integration tests using the sample apps as ground truth.

## Outcome

Despite these areas of miscommunication, the collaboration was productive. We were able to:

- converge on a stable and deterministic traversal model
- build representative sample applications covering key edge cases
- refine the analyzer to correctly identify intended duplicate attribute scenarios
- improve clarity and structure of output reporting

Overall, the process helped progressively clarify the design boundaries and led to a more robust and predictable system.


# Where the AI got things wrong and how you dealt with it

## Some bugs it produced were:

### Duplicate traversal via imports
The same module was being traversed multiple times via different import paths:

- default import
- named import
- namespace import
- barrel export

This caused components like Button.tsx to be visited multiple times per page.

Import resolution was correct functionally, but there was no deduplication layer at the traversal level.

So even if two imports resolved to the same file, they were still treated as separate traversal targets.

Before:
```typescript
for (const imp of analysis.imports) {
  const resolvedPath = resolveImport(filePath, imp.module);

  if (!resolvedPath) continue;

  walk(resolvedPath);
}

```


### Barrel exports caused exponentiaal traversal
Barrel files (index.ts) caused repeated re-traversal of the same import graph:
- each export re-triggered full import resolution
- nested barrels amplified traversal exponentially

```typescript
for (const exported of resolveExports(filePath)) {
  for (const imp of analysis.imports) {
    walk(resolveImport(filePath, imp.module));
  }
}

```


### Imported-but-unused components were incorrectly included

```typescript
import SearchResults from "../SearchResults";

export default function Page() {
  return <SearchBox />;
}
```
SearchResults was still included in analysis because traversal was driven by imports instead of JSX usage.

I switched traversal root to JSX render tree only:
- only components referenced in JSX are traversed
- unused imports are ignored

This aligns the analyzer with actual UI behavior, if it is not rendered in JSX, it is not part of the page graph.


### JSX attribute values were not normalized
Attribute values were sometimes stored in their raw AST form instead of normalized string values.
This led to inconsistent duplicate detection outputs such as:
```typescript
data-testid: ""search-input""
data-testid: "\"search-input\""
```
Even though they both represented the same value 

The analyzer was reading AST nodes directly without consistently resolving:
- string literals
- template literals
- JSX expression wrappers

Before: 
```typescript
function getValue(initializer: any) {
  return initializer?.getText();
}
```
The analyzer now compares:

semantic attribute values, not raw syntax

This ensures:
- consistent duplicate detection
- stable output formatting
- correct grouping of logically identical values


### Unsafe string-based duplicate keys

Duplicate detection used string concatenation:

Before
```typescript
const key = `${attr.name}:${attr.value}`;
```
This introduced ambiguity when values contained `:` - something like `data-testid:user:profile` could not be reliably split back into original parts, because a simple delimiter was chosen without considering value collision risk.

After
```typescript
const key = `${attr.name}\u0000${attr.value}`;
```
I chose the null character (\u0000) because:
- extremely unlikely in real DOM values
- safe for deterministic splitting
- reversible without ambiguity

It guarantees stable grouping, and lossless reconstruction of attribute data


### Over-aggressive import graph expansion
The traversal layer treated imports as always relevant to page scope,even when those imports were not used in JSX. This caused unrelated components to leak into page analysis.

```typescript
for (const imp of analysis.imports) {
  const resolved = resolveImport(filePath, imp.module);
  walk(resolved);
}
```

Traversal is now gated by actual JSX usage. Imports are resolved only if they are referenced in the render tree.


### Hardcoding attributes
the attributes we were working with were hardcoded into the codebase rather than coming from a config file. 

Before
```typescript
for (const attr of page.attributes) {
      if (attr.name !== "id" && attr.name !== "data-testid") {
        continue;
      }
```

After
```typescript
for (const attr of page.attributes) {
    if (!config.duplicateAttributes.includes(attr.name)) {
        continue;
    }
```


### Missing render path
Previously, validation output did not include how a component was reached in the render tree.

Before output

```
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx
data-testid: "conditional-action"

1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalPrimaryButton.tsx:8:37
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalSecondaryButton.tsx:8:37
```

Before code
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


issues.push({
        page: page.file,
        attribute,
        value,
        message: `Duplicate ${attribute} "${value}" found in page tree`,
        occurrences: occurrences.map((o) => ({
          file: o.file,
          line: o.line,
          column: o.column,
        })),
      });
```


After output
```
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx
data-testid: "conditional-action"

1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalPrimaryButton.tsx:8:37 via /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx:21:9
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalSecondaryButton.tsx:8:37 via /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx:23:9

```

After Code
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


      issues.push({
    page: page.file,
    attribute,
    value,
    message: `Duplicate ${attribute} "${value}" found in page`,
    occurrences: occurrences.map((o) => ({
        file: o.file,
        line: o.line,
        column: o.column,
        renderPath: o.renderPath,
    })),
});

```

### Occurrences were grouped and compressed:


Before Example 
```
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ComponentReusePage.tsx
id: "submit-button"

1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:17:7 (x3)
```

After
```
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ComponentReusePage.tsx
data-testid: "submit-button"

1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:18:7 via src/pages/ComponentReusePage.tsx:31:9
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:18:7 via src/pages/ComponentReusePage.tsx:33:9
3. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:18:7 via src/pages/ComponentReusePage.tsx:35:9

```

### Removing unnecessary abstractions

```typescript
import path from "path";

/** Normalize a path to an absolute filesystem path. */
export function normalizePath(filePath: string): string {
  return path.resolve(filePath);
}
```

Then in a few places I had `normalizePath(filename)`. 
`normalizePath()` simply wrapped `path.resolve()`, and every call site already provided an absolute path. The abstraction added no behavior,
so it was removed to simplify the codebase.


# What you’d improve with more time
I think there are a lot of things that could use improvement (see the limitations section), but I just picked a few things 
here that I had either tried to get in or really wished I had gotten to.


### Absolute paths 
I tried to trim the paths but loss page data in the process 

I ended up with output that looked like this 
```

Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/SettingsPage.tsx
data-testid: "search-input"

1. SearchBox.tsx:18:7 via sample-app-for-page-id-check:33:9
2. SearchResults.tsx:15:7 via sample-app-for-page-id-check:35:9
```

I tried to change the following and was unsuccessful 
- `${occurrence.file}` to `{path.basenaame(occurence.file)}`
- `path.relative` to `path.basename` 


### Add global caches for file analysis and file resolution

Right now:
* analyzeTsxFile() can rerun for the same file across pages
* `resolveImport()` repeatedly hits `fs.existsSync`
* `resolveExportTargets()` rereads files repeatedly

All that can cause major performane problems when dealing with larger/more realistic code bases. 

I think we could do something like this but am not 100% sure and would want more time
```typescript
const fileAnalysisCache = new Map<string, FileAnalysis>();
const importResolutionCache = new Map<string, string | null>();
```

### 

# Any limitations/rough edges you’re aware of

The analyzer is intentionally deterministic and static. It builds a compile-time component graph from source code only. It never executes application code or simulates a browser environment.
Reporting every possible collision visible in the source graph is generally more useful than attempting to predict which code paths will execute at runtime.
Additionally, there are several deliberate scope boundaries and implementation constraints in place. 
These decisions are made to preserve the deterministic nature of the analyzer and keep the component graph fully static 
and predictable. The tool is designed to operate only on source code structure, without relying on runtime execution or 
framework-specific behavior. As a result, certain advanced or dynamic language features are intentionally out of scope. 
This includes full TypeScript module resolution, bundler-specific aliasing, and complex package-based dependency graphs.
Similarly, export resolution is simplified and does not aim to fully replicate TypeScript or Node module semantics. 
Some patterns, such as advanced barrel export structures or unconventional re-export chains, are only partially supported. 
These trade-offs reduce complexity and improve consistency, but introduce known limitations in edge-case scenarios. 
Other constraints are a result of implementation scope and performance considerations rather than explicit design choices.
A more comprehensive list is listed below. 

## No runtime code execution

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

## No TypeScript path alias resolution

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

## No dynamic imports

```ts
const Button = await import("./Button");
```

Dynamic imports are ignored because they cannot be resolved statically.

---

## No React.lazy resolution

```tsx
const LazyButton = React.lazy(() => import("./Button"));
```

`React.lazy()` boundaries are not currently traversed.

---

## Limited support of React framework semantics

While the analyzer is designed around React-style JSX, it does not fully implement React’s runtime behavior.

Specifically, it does not model:

hooks (useState, useEffect, etc.)
context propagation
memoization (React.memo)
reconciliation behavior
component lifecycle

It only models component composition as expressed in source code.

--- 

## No unified caching layer across pages (FILE/AST LEVEL)
Each page builds its own analysis context independently. While FileAnalysis is cached within a single page traversal, it is not shared across page analyses.
This leads to repeated work when multiple pages import the same components.

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

---

## No deduplication of traversal paths

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
---

## Barrel export resolution is regex-based (fragile)

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

## No support for JSX spread attributtes
```typescript
<div {...props} />
```
Spread attributes are not expanded or resolved.

Any duplicate attribute passed via props spreading is invisible to the analyzer, which may result in under-reporting of duplicates in real-world component patterns.

---

## No styling analysis

The analyzer only inspects JSX structure and configured validation attributes.

It does not analyze:

- `className`
- CSS Modules
- Tailwind
- styled-components
- Emotion
- runtime styling logic


