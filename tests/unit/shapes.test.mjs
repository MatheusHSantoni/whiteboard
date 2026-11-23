import assert from "node:assert/strict";
import { test } from "node:test";
import { createDrawing, isShape } from "../../src/types/shapes.ts";

test("cria um quadrado ao arrastar para cima e para a esquerda", () => {
  assert.deepEqual(createDrawing("s", "square", { x: 40, y: 50 }, { x: 10, y: 30 }), {
    id: "s", type: "square", x: 10, y: 20, size: 30,
  });
});

test("mantém a direção da seta e descarta gestos curtos", () => {
  assert.deepEqual(createDrawing("a", "arrow", { x: 10, y: 20 }, { x: 4, y: 30 }), {
    id: "a", type: "arrow", x: 10, y: 20, dx: -6, dy: 10,
  });
  assert.equal(createDrawing("a", "arrow", { x: 0, y: 0 }, { x: 4, y: 4 }), null);
});

test("rejeita coordenadas inválidas e textos vazios ou longos demais", () => {
  const text = { id: "t", type: "text", x: 1, y: 2 };
  assert.equal(isShape({ ...text, text: "Olá" }), true);
  assert.equal(isShape({ ...text, text: "Olá", color: "#123abc" }), true);
  assert.equal(isShape({ ...text, text: "Olá", color: "invalid" }), false);
  assert.equal(isShape({ ...text, text: "  " }), false);
  assert.equal(isShape({ ...text, text: "x".repeat(501) }), false);
  assert.equal(isShape({ ...text, x: Infinity, text: "Olá" }), false);
});
