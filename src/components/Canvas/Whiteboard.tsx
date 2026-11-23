import { useEffect, useRef, useState } from "react";
import type { Layer as KonvaLayer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Stage } from "react-konva/lib/ReactKonvaCore.js";
import BoardShape from "../Shapes/BoardShape";
import { createDrawing, DEFAULT_FONT_SIZE, FONTS, MAX_TEXT_LENGTH, type DrawingTool, type ElementStyle, type Point, type Shape, type Tool } from "../../types/shapes";

type Gesture = {
  pointerId: number;
  start: Point;
  current: Point;
} & (
  | { type: DrawingTool; style?: ElementStyle }
  | { type: "move"; shape: Shape }
);

type PanGesture = {
  pointerId: number;
  start: Point;
  origin: Point;
};

type WhiteboardProps = {
  tool: Tool;
  drawingStyle?: ElementStyle;
  scale: number;
  onErase: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  shapes: Shape[];
  disabled: boolean;
  onAdd: (shape: Shape) => void;
  onMove: (id: string, position: Point) => void;
  onImageResize: (id: string, width: number, height: number) => void;
  onArrowBend: (id: string, bend: Point) => void;
};

function getMovedShape(gesture: Extract<Gesture, { type: "move" }>): Shape {
  const { shape, start, current } = gesture;
  return { ...shape, x: shape.x + current.x - start.x, y: shape.y + current.y - start.y };
}

export default function Whiteboard({
  tool, drawingStyle, scale, onErase, selectedId, onSelect, shapes, disabled, onAdd, onMove, onImageResize, onArrowBend,
}: WhiteboardProps) {
  const layer = useRef<KonvaLayer>(null);
  const container = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panGesture = useRef<PanGesture | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [textPosition, setTextPosition] = useState<(Point & ElementStyle) | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  function stopPan(pointerId: number) {
    if (panGesture.current?.pointerId !== pointerId) return;
    panGesture.current = null;
    setPanning(false);
  }

  function startGesture(event: KonvaEventObject<PointerEvent>) {
    if (disabled || gesture || textPosition || event.evt.button !== 0) return;
    const start = layer.current?.getRelativePointerPosition();
    if (!start) return;

    if (tool === "text") {
      event.evt.preventDefault();
      setText("");
      setTextPosition({ ...start, ...drawingStyle });
      return;
    }

    const shapeId = event.target.findAncestor(".board-shape")?.id();
    if (tool === "erase") {
      if (shapeId) onErase(shapeId);
      return;
    }

    const pointerId = event.evt.pointerId;
    const base = { pointerId, start, current: start };
    if (tool === "select") {
      const shape = shapes.find(({ id }) => id === shapeId);
      onSelect(shape?.id ?? null);
      if (!shape) return;
      setGesture({ ...base, type: "move", shape });
    } else {
      setGesture({ ...base, type: tool, style: drawingStyle });
    }

    if (event.evt.target instanceof Element) {
      event.evt.target.setPointerCapture(pointerId);
    }
  }

  function updateGesture(event: KonvaEventObject<PointerEvent>) {
    if (!gesture || event.evt.pointerId !== gesture.pointerId) return;
    const current = layer.current?.getRelativePointerPosition();
    if (current) setGesture({ ...gesture, current });
  }

  function finishGesture(event: KonvaEventObject<PointerEvent>) {
    if (!gesture || event.evt.pointerId !== gesture.pointerId) return;
    setGesture(null);
    const current = layer.current?.getRelativePointerPosition();
    if (!current) return;

    if (gesture.type === "move") {
      if (current.x !== gesture.start.x || current.y !== gesture.start.y) {
        onMove(gesture.shape.id, getMovedShape({ ...gesture, current }));
      }
      return;
    }

    const shape = createDrawing(crypto.randomUUID(), gesture.type, gesture.start, current);
    if (shape) onAdd({ ...shape, ...gesture.style });
  }

  const drawing = gesture?.type === "move" ? null : gesture;
  const preview = drawing
    ? createDrawing("preview", drawing.type, drawing.start, drawing.current)
    : null;
  const moving = gesture?.type === "move" ? getMovedShape(gesture) : null;

  return (
    <section
      ref={container}
      className={`quadro quadro--${tool}${panning ? " quadro--panning" : ""}`}
      aria-label="Área de desenho"
      style={{
        backgroundSize: `${20 * scale}px ${20 * scale}px`,
        backgroundPosition: `${offset.x}px ${offset.y}px`,
      }}
      onPointerDownCapture={(event) => {
        if (disabled || gesture || panGesture.current || !event.altKey || event.button !== 0) return;
        // Intercepta Alt + arrasto antes que o canvas inicie um desenho ou mova um elemento.
        event.preventDefault();
        event.stopPropagation();
        panGesture.current = {
          pointerId: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
          origin: offset,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setPanning(true);
      }}
      onPointerMove={(event) => {
        const pan = panGesture.current;
        if (!pan || event.pointerId !== pan.pointerId) return;
        setOffset({
          x: pan.origin.x + event.clientX - pan.start.x,
          y: pan.origin.y + event.clientY - pan.start.y,
        });
      }}
      onPointerUp={(event) => stopPan(event.pointerId)}
      onPointerCancel={(event) => stopPan(event.pointerId)}
      onLostPointerCapture={(event) => {
        stopPan(event.pointerId);
        if (gesture?.pointerId === event.pointerId) setGesture(null);
      }}
    >
      <Stage
        className="board-stage"
        {...dimensions}
        onPointerDown={startGesture}
        onPointerMove={updateGesture}
        onPointerUp={finishGesture}
        onPointerCancel={() => setGesture(null)}
      >
        <Layer ref={layer} x={offset.x} y={offset.y} scaleX={scale} scaleY={scale}>
          {shapes.map((shape) => (
            <BoardShape
              key={shape.id}
              shape={shape.id === moving?.id ? moving : shape}
              selected={tool === "select" && shape.id === selectedId}
              onImageResize={onImageResize}
              onArrowBend={onArrowBend}
            />
          ))}
          {preview && <BoardShape shape={{ ...preview, ...drawing?.style }} preview />}
        </Layer>
      </Stage>
      {textPosition && (
        <textarea
          className="text-editor"
          aria-label="Texto do elemento"
          style={{
            left: offset.x + textPosition.x * scale,
            top: offset.y + textPosition.y * scale,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            color: textPosition.color,
            fontFamily: FONTS[textPosition.font ?? "system"].stack,
            fontSize: textPosition.fontSize ?? DEFAULT_FONT_SIZE,
          }}
          autoFocus
          rows={1}
          maxLength={MAX_TEXT_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => {
            const content = text.trim();
            if (content) {
              onAdd({ id: crypto.randomUUID(), type: "text", ...textPosition, text: content });
            }
            setTextPosition(null);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              setTextPosition(null);
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      )}
    </section>
  );
}
