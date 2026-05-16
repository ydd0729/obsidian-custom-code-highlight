# Custom Code Highlight

Extensible syntax highlighting for code blocks that are missing or inconsistent in the default highlighting.

The plugin highlights code in both Reading view and editor/Live Preview mode. It ships with several built-in language definitions and can be extended with `languages.json`.

## Features

- Built-in highlighting for WebAssembly text, Zig, Nix, HCL/Terraform, Kusto/KQL, and AutoHotkey.
- Editor-mode highlighting through CodeMirror 6 decorations.
- Reading-view highlighting through Markdown postprocessing.
- Extensible language definitions via JSON.
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

Obsidian uses different highlighting paths across Reading view, Source mode, and Live Preview. This plugin fills common gaps and lets you add more languages when needed.

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
```terraform
resource "aws_s3_bucket" "example" {
  bucket = var.bucket_name
}
```
````

## Installation

Copy the built plugin files into:

```text
<your-vault>/.obsidian/plugins/custom-code-highlight/
```

Required files:

```text
manifest.json
main.js
styles.css
```

Then enable `Custom Code Highlight` from Obsidian's Community plugins settings.

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

After editing `languages.json`, run `Reload custom highlight languages`, use the plugin settings reload button, or disable and re-enable the plugin.

## Styling

Reading view tokens use Prism-style classes:

```html
<span class="token keyword">...</span>
```

Editor tokens use CodeMirror decoration classes:

```text
custom-code-highlight-editor-keyword
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
- Run `Reload custom highlight languages` after editing `languages.json`.
- Check Obsidian's developer console for plugin load errors.
- If Live Preview code blocks become uneditable, make sure the plugin version does not use `registerMarkdownCodeBlockProcessor` for normal highlighting.
