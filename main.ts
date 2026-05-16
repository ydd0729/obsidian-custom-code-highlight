import { RangeSetBuilder, Text } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { App, MarkdownPostProcessorContext, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";

type PrismPattern = RegExp | {
  pattern: RegExp;
  lookbehind?: boolean;
  greedy?: boolean;
};

type PrismGrammar = Record<string, PrismPattern | PrismPattern[]>;

type PrismLike = {
  languages: Record<string, PrismGrammar>;
  hooks?: {
    run: (name: string, env: unknown) => void;
  };
  highlightElement?: (element: Element) => void;
};

type TokenConfig = {
  name: string;
  pattern: string;
  flags?: string;
  lookbehind?: boolean;
  greedy?: boolean;
};

type LanguageConfig = {
  id: string;
  aliases?: string[];
  tokens: TokenConfig[];
};

type LanguagesFile = {
  languages?: LanguageConfig[];
};

type TokenMatcher = {
  name: string;
  pattern: RegExp;
};

type RuntimeLanguage = {
  ids: string[];
  normalizedIds: Set<string>;
  idPattern: RegExp;
  matchers: TokenMatcher[];
};

type TokenRange = {
  start: number;
  end: number;
  name: string;
};

type PluginSettings = {
  languageConfigPath: string;
  includeBuiltInLanguages: boolean;
};

const DEFAULT_SETTINGS: PluginSettings = {
  languageConfigPath: "languages.json",
  includeBuiltInLanguages: true
};

const WASM_LANGUAGE: LanguageConfig = {
  id: "wasm",
  aliases: ["wat", "wast", "webassembly"],
  tokens: [
    {
      name: "comment",
      pattern: "\\(;[\\s\\S]*?;\\)|;;.*",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\\\\[\\s\\S]|[^\"\\\\])*\"",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:module|func|param|result|local|global|memory|table|elem|data|type|import|export|start|if|then|else|end|block|loop|br|br_if|br_table|return|call|call_indirect|local\\.get|local\\.set|local\\.tee|global\\.get|global\\.set|memory\\.(?:size|grow|copy|fill|init)|table\\.(?:get|set|size|grow|fill|copy|init)|drop|select|nop|unreachable)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:i32|i64|f32|f64|v128|funcref|externref)\\b(?:\\.[A-Za-z0-9_.$-]+)?"
    },
    {
      name: "number",
      pattern: "[-+]?\\b(?:0x[\\da-fA-F](?:[\\da-fA-F_]*\\.?[\\da-fA-F_]*)?|\\d(?:[\\d_]*\\.?[\\d_]*))(?:[eEpP][-+]?\\d[\\d_]*)?\\b|\\b(?:inf|nan(?::0x[\\da-fA-F_]+)?)\\b"
    },
    {
      name: "variable",
      pattern: "\\$[\\w!#$%&'*+./:<=>?@\\\\^`|~-]+"
    },
    {
      name: "operator",
      pattern: "[()]"
    }
  ]
};

const ZIG_LANGUAGE: LanguageConfig = {
  id: "zig",
  tokens: [
    {
      name: "comment",
      pattern: "//.*",
      flags: "m"
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:addrspace|align|allowzero|and|anyframe|anytype|asm|async|await|break|callconv|catch|comptime|const|continue|defer|else|enum|errdefer|error|export|extern|fn|for|if|inline|linksection|noalias|noinline|nosuspend|null|opaque|or|orelse|packed|pub|resume|return|struct|suspend|switch|test|threadlocal|try|union|unreachable|usingnamespace|var|volatile|while)\\b"
    },
    {
      name: "builtin",
      pattern: "@[A-Za-z_][A-Za-z0-9_]*|\\b(?:bool|void|noreturn|type|anyerror|comptime_int|comptime_float|isize|usize|i\\d+|u\\d+|f16|f32|f64|f80|f128)\\b"
    },
    {
      name: "number",
      pattern: "\\b(?:0x[\\da-fA-F_]+|0b[01_]+|\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][-+]?\\d[\\d_]*)?)\\b"
    },
    {
      name: "function",
      pattern: "\\b[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()"
    },
    {
      name: "operator",
      pattern: "[-+*/%=!<>|&~^?:]+|\\.\\.?|[{}()[\\],;]"
    }
  ]
};

