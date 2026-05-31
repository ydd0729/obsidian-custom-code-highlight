import { Notice, Plugin } from "obsidian";
import { createEditorExtension } from "./src/editor-extension";
import { BUILT_IN_LANGUAGES } from "./src/languages";
import { createRuntimeLanguage, getLanguageConfigPath, loadLanguageConfigs } from "./src/language-config";
import {
  createPrismGrammar,
  hasNativeBundledPrismGrammar,
  registerPrismGrammar,
  unregisterPrismGrammars
} from "./src/prism-highlight";
import { highlightCodeBlocks, highlightRenderedCodeBlocks } from "./src/reading-highlight";
import { ExtendedCodeHighlightSettingTab } from "./src/settings-tab";
import { DEFAULT_SETTINGS } from "./src/types";
import type { PluginSettings, RuntimeLanguage } from "./src/types";

export default class ExtendedCodeHighlightPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS;
  private registeredLanguageIds = new Set<string>();
  private runtimeLanguages: RuntimeLanguage[] = [];

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new ExtendedCodeHighlightSettingTab(this.app, this));
    this.addReloadCommand();
    this.registerReadingViewHighlighting();

    await this.registerLanguages();
    this.registerEditorExtension(createEditorExtension(() => this.runtimeLanguages));
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

    const languages = await loadLanguageConfigs({
      adapter: this.app.vault.adapter,
      pluginDir: this.pluginDir,
      settings: this.settings,
      builtInLanguages: BUILT_IN_LANGUAGES
    });

    for (const language of languages) {
      const runtimeLanguage = createRuntimeLanguage(language);
      this.runtimeLanguages.push(runtimeLanguage);

      if (language.tokens && (!language.preferPrism || !hasNativeBundledPrismGrammar(runtimeLanguage.ids, this.registeredLanguageIds))) {
        registerPrismGrammar(
          runtimeLanguage.ids,
          createPrismGrammar(language),
          this.registeredLanguageIds
        );
      }
    }

    highlightCodeBlocks(document, this.runtimeLanguages, this.registeredLanguageIds);
  }

  getConfigPath(): string {
    return getLanguageConfigPath(this.pluginDir, this.settings);
  }

  private get pluginDir(): string {
    return this.manifest.dir ?? "";
  }

  private unregisterLanguages(): void {
    unregisterPrismGrammars(this.registeredLanguageIds);
    this.runtimeLanguages = [];
  }

  private addReloadCommand(): void {
    this.addCommand({
      id: "reload-extended-highlight-languages",
      name: "Reload extended highlight languages",
      callback: async () => {
        await this.registerLanguages();
        new Notice("Extended highlight languages reloaded.");
      }
    });
  }

  private registerReadingViewHighlighting(): void {
    this.registerMarkdownPostProcessor((element, context) => {
      highlightRenderedCodeBlocks(element, context, this.runtimeLanguages, this.registeredLanguageIds);
      window.setTimeout(() => {
        highlightRenderedCodeBlocks(element, context, this.runtimeLanguages, this.registeredLanguageIds);
      }, 50);
    });
  }
}
