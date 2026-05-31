import { RangeSetBuilder, Text } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { findParserTokenRanges } from "./parser-highlight";
import { findPrismTokenRanges } from "./prism-highlight";
import { findTokenRanges, getEditorTokenClass } from "./token-ranges";
import type { RuntimeLanguage, TokenRange } from "./types";

export function createEditorExtension(getRuntimeLanguages: () => RuntimeLanguage[]) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildEditorDecorations(view, getRuntimeLanguages());
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildEditorDecorations(update.view, getRuntimeLanguages());
      }
    }
  }, {
    decorations: (value) => value.decorations
  });
}

function buildEditorDecorations(view: EditorView, runtimeLanguages: RuntimeLanguage[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  if (runtimeLanguages.length === 0) {
    return builder.finish();
  }

  for (const { from, to } of mergeRanges(view.visibleRanges)) {
    buildEditorDecorationsForRange(view, builder, from, to, runtimeLanguages);
  }

  return builder.finish();
}

function buildEditorDecorationsForRange(
  view: EditorView,
  builder: RangeSetBuilder<Decoration>,
  from: number,
  to: number,
  runtimeLanguages: RuntimeLanguage[]
): void {
  const doc = view.state.doc;
  let lineNumber = findFenceSearchStartLine(doc, from);
  const endLineNumber = doc.lineAt(to).number;

  while (lineNumber <= endLineNumber) {
    const openingLine = doc.line(lineNumber);
    const opening = openingLine.text.match(/^(\s*)(`{3,}|~{3,})\s*([^\s`~]+)/);

    if (!opening) {
      lineNumber += 1;
      continue;
    }

    const fence = opening[2];
    const language = runtimeLanguages.find((candidate) => candidate.idPattern.test(opening[3]));

    if (!language) {
      lineNumber += 1;
      continue;
    }

    let closingLineNumber = lineNumber + 1;
    while (closingLineNumber <= doc.lines) {
      const candidateLine = doc.line(closingLineNumber);
      if (isClosingFence(candidateLine.text, fence)) {
        break;
      }
      closingLineNumber += 1;
    }

    const contentStartLineNumber = lineNumber + 1;
    const hasClosingFence = closingLineNumber <= doc.lines;
    const contentEndLineNumber = hasClosingFence ? closingLineNumber - 1 : doc.lines;

    if (contentStartLineNumber <= contentEndLineNumber) {
      addTokenDecorations(view, builder, from, to, language, contentStartLineNumber, contentEndLineNumber);
    }

    lineNumber = hasClosingFence ? closingLineNumber + 1 : doc.lines + 1;
  }
}

function addTokenDecorations(
  view: EditorView,
  builder: RangeSetBuilder<Decoration>,
  from: number,
  to: number,
  language: RuntimeLanguage,
  contentStartLineNumber: number,
  contentEndLineNumber: number
): void {
  const doc = view.state.doc;
  const contentStart = doc.line(contentStartLineNumber).from;
  const contentEnd = doc.line(contentEndLineNumber).to;
  const visibleContentStart = Math.max(contentStart, from);
  const visibleContentEnd = Math.min(contentEnd, to);

  if (visibleContentStart > visibleContentEnd) {
    return;
  }

  const source = doc.sliceString(contentStart, contentEnd);
  const ranges = findEditorTokenRanges(source, language);

  for (const range of ranges) {
    const decorationStart = contentStart + range.start;
    const decorationEnd = contentStart + range.end;
    if (decorationEnd < from || decorationStart > to) {
      continue;
    }

    builder.add(
      decorationStart,
      decorationEnd,
      Decoration.mark({
        class: getEditorTokenClass(range.name)
      })
    );
  }
}

function findEditorTokenRanges(text: string, language: RuntimeLanguage): TokenRange[] {
  if (language.parserLanguage) {
    return findParserTokenRanges(text, language.parserLanguage);
  }
  if (language.preferPrism) {
    const ranges = findPrismTokenRanges(text, language);
    if (ranges.length > 0) {
      return ranges;
    }
  }
  if (!language.matchers) {
    return [];
  }
  return findTokenRanges(text, language.matchers);
}

function mergeRanges(ranges: readonly { from: number; to: number }[]): { from: number; to: number }[] {
  const merged: { from: number; to: number }[] = [];

  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.from <= previous.to) {
      previous.to = Math.max(previous.to, range.to);
    } else {
      merged.push({ from: range.from, to: range.to });
    }
  }

  return merged;
}

function findFenceSearchStartLine(doc: Text, from: number): number {
  let lineNumber = doc.lineAt(from).number;

  while (lineNumber > 1) {
    const line = doc.line(lineNumber);
    if (/^\s*(`{3,}|~{3,})/.test(line.text)) {
      return lineNumber;
    }
    lineNumber -= 1;
  }

  return 1;
}

function isClosingFence(text: string, openingFence: string): boolean {
  const fenceChar = openingFence[0];
  const minLength = openingFence.length;
  const pattern = new RegExp(`^\\s*\\${fenceChar}{${minLength},}\\s*$`);
  return pattern.test(text);
}