const NIX_LANGUAGE: LanguageConfig = {
  id: "nix",
  aliases: ["nixos"],
  tokens: [
    {
      name: "comment",
      pattern: "#.*|/\\*[\\s\\S]*?\\*/",
      greedy: true
    },
    {
      name: "string",
      pattern: "''[\\s\\S]*?''|\"(?:\\\\.|[^\"\\\\])*\"",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:assert|else|if|in|inherit|let|or|rec|then|with)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:abort|baseNameOf|builtins|derivation|dirOf|fetchTarball|import|isNull|map|placeholder|removeAttrs|throw|toString)\\b"
    },
    {
      name: "number",
      pattern: "\\b\\d+(?:\\.\\d+)?\\b"
    },
    {
      name: "property",
      pattern: "\\b[A-Za-z_][A-Za-z0-9_'-]*(?=\\s*=)"
    },
    {
      name: "operator",
      pattern: "[-+*/!<>=&|?:@]+|\\.\\.\\.?|[{}()[\\],;]"
    }
  ]
};

const HCL_LANGUAGE: LanguageConfig = {
  id: "hcl",
  aliases: ["terraform", "tf", "tfvars"],
  tokens: [
    {
      name: "comment",
      pattern: "#.*|//.*|/\\*[\\s\\S]*?\\*/",
      greedy: true
    },
    {
      name: "string",
      pattern: "<<-?\\w+[\\s\\S]*?\\n\\w+|\"(?:\\\\.|[^\"\\\\])*\"",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:resource|data|provider|variable|output|module|locals|terraform|dynamic|for|in|if|null|true|false)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:count|each|for_each|depends_on|lifecycle|provisioner|connection|source|version|required_providers|required_version|backend)\\b"
    },
    {
      name: "number",
      pattern: "\\b\\d+(?:\\.\\d+)?\\b"
    },
    {
      name: "property",
      pattern: "\\b[A-Za-z_][A-Za-z0-9_-]*(?=\\s*=)"
    },
    {
      name: "variable",
      pattern: "\\b(?:var|local|module|data|path|terraform|each|self)\\.[A-Za-z0-9_.-]+"
    },
    {
      name: "operator",
      pattern: "=>|==|!=|<=|>=|&&|\\|\\||[-+*/%<>=!?:]+|[{}()[\\],.]"
    }
  ]
};

const KUSTO_LANGUAGE: LanguageConfig = {
  id: "kusto",
  aliases: ["kql"],
  tokens: [
    {
      name: "comment",
      pattern: "//.*",
      flags: "m"
    },
    {
      name: "string",
      pattern: "@?\"(?:\"\"|\\\\.|[^\"\\\\])*\"|'(?:''|\\\\.|[^'\\\\])*'",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:let|where|project|project-away|extend|summarize|by|join|kind|on|union|take|limit|top|order|sort|asc|desc|render|evaluate|parse|mv-expand|distinct|count|datatable|between|contains|has|in|and|or|not)\\b",
      flags: "i"
    },
    {
      name: "builtin",
      pattern: "\\b(?:ago|bin|case|datetime|dynamic|iff|isnotempty|isnull|isempty|now|strcat|split|tolower|toupper|tostring|toint|tolong|todouble|summarize|countif|dcount|make_set|make_list)\\b",
      flags: "i"
    },
    {
      name: "number",
      pattern: "\\b\\d+(?:\\.\\d+)?\\b"
    },
    {
      name: "operator",
      pattern: "\\|\\||[|=<>!~+-/*%,.;()[\\]{}]"
    }
  ]
};

const AUTOHOTKEY_LANGUAGE: LanguageConfig = {
  id: "autohotkey",
  aliases: ["ahk"],
  tokens: [
    {
      name: "comment",
      pattern: ";.*|/\\*[\\s\\S]*?\\*/",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\"\"|`.|[^\"])*\"|'(?:''|`.|[^'])*'",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:if|else|return|global|local|static|class|extends|try|catch|finally|throw|loop|while|for|in|break|continue|switch|case|default|goto|gosub|new|and|or|not)\\b",
      flags: "i"
    },
    {
      name: "builtin",
      pattern: "\\b(?:MsgBox|Send|SendInput|Click|Sleep|Run|WinWait|WinActivate|Hotkey|SetTimer|InputBox|FileRead|FileAppend|RegRead|RegWrite|StrSplit|SubStr|InStr|Format)\\b",
      flags: "i"
    },
    {
      name: "number",
      pattern: "\\b(?:0x[\\da-fA-F]+|\\d+(?:\\.\\d+)?)\\b"
    },
    {
      name: "variable",
      pattern: "%[A-Za-z_][A-Za-z0-9_]*%|\\b[A-Za-z_][A-Za-z0-9_]*(?=\\s*:=)"
    },
    {
      name: "operator",
      pattern: "::|:=|=>|==|!=|<=|>=|&&|\\|\\||[-+*/%=!<>.&|^~?:]+|[{}()[\\],.]"
    }
  ]
};

