import type { MarkdownPostProcessorContext } from "obsidian";
import { findTokenRanges, renderTokenRanges } from "./token-ranges";
import { highlightWithBundledPrism, highlightWithParser } from "./prism-highlight";
import type { RuntimeLanguage } from "./types";

export function highlightCodeBlocks(
  root: ParentNode,
  runtimeLanguages: RuntimeLanguage[],
  registeredLanguageIds: Set<string>
): void {
  for (const code of findCodeElements(root)) {
    const language = getRuntimeLanguageForCodeElement(code, runtimeLanguages);
    if (language) {
      highlightCodeElement(code, language, registeredLanguageIds);
    }
  }
}

export function highlightRenderedCodeBlocks(
  root: ParentNode,
  context: MarkdownPostProcessorContext,
  runtimeLanguages: RuntimeLanguage[],
  registeredLanguageIds: Set<string>
): void {
  for (const code of findCodeElements(root)) {
    const language = getRuntimeLanguageForCodeElement(code, runtimeLanguages)
      ?? getRuntimeLanguageFromSection(code, context, runtimeLanguages);
    if (language) {
      highlightCodeElement(code, language, registeredLanguageIds);
    }
  }
}

function highlightCodeElement(
  element: Element,
  language: RuntimeLanguage,
  registeredLanguageIds: Set<string>
): void {
  if (element.hasClass("extended-code-highlight")) {
    if (element.querySelector(".token")) {
      return;
    }
    element.removeClass("extended-code-highlight");
    element.removeAttribute("data-extended-code-highlighted");
  }

  const text = element.textContent ?? "";
  if (!text) {
    return;
  }

  if (language.preferPrism && highlightWithBundledPrism(element, language, registeredLanguageIds)) {
    return;
  }

  if (language.parserLanguage && highlightWithParser(element, text, language)) {
    return;
  }

  if (!language.matchers) {
    return;
  }

  element.empty();
  element.addClass("extended-code-highlight");
  element.setAttr("data-extended-code-highlighted", "true");
  renderTokenRanges(element, text, findTokenRanges(text, language.matchers));
}

function findCodeElements(root: ParentNode): HTMLElement[] {
  const elements: HTMLElement[] = [];

  if (root instanceof HTMLElement && root.matches("pre > code, code[class*='language-']")) {
    elements.push(root);
  }

  root.querySelectorAll("pre > code, code[class*='language-']").forEach((element) => {
    if (element instanceof HTMLElement) {
      elements.push(element);
    }
  });

  return elements;
}

function getRuntimeLanguageForCodeElement(
  element: HTMLElement,
  runtimeLanguages: RuntimeLanguage[]
): RuntimeLanguage | null {
  const classNames = [
    ...Array.from(element.classList),
    ...Array.from(element.parentElement?.classList ?? [])
  ];

  for (const className of classNames) {
    const match = className.match(/^language-(.+)$/);
    if (!match) {
      continue;
    }

    const language = getRuntimeLanguage(match[1], runtimeLanguages);
    if (language) {
      return language;
    }
  }

  return null;
}

function getRuntimeLanguageFromSection(
  element: HTMLElement,
  context: MarkdownPostProcessorContext,
  runtimeLanguages: RuntimeLanguage[]
): RuntimeLanguage | null {
  const section = context.getSectionInfo(element);
  if (!section) {
    return null;
  }

  const opening = section.text.match(/^\s*(`{3,}|~{3,})\s*([^\s`~]+)/);
  if (!opening) {
    return null;
  }

  return runtimeLanguages.find((language) => language.idPattern.test(opening[2])) ?? null;
}

function getRuntimeLanguage(id: string, runtimeLanguages: RuntimeLanguage[]): RuntimeLanguage | null {
  const normalizedId = id.toLowerCase();
  return runtimeLanguages.find((language) => language.normalizedIds.has(normalizedId)) ?? null;
}
