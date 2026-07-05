# Page ID Check — Full Debug Summary (What was wrong + what was fixed)


# ❌ ROOT PROBLEM (BIG PICTURE)

Your system had **two separate but compounding bugs**:

### 1. Graph traversal was NOT properly deduplicated per page
### 2. Barrel + import resolution caused repeated and inflated traversal
### 3. `inProgress` was not reliably used as a cycle guard
### 4. Import resolution was duplicating the same modules multiple times
### 5. JSX traversal was re-visiting the same dependencies repeatedly

---

# ❌ BUG #1 — Missing proper `inProgress.delete(id)` placement

## Before (BROKEN)

```ts
function walk(filePath: string, requestedExport?: string) {
  const id = normalizePath(filePath);

  if (visited.has(id)) return;
  if (inProgress.has(id)) return;

  inProgress.add(id);
  visited.add(id);

  const analysis = analyzeTsxFile(filePath);

  // traversal logic...

  // ❌ MISSING CLEANUP HERE
}
```
Problem
Nodes stayed "stuck" in inProgress
Graph traversal became inconsistent
Some branches were incorrectly skipped OR re-entered depending on order

AFTER (Fixed)
```typescript
function walk(filePath: string, requestedExport?: string) {
  const id = normalizePath(filePath);

  if (visited.has(id)) return;
  if (inProgress.has(id)) return;

  inProgress.add(id);
  visited.add(id);

  try {
    const analysis = analyzeTsxFile(filePath);

    // traversal logic...

  } finally {
    // ✅ ALWAYS CLEAN UP
    inProgress.delete(id);
  }
}
```
Why this matters
Ensures correct DFS lifecycle
Guarantees no permanent "locked nodes"
Prevents inconsistent traversal state

❌ BUG #2 — Duplicate traversal via imports (NO dedupe across resolve paths)
Before (BROKEN)
```typescript
for (const imp of analysis.imports) {
  const resolvedPath = resolveImport(filePath, imp.module);

  if (!resolvedPath) continue;

  walk(resolvedPath, cleanedUsageName);
}
```
Problem
Same file resolved multiple times via:
default import
named import
namespace import
barrel export

➡️ Result:

Button.tsx visited 3–10 times per page


AFTER (Fixed)
```typescript
const resolvedImports = new Set<string>();

const normalized = normalizePath(resolvedPath);

if (resolvedImports.has(normalized)) continue;

resolvedImports.add(normalized);

walk(normalized, cleanedUsageName);

```
Why this matters
Prevents duplicate traversal of same module
Stabilizes graph structure
Fixes inflated “visiting:” logs





❌ BUG #3 — Barrel traversal was re-scanning ALL imports repeatedly
Before (BROKEN)
```typescript
for (const exported of resolveExports(filePath)) {
  for (const imp of analysis.imports) {
    const resolvedPath = resolveImport(filePath, imp.module);
    walk(resolvedPath);
  }
}

```
Problem

This caused:
FULL import list re-walk for EVERY export
exponential traversal explosion
unrelated components being pulled into pages


After (Fixed Behavior)
```typescript

for (const exported of resolveExports(filePath)) {
  if (requestedExport && exported.exportedName !== requestedExport) {
    continue;
  }

  // ONLY follow relevant export chain
  walk(resolvedPath);
}
```

Why this matters
Barrel files now behave like real module boundaries
Prevents “global import explosion”
Keeps page graph scoped correctly


❌ BUG #4 — Component usage deduplication was weak
before
```typescript
for (const usage of analysis.componentUsages) {
  allComponentUsages.push(usage);
}
```
Problem
Same JSX usage was counted multiple times per file
Inflated graph complexity
Confused traversal logic

after
```typescript
const key = `${filePath}:${usage.name}`;
if (seenUsageKeys.has(key)) continue;

seenUsageKeys.add(key);
allComponentUsages.push(usage);
```
Why this matters
Ensures stable component graph
Prevents repeated JSX expansion


❌ BUG #5 — Import tracking was duplicating entries globally
```typescript
allImports.push(imp);
```

Problem
Same import added repeatedly across traversal paths

``` typescript
const key = `${filePath}:${imp.module}`;
if (seenImportKeys.has(key)) continue;

seenImportKeys.add(key);
allImports.push(imp);
```
Why this matters
Prevents duplicated dependency metadata
Stabilizes final page analysis output




---

6)
The parser should normalize JSX attribute values before validation.

