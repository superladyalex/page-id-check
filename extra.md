# Page ID Check

Page ID Check is a static analysis tool for React/TSX codebases. It starts from configured page entry files, follows the JSX render tree, resolves the imported components that appear in that tree, and reports duplicate configured DOM attributes such as `id` and `data-testid`.

The analyzer is static only. It does not run the app or simulate runtime rendering.

---

# End-to-End Flow

## 1. Configuration

The CLI reads [`src/config.ts`](/Users/alexandra/repos/page-id-check/src/config.ts).

Current configuration:

```ts
export const config = {
  repoRoot: path.resolve("../sample-app-for-page-id-check"),
  pages: ["src/pages/**/*.tsx", "src/screens/**/*.tsx"],
  exclude: ["**/node_modules/**", "**/*.test.tsx", "**/*.spec.tsx", "**/dist/**"],
  duplicateAttributes: ["id", "data-testid"],
};
```

Meaning:

- `repoRoot` points at the sample app repository.
- `pages` defines the page entry-point globs.
- `exclude` is applied throughout discovery and traversal.
- `duplicateAttributes` defines which DOM attributes are checked.

## 2. Page discovery

[`src/discover.ts`](/Users/alexandra/repos/page-id-check/src/discover.ts) uses `fast-glob` to find page files under `repoRoot`.

The result is a list of absolute file paths. If nothing matches, the CLI prints a warning and exits with code `0`.

## 3. Render-tree traversal

[`src/buildPageAnalysis.ts`](/Users/alexandra/repos/page-id-check/src/buildPageAnalysis.ts) builds the page scope.

The current traversal is JSX-driven:

1. Parse the page file.
2. Collect the JSX component usages in that file.
3. Match those usages to local imports.
4. Resolve the matching component files.
5. Follow the component tree recursively.
6. Repeat the same process for every rendered child component.

Important:

- Only JSX usages that are actually rendered drive traversal.
- Imported components that are not rendered are ignored.
- Repeated JSX tags are counted as repeated instances, not collapsed into one.

## 4. Parsing

[`src/parser.ts`](/Users/alexandra/repos/page-id-check/src/parser.ts) reads a single TSX file and extracts:

- JSX attributes
- import declarations
- JSX component usages

### Attribute extraction

The parser records:

- file path
- attribute name
- attribute value
- line number
- column number

It normalizes string-like JSX initializers so duplicate comparison uses the actual value rather than JSX syntax noise.

Example:

```tsx
<input data-testid={"search-input"} />
```

is normalized to:

```ts
search-input
```

### Component usage extraction

The parser records JSX component tags such as:

```tsx
<Button />
<Forms.ProfileForm />
<Modal.Header />
```

Those usages are what drive traversal.

### Import extraction

The parser also records import declarations so the traversal can connect component usage back to the actual source file.

## 5. Import resolution

[`src/resolveImport.ts`](/Users/alexandra/repos/page-id-check/src/resolveImport.ts) resolves relative imports only.

It tries common file layouts in this order:

- `./Button.tsx`
- `./Button.ts`
- `./Button.jsx`
- `./Button.js`
- `./Button/index.tsx`
- `./Button/index.ts`
- `./Button/index.jsx`
- `./Button/index.js`

Examples:

```tsx
import Button from "./Button";
```

may resolve to:

```tsx
Button.tsx
```

or:

```tsx
Button/index.tsx
```

Package imports and TypeScript path aliases are not resolved.

## 6. Barrel resolution

[`src/resolveExport.ts`](/Users/alexandra/repos/page-id-check/src/resolveExport.ts) follows barrel files like:

```ts
export { Button } from "./Button";
export { Button, Card } from "./ui";
export * from "./ui";
```

This lets the JSX tree traversal move through `index.ts` files and still reach the real component implementation files.

## 7. Validation

[`src/validator.ts`](/Users/alexandra/repos/page-id-check/src/validator.ts) receives the flattened page scope and checks only the configured duplicate attributes.

It:

1. Ignores empty values.
2. Groups attributes by `name + value`.
3. Reports a duplicate when the same attribute/value pair appears more than once in the same page scope.

## 8. Output

[`src/index.ts`](/Users/alexandra/repos/page-id-check/src/index.ts) prints the result.

If duplicates are found, it prints:

- page path
- duplicate attribute name
- duplicate value
- every occurrence
- file path
- line
- column
- render path back to the JSX call site

If nothing is duplicated, the CLI exits with code `0`.
If duplicates are found, the CLI exits with code `1`.

Repeated renders of the same component now show up as separate entries with a
different render path instead of three identical source lines.

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

# Current Limitations

The analyzer is deterministic and intentionally narrow.

It does not:

- execute application code
- simulate runtime rendering
- evaluate conditional branches
- resolve TypeScript path aliases
- resolve non-relative package imports
- perform bundler-level module resolution
- analyze styling or CSS systems
