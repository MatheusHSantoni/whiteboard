import { MAX_TEXT_LENGTH, type TextMark } from "../../types/shapes";

const listKinds = {
  Digit7: { pattern: /^\d+\. /, prefix: (index: number) => `${index + 1}. ` },
  Digit8: { pattern: /^• /, prefix: () => "• " },
  Digit9: { pattern: /^[☐☑] /, prefix: () => "☐ " },
};

export function continueList(text: string, marks: TextMark[], start: number, end: number) {
  const first = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;
  const prefix = text.slice(first, start).match(/^(?:(\d+)\.|([•☐☑])) /);
  if (!prefix) return null;

  const marker = prefix[1] ? `${BigInt(prefix[1]) + 1n}.` : prefix[2] === "•" ? "•" : "☐";
  const insertion = `\n${marker} `;
  const next = text.slice(0, start) + insertion + text.slice(end);
  if (next.length > MAX_TEXT_LENGTH) return null;

  const caret = start + insertion.length;
  return {
    text: next,
    marks: marks.flatMap((mark) => {
      if (mark.index < start) return [mark];
      if (mark.index < end) return [];
      return [{ ...mark, index: mark.index + caret - end }];
    }),
    start: caret,
    end: caret,
  };
}

export function formatList(
  code: string, text: string, marks: TextMark[], start: number, end: number,
) {
  if (!Object.hasOwn(listKinds, code)) return null;
  const kind = listKinds[code as keyof typeof listKinds];
  const first = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;
  const lastBreak = text.indexOf("\n", end > start && text[end - 1] === "\n" ? end - 1 : end);
  const last = lastBreak === -1 ? text.length : lastBreak;
  const lines = text.slice(first, last).split("\n");
  const removing = lines.every((line) => kind.pattern.test(line));
  const prefixPattern = /^(?:\d+\.|[•☐☑]) /;
  let offset = first;
  let ending = first;
  let next = text;
  let updatedMarks = marks;

  lines.forEach((line, index) => {
    const oldPrefix = line.match(prefixPattern)?.[0] ?? "";
    const prefix = removing ? "" : kind.prefix(index);
    next = next.slice(0, offset) + prefix + next.slice(offset + oldPrefix.length);
    updatedMarks = updatedMarks.flatMap((mark) => {
      if (mark.index < offset) return [mark];
      if (mark.index < offset + oldPrefix.length) return [];
      return [{ ...mark, index: mark.index + prefix.length - oldPrefix.length }];
    });
    ending = offset + line.length + prefix.length - oldPrefix.length;
    offset = ending + 1;
  });

  if (next.length > MAX_TEXT_LENGTH) return null;
  const caret = Math.max(first + (removing ? 0 : kind.prefix(0).length), start + next.length - text.length);
  return {
    text: next,
    marks: updatedMarks,
    start: start === end ? caret : first,
    end: start === end ? caret : ending,
  };
}
