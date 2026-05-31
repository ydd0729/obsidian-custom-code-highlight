import type { LanguageConfig, TokenMatcher, TokenRange } from "./types";

const OBSIDIAN_EDITOR_TOKEN_CLASSES: Record<string, string> = {
  comment: "cm-comment",
  string: "cm-string",
  keyword: "cm-keyword",
  builtin: "cm-atom",
  number: "cm-number",
  variable: "cm-variable-2",
  function: "cm-def",
  property: "cm-property",
  operator: "cm-operator"
};

export function createTokenMatchers(language: LanguageConfig): TokenMatcher[] {
  return (language.tokens ?? []).map((token) => ({
    name: token.name,
    pattern: new RegExp(token.pattern, withGlobalFlag(token.flags ?? ""))
  }));
}

export function findTokenRanges(text: string, matchers: TokenMatcher[]): TokenRange[] {
  const ranges: TokenRange[] = [];
  const occupied = new Array<boolean>(text.length).fill(false);

  for (const matcher of matchers) {
    matcher.pattern.lastIndex = 0;

    for (const match of text.matchAll(matcher.pattern)) {
      const start = match.index ?? 0;
      const value = match[0];
      const end = start + value.length;

      if (!value || hasOverlap(occupied, start, end)) {
        continue;
      }

      ranges.push({ start, end, name: matcher.name });
      for (let i = start; i < end; i += 1) {
        occupied[i] = true;
      }
    }
  }

  return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
}

export function renderTokenRanges(element: Element, text: string, ranges: TokenRange[]): void {
  let offset = 0;

  for (const range of ranges) {
    if (range.start > offset) {
      element.appendText(text.slice(offset, range.start));
    }

    const tokenEl = element.createSpan({
      cls: `token ${range.name}`,
      text: text.slice(range.start, range.end)
    });
    tokenEl.setAttr("data-token", range.name);
    offset = range.end;
  }

  if (offset < text.length) {
    element.appendText(text.slice(offset));
  }
}

export function getEditorTokenClass(tokenName: string): string {
  const nativeClass = OBSIDIAN_EDITOR_TOKEN_CLASSES[tokenName];
  return [
    "extended-code-highlight-editor-token",
    `extended-code-highlight-editor-${tokenName}`,
    "cm-hmd-codeblock",
    nativeClass
  ].filter(Boolean).join(" ");
}

function withGlobalFlag(flags: string): string {
  return flags.includes("g") ? flags : `${flags}g`;
}

function hasOverlap(occupied: boolean[], start: number, end: number): boolean {
  for (let i = start; i < end; i += 1) {
    if (occupied[i]) {
      return true;
    }
  }
  return false;
}
