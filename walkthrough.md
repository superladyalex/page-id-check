# Page ID Check Walkthrough

This is the current end-to-end behavior of the tool.

## 1. Start in `src/index.ts`

The CLI starts in [`src/index.ts`](src/index.ts).

It:

1. reads `config.repoRoot`
2. prints the repository path
3. discovers page entry files
4. builds a page analysis for each page
5. validates duplicate attributes
6. prints a report
7. exits with `0` or `1`

## 2. Discover pages

[`src/discover.ts`](src/discover.ts) uses `fast-glob` to find files matching the config `pages` section

The search is rooted at `repoRoot`, and the global exclude patterns are applied during discovery.

If nothing matches, the CLI prints a warning and exits successfully with code `0`.

## 3. Build the page scope

[`src/buildPageAnalysis.ts`](src/buildPageAnalysis.ts) is the important part.

The analyzer does not just inspect a file in isolation. It tries to reconstruct the JSX render tree for that page.

For each file it visits:

1. Parse the file.
2. Look at the JSX component tags it contains.
3. Match those tags to imports in the same file.
4. Resolve the imported component file.
5. If that component file re-exports through a barrel, follow the specific export that was actually used.
6. Repeat the process for child components.

This means the traversal is driven by rendered JSX, not by every import in the file.

That distinction matters.

Example:

```tsx
import SearchBox from "../components/ui/SearchBox";
import SearchResults from "../components/ui/SearchResults";

export default function Page() {
  return <SearchBox />;
}
```

If `SearchResults` is imported but not rendered, it should NOT be part of the page scope.

## 4. Parse a single file

[`src/parser.ts`](src/parser.ts) reads one TSX file and extracts:

- JSX attributes
- import declarations
- JSX component usages

### JSX attributes

It records attributes defined in `duplicateAttributes` from every JSX element.

Example:

```tsx
<input data-testid={"search-input"} />
```

is normalized to the actual value:

```ts
search-input
```

That keeps the duplicate report readable.

### JSX component usages

The parser keeps JSX component tags such as:

```tsx
<Button />
<Forms.ProfileForm />
<Modal.Header />
```

Those usages are what drive recursive traversal.

### Imports

The parser also records imports so the traversal can map JSX usage back to source files.

## 5. Resolve imports

[`src/resolveImport.ts`](src/resolveImport.ts) handles relative imports like:

```tsx
import Button from "./Button";
import { SearchBox } from "../ui";
```

It tries common React file layouts:

- direct `.ts` / `.tsx` / `.js` / `.jsx` files
- `index.ts` / `index.tsx` barrel files

It does NOT resolve package imports or TypeScript path aliases.

## 6. Resolve barrels

[`src/resolveExport.ts`](src/resolveExport.ts) follows re-exports like:

```ts
export { Button } from "./Button";
export { Button, Card } from "./ui";
export * from "./ui";
```

This is how the JSX tree traversal can pass through a barrel file and still land on the real component file.

## 7. Repeat rendering matters

The analyzer counts repeated JSX tags as repeated component instances.

Example:

```tsx
<>
  <Button />
  <Button />
  <Button />
</>
```

That means Button is part of the page three times, so its DOM attributes should be counted three times in the flattened page scope.

## 8. Validate duplicates

[`src/validator.ts`](src/validator.ts) only checks configured attributes:

- `id`
- `data-testid`

It:

1. ignores empty values
2. groups attributes by `name + value`
3. reports a duplicate when the same pair appears more than once in the same page scope

## 9. Print the report

[`src/index.ts`](src/index.ts) prints:

- the page
- the attribute name
- the attribute value
- each occurrence with file, line, and column
- the render path that led to the component, if available

If there are no issues, it prints a success message and exits `0`.
If there are issues, it prints the duplicate report and exits `1`.

Example:

```txt
1. components/ui/Button.tsx:18:7 via pages/ComponentReusePage.tsx:12:9
2. components/ui/Button.tsx:18:7 via pages/ComponentReusePage.tsx:14:9
3. components/ui/Button.tsx:18:7 via pages/ComponentReusePage.tsx:16:9
```




## Regression page

The sample app includes a page that proves the difference between JSX traversal and static import traversal:

[`src/pages/ImportedButUnusedPage.tsx`](/Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ImportedButUnusedPage.tsx)

That page imports `SearchResults`, but never renders it.

`SearchBox` and `SearchResults` both contain `data-testid="search-input"`.

With a static import walk, the analyzer would incorrectly include `SearchResults` and report a duplicate.

With JSX-tree traversal, `SearchResults` is ignored because it is imported but not rendered.

## Conditional rendering example

The sample app also includes a page that uses a conditional JSX branch:

[`src/pages/ConditionalBranchPage.tsx`](/Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx)

That page picks one branch at runtime, but static analysis still sees both JSX branches in the source:

```tsx
{usePrimaryAction ? (
  <ConditionalPrimaryButton />
) : (
  <ConditionalSecondaryButton />
)}
```

This is the case that a browser extension would miss if it only inspects the current DOM.

## What the tool does not do

The tool is intentionally narrow. It does not:

- execute application code
- simulate runtime rendering
- evaluate conditional branches
- resolve TypeScript path aliases
- resolve non-relative package imports
- perform bundler-level module resolution
