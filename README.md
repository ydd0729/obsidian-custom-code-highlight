# Extended Code Highlight

Additional and configurable syntax highlighting for Obsidian code blocks.

The plugin highlights code in both Reading view and editor/Live Preview mode. It ships with built-in language definitions for missing or inconsistent code block languages, and can be extended with regex-based token rules in `languages.json`.

## Features

- Built-in highlighting for WebAssembly text, Zig, Nix, HCL/Terraform, Kusto/KQL, AutoHotkey, GDScript, MLIR, Lean, Angular, Vue, Liquid, Less, Sass/SCSS, and Svelte.
- User-defined language highlighting through `languages.json`.
- Reading-view highlighting through Prism-compatible grammar registration.
- Editor-mode highlighting through CodeMirror 6 decorations.
- Live Preview code blocks remain editable.

## Supported Languages

| Language | Fence names |
| --- | --- |
| WebAssembly text format | `wasm`, `wat`, `wast`, `webassembly` |
| Zig | `zig` |
| Nix | `nix`, `nixos` |
| HCL / Terraform | `hcl`, `terraform`, `tf`, `tfvars` |
| Kusto Query Language | `kusto`, `kql` |
| AutoHotkey | `autohotkey`, `ahk` |
| GDScript | `gdscript`, `gd` |
| MLIR | `mlir` |
| Lean | `lean`, `lean4` |
| Angular templates | `angular`, `ng` |
| Vue single-file components | `vue` |
| Liquid templates | `liquid`, `shopify` |
| Less | `less` |
| Sass / SCSS | `sass`, `scss` |
| Svelte | `svelte`, `sv` |

Obsidian uses different highlighting paths across Reading view, Source mode, and Live Preview. This plugin keeps the supported language set consistent across those views by registering Prism-compatible rules and applying matching editor decorations.

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

Obsidian uses PrismJS for Reading view code block highlighting, while Source mode and Live Preview use CodeMirror. Extended Code Highlight bridges those views with built-in language definitions and user-provided regex token definitions.

The current implementation is parser-first for built-in languages where parser support is available:

- Reading view prefers the current PrismJS grammar for a supported fence name, and falls back to the plugin's regex grammar when Prism does not provide that language.
- Editor and Live Preview prefer CodeMirror/Lezer parsers for built-in languages with bundled CodeMirror language support.
- If CodeMirror support is unavailable for a built-in language, editor highlighting falls back to the regex token rules.
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

Editor tokens use CodeMirror decoration classes:

```text
extended-code-highlight-editor-keyword
```

Customize colors in `styles.css`.

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
