import type { Point, Shape } from "../types/shapes";

type Interval = [number, number];
const EPSILON = 1e-7;

function circleInterval(start: Point, delta: Point, centerX: number, radius: number): Interval | null {
  const x = start.x - centerX;
  const a = delta.x ** 2 + delta.y ** 2;
  const c = x ** 2 + start.y ** 2 - radius ** 2;
  if (a < EPSILON) return c < 0 ? [0, 1] : null;
  const b = x * delta.x + start.y * delta.y;
  const discriminant = b * b - a * c;
  if (discriminant <= 0) return null;
  const root = Math.sqrt(discriminant);
  return [(-b - root) / a, (-b + root) / a];
}

function axisInterval(start: number, delta: number, low: number, high: number): Interval | null {
  if (Math.abs(delta) < EPSILON) return start >= low && start <= high ? [0, 1] : null;
  const a = (low - start) / delta;
  const b = (high - start) / delta;
  return [Math.min(a, b), Math.max(a, b)];
}

export function eraseStroke(shape: Shape, from: Point, to: Point, radius: number, newId: () => string): Shape[] {
  if (shape.type !== "pencil" && shape.type !== "marker") return [shape];
  const edge = radius + shape.strokeWidth / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const ux = length ? dx / length : 1;
  const uy = length ? dy / length : 0;
  const { points } = shape;

  function project(x: number, y: number): Point {
    const ax = x + shape.x - from.x;
    const ay = y + shape.y - from.y;
    return { x: ax * ux + ay * uy, y: ay * ux - ax * uy };
  }

  function cut(start: Point, end: Point): Interval | null {
    const delta = { x: end.x - start.x, y: end.y - start.y };
    const xRange = axisInterval(start.x, delta.x, 0, length);
    const yRange = axisInterval(start.y, delta.y, -edge, edge);
    const middle: Interval | null = length && xRange && yRange
      ? [Math.max(xRange[0], yRange[0]), Math.min(xRange[1], yRange[1])] : null;
    const intervals = [middle, circleInterval(start, delta, 0, edge),
      length ? circleInterval(start, delta, length, edge) : null];
    let first = 1;
    let last = 0;
    for (const interval of intervals) {
      if (!interval || interval[1] - interval[0] <= EPSILON || interval[1] <= 0 || interval[0] >= 1) continue;
      first = Math.min(first, Math.max(0, interval[0]));
      last = Math.max(last, Math.min(1, interval[1]));
    }
    return last > first ? [first, last] : null;
  }

  if (points.length === 2) {
    const dot = project(points[0], points[1]);
    return cut(dot, dot) ? [] : [shape];
  }

  const fragments: number[][] = [];
  let fragment = points.slice(0, 2);
  let changed = false;

  for (let index = 2; index < points.length; index += 2) {
    const x = points[index - 2];
    const y = points[index - 1];
    const endX = points[index];
    const endY = points[index + 1];
    const range = cut(project(x, y), project(endX, endY));
    if (!range) {
      if (!fragment.length) fragment.push(x, y);
      fragment.push(endX, endY);
      continue;
    }

    changed = true;
    const [first, last] = range;
    if (first > EPSILON) {
      if (!fragment.length) fragment.push(x, y);
      fragment.push(x + (endX - x) * first, y + (endY - y) * first);
    }
    if (fragment.length >= 4) fragments.push(fragment);
    fragment = last < 1 - EPSILON
      ? [x + (endX - x) * last, y + (endY - y) * last, endX, endY]
      : [];
  }

  if (!changed) return [shape];
  if (fragment.length >= 4) fragments.push(fragment);
  return fragments.map((points, index) => ({ ...shape, id: index === 0 ? shape.id : newId(), points }));
}
