# ✨ Extended Code Highlight

Extended Code Highlight adds broader, theme-compatible syntax highlighting for Obsidian code blocks in Reading view, Source mode, and Live Preview.

It supports all bundled PrismJS languages, bundled CodeMirror parser languages, and optional user-defined regex languages.

## 🚀 Features

- Highlights more code block languages in both Reading view and editor views.
- Supports every PrismJS language id and alias bundled with the plugin.
- Uses CodeMirror parser highlighting where bundled parser support exists.
- Keeps highlighted code blocks editable in Live Preview.
- Reuses Obsidian's native `.token.*` and `.cm-*` theme classes.
- Lets you add custom regex-based languages with `languages.json`.

## 🌐 Language Support

Reading view supports the PrismJS language list bundled with this plugin, including aliases such as `js`, `ts`, `py`, `yml`, and many more.

Editor and Live Preview include bundled CodeMirror parser support for:

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

Additional built-in regex definitions cover WebAssembly text, Zig, Nix, HCL/Terraform, Kusto/KQL, GLSL, AutoHotkey, GDScript, MLIR, Lean, Angular, Vue, Liquid, Less, Sass/SCSS, and Svelte.

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

Create `languages.json` in the plugin directory:

```text
<your-vault>/.obsidian/plugins/extended-code-highlight/languages.json
```

Example:

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

Supported token names include `comment`, `keyword`, `string`, `number`, `builtin`, `variable`, `function`, `property`, and `operator`.

After editing `languages.json`, run the `Reload extended highlight languages` command or disable and re-enable the plugin.

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
styles.css
```

Then enable `Extended Code Highlight` in Obsidian's Community plugins settings.
