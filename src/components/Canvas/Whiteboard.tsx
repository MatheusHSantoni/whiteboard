import { useEffect, useRef, useState } from "react";
import type { Layer as KonvaLayer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Rect, Stage } from "react-konva/lib/ReactKonvaCore.js";
import BoardShape from "../Shapes/BoardShape";
import { createDrawing, DEFAULT_FONT_SIZE, FONTS, MAX_TEXT_LENGTH, type DrawingTool, type ElementStyle, type Point, type Shape, type Tool } from "../../types/shapes";

type Gesture = {
  pointerId: number;
  start: Point;
  current: Point;
} & (
  | { type: DrawingTool; style?: ElementStyle }
  | { type: "move"; ids: string[]; clickedId: string }
  | { type: "marquee" }
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
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  shapes: Shape[];
  disabled: boolean;
  onAdd: (shape: Shape) => void;
  onMove: (ids: string[], delta: Point) => void;
  onImageResize: (id: string, width: number, height: number) => void;
  onResize: (id: string, point: Point) => void;
  onArrowBend: (id: string, bend: Point) => void;
};

function selectionBounds(start: Point, end: Point) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export default function Whiteboard({
  tool, drawingStyle, scale, onErase, selectedIds, onSelect, shapes, disabled, onAdd, onMove, onImageResize, onResize, onArrowBend,
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
      if (!shapeId) {
        onSelect([]);
        setGesture({ ...base, type: "marquee" });
      } else if (event.evt.ctrlKey || event.evt.metaKey) {
        onSelect(selectedIds.includes(shapeId)
          ? selectedIds.filter((id) => id !== shapeId)
          : [...selectedIds, shapeId]);
        return;
      } else {
        const ids = selectedIds.includes(shapeId) ? selectedIds : [shapeId];
        onSelect(ids);
        setGesture({ ...base, type: "move", ids, clickedId: shapeId });
      }
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
      const delta = { x: current.x - gesture.start.x, y: current.y - gesture.start.y };
      if (delta.x || delta.y) onMove(gesture.ids, delta);
      else onSelect([gesture.clickedId]);
      return;
    }

    if (gesture.type === "marquee") {
      const canvasLayer = layer.current;
      const area = selectionBounds(gesture.start, current);
      if (!canvasLayer || !area.width || !area.height) return;

      const ids = canvasLayer.find(".board-shape").filter((node) => {
        const bounds = node.getClientRect({ relativeTo: canvasLayer });
        return bounds.x < area.x + area.width && bounds.x + bounds.width > area.x &&
          bounds.y < area.y + area.height && bounds.y + bounds.height > area.y;
      }).map((node) => node.id());
      onSelect(ids);
      return;
    }

    const shape = createDrawing(crypto.randomUUID(), gesture.type, gesture.start, current);
    if (shape) onAdd({ ...shape, ...gesture.style });
  }

  const drawing = gesture?.type === "move" || gesture?.type === "marquee" ? null : gesture;
  const preview = drawing
    ? createDrawing("preview", drawing.type, drawing.start, drawing.current)
    : null;
  const moving = gesture?.type === "move" ? gesture : null;
  const marquee = gesture?.type === "marquee" ? selectionBounds(gesture.start, gesture.current) : null;
  const selected = new Set(tool === "select" ? selectedIds : []);

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
              shape={moving?.ids.includes(shape.id) ? {
                ...shape,
                x: shape.x + moving.current.x - moving.start.x,
                y: shape.y + moving.current.y - moving.start.y,
              } : shape}
              selected={selected.has(shape.id)}
              showHandles={selected.size === 1 && selected.has(shape.id)}
              onImageResize={onImageResize}
              onResize={onResize}
              onArrowBend={onArrowBend}
            />
          ))}
          {preview && <BoardShape shape={{ ...preview, ...drawing?.style }} preview />}
          {marquee && <Rect {...marquee} fill="#583ce025" stroke="#583ce0" strokeScaleEnabled={false} listening={false} />}
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
