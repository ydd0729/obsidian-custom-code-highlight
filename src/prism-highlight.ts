import { findParserTokenRanges } from "./parser-highlight";
import { bundledPrism } from "./prism";
import { renderTokenRanges } from "./token-ranges";
import type { LanguageConfig, PrismGrammar, RuntimeLanguage, TokenRange } from "./types";

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

export function createPrismGrammar(language: LanguageConfig): PrismGrammar {
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

export function hasNativeBundledPrismGrammar(ids: string[], registeredLanguageIds: Set<string>): boolean {
  return ids.some((id) => bundledPrism.languages[id] && !registeredLanguageIds.has(id));
}

export function registerPrismGrammar(ids: string[], grammar: PrismGrammar, registeredLanguageIds: Set<string>): void {
  for (const id of ids) {
    bundledPrism.languages[id] = grammar;
    registeredLanguageIds.add(id);
  }
}

export function unregisterPrismGrammars(registeredLanguageIds: Set<string>): void {
  for (const id of registeredLanguageIds) {
    delete bundledPrism.languages[id];
  }
  registeredLanguageIds.clear();
}

export function highlightWithBundledPrism(
  element: Element,
  language: RuntimeLanguage,
  registeredLanguageIds: Set<string>
): boolean {
  const prismLanguageId = language.ids.find((id) => (
    bundledPrism.languages[id] && !registeredLanguageIds.has(id)
  ));
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

export function highlightWithParser(element: Element, text: string, language: RuntimeLanguage): boolean {
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
  renderTokenRanges(element, text, ranges);
  return true;
}

export function findPrismTokenRanges(text: string, language: RuntimeLanguage): TokenRange[] {
  const prismLanguageId = language.ids.find((id) => bundledPrism.languages[id]);
  if (!prismLanguageId) {
    return [];
  }

  const grammar = bundledPrism.languages[prismLanguageId];
  const stream = bundledPrism.tokenize(text, grammar) as PrismTokenStream;
  const ranges: TokenRange[] = [];
  collectPrismTokenRanges(stream, 0, ranges);
  return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
}

function collectPrismTokenRanges(content: PrismTokenContent, offset: number, ranges: TokenRange[]): number {
  if (typeof content === "string") {
    return offset + content.length;
  }

  if (Array.isArray(content)) {
    let currentOffset = offset;
    for (const item of content) {
      currentOffset = collectPrismTokenRanges(item, currentOffset, ranges);
    }
    return currentOffset;
  }

  const start = offset;
  const nestedCount = ranges.length;
  const end = collectPrismTokenRanges(content.content, offset, ranges);
  const editorTokenName = PRISM_TO_EDITOR_TOKEN_NAMES[content.type];

  if (editorTokenName && ranges.length === nestedCount && end > start) {
    ranges.push({ start, end, name: editorTokenName });
  }

  return end;
}
