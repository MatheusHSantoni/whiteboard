import type { CharRenderProps } from "konva/lib/shapes/Text";
import { DEFAULT_FONT_SIZE, type Shape } from "../../types/shapes";

export function textCharacterStyle(shape: Extract<Shape, { type: "text" }>) {
  const marks = new Map(shape.marks?.map((mark) => [mark.index, mark]));
  const fontSize = shape.fontSize ?? DEFAULT_FONT_SIZE;
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
      context.fillStyle = mark.highlight;
      context.fillRect(x, y - fontSize * 0.85, width, fontSize);
      context.restore();
    }
    if (mark?.color) context.fillStyle = mark.color;
  };
}
