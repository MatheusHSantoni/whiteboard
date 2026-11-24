import type { Shape } from "../types/shapes";

const HISTORY_LIMIT = 50;

export type BoardHistory = { shapes: Shape[]; previous: Shape[][]; next: Shape[][]; group?: symbol };

export function createHistory(shapes: Shape[] = []): BoardHistory {
  return { shapes, previous: [], next: [] };
}

export function recordEdit(history: BoardHistory, shapes: Shape[], group?: symbol): BoardHistory {
  if (shapes === history.shapes || (shapes.length === history.shapes.length &&
      shapes.every((shape, index) => shape === history.shapes[index]))) return history;

  // A borracha pode remover vários elementos durante um único gesto.
  const previous = group && group === history.group ? history.previous :
    [...history.previous.slice(-(HISTORY_LIMIT - 1)), history.shapes];
  return { shapes, previous, next: [], group };
}

export function undoEdit(history: BoardHistory): BoardHistory {
  const shapes = history.previous.at(-1);
  if (!shapes) return history;
  return { shapes, previous: history.previous.slice(0, -1), next: [...history.next, history.shapes] };
}

export function redoEdit(history: BoardHistory): BoardHistory {
  const shapes = history.next.at(-1);
  if (!shapes) return history;
  return { shapes, previous: [...history.previous, history.shapes], next: history.next.slice(0, -1) };
}
