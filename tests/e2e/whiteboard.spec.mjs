import { expect, test } from "@playwright/test";

async function drag(page, canvas, start, end) {
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + start.x, bounds.y + start.y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + end.x, bounds.y + end.y, { steps: 5 });
  await page.mouse.up();
}

function savedShapes() {
  return new Promise((resolve, reject) => {
    const open = globalThis.indexedDB.open("whiteboard");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction("boards", "readonly");
      const read = transaction.objectStore("boards").get("default");
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
      transaction.oncomplete = () => db.close();
    };
  });
}

test("salva automaticamente desenhos e edições e recupera após recarregar", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas").first();
  await expect(page.getByText("Clique em um elemento ou arraste numa área vazia para selecionar vários.")).toBeVisible();

  const shortcuts = page.getByText("Atalhos", { exact: true });
  await shortcuts.focus();
  await page.keyboard.press("Enter");
  const shortcutList = page.locator(".shortcut-list");
  await expect(shortcutList).toBeVisible();
  await expect(shortcutList.locator("kbd")).toHaveText([
    "Alt + V", "Alt + S", "Alt + C", "Alt + A", "Alt + T", "Alt + arrastar", "Ctrl + clique", "Delete", "Enter", "Shift + Enter", "Esc",
  ]);
  await page.keyboard.press("Enter");
  await expect(shortcutList).toBeHidden();

  await page.getByRole("button", { name: "Diminuir zoom" }).click();
  const zoom = page.getByRole("group", { name: "Zoom do quadro" });
  await expect(zoom.getByRole("button", { name: "75%" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Área de desenho" }))
    .toHaveCSS("background-size", "15px 15px");
  await zoom.getByRole("button", { name: "75%" }).click();
  await expect(zoom.getByRole("button", { name: "100%" })).toBeVisible();

  const color = page.getByLabel("Cor da ferramenta");
  await expect(color).toBeDisabled();
  for (const label of ["Preenchimento", "Fonte", "Tamanho"]) {
    const control = page.getByLabel(label);
    await expect(control).toBeVisible();
    await expect(control).toBeDisabled();
    await expect(control).toHaveCSS("opacity", "0");
  }
  await page.keyboard.press("Alt+s");
  await color.fill("#dc2638");
  await expect(page.getByText("Clique e arraste para desenhar um retângulo.")).toBeVisible();
  await drag(page, canvas, { x: 45, y: 50 }, { x: 105, y: 105 });

  await shortcuts.click();
  await expect(page.getByRole("button", { name: "Retângulo" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Seta" }).click();
  await expect(shortcutList).toBeHidden();
  await expect(color).toHaveValue("#293452");
  await color.fill("#16805c");
  await drag(page, canvas, { x: 150, y: 90 }, { x: 215, y: 90 });

  await page.keyboard.press("Alt+s");
  await expect(color).toHaveValue("#dc2638");
  await page.keyboard.press("Alt+t");
  await color.fill("#6337c7");
  await canvas.click({ position: { x: 75, y: 180 } });
  const editor = page.getByRole("textbox", { name: "Texto do elemento" });
  await expect(editor).toBeFocused();
  const canvasBounds = await canvas.boundingBox();
  const editorBounds = await editor.boundingBox();
  expect(editorBounds.x - canvasBounds.x).toBe(75);
  expect(editorBounds.y - canvasBounds.y).toBe(180);
  await page.keyboard.type("Meu primeiro quadro");
  await page.keyboard.press("Enter");
  await expect(editor).toHaveCount(0);

  await canvas.click({ position: { x: 90, y: 250 } });
  await page.keyboard.type("Cancelar");
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);

  await page.keyboard.press("Alt+v");
  await drag(page, canvas, { x: 60, y: 65 }, { x: 80, y: 95 });
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "rectangle", x: 65, y: 80, width: 60, height: 55, color: "#dc2638" }),
    expect.objectContaining({ type: "arrow", dx: 65, dy: 0, color: "#16805c" }),
    expect.objectContaining({ type: "text", text: "Meu primeiro quadro", color: "#6337c7" }),
  ]);

  await page.reload();
  await expect(page.getByText("Clique em um elemento ou arraste numa área vazia para selecionar vários.")).toBeVisible();
  await drag(page, canvas, { x: 80, y: 95 }, { x: 110, y: 95 });
  await expect(color).toHaveValue("#dc2638");
  await color.fill("#214bd5");
  await page.getByLabel("Preenchimento").fill("#ffec9a");

  await canvas.click({ position: { x: 90, y: 190 } });
  await canvas.dblclick({ position: { x: 90, y: 190 } });
  await expect(editor).toHaveValue("Meu primeiro quadro");
  await editor.fill("Rascunho descartado");
  await editor.press("Escape");
  await canvas.dblclick({ position: { x: 90, y: 190 } });
  await expect(editor).toHaveValue("Meu primeiro quadro");
  await editor.fill("Texto atualizado");
  await editor.press("Home");
  for (let index = 0; index < 5; index++) await editor.press("Shift+ArrowRight");
  const format = page.getByRole("group", { name: "Formatar trecho" });
  await format.getByLabel("Cor do trecho").fill("#d71920");
  await format.getByRole("button", { name: "Marca-texto amarelo" }).click();
  await editor.press("Enter");
  const font = page.getByLabel("Fonte");
  await expect(font.locator("option[value=verdana]")).toHaveText("Verdana");
  await font.selectOption("handwriting");
  await page.getByLabel("Tamanho").selectOption("32");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "rectangle", x: 95, y: 80, width: 60, height: 55, color: "#214bd5", fillColor: "#ffec9a" }),
    expect.objectContaining({ type: "arrow" }),
    expect.objectContaining({ type: "text", text: "Texto atualizado", x: 75, y: 180, font: "handwriting", fontSize: 32,
      marks: Array.from({ length: 5 }, (_, index) => ({ index, color: "#d71920", highlight: "#fff176" })), }),
  ]);

  await canvas.click({ position: { x: 90, y: 190 } });
  await expect.poll(() => canvas.evaluate((node) => {
    const pixels = node.getContext("2d").getImageData(75, 180, 240, 42).data;
    let textColor = false;
    let highlight = false;
    for (let index = 0; index < pixels.length; index += 4) {
      const [red, green, blue, alpha] = pixels.subarray(index, index + 4);
      textColor ||= alpha === 255 && red === 215 && green === 25 && blue === 32;
      highlight ||= alpha === 255 && red === 255 && green === 241 && blue === 118;
    }
    return textColor && highlight;
  })).toBe(true);
  await page.keyboard.press("Delete");
  await page.getByRole("button", { name: "Aumentar zoom" }).click();
  await expect(page.getByRole("button", { name: "125%" })).toBeVisible();
  await page.getByRole("button", { name: "Borracha" }).click();
  await canvas.click({ position: { x: 135, y: 113 } });
  await page.getByRole("button", { name: "Diminuir zoom" }).click();
  await expect(page.getByRole("button", { name: "100%" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "arrow", x: 150, y: 90 }),
  ]);

  await page.keyboard.down("Alt");
  await drag(page, canvas, { x: 180, y: 90 }, { x: 220, y: 120 });
  await page.keyboard.up("Alt");
  const board = page.getByRole("region", { name: "Área de desenho" });
  await expect(board).toHaveCSS("background-position", "40px 30px");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "arrow", x: 150, y: 90 }),
  ]);
  await canvas.click({ position: { x: 220, y: 120 } });
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([]);
});