Before:
  ```tsx
  <input data-testid={"search-input"} />
```
  If the analyzer stores the raw initializer text, it may treat the value as
  syntax instead of the actual attribute value. That can make duplicate output
  look like this:

  data-testid: ""search-input""

  which is technically pointing at the right thing, but the output is noisy and
  hard to read.

  After:
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

    return initializer.getText();
  }
```
  Specific example:

  Before normalization:

  data-testid value = "\"search-input\""

  After normalization:

  data-testid value = search-input

  That keeps the duplicate report clean and makes it obvious the analyzer is
  comparing actual attribute values.





7) 
  The duplicate-key logic should be stable and not depend on fragile string
  splitting.

  Before:

  const key = `${attr.name}:${attr.value}`;
  const [attribute, value] = key.split(":");

  That looks simple, but it assumes the separator will never appear in the
  value. If a value contains :, the key becomes ambiguous.

  Specific example:

  const name = "data-testid";
  const value = "user:profile";
  const key = `${name}:${value}`;

  // key is now:
  // "data-testid:user:profile"

  If you later split on :, you get the wrong pieces:

  const [attribute, valuePart] = "data-testid:user:profile".split(":");
  // attribute = "data-testid"
  // valuePart = "user"
  // "profile" is lost

  After:

  const key = `${attr.name}\u0000${attr.value}`;
  const [attribute, value] = key.split("\u0000");

  That gives the validator a separator that is extremely unlikely to collide
  with a real DOM attribute value.

  Specific example:

  const name = "data-testid";
  const value = "user:profile";
  const key = `${name}\u0000${value}`;

  Now the key stays unambiguous, and the validator can recover the exact
  original attribute name and value.

  This same principle applies to traversal too: walk each file once, collect the
  analysis once, and then validate the flattened result. That keeps the behavior
  deterministic and avoids extra passes or debug noise that make the tool harder
  to trust.

8)
The analyzer was following imports and barrels too aggressively instead of
treating the JSX render tree as the source of truth.

Before, the traversal could look more like this:

```ts
for (const imp of analysis.imports) {
  const resolved = resolveImport(filePath, imp.module);
  if (resolved) {
    walk(resolved);
  }
}
```

That is useful for finding related files, but it is not enough to describe what
is actually rendered. A file can be imported and still never appear in the page:

```tsx
import SearchResults from "../components/ui/SearchResults";

export default function Page() {
  return <SearchBox />;
}
```

In that case, a browser-extension style approach would only see the current DOM
and a file-graph-only approach would still drag `SearchResults` into the page
scope. The JSX-tree approach is stricter: it only follows what is actually
rendered from the source tree.

After the fix, traversal starts from the JSX usage and then resolves only the
component that the JSX actually points to.

9)
Repeated JSX renders were being collapsed instead of counted as separate
occurrences.

This matters because a page can render the same component several times and each
render should contribute its DOM attributes to the page scope.

Example:

```tsx
export default function ComponentReusePage() {
  return (
    <>
      <Button />
      <Button />
      <Button />
    </>
  );
}
```

If `Button` renders this:

```tsx
export default function Button() {
  return <button id="submit-button" data-testid="submit-button" />;
}
```

then the page contains three copies of that DOM, not one. Collapsing the JSX
usage down to a single component instance would hide that fact and make the
duplicate report less accurate.

The fixed behavior keeps repeated JSX tags as repeated render instances, so the
validator sees all three occurrences.

10)
Imported-but-unused components could be pulled into analysis incorrectly.

This is the exact false-positive case that browser-level inspection often misses
and that a file-graph-only analyzer can get wrong.

Example:

```tsx
import Layout from "../components/layout/Layout";
import SearchBox from "../components/ui/SearchBox";
import SearchResults from "../components/ui/SearchResults";

