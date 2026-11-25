import assert from "node:assert/strict";
import { test } from "node:test";
import { createDrawing, isShape } from "../../src/types/shapes.ts";

test("cria um retângulo ao arrastar para cima e para a esquerda", () => {
  assert.deepEqual(createDrawing("r", "rectangle", { x: 40, y: 50 }, { x: 10, y: 30 }), {
    id: "r", type: "rectangle", x: 10, y: 30, width: 30, height: 20,
  });
});

test("mantém a direção da seta e descarta gestos curtos", () => {
  assert.deepEqual(createDrawing("a", "arrow", { x: 10, y: 20 }, { x: 4, y: 30 }), {
    id: "a", type: "arrow", x: 10, y: 20, dx: -6, dy: 10,
  });
  assert.equal(createDrawing("a", "arrow", { x: 0, y: 0 }, { x: 4, y: 4 }), null);
});

test("cria círculos pelo raio e valida as dimensões das formas", () => {
  const circle = createDrawing("c", "circle", { x: 80, y: 90 }, { x: 50, y: 50 });
  assert.deepEqual(circle, { id: "c", type: "circle", x: 80, y: 90, radius: 50 });
  assert.equal(isShape(circle), true);
  assert.equal(isShape({ ...circle, radius: Infinity }), false);

  const rectangle = createDrawing("r", "rectangle", { x: 0, y: 0 }, { x: 40, y: 15 });
  assert.equal(isShape(rectangle), true);
  assert.equal(isShape({ ...rectangle, height: 0 }), false);
  assert.equal(createDrawing("r", "rectangle", { x: 0, y: 0 }, { x: 40, y: 0 }), null);
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

test("rejeita lacunas nas coordenadas de traços e nas marcações de texto", () => {
  const stroke = { id: "p", type: "pencil", x: 0, y: 0, strokeWidth: 3 };
  const text = { id: "t", type: "text", x: 0, y: 0, text: "Olá" };
  assert.equal(isShape({ ...stroke, points: [0, 1] }), true);
  assert.equal(isShape({ ...stroke, points: Array(2) }), false);
  assert.equal(isShape({ ...text, marks: [{ index: 0, color: "#123abc" }] }), true);
  assert.equal(isShape({ ...text, marks: Array(1) }), false);
});
