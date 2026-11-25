import { useEffect } from "react";
import pencilIcon from "../../assets/pencil.svg";
import markerIcon from "../../assets/marker.svg";
import {
  DEFAULT_DRAWING_COLOR, DEFAULT_FILL, DEFAULT_FONT_SIZE, FONTS, FONT_SIZES,
  IMAGE_TYPES, type ElementStyle, type FreehandTool, type Shape, type Tool,
} from "../../types/shapes";

const tools = [
  { id: "select", label: "Selecionar", icon: "↖", key: "V" },
  { id: "rectangle", label: "Retângulo", icon: "▭", key: "S" },
  { id: "circle", label: "Círculo", icon: "○", key: "C" },
  { id: "arrow", label: "Seta", icon: "↗", key: "A" },
  { id: "pencil", label: "Lápis", icon: "✎", key: "P" },
  { id: "marker", label: "Marca-texto", icon: "▰", key: "M" },
  { id: "erase", label: "Borracha", icon: "◇", key: "B" },
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
  onStrokeWidthChange: (tool: FreehandTool, direction: number) => void;
  onDelete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
};

export default function Toolbar({
  activeTool, onToolChange, disabled, style, styleType, onStyleChange, onStrokeWidthChange, onDelete, onUndo, onRedo, onImportImage, importing,
}: ToolbarProps) {
  const hasFill = styleType === "square" || styleType === "rectangle" || styleType === "circle";

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (disabled || event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.isContentEditable || target?.closest("textarea, input:not([type=color]):not([type=file])")) return;

      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
        const key = event.key.toLowerCase();
        const action = key === "z" ? onUndo : key === "y" ? onRedo : undefined;
        if (action) {
          event.preventDefault();
          action();
          return;
        }
      }
      if (event.ctrlKey || event.metaKey || target?.closest("input, select")) return;

      if ((activeTool === "pencil" || activeTool === "marker") && !event.altKey &&
          (event.key === "+" || event.key === "-")) {
        event.preventDefault();
        onStrokeWidthChange(activeTool, event.key === "+" ? 1 : -1);
        return;
      }
      if (event.shiftKey || event.repeat) return;

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
  }, [activeTool, disabled, onToolChange, onDelete, onUndo, onRedo, onStrokeWidthChange]);

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
            <dd><kbd>Ctrl + arrastar</kbd></dd>
          </div>
          <div>
            <dt>Adicionar ou remover da seleção</dt>
            <dd><kbd>Shift + clique</kbd></dd>
          </div>
          <div>
            <dt>Ajustar espessura do lápis ou marca-texto</dt>
            <dd><kbd>+ / −</kbd></dd>
          </div>
          <div>
            <dt>Desfazer última edição</dt>
            <dd><kbd>Ctrl + Z</kbd></dd>
          </div>
          <div>
            <dt>Refazer edição desfeita</dt>
            <dd><kbd>Ctrl + Y</kbd></dd>
          </div>
          <div>
            <dt>Copiar seleção</dt>
            <dd><kbd>Ctrl + C</kbd></dd>
          </div>
          <div>
            <dt>Colar elementos</dt>
            <dd><kbd>Ctrl + V</kbd></dd>
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
            <dt>Lista numerada</dt>
            <dd><kbd>Ctrl + Shift + 7</kbd></dd>
          </div>
          <div>
            <dt>Lista com marcadores</dt>
            <dd><kbd>Ctrl + Shift + 8</kbd></dd>
          </div>
          <div>
            <dt>Lista de verificação</dt>
            <dd><kbd>Ctrl + Shift + 9</kbd></dd>
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
      {tools.filter(({ id }) => id === "pencil" || id === "marker").map(({ id, label, key }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          className="icon-tool-button"
          aria-label={label}
          title={label}
          aria-pressed={activeTool === id}
          aria-keyshortcuts={`Alt+${key}`}
          onClick={() => onToolChange(id)}
        >
          <img src={id === "pencil" ? pencilIcon : markerIcon} alt="" width={20} height={20} />
        </button>
      ))}
      <button
        type="button"
        className="icon-tool-button"
        aria-label="Borracha"
        aria-keyshortcuts="Alt+B"
        title="Borracha (Alt + B)"
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
        {FONTS[style?.font ?? "system"].label}
        <select
          aria-label="Fonte"
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
      <button
        type="button"
        aria-label="Negrito"
        aria-pressed={style?.bold === true}
        title="Negrito"
        disabled={disabled || styleType !== "text"}
        onClick={() => onStyleChange({ bold: !style?.bold })}
      ><strong aria-hidden="true">B</strong></button>
      <label className="tool-color compact-style">
        {style?.fontSize ?? DEFAULT_FONT_SIZE} px
        <select
          aria-label="Tamanho"
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
