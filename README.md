# ✨ Extended Code Highlight

Extended Code Highlight adds broader, theme-compatible syntax highlighting for Obsidian code blocks in Reading view, Source mode, and Live Preview.

It supports all bundled PrismJS languages, bundled CodeMirror parser languages, and optional regex languages loaded from JSON files.

## 🚀 Features

- Highlights more code block languages in both Reading view and editor views.
- Supports every PrismJS language id and alias bundled with the plugin.
- Uses CodeMirror parser highlighting where bundled parser support exists.
- Keeps highlighted code blocks editable in Live Preview.
- Reuses Obsidian's native `.token.*` and `.cm-*` theme classes.
- Lets you add custom regex-based languages as JSON files.

## 🌐 Language Support

Use the normal language name after a fenced code block, such as `js`, `ts`, `python`, `json`, `css`, `html`, `glsl`, `svelte`, `vue`, `zig`, `nix`, or `wasm`.

The plugin supports:

- Every PrismJS language bundled from the PrismJS supported language list.
- Every CodeMirror parser language bundled in this plugin.
- Regex fallback languages shipped as separate JSON files.
- User-defined regex languages that use the same JSON format.

You can check the upstream language lists here:

- PrismJS supported languages: [prismjs.com/#supported-languages](https://prismjs.com/#supported-languages)
- CodeMirror parser packages: [codemirror.net/#language-support](https://codemirror.net/#language-support)

Bundled fallback JSON files currently cover MLIR and Lean. Other bundled languages use PrismJS and/or CodeMirror support.

Highlighting priority depends on the Obsidian view:

- Reading view: PrismJS grammar first, then CodeMirror parser translated to Prism-style `.token.*` spans, then regex fallback.
- Source mode and Live Preview: CodeMirror parser first, then PrismJS token stream translated to Obsidian/CodeMirror `.cm-*` classes, then regex fallback.
- Regex JSON languages always use their token rules.

If a language is not built in, add a JSON file for it.

## 🧩 Examples

````markdown
```glsl
uniform sampler2D tex;

void main() {
  vec4 color = texture2D(tex, vec2(0.5));
}
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

## ⚙️ Custom Languages

Create one JSON file per language in the plugin's `languages` folder:

```text
<your-vault>/.obsidian/plugins/extended-code-highlight/languages/
```

Example:

```json
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
```

Supported token names include `comment`, `keyword`, `string`, `number`, `builtin`, `variable`, `function`, `property`, and `operator`.

After editing a language JSON file, run the `Reload extended highlight languages` command or disable and re-enable the plugin.

## 🎨 Styling

The plugin uses Obsidian-compatible token classes so your current theme can style highlighted code.

Reading view uses Prism-style classes:

```html
<span class="token keyword">...</span>
```

Editor views use CodeMirror-style classes:

```text
cm-hmd-codeblock cm-keyword
```

## 📦 Installation

Copy these files into your plugin folder:

```text
<your-vault>/.obsidian/plugins/extended-code-highlight/
```

Required files:

```text
manifest.json
main.js
languages/*.json
```

Then enable `Extended Code Highlight` in Obsidian's Community plugins settings.
