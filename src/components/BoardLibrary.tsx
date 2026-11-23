import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Editor } from "../Editor";
import { localLibrary, readBackup, serverLibrary, type BoardSummary } from "../utils/boardLibrary";

export default function BoardLibrary({ server }: { server: boolean }) {
  const library = server ? serverLibrary : localLibrary;
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [error, setError] = useState("");
  const storage = useMemo(() => library.storage(activeId), [activeId, library]);

  useEffect(() => {
    let active = true;
    library.list().then((items) => {
      if (!active) return;
      setBoards(items);
      setActiveId(items[0]?.id ?? "");
    }).catch(() => {
      if (active) setLoadError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [attempt, library]);

  async function addBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const name = String(fields.get("name")).trim();
    if (!name) {
      setError("Digite um nome para a lousa.");
      return;
    }
    const file = fields.get("backup");
    setCreating(true);
    setError("");
    try {
      const shapes = file instanceof File && file.name ? await readBackup(file) : [];
      const board = await library.create(name, shapes);
      setBoards((previous) => [board, ...previous]);
      setActiveId((previous) => previous || board.id);
      form.reset();
    } catch (failure) {
      setError(failure instanceof SyntaxError ? "O arquivo não contém uma lousa do Whiteboard." :
        failure instanceof Error ? failure.message : "Não foi possível criar a lousa.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteBoard() {
    const board = boards.find(({ id }) => id === activeId);
    if (!board || !window.confirm(`Excluir a lousa “${board.name}”? Essa ação é permanente.`)) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await library.remove(board.id);
      const remaining = boards.filter(({ id }) => id !== board.id);
      setBoards(remaining);
      setActiveId(remaining[0]?.id ?? "");
    } catch {
      setDeleteError("Não foi possível excluir a lousa. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  function navigation(locked: boolean) {
    return (
      <>
        {boards.length > 0 && (
          <label>
            Minhas Boards
            <select value={activeId} disabled={locked || creating || deleting} onChange={(event) => {
              setDeleteError("");
              setActiveId(event.target.value);
            }}>
              {boards.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        )}
        {activeId && (
          <button type="button" disabled={locked || creating || deleting} onClick={() => void deleteBoard()}>
            {deleting ? "Excluindo…" : "Excluir lousa"}
          </button>
        )}
        {deleteError && <p role="alert" className="message">{deleteError}</p>}
        <details open={boards.length === 0 ? true : undefined}>
          <summary>Nova lousa</summary>
          <form className="board-library" onSubmit={(event) => void addBoard(event)}>
            <label>Nome <input name="name" required maxLength={100} disabled={creating || deleting} /></label>
            <label>Importar arquivo (opcional) <input name="backup" type="file" accept=".json" disabled={creating || deleting} /></label>
            <button disabled={creating || deleting}>{creating ? "Criando…" : "Criar lousa"}</button>
            {error && <p role="alert" className="message">{error}</p>}
          </form>
        </details>
      </>
    );
  }

  if (activeId) return <Editor key={activeId} storage={storage} server={server} deleting={deleting} navigation={navigation} />;

  return (
    <main className="app">
      <h1>Whiteboard</h1>
      {loading ? <p role="status">Carregando lousas…</p> : loadError ? (
        <div className="message">
          <p role="alert">Não foi possível carregar suas lousas.</p>
          <button onClick={() => {
            setLoading(true);
            setLoadError(false);
            setAttempt((previous) => previous + 1);
          }}>Tentar novamente</button>
        </div>
      ) : <div className="board-library">{navigation(false)}</div>}
    </main>
  );
}
