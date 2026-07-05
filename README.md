# page-id-check

`page-id-check` is a static analysis CLI for React/TSX codebases. It starts from configured page entry files, follows the JSX render tree, resolves imported components through relative imports and barrels, and reports duplicate DOM attributes such as `id` and `data-testid`. The analyzer is static only. It does not run the app or simulate runtime rendering.

## Write-up/Answers to questions
[`writeup`](Writeup.md)

## Running Locally / Contributing

1. Install Node.js 20 or higher.
2. Enable Corepack.

```bash
corepack enable
```

3. From this directory, install dependencies.

```bash
yarn install
```

After that, the main commands **(some of which require configuration and the sample app to produce valid results - explained in the next section)** are:

```bash
yarn build
yarn check  (the command you will use to run)
yarn test
```

If Corepack or Yarn fails before the project starts, that usually means the local Node.js install is too old or the package-manager shim is not enabled.
Additionally, you may need to run `corepack yarn...` with your yarn commands 

## Configuration 

The CLI reads [`src/config.ts`](src/config.ts) to determine:

- repoRoot
- page discovery globs
- exclusion rules
- duplicate attributes to validate

Then it:

1. discovers page entry files
2. builds a render-tree analysis for each page
3. validates duplicate attributes in the flattened page scope
4. prints the duplicate report


```ts
export const config = {
  repoRoot: path.resolve("../sample-app-for-page-id-check"),
  pages: ["src/pages/**/*.tsx", "src/screens/**/*.tsx"],
  exclude: ["**/node_modules/**", "**/*.test.tsx", "**/*.spec.tsx"],
  duplicateAttributes: ["id", "data-testid"],
};
```

Meaning:

- `repoRoot` points at the sample app repository.
- `pages` defines the page entry-point globs.
- `exclude` is applied throughout discovery and traversal.
- `duplicateAttributes` defines which DOM attributes are checked.

There are 3 possible repo roots you can use:
- `../sample-app-for-page-id-check` - this will point at the sample app meant to exercise the logic within this repo -- you can use that path provided you `git clone` that repo as a sibling of where you have cloned this repo.
- `"."` - this will point at THIS repo and will return the result that there is nothing configured and the output will tell you that
- `"../sample-app-happy-path-for-page-id-check"` - this will point at the happy path sample app and exercise logic within this repo and tell you there are no issues

Select a config and then `yarn check` from this repo's root. 


## Sample apps

There are 2 sample apps that are ment to help with testing this project. 
**You should clone them as siblings to this repo**

