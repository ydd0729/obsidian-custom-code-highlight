import { Language } from "@codemirror/language";
import { highlightTree, tagHighlighter, tags } from "@lezer/highlight";
import type { TokenRange } from "./types";

const PARSER_HIGHLIGHTER = tagHighlighter([
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], class: "comment" },
  { tag: [tags.string, tags.docString, tags.character, tags.attributeValue, tags.regexp], class: "string" },
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword, tags.operatorKeyword], class: "keyword" },
  { tag: tags.bool, class: "boolean" },
  { tag: [tags.atom, tags.null], class: "constant" },
  { tag: tags.unit, class: "unit" },
  { tag: tags.standard(tags.variableName), class: "builtin" },
  { tag: [tags.number, tags.integer, tags.float], class: "number" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], class: "function" },
  { tag: tags.propertyName, class: "property" },
  { tag: tags.attributeName, class: "attr-name" },
  { tag: tags.tagName, class: "tag" },
  { tag: [tags.className, tags.typeName], class: "class-name" },
  { tag: [tags.variableName, tags.labelName, tags.namespace, tags.macroName], class: "variable" },
  { tag: [tags.operator, tags.derefOperator, tags.arithmeticOperator, tags.logicOperator, tags.bitwiseOperator, tags.compareOperator, tags.updateOperator, tags.definitionOperator, tags.typeOperator, tags.controlOperator], class: "operator" },
  { tag: [tags.punctuation, tags.bracket, tags.angleBracket, tags.squareBracket, tags.paren, tags.brace, tags.separator], class: "punctuation" }
]);

const TOKEN_CLASS_NAMES = new Set([
  "attr-name",
  "boolean",
  "builtin",
  "class-name",
  "comment",
  "constant",
  "function",
  "keyword",
  "number",
  "operator",
  "property",
  "punctuation",
  "string",
  "tag",
  "unit",
  "variable"
]);

export function findParserTokenRanges(text: string, language: Language): TokenRange[] {
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
