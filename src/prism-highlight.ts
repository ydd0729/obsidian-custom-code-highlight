import { findParserTokenRanges } from "./parser-highlight";
import { bundledPrism } from "./prism";
import { renderTokenRanges } from "./token-ranges";
import type { LanguageConfig, PrismGrammar, RuntimeLanguage, TokenRange } from "./types";

const PRISM_TO_EDITOR_TOKEN_NAMES: Record<string, string> = {
  annotation: "keyword",
  atrule: "atrule",
  attrName: "property",
  "attr-name": "attribute",
  "attr-value": "string",
  boolean: "boolean",
  bold: "keyword",
  builtin: "builtin",
  cdata: "comment",
  char: "string",
  "class-name": "type",
  comment: "comment",
  constant: "constant",
  deleted: "comment",
  directive: "directive",
  doctype: "comment",
  entity: "builtin",
  function: "function",
  "function-variable": "function",
  hashbang: "comment",
  important: "keyword",
  inserted: "string",
  interpolation: "string",
  "interpolation-punctuation": "operator",
  italic: "keyword",
  keyword: "keyword",
  namespace: "namespace",
  number: "number",
  operator: "operator",
  parameter: "parameter",
  prolog: "comment",
  property: "property",
  punctuation: "punctuation",
  regex: "string",
  rule: "atrule",
  selector: "selector",
  shebang: "comment",
  string: "string",
  symbol: "constant",
  tag: "tag",
  unit: "number",
  url: "string",
  variable: "variable"
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
  const html = bundledPrism.highlight(text, grammar, prismLanguageId);
  return findPrismTokenRangesFromHighlightedHtml(html);
}

function findPrismTokenRangesFromHighlightedHtml(html: string): TokenRange[] {
  const template = document.createElement("template");
  template.innerHTML = html;

  const ranges: TokenRange[] = [];
  let offset = 0;

  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length ?? 0;
      return;
    }

    if (!(node instanceof Element)) {
      node.childNodes.forEach(visit);
      return;
    }

    const editorTokenName = node.classList.contains("token")
      ? getEditorTokenNameFromPrismClasses(node.classList)
      : null;
    const start = offset;

    node.childNodes.forEach(visit);

    if (editorTokenName && offset > start) {
      ranges.push({ start, end: offset, name: editorTokenName });
    }
  };

  template.content.childNodes.forEach(visit);
  return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
}

function getEditorTokenNameFromPrismClasses(classList: DOMTokenList): string | null {
  for (const className of Array.from(classList)) {
    const editorTokenName = getEditorTokenName(className);
    if (editorTokenName) {
      return editorTokenName;
    }
  }

  return null;
}

function getEditorTokenName(tokenName: string): string | null {
  return PRISM_TO_EDITOR_TOKEN_NAMES[tokenName] ?? null;
}
