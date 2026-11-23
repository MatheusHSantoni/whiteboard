import "konva/lib/shapes/Rect.js";
import { Rect } from "react-konva/lib/ReactKonvaCore.js";
import { DEFAULT_FILL, type Shape } from "../../types/shapes";

type RectangleProps = {
  shape: Extract<Shape, { type: "square" | "rectangle" }>;
  stroke: string;
  selected?: boolean;
};

export default function Rectangle({ shape, stroke, selected }: RectangleProps) {
  return (
    <Rect
      width={shape.type === "square" ? shape.size : shape.width}
      height={shape.type === "square" ? shape.size : shape.height}
      cornerRadius={4}
      fill={shape.fillColor ?? DEFAULT_FILL}
      stroke={stroke}
      strokeWidth={2}
      dash={selected ? [6, 4] : undefined}
    />
  );
}
