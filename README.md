# page-id-check

`page-id-check` is a static analysis CLI for React/TSX codebases. It starts from configured page entry files, follows the JSX render tree, resolves imported components through relative imports and barrels, and reports duplicate DOM attributes such as `id` and `data-testid`. The analyzer is static only. It does not run the app or simulate runtime rendering.


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
yarn check
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

## Sample app

The repo can point to a sample app  [`sample-app-for-page-id-check`](https://github.com/superladyalex/sample-app-for-page-id-check).

That sample includes:

- repeated component rendering
- imported-but-unused components
- conditional JSX branches
- files that should be excluded
- same values for different keys

Those cases among others are used to use as a live integration repo for this code. The README within the sample app gives a more detailed explanation.


## Output Report
The report includes the component source location plus the render path that led to it, so repeated renders are easier to trace back to the page source.

XXXXXX 



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

# Current Limitations

The analyzer is intentionally deterministic and static.

It builds a compile-time component graph from source code only. It never executes application code or simulates a browser environment.

This is intentional. Reporting every possible collision visible in the source graph is generally more useful than attempting to predict which code paths will execute at runtime.

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

Only relative imports are currently resolved.

---

## No package resolution

```ts
import React from "react";
import { Button } from "@company/ui";
```

Only files within the analyzed repository are included in the component graph.

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

## No bundler-specific module resolution

The analyzer does not reproduce Webpack, Vite, esbuild, or other bundler behavior.

For example, it does not resolve:

- custom module aliases
- `package.json` `"exports"` maps
- workspace-specific module resolution

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
