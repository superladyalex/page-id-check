# Page ID Check

Page ID Check is a static analysis tool for React/TSX codebases. It starts from configured page entry files, walks the file graph through static imports and barrel re-exports, collects DOM attributes from every reachable file, and reports duplicate configured attributes such as `id` and `data-testid`.

The analyzer is static only. It does not run the app, render components, or evaluate runtime conditions.

---

# End-to-End Flow

## 1. Configuration

The CLI reads the configuration from [`src/config.ts`](/Users/alexandra/repos/page-id-check/src/config.ts).

Current configuration:

```ts
export const config = {
  repoRoot: path.resolve("../sample-app-for-page-id-check"),
  pages: ["src/pages/**/*.tsx", "src/screens/**/*.tsx"],
  exclude: ["**/node_modules/**", "**/*.test.tsx", "**/*.spec.tsx", "**/dist/**"],
  duplicateAttributes: ["id", "data-testid"],
};
```

What that means:

- `repoRoot` points at the sample app repository.
- `pages` defines the page entry-point globs.
- `exclude` defines files that should be ignored everywhere in the analysis pipeline.
- `duplicateAttributes` defines which DOM attributes are checked for duplicates.

## 2. Page discovery

[`src/discover.ts`](/Users/alexandra/repos/page-id-check/src/discover.ts) uses `fast-glob` to find matching page files under `repoRoot`.

It returns absolute file paths, so later steps do not need to guess at relative path handling.

If no pages match, the CLI prints a warning and exits successfully with code `0`.

## 3. Page analysis

For each discovered page, [`src/buildPageAnalysis.ts`](/Users/alexandra/repos/page-id-check/src/buildPageAnalysis.ts) builds a flattened page analysis.

The process is:

1. Normalize the page path.
2. Skip the file if it matches the exclusion rules.
3. Parse the file with [`src/parser.ts`](/Users/alexandra/repos/page-id-check/src/parser.ts).
4. Follow each static import with [`src/resolveImport.ts`](/Users/alexandra/repos/page-id-check/src/resolveImport.ts).
5. Follow each barrel re-export with [`src/resolveExport.ts`](/Users/alexandra/repos/page-id-check/src/resolveExport.ts).
6. Repeat recursively until the reachable file set is exhausted.
7. Collect attributes, imports, and component usages from every visited file.

Important detail:

- The traversal currently follows imports and re-exports.
- JSX component usage is extracted by the parser, but it is not currently used as a traversal signal.

## 4. Parsing

`parser.ts` reads a single TSX file and extracts three things:

- JSX attributes
- import declarations
- JSX component usages

### Attribute extraction

The parser walks all `JsxAttribute` nodes and records:

- file path
- attribute name
- attribute value
- line number
- column number

It normalizes string-like JSX initializers so duplicate comparison uses the actual attribute value rather than JSX syntax noise.

Example:

```tsx
<input data-testid={"search-input"} />
```

becomes the stored value:

```ts
search-input
```

### Import extraction

The parser records each import declaration, including:

- default imports
- named imports
- aliased named imports
- namespace imports

This data is used by the traversal step to find related files.

### Component usage extraction

The parser also detects PascalCase JSX tags such as:

```tsx
<Button />
<Modal.Header />
```

These are collected as component usages, but the current traversal does not act on them directly.

## 5. Import resolution

[`src/resolveImport.ts`](/Users/alexandra/repos/page-id-check/src/resolveImport.ts) resolves relative imports only.

It tries common React/TypeScript file shapes in this order:

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

Absolute imports and package imports are not resolved by this logic.

## 6. Barrel resolution

[`src/resolveExport.ts`](/Users/alexandra/repos/page-id-check/src/resolveExport.ts) looks for barrel-style re-exports in source files.

Supported patterns include:

```ts
export { Button } from "./Button";
export { Button, Card } from "./ui";
export * from "./ui";
```

This lets the traversal follow shared index files into their underlying implementation files.

## 7. Validation

[`src/validator.ts`](/Users/alexandra/repos/page-id-check/src/validator.ts) receives the flattened analyses and checks only the configured duplicate attributes.

Current validation targets:

- `id`
- `data-testid`

The validator:

1. Ignores attributes with empty values.
2. Groups attributes by `name + value`.
3. Reports an issue when the same attribute/value pair appears more than once in a single page.

The current keying strategy uses a delimiter that should not collide with normal attribute values.

## 8. Output

[`src/index.ts`](/Users/alexandra/repos/page-id-check/src/index.ts) prints the results.

If duplicates are found, it reports:

- page path
- duplicate attribute name
- duplicate value
- every occurrence
- file path
- line
- column

If no duplicates are found, the CLI exits with code `0`.

If duplicates are found, the CLI exits with code `1`.

---

# What The Tool Does Not Do

The current implementation intentionally does **not**:

- execute application code
- simulate runtime rendering
- evaluate conditional branches
- resolve TypeScript path aliases
- resolve non-relative package imports
- perform bundler-level module resolution
- analyze styling or CSS systems

---

# Example Mental Model

For a page like:

```tsx
<>
  <LoginForm />
  <Footer />
</>
```

if both reachable components render:

```tsx
<button id="submit-button" />
```

the analyzer collects both occurrences into the same page scope and reports the duplicate.

---

# Current Limitations

The analyzer is deterministic and simple by design, which means it favors clarity over full framework awareness.

It works well for local static component graphs, but it does not currently understand:

- aliases like `@/components/Button`
- build-time transforms
- dynamic imports
- conditionally rendered trees
- framework-specific routing conventions beyond the configured page globs

