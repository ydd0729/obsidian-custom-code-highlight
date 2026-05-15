import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";

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

    this.registerMarkdownPostProcessor((element) => {
      const prism = this.getPrism();
      if (prism) {
        this.highlightCodeBlocks(prism, element);
      }
    });

    await this.ensureExampleConfig();
    await this.registerLanguages();
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
    if (!prism) {
      new Notice("Prism is not available in this Obsidian window.");
      return;
    }

    this.unregisterLanguages();

    const languages = await this.loadLanguageConfigs();
    for (const language of languages) {
      const grammar = this.createGrammar(language);
      const ids = [language.id, ...(language.aliases ?? [])];
      for (const id of ids) {
        prism.languages[id] = grammar;
        this.registeredLanguageIds.add(id);
      }
    }

    this.highlightVisibleCodeBlocks(prism);
  }

  private unregisterLanguages(): void {
    const prism = this.getPrism();
    if (!prism) {
      this.registeredLanguageIds.clear();
      return;
    }

    for (const id of this.registeredLanguageIds) {
      delete prism.languages[id];
    }
    this.registeredLanguageIds.clear();
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

  private highlightVisibleCodeBlocks(prism: PrismLike): void {
    this.highlightCodeBlocks(prism, document);
  }

  private highlightCodeBlocks(prism: PrismLike, root: ParentNode): void {
    if (!prism.highlightElement) {
      return;
    }

    for (const id of this.registeredLanguageIds) {
      const selector = `code.language-${CSS.escape(id)}, code[class*="language-${CSS.escape(id)}"]`;
      root.querySelectorAll(selector).forEach((element) => prism.highlightElement?.(element));
    }
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
