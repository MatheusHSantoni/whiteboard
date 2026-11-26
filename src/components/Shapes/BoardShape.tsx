import "konva/lib/shapes/Arrow.js";
import "konva/lib/shapes/Text.js";
import "konva/lib/shapes/Circle.js";
import "konva/lib/shapes/Line.js";
import type { Text as KonvaText } from "konva/lib/shapes/Text";
import { useState } from "react";
import { Arrow, Circle, Group, Line, Rect, Text } from "react-konva/lib/ReactKonvaCore.js";
import { DEFAULT_DRAWING_COLOR, DEFAULT_FILL, DEFAULT_FONT_SIZE, DEFAULT_TEXT_WIDTH, FONTS, resizeShape, type Point, type Shape } from "../../types/shapes";
import BoardImage from "./BoardImage";
import Rectangle from "./Rectangle";
import { textCharacterStyle } from "./textCharacterStyle";
import { toggleChecklistItem } from "../../utils/checklist";

type BoardShapeProps = {
  shape: Shape;
  selected?: boolean;
  selectionMode?: boolean;
  showHandles?: boolean;
  dark?: boolean;
  preview?: boolean;
  onImageResize?: (id: string, width: number, height: number) => void;
  onResize?: (id: string, point: Point) => void;
  onArrowBend?: (id: string, bend: Point) => void;
  onChecklistChange?: (id: string, text: string, marks: NonNullable<Extract<Shape, { type: "text" }>["marks"]>) => void;
};

export default function BoardShape({
  shape: savedShape, selected, selectionMode, showHandles, dark, preview, onImageResize, onResize, onArrowBend, onChecklistChange,
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
        <Rectangle shape={shape} stroke={stroke} selected={selected} selectionMode={selectionMode} />
      )}
      {shape.type === "circle" && (
        <Circle
          radius={shape.radius}
          fill={shape.noFill ? "transparent" : shape.fillColor ?? DEFAULT_FILL}
          fillEnabled={!shape.noFill || selectionMode}
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
          hitStrokeWidth={selectionMode ? 28 : 16}
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
          radius={shape.type === "text" ? 10 : 6}
          hitStrokeWidth={shape.type === "text" ? 16 : "auto"}
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
          charRenderFunc={shape.marks?.length || /^☑ /m.test(shape.text) ? textCharacterStyle(shape, dark) : undefined}
          onPointerDown={(event) => {
            if (!onChecklistChange || event.evt.button !== 0 ||
                event.evt.ctrlKey || event.evt.shiftKey || event.evt.metaKey) return;
            const node = event.currentTarget as KonvaText;
            const point = node.getRelativePointerPosition();
            if (!point || point.x < 0 || point.x > node.padding() * 2 + node.measureSize("☑").width) return;
            const row = Math.floor((point.y - node.padding()) / (node.lineHeight() * node.fontSize()));
            if (row < 0 || row >= node.textArr.length) return;
            // Uma tarefa pode ocupar várias linhas visuais, mas só a primeira tem caixa.
            const precedingRows = node.textArr.slice(0, row);
            if (row > 0 && !precedingRows.at(-1)?.lastInParagraph) return;
            const line = precedingRows.filter(({ lastInParagraph }) => lastInParagraph).length;
            const text = toggleChecklistItem(shape.text, line);
            if (text === shape.text) return;
            event.cancelBubble = true;
            onChecklistChange(shape.id, text, shape.marks ?? []);
          }}
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
