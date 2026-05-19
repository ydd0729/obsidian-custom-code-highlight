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
      .setDesc("Registers built-in language definitions for wasm/wat, Zig, Nix, HCL/Terraform, Kusto/KQL, AutoHotkey, GDScript, MLIR, Lean, Angular, Vue, Liquid, Less, Sass/SCSS, and Svelte.")
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
