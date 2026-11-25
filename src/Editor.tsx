import "./App.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { downloadBackup, type BoardStorage } from "./utils/boardLibrary";
import Whiteboard from "./components/Canvas/Whiteboard";
import Toolbar from "./components/Toolbar/Toolbar";
import { readBoardImage } from "./utils/boardImage";
import { eraseStroke } from "./utils/eraseStroke";
import { useWhiteboard } from "./hooks/useWhiteboard";
import { isShapeList, MAX_STROKE_WIDTH, resizeShape, type FreehandTool, type ElementStyle, type Point, type Shape, type TextMark, type Tool } from "./types/shapes";

const BOARD_CLIPBOARD_TYPE = "application/x-whiteboard-shapes+json";
const PASTE_OFFSET = 20;

const BOARD_SURFACES = [[255, 255, 255], [255, 253, 243], [18, 18, 18]] as const;

function getBoardSurface(percent: number) {
  const [start, end] = percent <= 50 ? BOARD_SURFACES.slice(0, 2) : BOARD_SURFACES.slice(1);
  const progress = (percent <= 50 ? percent : percent - 50) / 50;
  const [r, g, b] = start.map((value, index) => Math.round(value + (end[index] - value) * progress));
  const [red, green, blue] = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return {
    color: `rgb(${r}, ${g}, ${b})`,
    dark: 0.2126 * red + 0.7152 * green + 0.0722 * blue <= 0.18,
  };
}

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 25;

