import { useEffect, useRef, useState, type SetStateAction } from "react";
import type { Shape } from "../types/shapes";
import { BoardConflictError, type BoardStorage } from "../utils/boardLibrary";
import { createHistory, recordEdit, redoEdit, undoEdit } from "../utils/boardHistory";

export function useWhiteboard(storage: BoardStorage) {
  const [{ shapes, previous, next }, setHistory] = useState(() => createHistory());
  const [savedShapes, setSavedShapes] = useState<Shape[]>(shapes);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailure, setSaveFailure] = useState<{ shapes: Shape[]; message: string; conflict: boolean } | null>(null);
  const writeInProgress = useRef(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    storage.load().then((storedShapes) => {
      if (!active) return;
      setHistory(createHistory(storedShapes));
      setSavedShapes(storedShapes);
      setSaveFailure(null);
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
        shapes === savedShapes || saveFailure?.conflict || shapes === saveFailure?.shapes) return;

    // Serializa as gravações para que cada uma use a revisão retornada pela anterior.
    writeInProgress.current = true;
    setSaving(true);
    storage.save(shapes).then(() => {
      setSavedShapes(shapes);
      setSaveFailure(null);
    }).catch((error: unknown) => {
      console.error("Falha ao salvar o Board.", error);
      setSaveFailure({
        shapes,
        message: error instanceof Error ? error.message : "",
        conflict: error instanceof BoardConflictError,
      });
    }).finally(() => {
      writeInProgress.current = false;
      setSaving(false);
    });
  }, [loading, loadFailed, saving, shapes, savedShapes, saveFailure, storage]);

  function setShapes(update: SetStateAction<Shape[]>, group?: symbol) {
    setHistory((history) => {
      const updatedShapes = typeof update === "function" ? update(history.shapes) : update;
      return recordEdit(history, updatedShapes, group);
    });
  }

  function undo() {
    setHistory(undoEdit);
  }

  function redo() {
    setHistory(redoEdit);
  }

  function retryLoad() {
    setLoading(true);
    setLoadFailed(false);
    setLoadAttempt((attempt) => attempt + 1);
  }

  return {
    shapes, setShapes, retryLoad, loading, loadFailed, undo, canUndo: previous.length > 0,
    redo, canRedo: next.length > 0,
    saveFailed: saveFailure?.conflict || shapes === saveFailure?.shapes,
    saveConflict: saveFailure?.conflict ?? false,
    saveError: saveFailure?.message ?? "",
    retrySave: () => setSaveFailure(null),
    dirty: shapes !== savedShapes || saving || (saveFailure?.conflict ?? false),
  };
}