Sample app (unhappy paths)  [`sample-app-for-page-id-check`](https://github.com/superladyalex/sample-app-for-page-id-check)
Sample app happy path (no issues)  [`sample-app-happy-path-for-page-id-check`](https://github.com/superladyalex/sample-app-happy-path-for-page-id-check)

That unhappy paths sample includes:

- repeated component rendering
- imported-but-unused components
- conditional JSX branches
- files that should be excluded
- same values for different keys

Those cases among others are used to use as a live integration repo for this code. The README within the sample app gives a more detailed explanation.


## Output Report
The report includes the component source location plus the render path that led to it, so repeated renders are easier to trace back to the page source.
Including the 3 results here. 

### Invalid Repo Root

Page ID Check

Repository: /Users/alexandra/repos/page-id-check

⚠️  No pages matched your configuration.

Searching for:
• src/pages/**/*.tsx
• src/screens/**/*.tsx

Repository root: /Users/alexandra/repos/page-id-check

Suggestions:
• Verify repoRoot is correct.
• Verify the page glob patterns.
• Try a broader pattern like 'src/**/*.tsx'.


### sample-app (unhappy paths)

Page ID Check

Repository: /Users/alexandra/repos/sample-app-for-page-id-check
📄 Found 8 page(s).

➡️  /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ComponentReusePage.tsx
➡️  /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx
➡️  /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/DashboardPage.tsx
➡️  /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/IdsVsTestIdPage.tsx
➡️  /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ImportedButUnusedPage.tsx
➡️  /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/LoginPage.tsx
➡️  /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ProfilePage.tsx
➡️  /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/SettingsPage.tsx

🚨 Duplicate DOM attributes detected

────────────────────────────────────────
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ComponentReusePage.tsx
id: "submit-button"

1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:17:7 via src/pages/ComponentReusePage.tsx:31:9
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:17:7 via src/pages/ComponentReusePage.tsx:33:9
3. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:17:7 via src/pages/ComponentReusePage.tsx:35:9

────────────────────────────────────────
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ComponentReusePage.tsx
data-testid: "submit-button"

1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:18:7 via src/pages/ComponentReusePage.tsx:31:9
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:18:7 via src/pages/ComponentReusePage.tsx:33:9
3. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:18:7 via src/pages/ComponentReusePage.tsx:35:9

────────────────────────────────────────
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx
id: "conditional-action"

1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalPrimaryButton.tsx:8:13 via src/pages/ConditionalBranchPage.tsx:21:9
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalSecondaryButton.tsx:8:13 via src/pages/ConditionalBranchPage.tsx:23:9

────────────────────────────────────────
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/ConditionalBranchPage.tsx
data-testid: "conditional-action"

1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalPrimaryButton.tsx:8:37 via src/pages/ConditionalBranchPage.tsx:21:9
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/ConditionalSecondaryButton.tsx:8:37 via src/pages/ConditionalBranchPage.tsx:23:9

────────────────────────────────────────
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/LoginPage.tsx
id: "submit-button"

1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/Button.tsx:17:7 via src/pages/LoginPage.tsx:36:9 -> src/components/forms/LoginForm.tsx:21:7
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/Footer.tsx:14:15 via src/pages/LoginPage.tsx:38:9

────────────────────────────────────────
Page: /Users/alexandra/repos/sample-app-for-page-id-check/src/pages/SettingsPage.tsx
data-testid: "search-input"

1. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/SearchBox.tsx:18:7 via src/pages/SettingsPage.tsx:33:9
2. /Users/alexandra/repos/sample-app-for-page-id-check/src/components/ui/SearchResults.tsx:15:7 via src/pages/SettingsPage.tsx:35:9

Found 6 duplicate issue(s).



### sample-app (happy path)

Page ID Check

Repository: /Users/alexandra/repos/sample-app-happy-path-for-page-id-check
📄 Found 1 page(s).

➡️  /Users/alexandra/repos/sample-app-happy-path-for-page-id-check/src/pages/HomePage.tsx

✅ No duplicate DOM attributes found.



## Unit Test suite

Run the analyzer tests with:

```bash
yarn test
```

The test suite covers:

- discovery
- import resolution
- barrel resolution
- JSX attribute normalization
- repeated renders
- imported-but-unused components
- conditional JSX branches
- validation of duplicate outputs




# How the Analyzer Works

This analyzer is designed for **React-style JSX/TSX applications**. Rather than executing an application, it builds a deterministic **static component graph**  directly from source code by following JSX component usage and import relationships.
Because of this design, it works best with frameworks whose component structure is explicit in TSX/JSX. Unlike a browser or React itself, it never executes your application. Instead, it analyzes the structure of your TSX/JSX files and follows component relationships to determine which DOM attributes could exist on a rendered page.
This makes the analysis deterministic, repeatable, and fast.

---

## What makes it React-specific?

The analyzer is built around **React's component model**, not generic HTML or arbitrary TypeScript.

Rather than treating every JSX element equally, it distinguishes between **React components** and **DOM elements**, then traverses only the component tree.

Specifically, the analyzer understands:

### JSX / TSX syntax

The analyzer parses `.tsx` files and inspects JSX nodes.

For example:

```tsx
<Button />
<Layout>
  <SearchBox />
</Layout>

<input data-testid="search" />
```

---

### Component tree traversal

React applications are composed as trees of components.

The analyzer follows those relationships exactly as they appear in source.

For example:

```tsx
<LoginPage>
    <Layout>
        <LoginForm />
    </Layout>
</LoginPage>
```

If `LoginForm` renders a `Button`, the analyzer will continue traversing into `Button` automatically.

This allows duplicate DOM attributes to be detected across deeply nested components.

---

### PascalCase component detection

The analyzer identifies React components using standard JSX naming conventions.

Components such as:

```tsx
<Button />
<Modal.Header />
<SearchResults />
```

are treated as traversable components.

Lowercase JSX tags are treated as standard DOM elements instead.

---

### Conditional rendering

React commonly renders components conditionally.

For example:

```tsx
{isPrimary ? <PrimaryButton /> : <SecondaryButton />}
```

The analyzer does **not** evaluate runtime conditions.

Instead, it includes **both branches** in the component graph so that potential duplicate attributes are not missed.

---

### Component imports and barrel files

React applications commonly organize components using:

- relative imports
- barrel files (`index.ts`)
- named exports
- default exports
- namespace imports
- aliased imports

The analyzer resolves these patterns to build a complete component graph.

---

## Why are normal HTML elements ignored during traversal?

The analyzer only traverses **React components**.

Standard HTML elements are considered terminal nodes.

For example:

```tsx
<div>
    <Button />
</div>
```

The analyzer will:

- ignore `<div>` as a traversal target
- continue into `<Button />`

Likewise:

```tsx
<div />
<button />
<input />
```

are never treated as components because they are standard DOM elements.

Internally, component detection follows React's PascalCase naming convention.

Conceptually, it behaves like:

```ts
function isComponentTag(tag: string): boolean {
    return /^[A-Z]/.test(tag);
}
```

Which means:

| JSX Tag | Traversed? |
|----------|------------|
| `<div />` | ❌ No |
| `<button />` | ❌ No |
| `<input />` | ❌ No |
| `<Button />` | ✅ Yes |
| `<Modal.Header />` | ✅ Yes |

### Important distinction

Although DOM elements are **not traversed**, they are still inspected for validation attributes.

For example:

```tsx
<div id="container">
    <Button />
</div>
```

The analyzer will:

- record `id="container"`
- traverse into `Button`

In other words:

- DOM elements contribute validation attributes.
- React components contribute additional traversal.

---

# Framework Support

The analyzer is designed for **React-style JSX/TSX applications**.

Because it builds a static component graph, it works best with frameworks whose UI structure is expressed through JSX and imports.

## Well supported

- React
- Preact
- Solid (JSX mode)
- Custom JSX-based applications

These frameworks generally share:

- TSX / JSX syntax
- PascalCase component conventions
- import-based component composition
- explicit component trees

## Not supported

The analyzer is **not** intended for frameworks whose render structure is defined outside of JSX.

Examples include:

- Vue
- Svelte
- Angular

These frameworks require different parsers and different traversal strategies because their component relationships are not represented solely through JSX and imports.

---


## What makes it react specific?
It is React-specific because the analyzer is built around React’s programming model, not just generic HTML or TypeScript.

- JSX syntax
    - The parser looks for .tsx files and JSX nodes with React component syntax (not plain Typescript) `<Button />, <Layout />, and <input data-testid="..." />`

- Component tree traversal
    - React apps are built as component trees.
    - The tool follows rendered components from page components into child components, which matches how React composes UI.

- PascalCase component detection
    - It treats tags like` <Button /> `or `<Modal.Header />` as components, which is a React convention.

- Plain HTML tags like `<div>` or `<button>` are not traversed as components.

- Conditional rendering
    - React commonly uses JSX conditionals like: `{isPrimary ? <PrimaryButton /> : <SecondaryButton />}` which this analyzer is built to reason about both branches in source.

- Barrels and component imports
    - React codebases often organize UI through component folders, index.ts barrels, and re-exports which resolver logic is built for.


## What this is not:

- It does not analyze generic HTML pages.
- It does not execute a browser DOM.
- It does not understand React state, hooks, or runtime rendering beyond what is visible in the source tree.

- It does not try to model non-React frameworks.

So the React-specific part is the combination of:

- TSX/JSX parsing
- React-style component naming
- component-tree traversal
- React-ish conditional rendering and import structure


## How does it ignore regular dom elements
It ignores HTML tags like div because the parser only treats PascalCase JSX tags as component usages.

In page-id-check/src/parser.ts, this function controls that:

```typescript
function isComponentTag(tag: string): boolean {
return /^[A-Z]/.test(tag);
}
```

Then, when it collects JSX tags, it filters with that check:

```typescript
const componentUsages = [
...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
]
.map((el: any) => ({
name: el.getTagNameNode().getText(),
line: pos.line,
column: pos.column,
}))
.filter((u) => isComponentTag(u.name));
```

So:

- `<div>` → starts with lowercase d → ignored
- `<button>` → starts with lowercase b → ignored
- `<Button>` → starts with uppercase B → treated as a component
- `<Modal.Header>` → starts with uppercase M → treated as a component

That means the analyzer only follows React component usage, not plain HTML elements.

One nuance:
- It WILL still record DOM attributes on HTML elements like `<div id="x" />`
- It just will NOT traverse into those tags as if they were components

So the tool checks DOM attributes on the real rendered elements, but only traverses into custom React components.



# End-to-End Flow

## 1. Configuration

The CLI reads [`src/config.ts`](src/config.ts)

Current configuration:

```ts
export const config = {
  repoRoot: path.resolve("../sample-app-for-page-id-check"),
  pages: ["src/pages/**/*.tsx", "src/screens/**/*.tsx"],
  exclude: ["**/node_modules/**", "**/*.test.tsx", "**/*.spec.tsx"],
  duplicateAttributes: ["id", "data-testid"],
};
```

Meaning:

- `repoRoot` points at the sample app repository.
- `pages` defines the page entry-point globs.
- `exclude` is applied throughout discovery and traversal.
- `duplicateAttributes` defines which DOM attributes are checked.


## 2. CLI entry point 

The analyzer starts in [`src/index.ts`](/src/index.ts)

It performs the top-level orchestration:

* Reads configuration (repoRoot, patterns, rules)
* Discovers page entry files
* Builds a full page analysis for each entry file
* Runs validation over the collected page scope
* Prints a report
  * Exits with:
    0 if no issues are found
    1 if duplicates are detected

## 3. Page discovery

[`src/discover.ts`](src/discover.ts) uses `fast-glob` to find page files under `repoRoot`.
* Search is constrained by config.pages
* Global exclude patterns are applied
* The result is a list of absolute file paths

If no files match, the CLI exits successfully with a warning.

The result is a list of absolute file paths. If nothing matches, the CLI prints a warning and exits with code `0`.

## 4. Building the page scope (core traversal)

This is the most important step
[`src/buildPageAnalysis.ts`](src/buildPageAnalysis.ts) builds the page scope.

The current traversal is JSX-driven starting from each page file. 

High-level process:
1. Parse the file.
2. Collect the JSX component usages in that file.
3. Match those usages to local imports.
4. Resolve the matching component files.
5. Follow the component tree recursively.
6. Repeat the same process for every rendered child component.

Important:

- Only JSX usages that are actually rendered drive traversal.
- Imported components that are not rendered are ignored.
- Repeated JSX tags are counted as repeated instances, not collapsed into one.

## 5. Parsing a single file

[`src/parser.ts`](src/parser.ts) reads a single TSX file and extracts:

### JSX Attribute extraction
Only attributes listed in `duplicateAttributes` are tracked. Values are normalized so that equivalent syntax produces the same value


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

### Component usage 

The parser records JSX component tags such as:

```tsx
<Button />
<Forms.ProfileForm />
<Modal.Header />
```

Those usages are what drive traversal. Lowercase HTML elements like `<div>` or `<input>` are treated as DOM nodes and are not traversed as components.

### Import extraction

The parser also records import declarations so the traversal can connect component usage back to the actual source file.

## 6. Import resolution

[`src/resolveImport.ts`](src/resolveImport.ts) resolves **relative** imports only.

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

Package imports and TypeScript path aliases are **NOT** resolved.

## 7. Barrel resolution

[`src/resolveExport.ts`](src/resolveExport.ts) follows barrel files like:

```ts
export { Button } from "./Button";
export { Button, Card } from "./ui";
export * from "./ui";
```

This lets the traversal move through `index.ts` files and still reach the real component implementation files.

The resolver supports:
* named re-exports
* wildcard exports (`export * from`)

More complex export patterns are simplified to maintain deterministic behavior.


## 8. Validation

[`src/validator.ts`](src/validator.ts) receives the flattened page scope and checks only the configured duplicate attributes.

It:

1. Filters only configured `duplicateAttributes`
2. Ignores empty values. 
3. Groups attributes by `name + value`. 
4. Reports a duplicate when the same attribute/value pair appears more than once in the same page scope.

## 8. Output

[`src/index.ts`](src/index.ts) prints the result.

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

Repeated renders of the same component show up as separate entries with a different render path instead of three identical source lines.
