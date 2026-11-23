import assert from "node:assert/strict";
import { test } from "node:test";
import "fake-indexeddb/auto";
import { createLocalBoard, deleteLocalBoard, listLocalBoards, loadBoard, saveBoard } from "../../src/utils/storage.ts";

test("carrega um quadro vazio e persiste a versão mais recente", async () => {
  assert.deepEqual(await loadBoard(), []);
  const shape = { id: "s", type: "square", x: 10, y: 20, size: 40 };
  await saveBoard([shape]);
  assert.deepEqual(await loadBoard(), [shape]);
  const movedShape = { ...shape, x: 25 };
  await saveBoard([movedShape]);
  assert.deepEqual(await loadBoard(), [movedShape]);
});

test("rejeita dados salvos com forma inválida ou identificador duplicado", async () => {
  const shape = { id: "s", type: "square", x: 10, y: 20, size: 40 };
  await saveBoard([{ ...shape, size: -1 }]);
  await assert.rejects(loadBoard(), /dados inválidos/);
  await saveBoard([shape, shape]);
  await assert.rejects(loadBoard(), /dados inválidos/);
});

test("lista o Board existente e salva cada novo Board separadamente", async () => {
  const legacyShape = { id: "legacy", type: "square", x: 10, y: 20, size: 40 };
  const importedShape = { ...legacyShape, id: "imported" };
  await saveBoard([legacyShape]);

  const [blank, imported] = await Promise.all([
    createLocalBoard("Projeto novo", []),
    createLocalBoard("Projeto importado", [importedShape]),
  ]);

  const [main, ...others] = await listLocalBoards();
  assert.deepEqual(main, { id: "default", name: "Board principal" });
  assert.equal(others.length, 2);
  assert.deepEqual(new Set(others.map(({ id }) => id)), new Set([blank.id, imported.id]));
  assert.deepEqual(await loadBoard(blank.id), []);
  await saveBoard([legacyShape], blank.id);
  assert.deepEqual(await loadBoard(imported.id), [importedShape]);
  assert.deepEqual(await loadBoard(), [legacyShape]);

  await deleteLocalBoard(blank.id);
  await deleteLocalBoard(main.id);
  assert.deepEqual(await listLocalBoards(), [imported]);
  assert.deepEqual(await loadBoard(), []);
  assert.deepEqual(await loadBoard(blank.id), []);
  await assert.rejects(saveBoard([legacyShape], main.id));
  await assert.rejects(saveBoard([legacyShape], blank.id));
  assert.deepEqual(await loadBoard(imported.id), [importedShape]);

  await deleteLocalBoard(imported.id);
  assert.deepEqual(await listLocalBoards(), []);
});
