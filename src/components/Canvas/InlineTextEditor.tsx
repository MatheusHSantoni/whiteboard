import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { DEFAULT_DRAWING_COLOR, MAX_TEXT_LENGTH, type TextMark } from "../../types/shapes";

import { continueList, formatList } from "./textLists";
import { completedChecklistRanges } from "../../utils/checklist";

const highlights = [
  { name: "Amarelo", color: "#fff176" },
  { name: "Verde", color: "#a5d6a7" },
  { name: "Rosa", color: "#f8bbd0" },
  { name: "Azul", color: "#90caf9" },
];

type InlineTextEditorProps = {
  initialText: string;
  initialBold?: boolean;
  dark: boolean;
  initialMarks: TextMark[];
  style: CSSProperties;
  onCommit: (text: string, marks: TextMark[], bold?: boolean) => void;
  onCancel: () => void;
};

function updateMarks(previous: string, next: string, marks: TextMark[]) {
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++;

  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (previousEnd > start && nextEnd > start && previous[previousEnd - 1] === next[nextEnd - 1]) {
    previousEnd--;
    nextEnd--;
  }

  return marks.flatMap((mark) => {
    if (mark.index < start) return [mark];
    if (mark.index >= previousEnd) return [{ ...mark, index: mark.index + nextEnd - previousEnd }];
    return [];
  });
}

export default function InlineTextEditor({ initialText, initialBold, initialMarks, dark, style, onCommit, onCancel }: InlineTextEditorProps) {
  const [text, setText] = useState(initialText);
  const [marks, setMarks] = useState(initialMarks);
  const [bold, setBold] = useState(initialBold);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const editor = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  useLayoutEffect(() => {
    const range = pendingSelection.current;
    if (!range) return;
    pendingSelection.current = null;
    editor.current?.setSelectionRange(range.start, range.end);
  }, [text]);

  const styles = new Map(marks.map((mark) => [mark.index, mark]));
  const completed = completedChecklistRanges(text);

  function applyListEdit(result: NonNullable<ReturnType<typeof formatList>>) {
    const range = { start: result.start, end: result.end };
    pendingSelection.current = range;
    setSelection(range);
    setMarks(result.marks);
    setText(result.text);
  }

  function format(property: "color" | "highlight", value?: string) {
    for (let index = selection.start; index < selection.end; index++) {
      const updated = { ...styles.get(index), index, [property]: value };
      if (updated.color || updated.highlight || updated.bold !== undefined) styles.set(index, updated);
      else styles.delete(index);
    }
    setMarks([...styles.values()].sort((left, right) => left.index - right.index));
  }

  function commit() {
    const content = text.trim();
    const start = text.length - text.trimStart().length;
    onCommit(content, marks
      .filter(({ index }) => index >= start && index < start + content.length)
      .map((mark) => ({ ...mark, index: mark.index - start })), bold);
  }

  function toggleBold(start: number, end: number) {
    if (start === end) {
      setBold((current) => !current);
      return;
    }
    const base = Boolean(bold);
    const indexes = Array.from({ length: end - start }, (_, offset) => start + offset);
    const enabled = !indexes.every((index) => styles.get(index)?.bold ?? base);
    for (const index of indexes) {
      const mark = { ...styles.get(index), index, bold: enabled === base ? undefined : enabled };
      if (mark.color || mark.highlight || mark.bold !== undefined) styles.set(index, mark);
      else styles.delete(index);
    }
    setMarks([...styles.values()].sort((left, right) => left.index - right.index));
  }

  return (
    <div
      className="inline-text-editor"
      style={{ ...style, fontWeight: bold ? "bold" : "normal" }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) commit();
      }}
    >
      <div className="text-editor-preview" aria-hidden="true">
        {Array.from(text).reduce<{ index: number; nodes: React.ReactNode[] }>((result, char) => {
          const mark = styles.get(result.index);
          const struck = completed.some(({ start, end }) => result.index >= start && result.index < end);
          result.nodes.push(mark || struck
            ? <span key={result.index} style={{
              color: dark ? undefined : mark?.color,
              backgroundColor: dark && mark?.highlight ? `${mark.highlight}66` : mark?.highlight,
              textDecoration: struck ? "line-through" : undefined,
              fontWeight: mark?.bold === undefined ? undefined : mark.bold ? "bold" : "normal",
            }}>{char}</span>
            : char);
          result.index += char.length;
          return result;
        }, { index: 0, nodes: [] }).nodes}
      </div>
      <textarea
        ref={editor}
        className="text-editor"
        aria-label="Texto do elemento"
        autoFocus
        rows={1}
        maxLength={MAX_TEXT_LENGTH}
        value={text}
        onFocus={(event) => event.currentTarget.setSelectionRange(text.length, text.length)}
        onSelect={(event) => setSelection({
          start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd,
        })}
        onChange={(event) => {
          const next = event.target.value;
          setMarks(updateMarks(text, next, marks));
          setText(next);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey &&
              event.key.toLowerCase() === "b") {
            event.preventDefault();
            if (!event.repeat) {
              const { selectionStart, selectionEnd } = event.currentTarget;
              toggleBold(selectionStart, selectionEnd);
            }
            return;
          }
          if (event.ctrlKey && event.shiftKey && !event.altKey && /^Digit[789]$/.test(event.code)) {
            event.preventDefault();
            const { selectionStart, selectionEnd } = event.currentTarget;
            const result = formatList(event.code, text, marks, selectionStart, selectionEnd);
            if (result) applyListEdit(result);
            return;
          }
          if (event.key === "Enter" && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
            const { selectionStart, selectionEnd } = event.currentTarget;
            const result = continueList(text, marks, selectionStart, selectionEnd);
            if (result) {
              event.preventDefault();
              applyListEdit(result);
            }
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          } else if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      {selection.start < selection.end && (
        <div className="text-format" role="group" aria-label="Formatar trecho">
          <label>
            Cor do trecho
            <input
              type="color"
              value={styles.get(selection.start)?.color ?? DEFAULT_DRAWING_COLOR}
              onChange={(event) => format("color", event.currentTarget.value)}
            />
          </label>
          {highlights.map(({ name, color }) => (
            <button
              key={color}
              type="button"
              style={{ backgroundColor: color }}
              aria-label={`Marca-texto ${name.toLowerCase()}`}
              title={`Marca-texto ${name.toLowerCase()}`}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => format("highlight", color)}
            />
          ))}
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => format("highlight")}
          >Remover marca</button>
          <button type="button" onClick={commit}>Concluir</button>
        </div>
      )}
    </div>
  );
}
