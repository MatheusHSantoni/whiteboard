import "konva/lib/shapes/Arrow.js";
import "konva/lib/shapes/Text.js";
import "konva/lib/shapes/Circle.js";
import "konva/lib/shapes/Line.js";
import { useState } from "react";
import { Arrow, Circle, Group, Line, Rect, Text } from "react-konva/lib/ReactKonvaCore.js";
import { DEFAULT_DRAWING_COLOR, DEFAULT_FILL, DEFAULT_FONT_SIZE, DEFAULT_TEXT_WIDTH, FONTS, resizeShape, type Point, type Shape } from "../../types/shapes";
import BoardImage from "./BoardImage";
import Rectangle from "./Rectangle";
import { textCharacterStyle } from "./textCharacterStyle";

type BoardShapeProps = {
  shape: Shape;
  selected?: boolean;
  showHandles?: boolean;
  dark?: boolean;
  preview?: boolean;
  onImageResize?: (id: string, width: number, height: number) => void;
  onResize?: (id: string, point: Point) => void;
  onArrowBend?: (id: string, bend: Point) => void;
};

export default function BoardShape({
  shape: savedShape, selected, showHandles, dark, preview, onImageResize, onResize, onArrowBend,
}: BoardShapeProps) {
  const [dragSize, setDragSize] = useState<Point>();
  const shape = dragSize ? resizeShape(savedShape, dragSize) : savedShape;
  const stroke = shape.color ?? DEFAULT_DRAWING_COLOR;

  const [dragBend, setDragBend] = useState<Point>();
  const isLine = shape.type === "arrow" || shape.type === "line";
  const curve = dragBend ?? (isLine ? shape.bend : undefined);
  const bend = isLine ? curve ?? { x: shape.dx / 2, y: shape.dy / 2 } : null;

  const resizePoint = isLine ? { x: shape.dx, y: shape.dy } :
    shape.type === "rectangle" ? { x: shape.width, y: shape.height } :
    shape.type === "square" ? { x: shape.size, y: shape.size } :
    shape.type === "circle" ? { x: shape.radius, y: 0 } :
    shape.type === "text" ? { x: shape.width ?? DEFAULT_TEXT_WIDTH, y: 4 + (shape.fontSize ?? DEFAULT_FONT_SIZE) / 2 } : null;

  return (
    <Group
      id={shape.id}
      name={shape.type === "pencil" || shape.type === "marker" ? "board-shape freehand-stroke" : "board-shape"}
      x={shape.x}
      y={shape.y}
      opacity={preview ? 0.65 : 1}
      listening={!preview}
    >
      {(shape.type === "square" || shape.type === "rectangle") && (
        <Rectangle shape={shape} stroke={stroke} selected={selected} />
      )}
      {shape.type === "circle" && (
        <Circle
          radius={shape.radius}
          fill={shape.fillColor ?? DEFAULT_FILL}
          fillEnabled={!shape.noFill}
          stroke={stroke}
          strokeWidth={2}
          dash={selected ? [6, 4] : undefined}
        />
      )}
      {shape.type === "image" && <BoardImage shape={shape} selected={showHandles} onResize={onImageResize} />}
      {shape.type === "image" && selected && !showHandles && (
        <Rect width={shape.width} height={shape.height} stroke="#583ce0" dash={[6, 4]} listening={false} />
      )}
      {isLine && (
        <Arrow
          points={curve ? [0, 0, curve.x, curve.y, shape.dx, shape.dy] : [0, 0, shape.dx, shape.dy]}
          tension={curve ? 0.45 : 0}
          pointerAtEnding={shape.type === "arrow"}
          stroke={stroke}
          fill={stroke}
          strokeWidth={3}
          dash={selected ? [6, 4] : undefined}
          hitStrokeWidth={16}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {showHandles && bend && (
        <Circle
          {...bend}
          radius={6}
          fill="#fff"
          stroke="#583ce0"
          strokeWidth={2}
          draggable
          onPointerDown={(event) => { event.cancelBubble = true; }}
          onDragMove={(event) => setDragBend(event.target.position())}
          onDragEnd={(event) => {
            onArrowBend?.(shape.id, event.target.position());
            setDragBend(undefined);
          }}
        />
      )}
      {showHandles && resizePoint && (
        <Circle
          {...resizePoint}
          radius={6}
          fill="#583ce0"
          stroke="#fff"
          strokeWidth={2}
          draggable
          onPointerDown={(event) => { event.cancelBubble = true; }}
          onDragMove={(event) => setDragSize(event.target.position())}
          onDragEnd={(event) => {
            onResize?.(shape.id, event.target.position());
            setDragSize(undefined);
          }}
        />
      )}
      {(shape.type === "pencil" || shape.type === "marker") && (
        shape.points.length === 2 ? (
          <Circle
            radius={shape.strokeWidth / 2}
            fill={stroke}
            opacity={shape.type === "marker" ? 0.42 : 1}
            stroke={selected ? "#583ce0" : undefined}
            strokeWidth={1}
          />
        ) : (
          <Line
            points={shape.points}
            stroke={stroke}
            strokeWidth={shape.strokeWidth}
            hitStrokeWidth={Math.max(12, shape.strokeWidth)}
            opacity={shape.type === "marker" ? 0.42 : 1}
            lineCap={shape.type === "marker" ? "butt" : "round"}
            lineJoin="round"
            dash={selected ? [6, 4] : undefined}
          />
        )
      )}
      {shape.type === "text" && (
        <Text
          text={shape.text}
          charRenderFunc={shape.marks?.length ? textCharacterStyle(shape, dark) : undefined}
          width={shape.width ?? DEFAULT_TEXT_WIDTH}
          padding={4}
          fontSize={shape.fontSize ?? DEFAULT_FONT_SIZE}
          fontStyle={shape.bold ? "bold" : "normal"}
          fontFamily={FONTS[shape.font ?? "system"].stack}
          fill={dark ? "#fff" : stroke}
          textDecoration={selected ? "underline" : undefined}
        />
      )}
    </Group>
  );
}
