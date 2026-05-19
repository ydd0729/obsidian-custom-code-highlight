import { LRLanguage } from "@codemirror/language";
import { highlightTree, tagHighlighter, tags } from "@lezer/highlight";
import type { TokenRange } from "./types";

const PARSER_HIGHLIGHTER = tagHighlighter([
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], class: "comment" },
  { tag: [tags.string, tags.docString, tags.character, tags.attributeValue, tags.regexp], class: "string" },
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword, tags.operatorKeyword], class: "keyword" },
  { tag: [tags.atom, tags.bool, tags.null, tags.unit, tags.standard(tags.variableName)], class: "builtin" },
  { tag: [tags.number, tags.integer, tags.float], class: "number" },
  { tag: [tags.variableName, tags.labelName, tags.namespace, tags.macroName], class: "variable" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], class: "function" },
  { tag: [tags.propertyName, tags.attributeName, tags.tagName, tags.className, tags.typeName], class: "property" },
  { tag: [tags.operator, tags.derefOperator, tags.arithmeticOperator, tags.logicOperator, tags.bitwiseOperator, tags.compareOperator, tags.updateOperator, tags.definitionOperator, tags.typeOperator, tags.controlOperator, tags.punctuation, tags.bracket, tags.angleBracket, tags.squareBracket, tags.paren, tags.brace, tags.separator], class: "operator" }
]);

const TOKEN_CLASS_NAMES = new Set([
  "comment",
  "string",
  "keyword",
  "builtin",
  "number",
  "variable",
  "function",
  "property",
  "operator"
]);

export function findParserTokenRanges(text: string, language: LRLanguage): TokenRange[] {
  const ranges: TokenRange[] = [];
  const tree = language.parser.parse(text);

  highlightTree(tree, PARSER_HIGHLIGHTER, (start, end, classes) => {
    const tokenName = getTokenNameFromClasses(classes);
    if (tokenName && start < end) {
      ranges.push({ start, end, name: tokenName });
    }
  });

  return ranges;
}

function getTokenNameFromClasses(classes: string): string | null {
  return classes.split(/\s+/).find((className) => TOKEN_CLASS_NAMES.has(className)) ?? null;
}
