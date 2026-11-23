import "./App.css";
import { useEffect, useState, type ReactNode } from "react";
import { downloadBackup, type BoardStorage } from "./utils/boardLibrary";
import Whiteboard from "./components/Canvas/Whiteboard";
import Toolbar from "./components/Toolbar/Toolbar";
import { readBoardImage } from "./utils/boardImage";
import { useWhiteboard } from "./hooks/useWhiteboard";
import { type ElementStyle, type Point, type Shape, type Tool } from "./types/shapes";

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;

const instructions: Record<Tool, string> = {
  select: "Clique em um elemento para selecionar. Arraste para mover.",
  erase: "Clique em um elemento para apagar.",
  rectangle: "Clique e arraste para desenhar um retângulo.",
  circle: "Clique no centro e arraste para definir o raio do círculo.",
  arrow: "Clique e arraste do início até a ponta da seta.",
  text: "Clique no quadro e digite. Enter confirma e Esc cancela.",
};

export function Editor({ storage, server, deleting, navigation }: {
  storage: BoardStorage;
  server: boolean;
  deleting: boolean;
  navigation?: (locked: boolean) => ReactNode;
}) {
  const [tool, setTool] = useState<Tool>("select");
  const [styles, setStyles] = useState<Record<Exclude<Tool, "select" | "erase">, ElementStyle>>({
    rectangle: {}, circle: {}, arrow: {}, text: {},
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [imageError, setImageError] = useState("");
  const [importing, setImporting] = useState(false);
  const board = useWhiteboard(storage);
  useEffect(() => {
    if (!board.dirty) return;
    function confirmExit(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", confirmExit);
    return () => window.removeEventListener("beforeunload", confirmExit);
  }, [board.dirty]);
  const selected = tool === "select" ? board.shapes.find(({ id }) => id === selectedId) : undefined;
  const drawingStyle = tool === "select" || tool === "erase" ? undefined : styles[tool];

  function changeStyle(patch: ElementStyle) {
    if (tool !== "select" && tool !== "erase") {
      setStyles((previous) => ({ ...previous, [tool]: { ...previous[tool], ...patch } }));
    } else if (selected) {
      updateShape(selected.id, (shape) => ({ ...shape, ...patch }));
    }
  }
  const disabled = board.loading || board.loadFailed || deleting;

  async function importImage(file: File) {
    setImageError("");
    setImporting(true);
    try {
      const image = await readBoardImage(file);
      addShape(image);
      setSelectedId(image.id);
      setTool("select");
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Não foi possível abrir a imagem.");
    } finally {
      setImporting(false);
    }
  }

  function updateShape(id: string, update: (shape: Shape) => Shape) {
    board.setShapes((shapes) => shapes.map((shape) =>
      shape.id === id ? update(shape) : shape,
    ));
  }

  function changeImageSize(id: string, width: number, height: number) {
    updateShape(id, (shape) => shape.type === "image" ? { ...shape, width, height } : shape);
  }

  function changeArrowBend(id: string, bend: Point) {
    updateShape(id, (shape) => shape.type === "arrow" ? { ...shape, bend } : shape);
  }

  function eraseShape(id: string) {
    board.setShapes((shapes) => shapes.filter((shape) => shape.id !== id));
    setSelectedId((current) => current === id ? null : current);
  }

  function addShape(shape: Shape) {
    board.setShapes((shapes) => [...shapes, shape]);
  }

  function moveShape(id: string, position: Point) {
    updateShape(id, (shape) => ({ ...shape, x: position.x, y: position.y }));
  }

  const status = board.dirty ? "Salvando…" : server ? "Salvo no servidor" : "Salvo neste navegador";
  const saveError = server && board.saveError
    ? board.saveError
    : "Não foi possível salvar as últimas alterações.";

  return (
    <main className="app">
      <header className="app-header">
        <h1>Whiteboard</h1>
        {!disabled && !board.saveFailed && <span className="save-status" role="status">{status}</span>}
      </header>

      <div className="board-library">
        {navigation?.(board.dirty || importing)}
        <button type="button" disabled={disabled} onClick={() => downloadBackup(board.shapes)}>
          Exportar Board
        </button>
      </div>

      <Toolbar
        activeTool={tool}
        onToolChange={setTool}
        disabled={disabled}
        style={selected?.type === "image" ? undefined : selected ?? drawingStyle}
        styleType={selected?.type ?? tool}
        onImportImage={(file) => void importImage(file)}
        importing={importing}
        onStyleChange={changeStyle}
        onDelete={selected ? () => eraseShape(selected.id) : undefined}
      />
      {!disabled && (
        <p className="instructions">
          {selected?.type === "arrow" ? "Arraste o ponto da seta para ajustar a curva." :
            selected?.type === "image" ? "Arraste a alça no canto da imagem para redimensionar." :
            instructions[tool]}
        </p>
      )}
      {imageError && <p className="message" role="alert">{imageError}</p>}
      {board.loading && <p role="status">Carregando quadro…</p>}
      {board.loadFailed && (
        <div className="message">
          <p role="alert">Não foi possível abrir o quadro salvo.</p>
          <button type="button" onClick={board.retryLoad}>Tentar novamente</button>
        </div>
      )}
      {board.saveFailed && (
        <div className="message">
          <p role="alert">{saveError}</p>
          <button type="button" onClick={board.retrySave}>Tentar salvar novamente</button>
        </div>
      )}

      <div className="board-area">
        <Whiteboard
          tool={tool}
          drawingStyle={drawingStyle}
          scale={zoom / 100}
          onErase={eraseShape}
          selectedId={selectedId}
          onSelect={setSelectedId}
          shapes={board.shapes}
          disabled={disabled}
          onAdd={addShape}
          onMove={moveShape}
          onImageResize={changeImageSize}
          onArrowBend={changeArrowBend}
        />
        <div className="zoom-controls" role="group" aria-label="Zoom do quadro">
          <button
            type="button"
            aria-label="Diminuir zoom"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))}
          >−</button>
          <button type="button" title="Restaurar zoom para 100%" onClick={() => setZoom(100)}>
            {zoom}%
          </button>
          <button
            type="button"
            aria-label="Aumentar zoom"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))}
          >+</button>
        </div>
      </div>
    </main>
  );
}