test("desenha, salva e seleciona um círculo após recarregar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("option", { name: "Board principal" })).toBeAttached();
  await expect(page.getByRole("button", { name: "Exportar Board" })).toBeEnabled();
  const canvas = page.locator("canvas").first();

  await page.keyboard.press("Alt+c");
  const fill = page.getByLabel("Preenchimento");
  await fill.fill("#ffec9a");
  await drag(page, canvas, { x: 100, y: 100 }, { x: 130, y: 140 });
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "circle", x: 100, y: 100, radius: 50, fillColor: "#ffec9a" }),
  ]);

  await page.reload();
  await expect(page.getByRole("button", { name: "Exportar Board" })).toBeEnabled();
  await canvas.click({ position: { x: 100, y: 100 } });
  await expect(fill).toHaveValue("#ffec9a");
  const noFill = page.getByRole("button", { name: "Sem preenchimento" });
  await noFill.click();
  await expect(noFill).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => canvas.evaluate((node) =>
    node.getContext("2d").getImageData(100, 100, 1, 1).data[3],
  )).toBe(0);
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "circle", noFill: true, fillColor: "#ffec9a" }),
  ]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Exportar Board" })).toBeEnabled();
  await canvas.click({ position: { x: 150, y: 100 } });
  await expect(noFill).toHaveAttribute("aria-pressed", "true");
  await noFill.click();
  await expect.poll(() => canvas.evaluate((node) =>
    node.getContext("2d").getImageData(100, 100, 1, 1).data[3],
  )).toBe(255);
  await drag(page, canvas, { x: 150, y: 100 }, { x: 175, y: 100 });
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "circle", x: 100, y: 100, radius: 75 }),
  ]);
});

