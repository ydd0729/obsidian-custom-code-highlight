import { RangeSetBuilder, Text } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { MarkdownPostProcessorContext, Notice, Plugin } from "obsidian";
import { BUILT_IN_LANGUAGES } from "./src/languages";
import { findParserTokenRanges } from "./src/parser-highlight";
import { bundledPrism } from "./src/prism";
import { ExtendedCodeHighlightSettingTab } from "./src/settings-tab";
import {
  DEFAULT_SETTINGS
} from "./src/types";
import type {
  LanguageConfig,
  LanguagesFile,
  PluginSettings,
  PrismGrammar,
  RuntimeLanguage,
  TokenMatcher,
  TokenRange
} from "./src/types";

const LANGUAGE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const TOKEN_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const VALID_REGEXP_FLAGS = /^[dgimsuvy]*$/;
const OBSIDIAN_EDITOR_TOKEN_CLASSES: Record<string, string> = {
  comment: "cm-comment",
  string: "cm-string",
  keyword: "cm-keyword",
  builtin: "cm-atom",
  number: "cm-number",
  variable: "cm-variable-2",
  function: "cm-def",
  property: "cm-property",
  operator: "cm-operator"
};
const PRISM_TO_EDITOR_TOKEN_NAMES: Record<string, string> = {
  attrName: "property",
  "attr-name": "property",
  "attr-value": "string",
  boolean: "keyword",
  builtin: "builtin",
  cdata: "comment",
  char: "string",
  "class-name": "variable",
  comment: "comment",
  constant: "builtin",
  doctype: "comment",
  function: "function",
  keyword: "keyword",
  namespace: "property",
  number: "number",
  operator: "operator",
  parameter: "variable",
  prolog: "comment",
  property: "property",
  punctuation: "operator",
  regex: "string",
  selector: "property",
  string: "string",
  symbol: "builtin",
  tag: "property",
  variable: "variable"
};

type PrismTokenStream = Array<string | PrismTokenLike>;
type PrismTokenContent = string | PrismTokenLike | PrismTokenStream;

type PrismTokenLike = {
  type: string;
  content: PrismTokenContent;
};

export default class ExtendedCodeHighlightPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  private registeredLanguageIds = new Set<string>();
  private runtimeLanguages: RuntimeLanguage[] = [];

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new ExtendedCodeHighlightSettingTab(this.app, this));

    this.addCommand({
      id: "reload-extended-highlight-languages",
      name: "Reload extended highlight languages",
      callback: async () => {
        await this.registerLanguages();
        new Notice("Extended highlight languages reloaded.");
      }
    });

    this.registerMarkdownPostProcessor((element, context) => {
      this.highlightRenderedCodeBlocks(element, context);
      window.setTimeout(() => {
        this.highlightRenderedCodeBlocks(element, context);
      }, 50);
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
    this.unregisterLanguages();

    const languages = await this.loadLanguageConfigs();
    for (const language of languages) {
      const ids = [language.id, ...(language.aliases ?? [])];
      const matchers = language.tokens ? this.createTokenMatchers(language) : undefined;

      this.runtimeLanguages.push({
        ids,
        normalizedIds: new Set(ids.map((id) => id.toLowerCase())),
        idPattern: this.createLanguageIdPattern(ids),
        matchers,
        parserLanguage: language.isCustom ? undefined : language.parserLanguage,
        isCustom: language.isCustom ?? false,
        preferPrism: !language.isCustom && language.preferPrism === true
      });

      const shouldRegisterRegexPrismGrammar = language.tokens
        && (!language.preferPrism || !this.hasNativeBundledPrismGrammar(ids));
      if (shouldRegisterRegexPrismGrammar) {
        const grammar = this.createGrammar(language);
        for (const id of ids) {
          bundledPrism.languages[id] = grammar;
          this.registeredLanguageIds.add(id);
        }
      }
    }

    this.highlightVisibleCodeBlocks();
  }

  private unregisterLanguages(): void {
    for (const id of this.registeredLanguageIds) {
      delete bundledPrism.languages[id];
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
        languages.push({ ...this.validateLanguage(language), isCustom: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`Skipped extended highlight language: ${message}`);
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
    for (const token of language.tokens ?? []) {
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

    for (const token of language.tokens ?? []) {
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
    return (language.tokens ?? []).map((token) => ({
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
    if (element.hasClass("extended-code-highlight")) {
      if (element.querySelector(".token")) {
        return;
      }
      element.removeClass("extended-code-highlight");
      element.removeAttribute("data-extended-code-highlighted");
    }

    const text = element.textContent ?? "";
    if (!text) {
      return;
    }

    if (language.preferPrism && this.highlightWithBundledPrism(element, language)) {
      return;
    }

    if (language.parserLanguage && this.highlightWithParser(element, text, language)) {
      return;
    }

    if (!language.matchers) {
      return;
    }

    element.empty();
    element.addClass("extended-code-highlight");
    element.setAttr("data-extended-code-highlighted", "true");
    this.renderHighlightedText(element, text, language);
  }

  private renderHighlightedText(element: Element, text: string, language: RuntimeLanguage): void {
    if (!language.matchers) {
      return;
    }

    const ranges = this.findTokenRanges(text, language.matchers);
    this.renderTokenRanges(element, text, ranges);
  }

  private renderTokenRanges(element: Element, text: string, ranges: TokenRange[]): void {
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
        const ranges = this.findEditorTokenRanges(source, language);

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
              class: this.getEditorTokenClass(range.name)
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

  private hasNativeBundledPrismGrammar(ids: string[]): boolean {
    return ids.some((id) => bundledPrism.languages[id] && !this.registeredLanguageIds.has(id));
  }

  private highlightWithBundledPrism(element: Element, language: RuntimeLanguage): boolean {
    const prismLanguageId = language.ids.find((id) => bundledPrism.languages[id] && !this.registeredLanguageIds.has(id));
    if (!prismLanguageId) {
      return false;
    }

    const text = element.textContent ?? "";
    const grammar = bundledPrism.languages[prismLanguageId];
    element.addClass("extended-code-highlight");
    element.setAttr("data-extended-code-highlighted", "true");
    element.empty();
    element.innerHTML = bundledPrism.highlight(text, grammar, prismLanguageId);
    return true;
  }

  private highlightWithParser(element: Element, text: string, language: RuntimeLanguage): boolean {
    if (!language.parserLanguage) {
      return false;
    }

    const ranges = findParserTokenRanges(text, language.parserLanguage);
    if (ranges.length === 0) {
      return false;
    }

    element.empty();
    element.addClass("extended-code-highlight");
    element.setAttr("data-extended-code-highlighted", "true");
    this.renderTokenRanges(element, text, ranges);
    return true;
  }

  private findEditorTokenRanges(text: string, language: RuntimeLanguage): TokenRange[] {
    if (language.parserLanguage) {
      return findParserTokenRanges(text, language.parserLanguage);
    }
    if (language.preferPrism) {
      const ranges = this.findPrismTokenRanges(text, language);
      if (ranges.length > 0) {
        return ranges;
      }
    }
    if (!language.matchers) {
      return [];
    }
    return this.findTokenRanges(text, language.matchers);
  }

  private findPrismTokenRanges(text: string, language: RuntimeLanguage): TokenRange[] {
    const prismLanguageId = language.ids.find((id) => bundledPrism.languages[id]);
    if (!prismLanguageId) {
      return [];
    }

    const grammar = bundledPrism.languages[prismLanguageId];
    const stream = bundledPrism.tokenize(text, grammar) as PrismTokenStream;
    const ranges: TokenRange[] = [];
    this.collectPrismTokenRanges(stream, 0, ranges);
    return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
  }

  private collectPrismTokenRanges(content: PrismTokenContent, offset: number, ranges: TokenRange[]): number {
    if (typeof content === "string") {
      return offset + content.length;
    }

    if (Array.isArray(content)) {
      let currentOffset = offset;
      for (const item of content) {
        currentOffset = this.collectPrismTokenRanges(item, currentOffset, ranges);
      }
      return currentOffset;
    }

    const start = offset;
    const nestedCount = ranges.length;
    const end = this.collectPrismTokenRanges(content.content, offset, ranges);
    const editorTokenName = PRISM_TO_EDITOR_TOKEN_NAMES[content.type];

    if (editorTokenName && ranges.length === nestedCount && end > start) {
      ranges.push({ start, end, name: editorTokenName });
    }

    return end;
  }

  private getEditorTokenClass(tokenName: string): string {
    const nativeClass = OBSIDIAN_EDITOR_TOKEN_CLASSES[tokenName];
    return [
      "extended-code-highlight-editor-token",
      `extended-code-highlight-editor-${tokenName}`,
      "cm-hmd-codeblock",
      nativeClass
    ].filter(Boolean).join(" ");
  }
}
