import { useEffect } from "react";
import {
  DEFAULT_DRAWING_COLOR, DEFAULT_FILL, DEFAULT_FONT_SIZE, FONTS, FONT_SIZES,
  IMAGE_TYPES, type ElementStyle, type Shape, type Tool,
} from "../../types/shapes";

const tools = [
  { id: "select", label: "Selecionar", icon: "↖", key: "V" },
  { id: "rectangle", label: "Retângulo", icon: "▭", key: "S" },
  { id: "circle", label: "Círculo", icon: "○", key: "C" },
  { id: "arrow", label: "Seta", icon: "↗", key: "A" },
  { id: "text", label: "Texto", icon: "T", key: "T" },
] as const;

type ToolbarProps = {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  disabled: boolean;
  style?: ElementStyle;
  styleType: Tool | Shape["type"];
  onImportImage: (file: File) => void;
  importing: boolean;
  onStyleChange: (patch: ElementStyle) => void;
  onDelete?: () => void;
};

export default function Toolbar({
  activeTool, onToolChange, disabled, style, styleType, onStyleChange, onDelete, onImportImage, importing,
}: ToolbarProps) {
  const hasFill = styleType === "square" || styleType === "rectangle" || styleType === "circle";

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (disabled || event.defaultPrevented || event.ctrlKey ||
          event.metaKey || event.shiftKey || event.repeat) return;
      if (event.target instanceof HTMLElement &&
          (event.target.isContentEditable || event.target.closest("input, textarea, select"))) return;

      if (event.key === "Delete" && !event.altKey && onDelete) {
        event.preventDefault();
        onDelete();
        return;
      }
      if (!event.altKey) return;

      const tool = tools.find(({ key }) => key === event.key.toUpperCase());
      if (!tool) return;
      event.preventDefault();
      onToolChange(tool.id);
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [disabled, onToolChange, onDelete]);

  return (
    <nav className="toolbar" aria-label="Ferramentas do quadro">
      <details className="shortcuts">
        <summary>Atalhos</summary>
        <dl className="shortcut-list">
          {tools.map(({ id, label, icon, key }) => (
            <div key={id}>
              <dt>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={activeTool === id}
                  aria-keyshortcuts={`Alt+${key}`}
                  onClick={(event) => {
                    onToolChange(id);
                    const disclosure = event.currentTarget.closest("details");
                    if (disclosure) {
                      disclosure.open = false;
                      disclosure.querySelector("summary")?.focus();
                    }
                  }}
                >
                  <span className="tool-icon" aria-hidden="true">{icon}</span>
                  {label}
                </button>
              </dt>
              <dd><kbd>Alt + {key}</kbd></dd>
            </div>
          ))}
          <div>
            <dt>Mover o Board</dt>
            <dd><kbd>Alt + arrastar</kbd></dd>
          </div>
          <div>
            <dt>Adicionar ou remover da seleção</dt>
            <dd><kbd>Ctrl + clique</kbd></dd>
          </div>
          <div>
            <dt>Apagar seleção</dt>
            <dd><kbd>Delete</kbd></dd>
          </div>
          <div>
            <dt>Confirmar texto</dt>
            <dd><kbd>Enter</kbd></dd>
          </div>
          <div>
            <dt>Quebrar linha no texto</dt>
            <dd><kbd>Shift + Enter</kbd></dd>
          </div>
          <div>
            <dt>Cancelar texto</dt>
            <dd><kbd>Esc</kbd></dd>
          </div>
        </dl>
      </details>
      <button
        type="button"
        className="eraser-button"
        aria-label="Borracha"
        title="Borracha"
        aria-pressed={activeTool === "erase"}
        disabled={disabled}
        onClick={() => onToolChange(activeTool === "erase" ? "select" : "erase")}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3.5 13.5 9.7-9.7a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8L11 20H8l-4.5-3.7a2 2 0 0 1 0-2.8Z"/>
          <path d="m8 9 8 8m-5 3h10"/>
        </svg>
      </button>
      <label className="tool-color compact-style">
        {importing ? "Abrindo imagem…" : "Inserir imagem"}
        <input
          type="file"
          accept={IMAGE_TYPES.join(",")}
          disabled={disabled || importing}
          aria-label="Inserir imagem"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) onImportImage(file);
          }}
        />
      </label>
      <label className="tool-color">
        {hasFill ? "Contorno" : "Cor"}
        <input
          type="color"
          aria-label="Cor da ferramenta"
          title={hasFill ? "Cor do contorno" : undefined}
          value={style?.color ?? DEFAULT_DRAWING_COLOR}
          disabled={disabled || !style}
          onChange={(event) => onStyleChange({ color: event.target.value })}
        />
      </label>
      <details className="shortcuts fill-menu" key={hasFill && !disabled ? "fill" : "fill-disabled"}>
        <summary
          aria-disabled={disabled || !hasFill}
          tabIndex={disabled || !hasFill ? -1 : undefined}
          onClick={(event) => {
            if (disabled || !hasFill) event.preventDefault();
          }}
        >Preenchimento</summary>
        <div className="shortcut-list">
          <label className="tool-color">
            Cor do preenchimento
            <input
              type="color"
              value={style?.fillColor ?? DEFAULT_FILL}
              disabled={disabled || !hasFill}
              onChange={(event) => onStyleChange({ fillColor: event.target.value, noFill: false })}
            />
          </label>
          <button
            type="button"
            disabled={disabled || !hasFill || !style?.noFill}
            onClick={() => onStyleChange({ fillColor: style?.fillColor ?? DEFAULT_FILL, noFill: false })}
          >Aplicar cor</button>
          <button
            type="button"
            disabled={disabled || !hasFill}
            aria-pressed={style?.noFill === true}
            onClick={() => onStyleChange({ noFill: true })}
          >Sem preenchimento</button>
        </div>
      </details>
      <label className="tool-color compact-style">
        Fonte
        <select
          value={style?.font ?? "system"}
          disabled={disabled || styleType !== "text"}
          onChange={(event) => {
            const font = event.target.value as keyof typeof FONTS;
            if (Object.hasOwn(FONTS, font)) onStyleChange({ font });
          }}
        >
          {Object.entries(FONTS).map(([id, { label }]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </label>
      <label className="tool-color compact-style">
        Tamanho
        <select
          value={style?.fontSize ?? DEFAULT_FONT_SIZE}
          disabled={disabled || styleType !== "text"}
          onChange={(event) => onStyleChange({ fontSize: Number(event.target.value) })}
        >
          {FONT_SIZES.map((size) => <option key={size} value={size}>{size} px</option>)}
        </select>
      </label>
    </nav>
  );
}
