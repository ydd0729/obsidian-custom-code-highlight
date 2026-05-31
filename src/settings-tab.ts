import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ExtendedCodeHighlightPlugin from "../main";
import { DEFAULT_SETTINGS } from "./types";

export class ExtendedCodeHighlightSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ExtendedCodeHighlightPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Extended Code Highlight" });

    new Setting(containerEl)
      .setName("Language config path")
      .setDesc("JSON file or folder inside this plugin folder. The default folder is languages.")
      .addText((text) => text
        .setPlaceholder("languages")
        .setValue(this.plugin.settings.languageConfigPath)
        .onChange(async (value) => {
          this.plugin.settings.languageConfigPath = value.trim() || DEFAULT_SETTINGS.languageConfigPath;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("Built-in language highlighting")
      .setDesc("Registers bundled PrismJS and CodeMirror language support. Regex JSON files are loaded from the configured language path.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.includeBuiltInLanguages)
        .onChange(async (value) => {
          this.plugin.settings.includeBuiltInLanguages = value;
          await this.plugin.saveSettings();
          await this.plugin.registerLanguages();
        }));

    new Setting(containerEl)
      .setName("Reload languages")
      .setDesc("Reloads built-in and configured language definitions, then refreshes visible code blocks.")
      .addButton((button) => button
        .setButtonText("Reload")
        .onClick(async () => {
          await this.plugin.registerLanguages();
          new Notice("Extended highlight languages reloaded.");
        }));
  }
}
