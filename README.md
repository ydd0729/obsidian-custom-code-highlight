# Extended Code Highlight

Additional and configurable syntax highlighting for Obsidian code blocks.

The plugin highlights code in both Reading view and editor/Live Preview mode. It ships with PrismJS grammars, CodeMirror parsers, and regex fallback definitions, and can be extended with regex-based token rules in `languages.json`.

## Features

- Reading-view highlighting for every PrismJS supported language id and alias.
- Editor/Live Preview parser highlighting for bundled CodeMirror-supported languages.
- CodeMirror parser highlighting in Reading view when CodeMirror supports a language but PrismJS does not.
- PrismJS token-stream highlighting in editor views when PrismJS supports a language but no CodeMirror parser is available.
- Regex fallback highlighting from JSON definitions when neither the relevant parser nor PrismJS tokenization is available.
- User-defined language highlighting through `languages.json`.
- Native Obsidian Prism and CodeMirror token classes for theme-compatible colors.
- Live Preview code blocks remain editable.

## Supported Languages

Reading view supports every language id and alias listed by PrismJS at <https://prismjs.com/#supported-languages>. If a bundled CodeMirror parser exists for a non-Prism language, Reading view translates the CodeMirror parser ranges into Prism-style `.token.*` spans.

Editor and Live Preview include CodeMirror parser support for:

| Language | Fence names |
| --- | --- |
| Angular templates | `angular`, `ng` |
| CSS | `css` |
| C++ | `cpp`, `c++`, `cxx`, `cc`, `hpp`, `h++` |
| Go | `go` |
| HTML | `html`, `htm` |
| Java | `java` |
| JavaScript | `javascript`, `js`, `mjs`, `cjs` |
| TypeScript | `typescript`, `ts` |
| JSX | `jsx` |
| TSX | `tsx` |
| Jinja | `jinja`, `jinja2`, `django` |
| JSON | `json`, `webmanifest` |
| Less | `less` |
| Liquid templates | `liquid`, `shopify` |
| Markdown | `markdown`, `md` |
| PHP | `php` |
| Python | `python`, `py` |
| Rust | `rust`, `rs` |
| Sass / SCSS | `sass`, `scss` |
| SQL | `sql` |
| Vue single-file components | `vue` |
| WebAssembly text format | `wasm`, `wat`, `wast`, `webassembly` |
| XML | `xml`, `xsd` |
| YAML | `yaml`, `yml` |
| Svelte | `svelte`, `sv` |

Additional built-in JSON regex fallbacks cover WebAssembly text, Zig, Nix, HCL/Terraform, Kusto/KQL, GLSL, AutoHotkey, GDScript, MLIR, Lean, Angular, Vue, Liquid, Less, Sass/SCSS, and Svelte. Prism-only languages use PrismJS token streams translated to Obsidian/CodeMirror editor classes when no CodeMirror parser is available.

## Example

````markdown
```wat
(module
  (func $add (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add))
```
````

````markdown
```svelte
<script lang="ts">
  export let name = "world";
</script>

{#if name}
  <h1>Hello {name}</h1>
{/if}
```
````

## Extending Languages

Create `languages.json` in the plugin directory. You can copy `languages.example.json` as a starting point.

```json
{
  "languages": [
    {
      "id": "mydsl",
      "aliases": ["my-dsl"],
      "tokens": [
        { "name": "comment", "pattern": ";.*", "flags": "m" },
        { "name": "keyword", "pattern": "\\b(foo|bar|baz)\\b" },
        { "name": "number", "pattern": "\\b\\d+(?:\\.\\d+)?\\b" },
        { "name": "string", "pattern": "\"(?:\\\\.|[^\"\\\\])*\"" }
      ]
    }
  ]
}
```

Each language supports:

- `id`: Primary fence name.
- `aliases`: Optional additional fence names.
- `tokens`: Ordered token rules.

Each token supports:

- `name`: CSS/token class, such as `comment`, `keyword`, `string`, `number`, `builtin`, `variable`, `function`, `property`, or `operator`.
- `pattern`: JavaScript regular expression source.
- `flags`: Optional regular expression flags.
- `lookbehind` / `greedy`: Optional Prism-compatible flags.

After editing `languages.json`, run `Reload extended highlight languages`, use the plugin settings reload button, or disable and re-enable the plugin.

## Implementation

Obsidian uses PrismJS for Reading view code block highlighting, while Source mode and Live Preview use CodeMirror. Extended Code Highlight keeps those paths separate:

- Reading view uses the plugin's bundled PrismJS grammar for Prism-supported fence names, then translates CodeMirror parser ranges into Prism-style token spans when only CodeMirror support is available.
- Editor and Live Preview use bundled CodeMirror/Lezer parsers for CodeMirror-supported fence names.
- If CodeMirror support is unavailable for a built-in language, editor highlighting uses PrismJS token streams translated to Obsidian/CodeMirror token classes.
- JSON regex token rules are used after the relevant PrismJS and CodeMirror paths are unavailable, and for user-defined languages.
- User-defined languages in `languages.json` always use regex token rules in both Reading view and editor/Live Preview mode.

## Installation

Copy the built plugin files into:

```text
<your-vault>/.obsidian/plugins/extended-code-highlight/
```

Required files:

```text
manifest.json
main.js
styles.css
```

Then enable `Extended Code Highlight` from Obsidian's Community plugins settings.

## Styling

Reading view tokens use Prism-style classes:

```html
<span class="token keyword">...</span>
```

Editor tokens use plugin decoration classes plus Obsidian/CodeMirror token classes:

```text
extended-code-highlight-editor-keyword cm-hmd-codeblock cm-keyword
```

This lets installed Obsidian themes style plugin-highlighted tokens through their existing `.token.*` and `.cm-*` rules.

## Development

```bash
pnpm install
pnpm run build
```

Watch mode:

```bash
pnpm run dev
```

`main.js` is committed so the plugin can be installed directly without rebuilding.

## Troubleshooting

- Reload the plugin after changing files.
- Switch away from the note and back if editor decorations do not refresh.
- Run `Reload extended highlight languages` after editing `languages.json`.
- Check Obsidian's developer console for plugin load errors.
- If Live Preview code blocks become uneditable, make sure the plugin version does not use `registerMarkdownCodeBlockProcessor` for normal highlighting.
