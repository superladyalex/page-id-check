# page-id-check

`page-id-check` is a static analysis CLI for React/TSX codebases. It starts from configured page entry files, follows the JSX render tree, resolves imported components through relative imports and barrels, and reports duplicate DOM attributes such as `id` and `data-testid`.

## what makes it react specific?
It is React-specific because the analyzer is built around React’s programming
model, not just generic HTML or TypeScript.

What makes it React-specific:

- JSX syntax
    - The parser looks for .tsx files and JSX nodes like <Button />, <Layout /
      >, and <input data-testid="..." />.

    - That syntax is React’s component syntax, not plain TypeScript.

- Component tree traversal
    - React apps are built as component trees.
    - The tool follows rendered components from page components into child
      components, which matches how React composes UI.

- PascalCase component detection
    - It treats tags like <Button /> or <Modal.Header /> as components, which
      is a React convention.

    - Plain HTML tags like <div> or <button> are not traversed as components.

- Conditional rendering
    - React commonly uses JSX conditionals like:

      {isPrimary ? <PrimaryButton /> : <SecondaryButton />}

    - The analyzer is built to reason about both branches in source.

- Barrels and component imports
    - React codebases often organize UI through component folders, index.ts
      barrels, and re-exports.

    - The resolver logic is designed for that structure.

What it is not:

- It does not analyze generic HTML pages.
- It does not execute a browser DOM.
- It does not understand React state, hooks, or runtime rendering beyond what
  is visible in the source tree.

- It does not try to model non-React frameworks.

So the React-specific part is the combination of:

- TSX/JSX parsing
- React-style component naming
- component-tree traversal
- React-ish conditional rendering and import structure


## how does it ignore regular dom elements
It ignores HTML tags like div because the parser only treats PascalCase JSX
tags as component usages.

In page-id-check/src/parser.ts, this function controls that:

function isComponentTag(tag: string): boolean {
return /^[A-Z]/.test(tag);
}

Then when it collects JSX tags, it filters with that check:

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

So:

- <div> → starts with lowercase d → ignored
- <button> → starts with lowercase b → ignored
- <Button> → starts with uppercase B → treated as a component
- <Modal.Header> → starts with uppercase M → treated as a component

That means the analyzer only follows React component usage, not plain HTML
elements.

One nuance:

- It will still record DOM attributes on HTML elements like <div id="x" />
- It just won’t traverse into those tags as if they were components

So the tool checks DOM attributes on the real rendered elements, but only
traverses into custom React components.


## What it checks and how is connfigured 

The CLI reads [`src/config.ts`](/Users/alexandra/repos/page-id-check/src/config.ts) to determine:

- `repoRoot`
- page discovery globs
- exclusion rules
- duplicate attributes to validate

Then it:

1. discovers page entry files
2. builds a render-tree analysis for each page
3. validates duplicate attributes in the flattened page scope
4. prints the duplicate report

## Usage

```bash
yarn build
yarn check
```

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

After that, the main commands are:

```bash
yarn build
yarn check
yarn test
```

If Corepack or Yarn fails before the project starts, that usually means the local Node.js install is too old or the package-manager shim is not enabled.

## Sample app

The repo points at the sample app in [`/Users/alexandra/repos/sample-app-for-page-id-check`](/Users/alexandra/repos/sample-app-for-page-id-check).

That sample includes:

- repeated component rendering
- imported-but-unused components
- conditional JSX branches

Those cases are used to demonstrate why JSX-tree traversal is more accurate than a browser-only or import-only walk.

The report includes the component source location plus the render path that led to it, so repeated renders are easier to trace back to the page source.

## Test suite

Run the analyzer tests with:

```bash
yarn test
```

You can also run the same suite through the regression alias:

```bash
yarn test:regression
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

The tests are self-contained unit tests built from temporary fixtures, so they do not depend on the sample app repo.
