import type { Span } from "./highlight";

export const formatSnippet = (source: string, start: number, end: number) => {
  const compact = source
    .slice(start, end)
    .replaceAll("\n", " ")
    .replaceAll("\r", " ")
    .replaceAll("\t", " ")
    .trim();
  return compact.length > 80 ? `${compact.slice(0, 77)}…` : compact;
};

export const rangesEqual = (a: Span, b: Span) =>
  a.start === b.start && a.end === b.end;

export const spanKey = (span: Span) => `${span.start}-${span.end}`;
