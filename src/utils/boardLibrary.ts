import { isShapeList, type Shape } from "../types/shapes";
import { createLocalBoard, deleteLocalBoard, listLocalBoards, loadBoard, saveBoard, type BoardSummary } from "./storage";
export type { BoardSummary } from "./storage";

const BACKUP_VERSION = 1;

export interface BoardStorage {
  load: () => Promise<Shape[]>;
  save: (shapes: Shape[]) => Promise<void>;
}

export class BoardConflictError extends Error {}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch("/api/boards" + path, {
    method,
    headers: body === undefined ? undefined : {
      "Content-Type": "application/json",
      "X-Whiteboard": "1",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.error || "Não foi possível acessar o servidor.";
    if (method === "PUT" && response.status === 409) throw new BoardConflictError(message);
    throw new Error(message);
  }
  return response.json();
}

function serverStorage(id: string): BoardStorage {
  const path = "/" + id;
  let revision: number;
  return {
    async load() {
      const board = await request<{ shapes: Shape[]; revision: number }>(path);
      revision = board.revision;
      return board.shapes;
    },
    async save(shapes) {
      const result = await request<{ revision: number }>(path, "PUT", { shapes, revision });
      revision = result.revision;
    },
  };
}

export const localLibrary = {
  list: listLocalBoards,
  remove: deleteLocalBoard,
  create: createLocalBoard,
  storage: (id: string): BoardStorage => ({
    load: () => loadBoard(id),
    save: (shapes) => saveBoard(shapes, id),
  }),
};

export const serverLibrary = {
  list: () => request<BoardSummary[]>(""),
  create: (name: string, shapes: Shape[]) => request<BoardSummary>("", "POST", { name, shapes }),
  storage: serverStorage,
  remove: (id: string) => request("/" + id, "DELETE", {}),
};

export async function readBackup(file: File): Promise<Shape[]> {
  const backup = JSON.parse(await file.text());
  const shapes: unknown = backup?.shapes;
  if (backup?.version !== BACKUP_VERSION || !isShapeList(shapes)) {
    throw new Error("O arquivo não contém um Board do Whiteboard.");
  }
  return shapes;
}

export function downloadBackup(shapes: Shape[]) {
  const backup = { version: BACKUP_VERSION, shapes };
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "board.whiteboard.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