export default function ImportedButUnusedPage() {
  return (
    <Layout>
      <SearchBox />
    </Layout>
  );
}
```

`SearchResults` is imported, but it is not rendered. A naive import walk would
still visit it and report a duplicate because `SearchResults` also contains:

```tsx
<div data-testid="search-input" />
```

That is wrong for page-scope analysis. The JSX-tree traversal only includes
components that actually appear in the returned JSX, so `SearchResults` stays
out of the page scope and the duplicate is not reported.

11)
Conditional JSX branches were not covered by the sample app, so the “static
tree vs live DOM” distinction was not demonstrated.

The sample now includes a page like this:

```tsx
export default function ConditionalBranchPage() {
  const usePrimaryAction = Math.random() > 0.5;

  return (
    <>
      {usePrimaryAction ? (
        <ConditionalPrimaryButton />
      ) : (
        <ConditionalSecondaryButton />
      )}
    </>
  );
}
```

At runtime, only one branch is mounted. A browser extension that inspects the
current DOM would only see whichever button happened to render on that run.

Static analysis is doing something different:

```tsx
{usePrimaryAction ? (
  <ConditionalPrimaryButton />
) : (
  <ConditionalSecondaryButton />
)}
```

Both branches are present in source, so both are part of the static page scope.
That is exactly why this tool can show the full JSX shape of the page while a
browser-only approach cannot.

12)
Repeated component renders were being reported as multiple identical source
lines instead of as one source location with a render count.

This happened because the traversal was correctly seeing every render instance,
but the reporting layer was flattening those instances directly into the final
duplicate output.

For example, this page:

```tsx
export default function ComponentReusePage() {
  return (
    <>
      <Button />
      <Button />
      <Button />
    </>
  );
}
```

with this component:

```tsx
export default function Button() {
  return <button id="submit-button" data-testid="submit-button" />;
}
```

really does contain three rendered copies of the same DOM.

But if the validator just stores every occurrence as a raw line item, the output
looks like this:

```txt
1. src/components/ui/Button.tsx:17:7
2. src/components/ui/Button.tsx:17:7
3. src/components/ui/Button.tsx:17:7
```

That is technically accurate, but it is not very useful. It reads like three
different issues when it is really one location rendered three times.

Before:

```ts
for (const [key, occurrences] of seen.entries()) {
  if (occurrences.length <= 1) continue;

  const [attribute, value] = key.split("\u0000");

  issues.push({
    page: page.file,
    attribute,
    value,
    message: `Duplicate ${attribute} "${value}" found in page`,
    occurrences: occurrences.map((o) => ({
      file: o.file,
      line: o.line,
      column: o.column,
    })),
  });
}
```

After:

```ts
for (const [key, occurrences] of seen.entries()) {
  if (occurrences.length <= 1) continue;

  const [attribute, value] = key.split("\u0000");
  const compressedOccurrences = compressOccurrences(occurrences);

  issues.push({
    page: page.file,
    attribute,
    value,
    message: `Duplicate ${attribute} "${value}" found in page`,
    occurrences: compressedOccurrences,
  });
}
```

And the compressed occurrences are counted like this:

```ts
function compressOccurrences(occurrences: DomAttribute[]): ValidationIssue["occurrences"] {
  const grouped = new Map<string, ValidationIssue["occurrences"][number]>();

  for (const occurrence of occurrences) {
    const key = `${occurrence.file}\u0000${occurrence.line}\u0000${occurrence.column}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    grouped.set(key, {
      file: occurrence.file,
      line: occurrence.line,
      column: occurrence.column,
      count: 1,
    });
  }

  return [...grouped.values()];
}
```

So the final report becomes clearer:

```txt
1. src/components/ui/Button.tsx:17:7 (x3)
```

That is the same duplicate, but presented in a way that reflects how many times
the component was actually rendered without pretending there are three separate
source locations.



---

# Regression Example

The sample app now includes a page specifically for the old false-positive case:

[`src/pages/ImportedButUnusedPage.tsx`](/Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ImportedButUnusedPage.tsx)

That page imports `SearchResults`, but does not render it.

```tsx
import Layout from "../components/layout/Layout";
import SearchBox from "../components/ui/SearchBox";
import SearchResults from "../components/ui/SearchResults";

export default function ImportedButUnusedPage() {
  return (
    <Layout>
      <SearchBox />
    </Layout>
  );
}
```

Why this matters:

- `SearchBox` renders `data-testid="search-input"`.
- `SearchResults` also renders `data-testid="search-input"`.
- A static import walk would visit both components and incorrectly report a duplicate.
- A JSX-tree walk should ignore `SearchResults` because it is imported but not rendered.

That page is the concrete regression test for the traversal behavior.

There is also a conditional-branch example:

[`src/pages/ConditionalBranchPage.tsx`](/Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx)

That page picks one branch at runtime, but the source contains both JSX branches:

```tsx
{usePrimaryAction ? (
  <ConditionalPrimaryButton />
) : (
  <ConditionalSecondaryButton />
)}
```

Both branches are included in static analysis, which is exactly what you want when you need to reason about the full JSX tree instead of only the current browser DOM.

---