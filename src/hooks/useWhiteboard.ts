import { useEffect, useRef, useState } from "react";
import type { Shape } from "../types/shapes";
import type { BoardStorage } from "../utils/boardLibrary";

export function useWhiteboard(storage: BoardStorage) {
  const [shapes, setShapes] = useState<Shape[]>([]);
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
      setShapes(storedShapes);
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

  function retryLoad() {
    setLoading(true);
    setLoadFailed(false);
    setLoadAttempt((attempt) => attempt + 1);
  }

  return {
    shapes, setShapes, retryLoad, loading, loadFailed,
    saveFailed: shapes === saveFailure?.shapes,
    saveError: saveFailure?.message ?? "",
    retrySave: () => setSaveFailure(null),
    dirty: shapes !== savedShapes,
  };
}
