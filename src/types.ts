import { Language } from "@codemirror/language";

export type PrismPattern = RegExp | {
  pattern: RegExp;
  lookbehind?: boolean;
  greedy?: boolean;
};

export type PrismGrammar = Record<string, PrismPattern | PrismPattern[]>;

export type PrismLike = {
  languages: Record<string, PrismGrammar>;
  hooks?: {
    run: (name: string, env: unknown) => void;
  };
  highlightElement?: (element: Element) => void;
};

export type TokenConfig = {
  name: string;
  pattern: string;
  flags?: string;
  lookbehind?: boolean;
  greedy?: boolean;
};

export type LanguageConfig = {
  id: string;
  aliases?: string[];
  tokens?: TokenConfig[];
  parserLanguage?: Language;
  preferPrism?: boolean;
  isCustom?: boolean;
};

export type LanguagesFile = {
  languages?: LanguageConfig[];
};

export type TokenMatcher = {
  name: string;
  pattern: RegExp;
};

export type RuntimeLanguage = {
  ids: string[];
  normalizedIds: Set<string>;
  idPattern: RegExp;
  matchers?: TokenMatcher[];
  parserLanguage?: Language;
  isCustom: boolean;
  preferPrism: boolean;
};

export type TokenRange = {
  start: number;
  end: number;
  name: string;
};

export type PluginSettings = {
  languageConfigPath: string;
  includeBuiltInLanguages: boolean;
};

export const DEFAULT_SETTINGS: PluginSettings = {
  languageConfigPath: "languages",
  includeBuiltInLanguages: true
};
