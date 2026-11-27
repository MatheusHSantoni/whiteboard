import { isShapeList, type Shape } from "../types/shapes.ts";

const DATABASE = "whiteboard";
const STORE = "boards";
const BOARD_KEY = "default";
const SUMMARY_PREFIX = "summary:";
const LEGACY_REMOVED = SUMMARY_PREFIX + "legacy-removed";

export type BoardSummary = { id: string; name: string };

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function withBoardStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      // A requisição pode terminar antes de a transação confirmar todas as operações.
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? new DOMException("A transação foi cancelada.", "AbortError"));
    });
  } finally {
    database.close();
  }
}

export async function loadBoard(id = BOARD_KEY): Promise<Shape[]> {
  const value: unknown = await withBoardStore("readonly", (store) => store.get(id));
  if (value === undefined) return [];

  if (!isShapeList(value)) {
    throw new Error("O quadro salvo contém dados inválidos.");
  }

  return value;
}

export async function saveBoard(shapes: Shape[], id = BOARD_KEY): Promise<void> {
  await withBoardStore("readwrite", (store) => {
    // A checagem e a gravação compartilham a transação para não recriar um Board excluído.
    const metadata = id === BOARD_KEY ? LEGACY_REMOVED : SUMMARY_PREFIX + id;
    const request = store.getKey(metadata);
    request.onsuccess = () => {
      const exists = request.result !== undefined;
      if (id === BOARD_KEY ? exists : !exists) {
        store.transaction.abort();
        return;
      }
      store.put(shapes, id);
    };
    return request;
  });
}

export async function listLocalBoards(): Promise<BoardSummary[]> {
  const rows: Array<BoardSummary | true> = await withBoardStore("readonly", (store) =>
    store.getAll(IDBKeyRange.bound(SUMMARY_PREFIX, SUMMARY_PREFIX + "\uffff")),
  );
  const boards = rows.filter((row) => row !== true);
  return rows.includes(true) ? boards : [{ id: BOARD_KEY, name: "Board principal" }, ...boards];
}

export async function createLocalBoard(name: string, shapes: Shape[]): Promise<BoardSummary> {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const board = { id, name };
  await withBoardStore("readwrite", (store) => {
    store.add(shapes, id);
    return store.add(board, SUMMARY_PREFIX + id);
  });
  return board;
}

export async function deleteLocalBoard(id: string): Promise<void> {
  await withBoardStore("readwrite", (store) => {
    const request = store.delete(id);
    if (id === BOARD_KEY) store.put(true, LEGACY_REMOVED);
    else store.delete(SUMMARY_PREFIX + id);
    return request;
  });
}
