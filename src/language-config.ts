import { Notice } from "obsidian";
import { createTokenMatchers } from "./token-ranges";
import { DEFAULT_SETTINGS } from "./types";
import type { LanguageConfig, LanguagesFile, PluginSettings, RuntimeLanguage } from "./types";

const LANGUAGE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const TOKEN_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const VALID_REGEXP_FLAGS = /^[dgimsuvy]*$/;

type VaultAdapter = {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  list(path: string): Promise<{ files: string[]; folders: string[] }>;
};

type LoadLanguageConfigOptions = {
  adapter: VaultAdapter;
  pluginDir: string;
  settings: PluginSettings;
  builtInLanguages: LanguageConfig[];
};

export async function loadLanguageConfigs(options: LoadLanguageConfigOptions): Promise<LanguageConfig[]> {
  const languages: LanguageConfig[] = [];

  if (options.settings.includeBuiltInLanguages) {
    languages.push(...options.builtInLanguages);
  }

  const config = await readConfiguredLanguages(options);
  for (const language of config.languages ?? []) {
    try {
      languages.push({ ...validateLanguage(language), isCustom: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Skipped extended highlight language: ${message}`);
    }
  }

  return languages;
}

export function createRuntimeLanguage(language: LanguageConfig): RuntimeLanguage {
  const ids = [language.id, ...(language.aliases ?? [])];
  return {
    ids,
    normalizedIds: new Set(ids.map((id) => id.toLowerCase())),
    idPattern: createLanguageIdPattern(ids),
    matchers: language.tokens ? createTokenMatchers(language) : undefined,
    parserLanguage: language.isCustom ? undefined : language.parserLanguage,
    isCustom: language.isCustom ?? false,
    preferPrism: !language.isCustom && language.preferPrism === true
  };
}

export function getLanguageConfigPath(pluginDir: string, settings: PluginSettings): string {
  const configuredPath = settings.languageConfigPath.trim() || DEFAULT_SETTINGS.languageConfigPath;
  if (configuredPath.includes(":") || configuredPath.startsWith("/") || configuredPath.startsWith("\\")) {
    return `${pluginDir}/languages`;
  }
  return `${pluginDir}/${configuredPath.replace(/\\/g, "/")}`;
}

async function readConfiguredLanguages(options: LoadLanguageConfigOptions): Promise<LanguagesFile> {
  const path = getLanguageConfigPath(options.pluginDir, options.settings);
  if (!(await options.adapter.exists(path))) {
    return {};
  }

  if (!path.toLowerCase().endsWith(".json")) {
    return readConfiguredLanguageDirectory(options.adapter, path, options.settings.languageConfigPath);
  }

  return readConfiguredLanguageFile(options.adapter, path);
}

async function readConfiguredLanguageDirectory(
  adapter: VaultAdapter,
  path: string,
  configuredPath: string
): Promise<LanguagesFile> {
  const languages: LanguageConfig[] = [];

  try {
    const listed = await adapter.list(path);
    const files = listed.files
      .filter((file) => file.toLowerCase().endsWith(".json"))
      .sort((left, right) => left.localeCompare(right));

    for (const file of files) {
      const config = await readConfiguredLanguageFile(adapter, file);
      languages.push(...(config.languages ?? []));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    new Notice(`Failed to load ${configuredPath}: ${message}`);
  }

  return { languages };
}

async function readConfiguredLanguageFile(adapter: VaultAdapter, path: string): Promise<LanguagesFile> {
  try {
    const raw = await adapter.read(path);
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("root must be an object");
    }
    return normalizeLanguagesFile(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    new Notice(`Failed to load ${path}: ${message}`);
    return {};
  }
}

function normalizeLanguagesFile(parsed: unknown): LanguagesFile {
  const object = parsed as Partial<LanguagesFile & LanguageConfig>;
  if (typeof object.id === "string" && Array.isArray(object.tokens)) {
    return { languages: [object as LanguageConfig] };
  }
  return parsed as LanguagesFile;
}

function validateLanguage(language: LanguageConfig): LanguageConfig {
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

function createLanguageIdPattern(ids: string[]): RegExp {
  const alternatives = ids.map((id) => escapeRegExp(id)).join("|");
  return new RegExp(`^\\s*(?:${alternatives})(?:\\s|$)`, "i");
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}
