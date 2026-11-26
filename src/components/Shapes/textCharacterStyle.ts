import type { CharRenderProps } from "konva/lib/shapes/Text";
import { DEFAULT_FONT_SIZE, type Shape } from "../../types/shapes";
import { completedChecklistRanges } from "../../utils/checklist";

export function textCharacterStyle(shape: Extract<Shape, { type: "text" }>, dark = false) {
  const marks = new Map(shape.marks?.map((mark) => [mark.index, mark]));
  const fontSize = shape.fontSize ?? DEFAULT_FONT_SIZE;
  const completed = completedChecklistRanges(shape.text);
  let cursor = 0;

  return ({ index, char, x, y, width, context }: CharRenderProps) => {
    if (index === 0) cursor = 0;
    // Konva skips newlines and can trim spaces at a wrap boundary.
    const start = shape.text.indexOf(char, cursor);
    if (start === -1) return;
    cursor = start + char.length;

    const mark = marks.get(start);
    if (mark?.highlight) {
      context.save();
      context.fillStyle = dark ? `${mark.highlight}66` : mark.highlight;
      context.fillRect(x, y - fontSize * 0.85, width, fontSize);
      context.restore();
    }
    if (!dark && mark?.color) context.fillStyle = mark.color;
    if (completed.some(({ start: from, end }) => start >= from && start < end)) {
      context.fillRect(x, y - fontSize * 0.3, width, Math.max(1, fontSize / 16));
    }
  };
}