const GDSCRIPT_LANGUAGE: LanguageConfig = {
  id: "gdscript",
  aliases: ["gd"],
  tokens: [
    {
      name: "comment",
      pattern: "#.*",
      flags: "m"
    },
    {
      name: "string",
      pattern: "\"\"\"[\\s\\S]*?\"\"\"|'''[\\s\\S]*?'''|\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:and|as|assert|await|break|breakpoint|class|class_name|const|continue|elif|else|enum|extends|for|func|if|in|is|match|not|or|pass|preload|return|self|signal|static|super|tool|var|while|yield)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:Array|Basis|Callable|Color|Dictionary|Node|Node2D|Object|PackedScene|Quaternion|Rect2|Resource|SceneTree|Signal|String|StringName|Transform2D|Transform3D|Vector2|Vector3|Vector4|bool|float|int|void)\\b|@[A-Za-z_][A-Za-z0-9_]*"
    },
    {
      name: "number",
      pattern: "\\b(?:0x[\\da-fA-F_]+|0b[01_]+|\\d[\\d_]*(?:\\.\\d[\\d_]*)?)\\b"
    },
    {
      name: "function",
      pattern: "\\b[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()"
    },
    {
      name: "operator",
      pattern: ":=|==|!=|<=|>=|&&|\\|\\||[-+*/%=!<>.&|^~?:]+|[{}()[\\],.]"
    }
  ]
};

const MLIR_LANGUAGE: LanguageConfig = {
  id: "mlir",
  tokens: [
    {
      name: "comment",
      pattern: "//.*",
      flags: "m"
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:affine_map|affine_set|attributes|dense|false|func|loc|module|none|return|strided|true|type|unit)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:bf16|f16|f32|f64|i1|i8|i16|i32|i64|index|memref|tensor|vector)\\b(?:<[^>]+>)?"
    },
    {
      name: "number",
      pattern: "[-+]?\\b(?:0x[\\da-fA-F]+|\\d+(?:\\.\\d+)?)\\b"
    },
    {
      name: "variable",
      pattern: "%[A-Za-z0-9_.$-]+|#[A-Za-z0-9_.$-]+|@[A-Za-z0-9_.$-]+|![A-Za-z0-9_.$-]+"
    },
    {
      name: "operator",
      pattern: "->|=>|[{}()[\\],:=<>*x?]|\\.\\.\\."
    }
  ]
};

const LEAN_LANGUAGE: LanguageConfig = {
  id: "lean",
  aliases: ["lean4"],
  tokens: [
    {
      name: "comment",
      pattern: "--.*|/-[\\s\\S]*?-/",
      greedy: true
    },
    {
      name: "string",
      pattern: "\"(?:\\\\.|[^\"\\\\])*\"",
      greedy: true
    },
    {
      name: "keyword",
      pattern: "\\b(?:abbrev|axiom|by|calc|case|class|def|deriving|do|else|end|example|extends|forall|fun|if|import|in|inductive|infix|instance|let|macro|match|mutual|namespace|open|opaque|partial|private|protected|public|rec|section|simp|structure|syntax|termination_by|then|theorem|universe|variable|where|with)\\b"
    },
    {
      name: "builtin",
      pattern: "\\b(?:Bool|Char|False|Fin|Float|IO|Int|List|Nat|Option|Prop|Set|Sort|String|Subtype|True|Type|UInt8|UInt16|UInt32|UInt64|Unit)\\b"
    },
    {
      name: "number",
      pattern: "\\b\\d+(?:\\.\\d+)?\\b"
    },
    {
      name: "function",
      pattern: "\\b[A-Za-z_][A-Za-z0-9_'.]*(?=\\s*(?:\\{|\\(|:|:=))"
    },
    {
      name: "operator",
      pattern: "=>|:=|->|<-|←|→|↔|∀|∃|λ|fun|[{}()[\\],.:;=<>+\\-*/|&!?'^]+"
    }
  ]
};

