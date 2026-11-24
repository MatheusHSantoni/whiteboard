export type Point = { x: number; y: number };
export type DrawingTool = "rectangle" | "circle" | "arrow";
export type Tool = "select" | "erase" | "text" | DrawingTool;

export const FONTS = {
  system: { label: "Sistema", stack: "system-ui, sans-serif" },
  handwriting: { label: "Manuscrita", stack: "Segoe Print, Bradley Hand, Comic Sans MS, cursive" },
  verdana: { label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  arial: { label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  calibri: { label: "Calibri", stack: "Calibri, Carlito, sans-serif" },
  times: { label: "Times New Roman", stack: "Times New Roman, Times, serif" },
  georgia: { label: "Georgia", stack: "Georgia, serif" },
  mono: { label: "Monoespaçada", stack: "monospace" },
};
export const FONT_SIZES = [12, 16, 20, 24, 32, 40, 48];
export const DEFAULT_FILL = "#f1efff";
export const DEFAULT_FONT_SIZE = 20;

export type ElementStyle = {
  color?: string;
  fillColor?: string;
  noFill?: boolean;
  font?: keyof typeof FONTS;
  fontSize?: number;
};

export type TextMark = { index: number; color?: string; highlight?: string };

type PositionedShape = Point & ElementStyle & { id: string };

export type Shape = PositionedShape & (
  | { type: "square"; size: number }
  | { type: "rectangle"; width: number; height: number }
  | { type: "circle"; radius: number }
  | { type: "arrow"; dx: number; dy: number; bend?: Point }
  | { type: "image"; src: string; width: number; height: number }
  | { type: "text"; text: string; marks?: TextMark[] }
);

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 4096;

export const MAX_TEXT_LENGTH = 500;
export const DEFAULT_DRAWING_COLOR = "#293452";

export function createDrawing(
  id: string,
  type: DrawingTool,
  start: Point,
  end: Point,
): Shape | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const width = Math.abs(dx);
  const height = Math.abs(dy);
  if (Math.max(width, height) < 5) return null;

  if (type === "arrow") return { id, type, ...start, dx, dy };
  if (type === "circle") return { id, type, ...start, radius: Math.hypot(dx, dy) };
  if (width === 0 || height === 0) return null;

  return { id, type, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width, height };
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function resizeShape(shape: Shape, point: Point): Shape {
  const { x, y } = point;
  if (shape.type === "rectangle") {
    return { ...shape, width: Math.max(5, x), height: Math.max(5, y) };
  }
  if (shape.type === "square") return { ...shape, size: Math.max(5, x, y) };
  if (shape.type === "circle") return { ...shape, radius: Math.max(5, x) };
  if (shape.type === "arrow" && Math.hypot(x, y) >= 5) {
    return { ...shape, dx: x, dy: y };
  }
  return shape;
}

export function isShape(value: unknown): value is Shape {
  if (typeof value !== "object" || value === null) return false;
  const shape = value as Record<string, unknown>;
  if (typeof shape.id !== "string" || !shape.id ||
      !Number.isFinite(shape.x) || !Number.isFinite(shape.y)) return false;

  if (shape.color !== undefined &&
      (typeof shape.color !== "string" || !/^#[\da-f]{6}$/i.test(shape.color))) return false;

  if (shape.noFill !== undefined && typeof shape.noFill !== "boolean") return false;
  if (shape.fillColor !== undefined &&
      (typeof shape.fillColor !== "string" || !/^#[\da-f]{6}$/i.test(shape.fillColor))) return false;
  if (shape.font !== undefined &&
      (typeof shape.font !== "string" || !Object.hasOwn(FONTS, shape.font))) return false;
  if (shape.fontSize !== undefined &&
      (typeof shape.fontSize !== "number" || !FONT_SIZES.includes(shape.fontSize))) return false;

  switch (shape.type) {
    case "square":
      return isPositiveNumber(shape.size);
    case "rectangle":
      return isPositiveNumber(shape.width) && isPositiveNumber(shape.height);
    case "circle":
      return isPositiveNumber(shape.radius);
    case "arrow":
      return Number.isFinite(shape.dx) && Number.isFinite(shape.dy) &&
        (shape.dx !== 0 || shape.dy !== 0) &&
        (shape.bend === undefined || (typeof shape.bend === "object" && shape.bend !== null &&
          "x" in shape.bend && "y" in shape.bend &&
          Number.isFinite(shape.bend.x) && Number.isFinite(shape.bend.y)));
    case "image":
      return typeof shape.src === "string" && shape.src.length <= 4 * Math.ceil(MAX_IMAGE_BYTES / 3) + 32 &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(shape.src) &&
        [shape.width, shape.height].every((size) =>
          typeof size === "number" && size > 0 && size <= MAX_IMAGE_DIMENSION,
        );
    case "text":
      return typeof shape.text === "string" && shape.text.length <= MAX_TEXT_LENGTH &&
        shape.text.trim().length > 0 && validTextMarks(shape.marks, shape.text.length);
    default:
      return false;
  }
}

function validTextMarks(value: unknown, length: number): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > length) return false;
  const indexes = new Set<number>();
  return value.every((mark) => {
    if (!mark || typeof mark !== "object" || !Number.isInteger(mark.index) ||
        mark.index < 0 || mark.index >= length || indexes.has(mark.index)) return false;
    indexes.add(mark.index);
    return [mark.color, mark.highlight].every((color) =>
      color === undefined || (typeof color === "string" && /^#[\da-f]{6}$/i.test(color)));
  });
}

export function isShapeList(value: unknown): value is Shape[] {
  if (!Array.isArray(value)) return false;

  const ids = new Set<string>();
  for (const shape of value) {
    if (!isShape(shape) || ids.has(shape.id)) return false;
    ids.add(shape.id);
  }
  return true;
}
