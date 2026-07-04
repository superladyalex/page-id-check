# page-id-check

`page-id-check` is a static analysis CLI for React/TSX codebases. It starts from configured page entry files, follows the JSX render tree, resolves imported components through relative imports and barrels, and reports duplicate DOM attributes such as `id` and `data-testid`.

## What it checks

- Page files under `src/pages/**/*.tsx`
- Page files under `src/screens/**/*.tsx`
- Duplicate `id` attributes
- Duplicate `data-testid` attributes

## How it runs

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