const BUILT_IN_LANGUAGES: LanguageConfig[] = [
  WASM_LANGUAGE,
  ZIG_LANGUAGE,
  NIX_LANGUAGE,
  HCL_LANGUAGE,
  KUSTO_LANGUAGE,
  AUTOHOTKEY_LANGUAGE,
  GDSCRIPT_LANGUAGE,
  MLIR_LANGUAGE,
  LEAN_LANGUAGE
];

const LANGUAGE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const TOKEN_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const VALID_REGEXP_FLAGS = /^[dgimsuvy]*$/;

export default class CustomCodeHighlightPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  private registeredLanguageIds = new Set<string>();
  private runtimeLanguages: RuntimeLanguage[] = [];

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new CustomCodeHighlightSettingTab(this.app, this));

    this.addCommand({
      id: "reload-custom-highlight-languages",
      name: "Reload custom highlight languages",
      callback: async () => {
        await this.registerLanguages();
        new Notice("Custom highlight languages reloaded.");
      }
    });

    this.registerMarkdownPostProcessor((element, context) => {
      this.highlightRenderedCodeBlocks(element, context);
    });

    await this.ensureExampleConfig();
    await this.registerLanguages();
    this.registerEditorExtension(this.createEditorExtension());
  }

  onunload(): void {
    this.unregisterLanguages();
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);

    const legacySettings = loaded as Partial<PluginSettings> & { includeBuiltInWasm?: boolean } | null;
    if (legacySettings && typeof legacySettings.includeBuiltInWasm === "boolean") {
      this.settings.includeBuiltInLanguages = legacySettings.includeBuiltInWasm;
      await this.saveSettings();
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData({
      languageConfigPath: this.settings.languageConfigPath,
      includeBuiltInLanguages: this.settings.includeBuiltInLanguages
    });
  }

  async registerLanguages(): Promise<void> {
    const prism = this.getPrism();

    this.unregisterLanguages();

    const languages = await this.loadLanguageConfigs();
    for (const language of languages) {
      const grammar = this.createGrammar(language);
      const ids = [language.id, ...(language.aliases ?? [])];

      this.runtimeLanguages.push({
        ids,
        normalizedIds: new Set(ids.map((id) => id.toLowerCase())),
        idPattern: this.createLanguageIdPattern(ids),
        matchers: this.createTokenMatchers(language)
      });

      for (const id of ids) {
        if (prism) {
          prism.languages[id] = grammar;
        }
        this.registeredLanguageIds.add(id);
      }
    }

    this.highlightVisibleCodeBlocks();
  }

  private unregisterLanguages(): void {
    const prism = this.getPrism();

    if (prism) {
      for (const id of this.registeredLanguageIds) {
        delete prism.languages[id];
      }
    }

    this.registeredLanguageIds.clear();
    this.runtimeLanguages = [];
  }

  private async loadLanguageConfigs(): Promise<LanguageConfig[]> {
    const languages: LanguageConfig[] = [];

    if (this.settings.includeBuiltInLanguages) {
      languages.push(...BUILT_IN_LANGUAGES);
    }

    const config = await this.readConfiguredLanguages();
    for (const language of config.languages ?? []) {
      try {
        languages.push(this.validateLanguage(language));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`Skipped custom highlight language: ${message}`);
      }
    }

    return languages;
  }

  private async readConfiguredLanguages(): Promise<LanguagesFile> {
    const path = this.getConfigPath();
    if (!(await this.app.vault.adapter.exists(path))) {
      return {};
    }

    try {
      const raw = await this.app.vault.adapter.read(path);
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        throw new Error("root must be an object");
      }
      return parsed as LanguagesFile;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to load ${this.settings.languageConfigPath}: ${message}`);
      return {};
    }
  }

  private validateLanguage(language: LanguageConfig): LanguageConfig {
    if (!language || typeof language !== "object") {
      throw new Error("language entry must be an object");
    }
    if (!LANGUAGE_ID_PATTERN.test(language.id)) {
      throw new Error(`invalid language id: ${language.id}`);
    }
    for (const alias of language.aliases ?? []) {
      if (!LANGUAGE_ID_PATTERN.test(alias)) {
        throw new Error(`invalid alias for ${language.id}: ${alias}`);
      }
    }
    if (!Array.isArray(language.tokens) || language.tokens.length === 0) {
      throw new Error(`language ${language.id} must define at least one token`);
    }
    for (const token of language.tokens) {
      if (!TOKEN_NAME_PATTERN.test(token.name)) {
        throw new Error(`invalid token name in ${language.id}: ${token.name}`);
      }
      if (token.flags && !VALID_REGEXP_FLAGS.test(token.flags)) {
        throw new Error(`invalid regexp flags for ${language.id}.${token.name}: ${token.flags}`);
      }
    }
    return language;
  }

  private createGrammar(language: LanguageConfig): PrismGrammar {
    const grammar: PrismGrammar = {};

    for (const token of language.tokens) {
      const flags = token.flags ?? "";
      const pattern = new RegExp(token.pattern, flags);
      grammar[token.name] = token.lookbehind || token.greedy
        ? {
          pattern,
          lookbehind: token.lookbehind,
          greedy: token.greedy
        }
        : pattern;
    }

    return grammar;
  }

  private createTokenMatchers(language: LanguageConfig): TokenMatcher[] {
    return language.tokens.map((token) => ({
      name: token.name,
      pattern: new RegExp(token.pattern, this.withGlobalFlag(token.flags ?? ""))
    }));
  }

  private withGlobalFlag(flags: string): string {
    return flags.includes("g") ? flags : `${flags}g`;
  }

  private createLanguageIdPattern(ids: string[]): RegExp {
    const alternatives = ids.map((id) => this.escapeRegExp(id)).join("|");
    return new RegExp(`^\\s*(?:${alternatives})(?:\\s|$)`, "i");
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }

  private highlightVisibleCodeBlocks(): void {
    this.highlightCodeBlocks(document);
  }

  private highlightCodeBlocks(root: ParentNode): void {
    for (const code of this.findCodeElements(root)) {
      const language = this.getRuntimeLanguageForCodeElement(code);
      if (language) {
        this.highlightCodeElement(code, language);
      }
    }
  }

  private highlightRenderedCodeBlocks(root: ParentNode, context: MarkdownPostProcessorContext): void {
    for (const code of this.findCodeElements(root)) {
      const language = this.getRuntimeLanguageForCodeElement(code)
        ?? this.getRuntimeLanguageFromSection(code, context);
      if (language) {
        this.highlightCodeElement(code, language);
      }
    }
  }

  private findCodeElements(root: ParentNode): HTMLElement[] {
    const elements: HTMLElement[] = [];

    if (root instanceof HTMLElement && root.matches("pre > code, code[class*='language-']")) {
      elements.push(root);
    }

    root.querySelectorAll("pre > code, code[class*='language-']").forEach((element) => {
      if (element instanceof HTMLElement) {
        elements.push(element);
      }
    });

    return elements;
  }

  private getRuntimeLanguage(id: string): RuntimeLanguage | null {
    const normalizedId = id.toLowerCase();
    return this.runtimeLanguages.find((language) => language.normalizedIds.has(normalizedId)) ?? null;
  }

  private getRuntimeLanguageForCodeElement(element: HTMLElement): RuntimeLanguage | null {
    const classNames = [
      ...Array.from(element.classList),
      ...Array.from(element.parentElement?.classList ?? [])
    ];

    for (const className of classNames) {
      const match = className.match(/^language-(.+)$/);
      if (!match) {
        continue;
      }

      const language = this.getRuntimeLanguage(match[1]);
      if (language) {
        return language;
      }
    }

    return null;
  }

  private getRuntimeLanguageFromSection(
    element: HTMLElement,
    context: MarkdownPostProcessorContext
  ): RuntimeLanguage | null {
    const section = context.getSectionInfo(element);
    if (!section) {
      return null;
    }

    const opening = section.text.match(/^\s*(`{3,}|~{3,})\s*([^\s`~]+)/);
    if (!opening) {
      return null;
    }

    return this.runtimeLanguages.find((language) => language.idPattern.test(opening[2])) ?? null;
  }

  private highlightCodeElement(element: Element, language: RuntimeLanguage): void {
    if (element.hasClass("custom-code-highlight")) {
      return;
    }

    const text = element.textContent ?? "";
    if (!text) {
      return;
    }

    element.empty();
    element.addClass("custom-code-highlight");
    element.setAttr("data-custom-code-highlighted", "true");
    this.renderHighlightedText(element, text, language);
  }

  private renderHighlightedText(element: Element, text: string, language: RuntimeLanguage): void {
    const ranges = this.findTokenRanges(text, language.matchers);
    let offset = 0;

    for (const range of ranges) {
      if (range.start > offset) {
        element.appendText(text.slice(offset, range.start));
      }

      const tokenEl = element.createSpan({
        cls: `token ${range.name}`,
        text: text.slice(range.start, range.end)
      });
      tokenEl.setAttr("data-token", range.name);
      offset = range.end;
    }

    if (offset < text.length) {
      element.appendText(text.slice(offset));
    }
  }

  private findTokenRanges(text: string, matchers: TokenMatcher[]): TokenRange[] {
    const ranges: TokenRange[] = [];
    const occupied = new Array<boolean>(text.length).fill(false);

    for (const matcher of matchers) {
      matcher.pattern.lastIndex = 0;

      for (const match of text.matchAll(matcher.pattern)) {
        const start = match.index ?? 0;
        const value = match[0];
        const end = start + value.length;

        if (!value || this.hasOverlap(occupied, start, end)) {
          continue;
        }

        ranges.push({ start, end, name: matcher.name });
        for (let i = start; i < end; i += 1) {
          occupied[i] = true;
        }
      }
    }

    return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
  }

  private hasOverlap(occupied: boolean[], start: number, end: number): boolean {
    for (let i = start; i < end; i += 1) {
      if (occupied[i]) {
        return true;
      }
    }
    return false;
  }

  private createEditorExtension() {
    const plugin = this;

    return ViewPlugin.fromClass(class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = plugin.buildEditorDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = plugin.buildEditorDecorations(update.view);
        }
      }
    }, {
      decorations: (value) => value.decorations
    });
  }

  private buildEditorDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();

    if (this.runtimeLanguages.length === 0) {
      return builder.finish();
    }

    for (const { from, to } of this.mergeRanges(view.visibleRanges)) {
      this.buildEditorDecorationsForRange(view, builder, from, to);
    }

    return builder.finish();
  }

  private mergeRanges(ranges: readonly { from: number; to: number }[]): { from: number; to: number }[] {
    const merged: { from: number; to: number }[] = [];

    for (const range of ranges) {
      const previous = merged[merged.length - 1];
      if (previous && range.from <= previous.to) {
        previous.to = Math.max(previous.to, range.to);
      } else {
        merged.push({ from: range.from, to: range.to });
      }
    }

    return merged;
  }

  private buildEditorDecorationsForRange(
    view: EditorView,
    builder: RangeSetBuilder<Decoration>,
    from: number,
    to: number
  ): void {
    const doc = view.state.doc;
    let lineNumber = this.findFenceSearchStartLine(doc, from);
    const endLineNumber = doc.lineAt(to).number;

    while (lineNumber <= endLineNumber) {
      const openingLine = doc.line(lineNumber);
      const opening = openingLine.text.match(/^(\s*)(`{3,}|~{3,})\s*([^\s`~]+)/);

      if (!opening) {
        lineNumber += 1;
        continue;
      }

      const fence = opening[2];
      const language = this.runtimeLanguages.find((candidate) => candidate.idPattern.test(opening[3]));

      if (!language) {
        lineNumber += 1;
        continue;
      }

      let closingLineNumber = lineNumber + 1;
      while (closingLineNumber <= doc.lines) {
        const candidateLine = doc.line(closingLineNumber);
        if (this.isClosingFence(candidateLine.text, fence)) {
          break;
        }
        closingLineNumber += 1;
      }

      const contentStartLineNumber = lineNumber + 1;
      const hasClosingFence = closingLineNumber <= doc.lines;
      const contentEndLineNumber = hasClosingFence ? closingLineNumber - 1 : doc.lines;

      if (contentStartLineNumber <= contentEndLineNumber) {
        const contentStart = doc.line(contentStartLineNumber).from;
        const contentEnd = doc.line(contentEndLineNumber).to;
        const visibleContentStart = Math.max(contentStart, from);
        const visibleContentEnd = Math.min(contentEnd, to);

        if (visibleContentStart > visibleContentEnd) {
          lineNumber = hasClosingFence ? closingLineNumber + 1 : doc.lines + 1;
          continue;
        }

        const source = doc.sliceString(contentStart, contentEnd);
        const ranges = this.findTokenRanges(source, language.matchers);

        for (const range of ranges) {
          const decorationStart = contentStart + range.start;
          const decorationEnd = contentStart + range.end;
          if (decorationEnd < from || decorationStart > to) {
            continue;
          }

          builder.add(
            decorationStart,
            decorationEnd,
            Decoration.mark({
              class: `custom-code-highlight-editor-token custom-code-highlight-editor-${range.name}`
            })
          );
        }
      }

      lineNumber = hasClosingFence ? closingLineNumber + 1 : doc.lines + 1;
    }

  }

  private findFenceSearchStartLine(doc: Text, from: number): number {
    let lineNumber = doc.lineAt(from).number;

    while (lineNumber > 1) {
      const line = doc.line(lineNumber);
      if (/^\s*(`{3,}|~{3,})/.test(line.text)) {
        return lineNumber;
      }
      lineNumber -= 1;
    }

    return 1;
  }

  private isClosingFence(text: string, openingFence: string): boolean {
    const fenceChar = openingFence[0];
    const minLength = openingFence.length;
    const pattern = new RegExp(`^\\s*\\${fenceChar}{${minLength},}\\s*$`);
    return pattern.test(text);
  }

  private async ensureExampleConfig(): Promise<void> {
    const path = `${this.manifest.dir}/languages.example.json`;
    if (await this.app.vault.adapter.exists(path)) {
      return;
    }

    const example: LanguagesFile = {
      languages: [
        {
          id: "mydsl",
          aliases: ["my-dsl"],
          tokens: [
            { name: "comment", pattern: ";.*", flags: "m" },
            { name: "keyword", pattern: "\\b(foo|bar|baz)\\b" },
            { name: "number", pattern: "\\b\\d+(?:\\.\\d+)?\\b" },
            { name: "string", pattern: "\"(?:\\\\.|[^\"\\\\])*\"" }
          ]
        }
      ]
    };

    await this.app.vault.adapter.write(path, `${JSON.stringify(example, null, 2)}\n`);
  }

  getConfigPath(): string {
    const configuredPath = this.settings.languageConfigPath.trim() || DEFAULT_SETTINGS.languageConfigPath;
    if (configuredPath.includes(":") || configuredPath.startsWith("/") || configuredPath.startsWith("\\")) {
      return `${this.manifest.dir}/${DEFAULT_SETTINGS.languageConfigPath}`;
    }
    return `${this.manifest.dir}/${configuredPath.replace(/\\/g, "/")}`;
  }

  private getPrism(): PrismLike | null {
    const prism = (window as Window & { Prism?: PrismLike }).Prism;
    return prism ?? null;
  }
}

class CustomCodeHighlightSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: CustomCodeHighlightPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Custom Code Highlight" });

    new Setting(containerEl)
      .setName("Language config file")
      .setDesc("JSON file inside this plugin folder. Use languages.example.json as a starting point.")
      .addText((text) => text
        .setPlaceholder("languages.json")
        .setValue(this.plugin.settings.languageConfigPath)
        .onChange(async (value) => {
          this.plugin.settings.languageConfigPath = value.trim() || DEFAULT_SETTINGS.languageConfigPath;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Built-in language highlighting")
      .setDesc("Registers built-in language definitions for wasm/wat, Zig, Nix, HCL/Terraform, Kusto/KQL, AutoHotkey, GDScript, MLIR, and Lean.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.includeBuiltInLanguages)
        .onChange(async (value) => {
          this.plugin.settings.includeBuiltInLanguages = value;
          await this.plugin.saveSettings();
          await this.plugin.registerLanguages();
        }));

    new Setting(containerEl)
      .setName("Reload languages")
      .setDesc("Reloads the configured language file and refreshes visible code blocks.")
      .addButton((button) => button
        .setButtonText("Reload")
        .onClick(async () => {
          await this.plugin.registerLanguages();
          new Notice("Custom highlight languages reloaded.");
        }));
  }
}
