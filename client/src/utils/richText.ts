import TurndownService from "turndown";

const htmlPattern = /<\/?[a-z][\s\S]*>/i;
const turndown = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  headingStyle: "atx",
});

export function looksLikeHtml(value: string) {
  return htmlPattern.test(value);
}

export function legacyHtmlToMarkdown(value: string) {
  if (!looksLikeHtml(value)) return value;
  return turndown.turndown(value).trim();
}

export function richTextToPlainText(value: string) {
  const markdown = legacyHtmlToMarkdown(value);
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
