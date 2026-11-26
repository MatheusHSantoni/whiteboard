export function toggleChecklistItem(text: string, line: number): string {
  const lines = text.split("\n");
  const item = lines[line];
  if (!item || !/^[☐☑] /.test(item)) return text;
  lines[line] = (item.startsWith("☐") ? "☑" : "☐") + item.slice(1);
  return lines.join("\n");
}

export function completedChecklistRanges(text: string) {
  return Array.from(text.matchAll(/^☑ [^\n]*/gm), ({ 0: line, index }) => ({
    start: index + 2,
    end: index + line.length,
  }));
}
