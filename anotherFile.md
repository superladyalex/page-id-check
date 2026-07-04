19 -## Things AI got wrong
20 -1)
21 -disocver.cs
22 -{
23 -cwd: root, //search from "this" directory
24 -absolute: true, originally set this to true with the reasoning that ful
l paths are easier to work with.
25 -onlyFiles: true
26 -}
27 -Why I disagree:
28 -They're much cleaner in CLI output.
29 -They're easier to read in error messages.
30 -If someone pastes the output into a PR or Slack, it isn't full of machi
ne-specific paths.
31 -
32 -2)
33 -the original paradigm it suggestd wass firsst find eveyr jsx element an
d inspect their attributes
34 -```
     35 -JSX Element
     36 -    ↓
     37 -Attributes
     38 -        ↓
     39 -id
     40 -data-testid
     41 -```
42 -In other words:
43 -
44 -Find <input />
45 -Look at its attributes
46 -Find id
47 -
48 -Since we only care about `id` and `data-testid` - we can just find ever
y JSX attribute instead
49 -
50 -so, with this code
51 -```typescript
     52 -<div>
     53 -  <input id="email" />
     54 -  <button data-testid="submit">
     55 -    Submit
     56 -  </button>
     57 -</div>
     58 -```
59 -with the original suggesetsiotn,
60 -```typescript
     61 -Find every JSX element
     62 -
     63 -↓
     64 -
     65 -div
     66 -input
     67 -button
     68 -
     69 -↓
     70 -
     71 -Inspect each one's attributes
     72 -
     73 -↓
     74 -
     75 -id
     76 -data-testid
     77 -```
78 -
79 -with my improvement
80 -```typescript
     81 -Find every JSX attribute
     82 -
     83 -↓
     84 -
     85 -id
     86 -data-testid
     87 -```
88 -Since we're not doing answring questions  like - this approach works
89 -"Which component contains this attribute?"
90 -"Is this attribute on a DOM element or a React component?"
91 -"Where is this element in the render tree?"
92 -
93 -
94 -3)
95 -It originally suggested a Next specific configuration where we'd only l
ok for pages in app/* and pages/* which raell meant we were building so
mething coupled to a framework instead of being framework agnosti
96 -original code in discover.ts suggested
97 -return fg(
98 -[
99 -"app/**/page.tsx",
100 -"pages/**/*.tsx"
101 -]
102 -
103 -I changed it to a config file that wasn't framework specific and had in
cludde, exclude logic
104 -
105 -4)
106 -Right now we still assume:
107 -
108 -./Button → Button.tsx
109 -
110 -But real code has:
111 -
112 -./Button/index.ts
113 -@/components/Button
114 -re-exports
115 -barrel files
116 -
117 -
118 -5
119 -

