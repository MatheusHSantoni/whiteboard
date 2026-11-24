import { useEffect, useRef, useState } from "react";
import type { Layer as KonvaLayer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import { Layer, Rect, Stage } from "react-konva/lib/ReactKonvaCore.js";
import BoardShape from "../Shapes/BoardShape";
import InlineTextEditor from "./InlineTextEditor";
import { createDrawing, DEFAULT_FONT_SIZE, FONTS, MAX_STROKE_POINTS, type FreehandTool, type TextMark, type DrawingTool, type ElementStyle, type Point, type Shape, type Tool } from "../../types/shapes";

type Gesture = {
  pointerId: number;
  start: Point;
  current: Point;
} & (
  | { type: DrawingTool; style?: ElementStyle }
  | { type: FreehandTool; style?: ElementStyle; points: number[]; strokeWidth: number }
  | { type: "move"; ids: string[]; clickedId: string }
  | { type: "marquee" }
);

type StrokeGesture = Extract<Gesture, { points: number[] }>;

function addStrokePoint(gesture: StrokeGesture, point: Point) {
  const { points, start } = gesture;
  const x = point.x - start.x;
  const y = point.y - start.y;
  if (points.length >= MAX_STROKE_POINTS * 2 ||
      Math.hypot(x - points[points.length - 2], y - points[points.length - 1]) < 0.5) return points;
  return [...points, x, y];
}

function makeStroke(gesture: StrokeGesture, id: string, points: number[]): Shape {
  return {
    id, type: gesture.type, ...gesture.start, ...gesture.style,
    points, strokeWidth: gesture.strokeWidth,
  };
}

type EraseGesture = {
  pointerId: number;
  previous: Point;
  erased: Set<string>;
  refreshHitCanvas: boolean;
};

type PanGesture = {
  pointerId: number;
  start: Point;
  origin: Point;
};

type WhiteboardProps = {
  tool: Tool;
  drawingStyle?: ElementStyle;
  strokeWidth?: number;
  scale: number;
  onErase: (ids: string[]) => void;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  shapes: Shape[];
  disabled: boolean;
  onAdd: (shape: Shape) => void;
  onTextEdit: (id: string, text: string, marks: TextMark[]) => void;
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
  tool, drawingStyle, strokeWidth, scale, onErase, selectedIds, onSelect, shapes, disabled, onAdd, onTextEdit, onMove, onImageResize, onResize, onArrowBend,
}: WhiteboardProps) {
  const layer = useRef<KonvaLayer>(null);
  const container = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panGesture = useRef<PanGesture | null>(null);
  const eraseGesture = useRef<EraseGesture | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [textPosition, setTextPosition] = useState<(Point & ElementStyle & { id?: string; text?: string; marks?: TextMark[] }) | null>(null);

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

  function eraseAlong(event: KonvaEventObject<PointerEvent>) {
    const active = eraseGesture.current;
    const canvasLayer = layer.current;
    const point = canvasLayer?.getStage()?.getPointerPosition();
    if (!active || active.pointerId !== event.evt.pointerId || !canvasLayer || !point) return;

    const { previous, erased } = active;
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    if (!dx && !dy && event.evt.type !== "pointerdown") return;
    if (active.refreshHitCanvas) {
      // O canvas de interação pode conservar pixels de elementos removidos até o próximo quadro.
      canvasLayer.drawHit();
      active.refreshHitCanvas = false;
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2));
    const hits: string[] = [];
    for (let index = 1; index <= steps; index++) {
      const node = canvasLayer.getIntersection({
        x: previous.x + dx * index / steps,
        y: previous.y + dy * index / steps,
      });
      const id = node?.findAncestor(".board-shape")?.id();
      if (id && !erased.has(id)) {
        erased.add(id);
        hits.push(id);
      }
    }
    active.previous = point;
    if (hits.length) {
      active.refreshHitCanvas = true;
      onErase(hits);
    }
  }

  function stopErase(pointerId: number) {
    if (eraseGesture.current?.pointerId === pointerId) eraseGesture.current = null;
  }

  function startGesture(event: KonvaEventObject<PointerEvent>) {
    if (disabled || gesture || eraseGesture.current || textPosition || event.evt.button !== 0) return;
    const start = layer.current?.getRelativePointerPosition();
    if (!start) return;

    if (tool === "text") {
      event.evt.preventDefault();
      setTextPosition({ ...start, ...drawingStyle });
      return;
    }

    const shapeId = event.target.findAncestor(".board-shape")?.id();
    if (tool === "erase") {
      const point = layer.current?.getStage()?.getPointerPosition();
      if (!point) return;
      const { pointerId, target } = event.evt;
      eraseGesture.current = { pointerId, previous: point, erased: new Set(), refreshHitCanvas: false };
      if (target instanceof Element) target.setPointerCapture(pointerId);
      eraseAlong(event);
      return;
    }

    const pointerId = event.evt.pointerId;
    const base = { pointerId, start, current: start };
    if (tool === "select") {
      if (!shapeId) {
        onSelect([]);
        setGesture({ ...base, type: "marquee" });
      } else if (event.evt.shiftKey || event.evt.metaKey) {
        onSelect(selectedIds.includes(shapeId)
          ? selectedIds.filter((id) => id !== shapeId)
          : [...selectedIds, shapeId]);
        return;
      } else {
        const ids = selectedIds.includes(shapeId) ? selectedIds : [shapeId];
        onSelect(ids);
        setGesture({ ...base, type: "move", ids, clickedId: shapeId });
      }
    } else if (tool === "pencil" || tool === "marker") {
      setGesture({ ...base, type: tool, style: drawingStyle, points: [0, 0], strokeWidth: strokeWidth ?? 3 });
    } else {
      setGesture({ ...base, type: tool, style: drawingStyle });
    }

    if (event.evt.target instanceof Element) {
      event.evt.target.setPointerCapture(pointerId);
    }
  }

  function updateGesture(event: KonvaEventObject<PointerEvent>) {
    if (eraseGesture.current) {
      if (event.evt.buttons & 1) eraseAlong(event);
      else stopErase(event.evt.pointerId);
      return;
    }
    if (!gesture || event.evt.pointerId !== gesture.pointerId) return;
    const current = layer.current?.getRelativePointerPosition();
    if (!current) return;
    setGesture((active) => {
      if (!active || active.pointerId !== event.evt.pointerId) return active;
      if (!("points" in active)) return { ...active, current };
      const points = addStrokePoint(active, current);
      return points === active.points ? active : { ...active, points, current };
    });
  }

  function finishGesture(event: KonvaEventObject<PointerEvent>) {
    if (eraseGesture.current) {
      eraseAlong(event);
      stopErase(event.evt.pointerId);
      return;
    }
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

    if ("points" in gesture) {
      onAdd(makeStroke(gesture, crypto.randomUUID(), addStrokePoint(gesture, current)));
      return;
    }

    const shape = createDrawing(crypto.randomUUID(), gesture.type, gesture.start, current);
    if (shape) onAdd({ ...shape, ...gesture.style });
  }

  const drawing = gesture?.type === "move" || gesture?.type === "marquee" ? null : gesture;
  const preview = drawing
    ? "points" in drawing
      ? makeStroke(drawing, "preview", drawing.points)
      : createDrawing("preview", drawing.type, drawing.start, drawing.current)
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
        if (disabled || gesture || eraseGesture.current || panGesture.current || !event.ctrlKey || event.button !== 0) return;
        // Intercepta Ctrl + arrasto antes que o canvas inicie um desenho ou mova um elemento.
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
      onPointerUp={(event) => {
        stopPan(event.pointerId);
        stopErase(event.pointerId);
      }}
      onPointerCancel={(event) => stopPan(event.pointerId)}
      onLostPointerCapture={(event) => {
        stopPan(event.pointerId);
        stopErase(event.pointerId);
        if (gesture?.pointerId === event.pointerId) setGesture(null);
      }}
    >
      <Stage
        className="board-stage"
        {...dimensions}
        onDblClick={(event) => {
          if (disabled || tool !== "select" || textPosition || event.evt.button !== 0) return;
          const id = event.target.findAncestor(".board-shape")?.id();
          const shape = shapes.find((item) => item.id === id);
          if (shape?.type !== "text") return;

          const { id: textId, x, y, color, font, fontSize } = shape;
          onSelect([textId]);
          setTextPosition({ id: textId, x, y, color, font, fontSize, text: shape.text, marks: shape.marks });
        }}
        onPointerDown={startGesture}
        onPointerMove={updateGesture}
        onPointerUp={finishGesture}
        onPointerCancel={(event) => {
          stopErase(event.evt.pointerId);
          setGesture(null);
        }}
      >
        <Layer ref={layer} x={offset.x} y={offset.y} scaleX={scale} scaleY={scale}>
          {shapes.filter((shape) => shape.id !== textPosition?.id).map((shape) => (
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
        <InlineTextEditor
          initialText={textPosition.text ?? ""}
          initialMarks={textPosition.marks ?? []}
          style={{
            left: offset.x + textPosition.x * scale,
            top: offset.y + textPosition.y * scale,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            color: textPosition.color,
            fontFamily: FONTS[textPosition.font ?? "system"].stack,
            fontSize: textPosition.fontSize ?? DEFAULT_FONT_SIZE,
          }}
          onCommit={(text, marks) => {
            if (text) {
              const { id, text: initialText, marks: initialMarks, ...position } = textPosition;
              if (id) {
                if (text !== initialText || JSON.stringify(marks) !== JSON.stringify(initialMarks ?? [])) {
                  onTextEdit(id, text, marks);
                }
              } else {
                onAdd({ id: crypto.randomUUID(), type: "text", ...position, text, marks });
              }
            }
            setTextPosition(null);
          }}
          onCancel={() => setTextPosition(null)}
        />
      )}
    </section>
  );
}
