import { useEffect, useRef, useState, type SetStateAction } from "react";
import type { Shape } from "../types/shapes";
import type { BoardStorage } from "../utils/boardLibrary";

const HISTORY_LIMIT = 50;

type BoardHistory = { shapes: Shape[]; previous: Shape[][]; group?: symbol };

export function useWhiteboard(storage: BoardStorage) {
  const [{ shapes, previous }, setHistory] = useState<BoardHistory>({ shapes: [], previous: [] });
  const [savedShapes, setSavedShapes] = useState<Shape[]>(shapes);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState<{ shapes: Shape[]; message: string } | null>(null);
  const writeInProgress = useRef(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    storage.load().then((storedShapes) => {
      if (!active) return;
      setHistory({ shapes: storedShapes, previous: [] });
      setSavedShapes(storedShapes);
    }).catch((error: unknown) => {
      if (!active) return;
      console.error("Falha ao carregar o Board.", error);
      setLoadFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [loadAttempt, storage]);

  useEffect(() => {
    if (loading || loadFailed || saving || writeInProgress.current ||
        shapes === savedShapes || shapes === saveFailure?.shapes) return;

    // Serializa as gravações para que cada uma use a revisão retornada pela anterior.
    writeInProgress.current = true;
    setSaving(true);
    storage.save(shapes).then(() => {
      setSavedShapes(shapes);
      setSaveFailure(null);
    }).catch((error: unknown) => {
      console.error("Falha ao salvar o Board.", error);
      setSaveFailure({ shapes, message: error instanceof Error ? error.message : "" });
    }).finally(() => {
      writeInProgress.current = false;
      setSaving(false);
    });
  }, [loading, loadFailed, saving, shapes, savedShapes, saveFailure, storage]);

  function setShapes(update: SetStateAction<Shape[]>, group?: symbol) {
    setHistory((history) => {
      const next = typeof update === "function" ? update(history.shapes) : update;
      if (next === history.shapes || (next.length === history.shapes.length &&
          next.every((shape, index) => shape === history.shapes[index]))) return history;
      return {
        shapes: next,
        previous: group && group === history.group ? history.previous :
          [...history.previous.slice(-(HISTORY_LIMIT - 1)), history.shapes],
        group,
      };
    });
  }

  function undo() {
    setHistory((history) => {
      const last = history.previous.at(-1);
      if (!last) return history;
      return { shapes: last, previous: history.previous.slice(0, -1) };
    });
  }

  function retryLoad() {
    setLoading(true);
    setLoadFailed(false);
    setLoadAttempt((attempt) => attempt + 1);
  }

  return {
    shapes, setShapes, retryLoad, loading, loadFailed, undo, canUndo: previous.length > 0,
    saveFailed: shapes === saveFailure?.shapes,
    saveError: saveFailure?.message ?? "",
    retrySave: () => setSaveFailure(null),
    dirty: shapes !== savedShapes || saving,
  };
}