const instructions: Record<Tool, string> = {
  select: "Clique em um elemento ou arraste numa área vazia para selecionar vários.",
  pencil: "Arraste para desenhar livremente.",
  marker: "Arraste para destacar uma área da lousa.",
  erase: "Arraste para apagar partes dos traços. Use Delete para apagar um traço selecionado.",
  rectangle: "Clique e arraste para desenhar um retângulo.",
  circle: "Clique no centro e arraste para definir o raio do círculo.",
  line: "Clique e arraste para desenhar uma linha.",
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
    rectangle: { noFill: true }, circle: { noFill: true }, arrow: {}, line: {}, text: {},
    pencil: {}, marker: { color: "#fff176" },
  });
  const [strokeWidths, setStrokeWidths] = useState({ pencil: 3, marker: 18 });
  const [selection, setSelectedIds] = useState<string[]>([]);
  const [surfacePercent, setSurfacePercent] = useState(50);
  const surface = getBoardSurface(surfacePercent);
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
  const selectedIds = selection.filter((id) => board.shapes.some((shape) => shape.id === id));
  const selected = tool === "select" && selectedIds.length === 1
    ? board.shapes.find(({ id }) => id === selectedIds[0]) : undefined;
  const drawingStyle = tool === "select" || tool === "erase" ? undefined : styles[tool];

  const freehand = tool === "pencil" || tool === "marker" ? tool : undefined;
  const strokeWidth = freehand ? strokeWidths[freehand] : undefined;

  function changeStrokeWidth(tool: FreehandTool, direction: number) {
    const step = tool === "marker" ? 2 : 1;
    setStrokeWidths((current) => ({
      ...current,
      [tool]: Math.max(1, Math.min(MAX_STROKE_WIDTH, current[tool] + direction * step)),
    }));
  }

  function changeStyle(patch: ElementStyle) {
    if (tool !== "select" && tool !== "erase") {
      setStyles((previous) => ({ ...previous, [tool]: { ...previous[tool], ...patch } }));
    } else if (selected) {
      updateShape(selected.id, (shape) => ({ ...shape, ...patch }));
    }
  }
  const disabled = board.loading || board.loadFailed || deleting;
  const previousPaste = useRef<{ payload: string; offset: number } | null>(null);

  useEffect(() => {
    if (disabled) return;

    function canUseClipboard(event: ClipboardEvent): boolean {
      const target = event.target;
      return !event.defaultPrevented && !(target instanceof HTMLElement &&
        (target.isContentEditable || target.closest("input, textarea, select")));
    }

    function copy(event: ClipboardEvent) {
      if (!canUseClipboard(event) || tool !== "select" || !selectedIds.length ||
          !event.clipboardData || window.getSelection()?.isCollapsed === false) return;
      const ids = new Set(selectedIds);
      event.clipboardData.setData(BOARD_CLIPBOARD_TYPE, JSON.stringify(
        board.shapes.filter((shape) => ids.has(shape.id)),
      ));
      previousPaste.current = null;
      event.preventDefault();
    }

    function paste(event: ClipboardEvent) {
      if (!canUseClipboard(event)) return;
      const payload = event.clipboardData?.getData(BOARD_CLIPBOARD_TYPE);
      if (!payload) return;

      let data: unknown;
      try {
        data = JSON.parse(payload);
      } catch {
        return;
      }
      if (!isShapeList(data) || !data.length) return;
      const last = previousPaste.current;
      const offset = last?.payload === payload ? last.offset + PASTE_OFFSET : PASTE_OFFSET;
      previousPaste.current = { payload, offset };
      const copies = data.map((shape) => ({
        ...shape,
        id: crypto.randomUUID(),
        x: shape.x + offset,
        y: shape.y + offset,
      }));
      event.preventDefault();
      board.setShapes((shapes) => [...shapes, ...copies]);
      setSelectedIds(copies.map(({ id }) => id));
      setTool("select");
    }

    window.addEventListener("copy", copy);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("copy", copy);
      window.removeEventListener("paste", paste);
    };
  }, [board.shapes, board.setShapes, disabled, selectedIds, tool]);

  async function importImage(file: File) {
    setImageError("");
    setImporting(true);
    try {
      const image = await readBoardImage(file);
      addShape(image);
      setSelectedIds([image.id]);
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

  function changeShapeSize(id: string, point: Point) {
    board.setShapes((shapes) => shapes.map((shape) =>
      shape.id === id ? resizeShape(shape, point) : shape,
    ));
  }

  function editText(id: string, text: string, marks: TextMark[]) {
    if (!text) {
      eraseShapes([id]);
      return;
    }
    updateShape(id, (shape) => shape.type === "text" ? { ...shape, text, marks } : shape);
  }

  function changeArrowBend(id: string, bend: Point) {
    updateShape(id, (shape) => (shape.type === "arrow" || shape.type === "line") ? { ...shape, bend } : shape);
  }

  function eraseShapes(ids: string[], historyGroup?: symbol) {
    const removed = new Set(ids);
    board.setShapes((shapes) => shapes.filter((shape) => !removed.has(shape.id)), historyGroup);
    setSelectedIds((current) => current.filter((id) => !removed.has(id)));
  }

  function eraseAt(ids: string[], from: Point, to: Point, radius: number, historyGroup: symbol) {
    const removed = new Set(ids);
    const token = crypto.randomUUID();
    board.setShapes((shapes) => {
      let index = 0;
      return shapes.flatMap((shape) => removed.has(shape.id) ? [] :
        eraseStroke(shape, from, to, radius, () => `${token}-${index++}`));
    }, historyGroup);
  }

  function addShape(shape: Shape) {
    board.setShapes((shapes) => [...shapes, shape]);
  }

  function moveShapes(ids: string[], delta: Point) {
    const moving = new Set(ids);
    board.setShapes((shapes) => shapes.map((shape) => moving.has(shape.id)
      ? { ...shape, x: shape.x + delta.x, y: shape.y + delta.y } : shape));
  }

  const status = board.dirty ? "Salvando…" : server ? "Salvo no servidor" : "Salvo neste navegador";
  const saveError = server && board.saveError
    ? board.saveError
    : "Não foi possível salvar as últimas alterações.";

  function reloadServerBoard() {
    if (!window.confirm("Carregar a versão do servidor e descartar as alterações locais?")) return;
    setSelectedIds([]);
    board.retryLoad();
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Whiteboard</h1>
        <div className="board-header-controls">
          {!disabled && !board.saveFailed && <span className="save-status" role="status">{status}</span>}
          <label className="board-surface">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={surfacePercent}
              aria-label="Fundo da lousa"
              aria-valuetext={`${surfacePercent}%`}
              onChange={(event) => setSurfacePercent(event.currentTarget.valueAsNumber)}
            />
            <span aria-hidden="true">{surfacePercent}%</span>
          </label>
        </div>
      </header>

      <div className="board-library">
        {navigation?.(board.dirty || importing)}
        <button type="button" disabled={disabled && !board.saveConflict} onClick={() => downloadBackup(board.shapes)}>
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
        onStrokeWidthChange={changeStrokeWidth}
        onUndo={board.canUndo ? board.undo : undefined}
        onRedo={board.canRedo ? board.redo : undefined}
        onDelete={tool === "select" && selectedIds.length ? () => eraseShapes(selectedIds) : undefined}
      />
      {!disabled && (
        <p className="instructions">
          {tool === "select" && selectedIds.length > 1
            ? `${selectedIds.length} elementos selecionados. Arraste para mover ou use Ctrl + C para copiar.`
            : selected?.type === "text" ? "Dê dois cliques para editar ou arraste a alça roxa para mudar a largura do texto." :
            selected?.type === "line" ? "Arraste a ponta roxa para redimensionar a linha ou o ponto branco para ajustar a curva." :
            selected?.type === "arrow" ? "Arraste a ponta roxa para redimensionar a seta ou o ponto branco para ajustar a curva." :
            selected?.type === "image" ? "Arraste a alça no canto da imagem para redimensionar." :
            selected && ["square", "rectangle", "circle"].includes(selected.type)
              ? "Arraste a alça roxa para redimensionar a forma." : instructions[tool]}
          {strokeWidth !== undefined && ` Espessura: ${strokeWidth} px (+ / −).`}
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
      {board.saveFailed && !board.loading && !board.loadFailed && (
        <div className="message">
          <p role="alert">{saveError}</p>
          {board.saveConflict ? (
            <button type="button" onClick={reloadServerBoard}>Carregar versão do servidor</button>
          ) : (
            <button type="button" onClick={board.retrySave}>Tentar salvar novamente</button>
          )}
        </div>
      )}

      <div className="board-area">
        <Whiteboard
          tool={tool}
          drawingStyle={drawingStyle}
          strokeWidth={strokeWidth}
          scale={zoom / 100}
          surface={surface}
          onErase={eraseAt}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          shapes={board.shapes}
          disabled={disabled}
          onAdd={addShape}
          onTextEdit={editText}
          onMove={moveShapes}
          onImageResize={changeImageSize}
          onResize={changeShapeSize}
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
