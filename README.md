# page-id-check

`page-id-check` is a static analysis CLI for React/TSX codebases. It starts from configured page entry files, follows the JSX render tree, resolves imported components through relative imports and barrels, and reports duplicate DOM attributes such as `id` and `data-testid`. The analyzer is static only. It does not run the app or simulate runtime rendering.

## Write-up/Answers to questions
See [Writeup.md](Writeup.md) for the analyzer design, React-specific behavior, and deeper implementation notes, and answers to questions.


## Other repos you will need
This app can run against 2 sibling test apps. You can clone them as siblings to this repo -- additional information is below on how to configure the `/src/.config` and where the repos are located.

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
    // repoRoot: path.resolve("../sample-app-happy-path-for-page-id-check"),
    repoRoot: path.resolve("../sample-app-for-page-id-check"),
    // repoRoot: path.resolve("."),
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

There are 2 sample apps that are meant to help with testing this project. 
**You should clone them as siblings to this repo**

- Sample app (unhappy paths)  [`sample-app-for-page-id-check`](https://github.com/superladyalex/sample-app-for-page-id-check)
- Sample app happy path (no issues)  [`sample-app-happy-path-for-page-id-check`](https://github.com/superladyalex/sample-app-happy-path-for-page-id-check)

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