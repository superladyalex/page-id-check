End-to-end flow

1. The CLI starts in page-id-check/src/index.ts:7.

   main() reads config.repoRoot, prints the repository path, then asks
   discover() for page entry files. In the current config, that root is
   hardcoded to the sibling sample app in page-id-check/src/config.ts:3.

2. Page files are discovered in page-id-check/src/discover.ts:1.

   fast-glob searches for files matching:
  - src/pages/**/*.tsx
  - src/screens/**/*.tsx

   The search runs relative to repoRoot and ignores the configured exclude
   patterns. The result is a list of absolute file paths, one per page entry.

   If nothing matches, the CLI prints a warning and exits with code 0. That is
   the “no pages found” path in page-id-check/src/index.ts:19.

3. Each discovered page is analyzed in page-id-check/src/
   buildPageAnalysis.ts:9.

   This is the recursive traversal step. For each page:
  - the path is normalized
  - the file is skipped if it is excluded
  - the file is parsed
  - its imports are followed
  - its barrel re-exports are followed
  - the traversal continues until no new reachable files remain

   The visited set prevents infinite loops and avoids re-parsing the same
   file. The analysesByFile map stores one parsed analysis per file.

4. A single file is parsed in page-id-check/src/parser.ts:16.

   analyzeTsxFile() uses ts-morph to inspect one TSX file and extract three
   things:
  - JSX attributes
  - import declarations
  - JSX component usages

   For JSX attributes, it walks all JsxAttribute nodes and stores:
  - file path
  - attribute name
  - attribute value
  - line number
  - column number

   It also normalizes string-like JSX values before storing them. That matters
   because the validator should compare actual values, not JSX syntax noise.

   Example:

   <input data-testid={"search-input"} />

   gets normalized to the value:

   search-input

   That is why the report should say:

   data-testid: "search-input"

   instead of a noisy double-wrapped string.

   The parser also records imports, including:
  - default imports
  - named imports
  - aliased named imports
  - namespace imports

   Finally, it detects PascalCase JSX tags like <Button /> or <Modal.Header /
   >. That data is collected, but the current traversal does not use it.

5. Relative imports are resolved in page-id-check/src/resolveImport.ts:4.

   The resolver only handles relative module specifiers, so ./Button or ../ui
   are in scope, but react or @/components/Button are not.

   For each relative import, it tries common filesystem candidates in order:
  - Button.tsx
  - Button.ts
  - Button.jsx
  - Button.js
  - Button/index.tsx
  - Button/index.ts
  - Button/index.jsx
  - Button/index.js

   This is why a page can import ../components/forms/LoginForm, and the
   analyzer can still find the right file even if the actual implementation
   lives in a folder index file.

6. Barrel files are resolved in page-id-check/src/resolveExport.ts:4.

   This step handles re-exports like:

   export { Button } from "./Button";
   export { Button, Card } from "./ui";
   export * from "./ui";

   That means the traversal can move through index.ts style barrel files and
   reach the real implementation files underneath.

7. After traversal, the page analysis is flattened in page-id-check/src/
   buildPageAnalysis.ts:40.

   Every visited file contributes its extracted data to one page-level bundle:
  - all attributes
  - all imports
  - all component usages

   The output of this step is a single FileAnalysis object representing the
   whole page scope.

8. Validation happens in page-id-check/src/validator.ts:16.

   The validator only checks the configured duplicate attributes:
  - id
  - data-testid

   For each page:
  - it ignores attributes with empty values
  - it groups attributes by attribute name and value
  - it flags a duplicate when the same name + value pair appears more than
    once

   The grouping key uses a delimiter character that is unlikely to collide
   with real attribute values, so the lookup stays stable.

9. The CLI prints the result in page-id-check/src/index.ts:64.

   If there are no issues, it prints:

   No duplicate DOM attributes found.

   and exits 0.

   If there are issues, it prints:
  - the page path
  - the duplicated attribute
  - the duplicated value
  - each occurrence with file, line, and column

   Then it exits 1, which is what you want for CI failure behavior.

What this means for the sample app

With the current config, the tool analyzes the sample app in the sibling repo,
not page-id-check itself. So the flow is:

- discover pages in ../sample-app-for-page-id-check
- analyze DashboardPage, LoginPage, ProfilePage, and SettingsPage
- follow their imports and barrels
- collect the reachable attributes
- report duplicates like:
  - data-testid="search-input"
  - id="submit-button"

That matches the output you pasted earlier.

extra.md status

extra.md was not fully correct before. I updated it to match the code
currently in the repo. The key correction was removing the claim that
traversal follows JSX component usage. The current code extracts component
usage metadata, but traversal only follows:

- static imports
- barrel re-exports

If you want, I can also do a second pass and turn this explanation into a
shorter internal doc or a README-style architecture note.