test("redimensiona uma imagem e curva uma seta", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas").first();
  const input = page.getByLabel("Inserir imagem");
  await expect(input).toBeEnabled();
  const png = await page.evaluate(() => {
    const bitmap = globalThis.document.createElement("canvas");
    bitmap.width = 80;
    bitmap.height = 60;
    const context = bitmap.getContext("2d");
    context.fillRect(0, 0, 80, 60);
    return bitmap.toDataURL().split(",")[1];
  });
  const { Buffer } = await import("node:buffer");
  await input.setInputFiles({ name: "imagem.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await expect(page.getByText(/Arraste a alça/)).toBeVisible();
  await expect.poll(() => canvas.evaluate((node) =>
    node.getContext("2d").getImageData(40, 40, 1, 1).data[3],
  )).toBeGreaterThan(0);
  await drag(page, canvas, { x: 112, y: 92 }, { x: 152, y: 122 });

  await page.keyboard.press("Alt+a");
  await drag(page, canvas, { x: 180, y: 100 }, { x: 280, y: 100 });
  await page.keyboard.press("Alt+v");
  await canvas.click({ position: { x: 190, y: 100 } });
  await expect(page.getByText(/Arraste a ponta roxa/)).toBeVisible();
  await drag(page, canvas, { x: 230, y: 100 }, { x: 230, y: 145 });
  await drag(page, canvas, { x: 280, y: 100 }, { x: 320, y: 80 });

  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "image", width: 120, height: 90 }),
    expect.objectContaining({ type: "arrow", dx: 140, dy: -20, bend: { x: 50, y: 45 } }),
  ]);
});

test("permite repetir o salvamento automático após uma falha de armazenamento", async ({ page }) => {
  await page.addInitScript(() => {
    const prototype = globalThis.IDBDatabase.prototype;
    const transaction = prototype.transaction;
    let failNextWrite = true;
    prototype.transaction = function (...args) {
      if (args[1] === "readwrite" && failNextWrite) {
        failNextWrite = false;
        throw new Error("Falha temporária de armazenamento");
      }
      return transaction.apply(this, args);
    };
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  const canvas = page.locator("canvas").first();
  await page.keyboard.press("Alt+s");
  await drag(page, canvas, { x: 45, y: 50 }, { x: 105, y: 105 });

  await expect(page.getByRole("alert")).toHaveText("Não foi possível salvar as últimas alterações.");
  await page.getByRole("button", { name: "Tentar salvar novamente" }).click();
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "rectangle", width: 60, height: 55 }),
  ]);
});

test("seleciona por arraste, alterna com Ctrl e move e apaga o conjunto", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  const canvas = page.locator("canvas").first();
  await page.keyboard.press("Alt+s");
  await drag(page, canvas, { x: 40, y: 50 }, { x: 90, y: 90 });
  await page.keyboard.press("Alt+c");
  await drag(page, canvas, { x: 155, y: 75 }, { x: 177, y: 75 });

  await page.keyboard.press("Alt+v");
  await drag(page, canvas, { x: 200, y: 120 }, { x: 20, y: 25 });
  const multiple = page.getByText(/2 elementos selecionados/);
  await expect(multiple).toBeVisible();
  await canvas.click({ position: { x: 155, y: 75 }, modifiers: ["Control"] });
  await expect(multiple).toBeHidden();
  await canvas.click({ position: { x: 155, y: 75 }, modifiers: ["Control"] });
  await expect(multiple).toBeVisible();

  await drag(page, canvas, { x: 60, y: 65 }, { x: 90, y: 85 });
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "rectangle", x: 70, y: 70 }),
    expect.objectContaining({ type: "circle", x: 185, y: 95 }),
  ]);
  await page.keyboard.press("Delete");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([]);
});
