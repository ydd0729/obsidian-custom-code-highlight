# Custom Code Highlight

An Obsidian plugin that registers additional Prism syntax highlighters for fenced code blocks.

It ships with WebAssembly text highlighting for code fences such as:

````markdown
```wasm
(module
  (func $add (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add))
```
````

Aliases `wasm`, `wat`, `wast`, and `webassembly` are enabled by default.

## Extending languages

Copy `languages.example.json` to `languages.json` in the plugin directory and edit it. Reload the plugin or run the `Reload custom highlight languages` command from the command palette.

Each language contains an `id`, optional `aliases`, and a list of token rules. Token names map to Prism CSS classes, so names such as `comment`, `keyword`, `number`, `string`, `operator`, `function`, and `variable` will reuse Obsidian's existing theme colors.

## Build

```bash
npm install
npm run build
```
