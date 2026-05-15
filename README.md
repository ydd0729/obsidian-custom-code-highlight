# Custom Code Highlight

Custom Code Highlight is an Obsidian plugin for adding syntax highlighting to fenced code blocks whose languages are not supported by Obsidian out of the box.

The plugin was built primarily to support WebAssembly text format snippets (`wasm`, `wat`, and `wast`), but its language list can be extended with a JSON configuration file.

## Features

- Highlights WebAssembly text format code blocks by default.
- Supports the aliases `wasm`, `wat`, `wast`, and `webassembly`.
- Works in Reading view and Live Preview.
- Adds editor-mode highlighting through a CodeMirror 6 decoration extension.
- Allows additional languages to be defined in `languages.json`.
- Reuses Obsidian theme colors where possible.
- Does not replace editable code block DOM in Live Preview, so code blocks remain editable.

## Supported WebAssembly fences

Use any of the following language names:

````markdown
```wasm
(module
  (func $add (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add))
```
````

````markdown
```wat
(module
  (memory 1)
  (data (i32.const 0) "hello"))
```
````

The same highlighting rules also apply to `wast` and `webassembly`.

## Installation

Copy the built plugin files into your vault:

```text
<your-vault>/.obsidian/plugins/custom-code-highlight/
```

The directory should contain at least:

```text
manifest.json
main.js
styles.css
```

Then enable it in Obsidian:

1. Open Settings.
2. Go to Community plugins.
3. Reload plugins if needed.
4. Enable `Custom Code Highlight`.

If the plugin was already enabled while files were changed, disable and enable it again, or run Obsidian's plugin reload flow.

## Extending Languages

Create a `languages.json` file in the plugin directory. You can copy `languages.example.json` as a starting point.

Example:

```json
{
  "languages": [
    {
      "id": "mydsl",
      "aliases": ["my-dsl"],
      "tokens": [
        {
          "name": "comment",
          "pattern": ";.*",
          "flags": "m"
        },
        {
          "name": "keyword",
          "pattern": "\\b(foo|bar|baz)\\b"
        },
        {
          "name": "number",
          "pattern": "\\b\\d+(?:\\.\\d+)?\\b"
        },
        {
          "name": "string",
          "pattern": "\"(?:\\\\.|[^\"\\\\])*\""
        }
      ]
    }
  ]
}
```

After editing `languages.json`, reload the language definitions in one of these ways:

- Run the command `Reload custom highlight languages`.
- Open the plugin settings and click `Reload`.
- Disable and re-enable the plugin.

## Language Configuration Format

Each language entry supports:

- `id`: The primary fence language name, such as `mydsl`.
- `aliases`: Optional additional fence names.
- `tokens`: A list of token rules.

Each token rule supports:

- `name`: Token class name. Common values include `comment`, `keyword`, `string`, `number`, `builtin`, `variable`, and `operator`.
- `pattern`: A JavaScript regular expression source string.
- `flags`: Optional regular expression flags, such as `m` or `i`.
- `lookbehind`: Optional Prism-compatible flag used when the language is registered with Prism.
- `greedy`: Optional Prism-compatible flag used when the language is registered with Prism.

Token names become CSS classes in Reading view:

```html
<span class="token keyword">...</span>
```

In editor mode, they become CodeMirror decoration classes:

```text
custom-code-highlight-editor-keyword
```

You can customize these classes in `styles.css`.

## How Highlighting Works

The plugin uses two paths:

- Reading view and rendered Live Preview output: a Markdown postprocessor scans rendered code blocks and wraps matched tokens in `span.token.*` elements.
- Editor mode: a CodeMirror 6 view plugin scans fenced code block content and applies mark decorations to matching token ranges.

This split keeps Live Preview code blocks editable while still adding color in the editor.

## Development

Install dependencies with pnpm:

```bash
pnpm install
```

Build the plugin:

```bash
pnpm run build
```

For watch mode:

```bash
pnpm run dev
```

This project keeps `main.js` committed so the plugin can be used directly from an Obsidian plugins folder without rebuilding.

## Files

- `main.ts`: Plugin source.
- `main.js`: Built plugin bundle loaded by Obsidian.
- `styles.css`: Reading view and editor token styles.
- `manifest.json`: Obsidian plugin manifest.
- `languages.example.json`: Example custom language config.
- `languages.schema.json`: JSON schema for language config files.

## Troubleshooting

If highlighting does not appear:

1. Confirm the fence language is one of `wasm`, `wat`, `wast`, or `webassembly`, or is listed in `languages.json`.
2. Reload the plugin after changing files.
3. Switch away from the note and back to force editor decorations to refresh.
4. Run `Reload custom highlight languages` after editing `languages.json`.
5. Check Obsidian's developer console for plugin load errors.

If editor highlighting appears but the code block cannot be edited, make sure you are using a version after the Live Preview fix. The plugin should not use `registerMarkdownCodeBlockProcessor` for normal highlighting because that can replace editable Live Preview code blocks.
