import { RangeSetBuilder } from "@codemirror/state";
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
  includeBuiltInWasm: boolean;
};

const DEFAULT_SETTINGS: PluginSettings = {
  languageConfigPath: "languages.json",
  includeBuiltInWasm: true
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
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

    if (this.settings.includeBuiltInWasm) {
      languages.push(WASM_LANGUAGE);
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
    return this.runtimeLanguages.find((language) => language.ids.includes(id)) ?? null;
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

    const doc = view.state.doc;
    let lineNumber = 1;

    while (lineNumber <= doc.lines) {
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
        const source = doc.sliceString(contentStart, contentEnd);
        const ranges = this.findTokenRanges(source, language.matchers);

        for (const range of ranges) {
          builder.add(
            contentStart + range.start,
            contentStart + range.end,
            Decoration.mark({
              class: `custom-code-highlight-editor-token custom-code-highlight-editor-${range.name}`
            })
          );
        }
      }

      lineNumber = hasClosingFence ? closingLineNumber + 1 : doc.lines + 1;
    }

    return builder.finish();
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
      .setName("Built-in WebAssembly highlighting")
      .setDesc("Registers wasm, wat, wast, and webassembly code fences.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.includeBuiltInWasm)
        .onChange(async (value) => {
          this.plugin.settings.includeBuiltInWasm = value;
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
