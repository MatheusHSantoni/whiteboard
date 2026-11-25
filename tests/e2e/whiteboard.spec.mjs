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
  const shortcutList = page.locator("dl.shortcut-list");
  await expect(shortcutList).toBeVisible();
  await expect(shortcutList.locator("kbd")).toHaveText([
    "Alt + V", "Alt + S", "Alt + C", "Alt + A", "Alt + L", "Alt + P", "Alt + M", "Alt + B", "Alt + T", "Ctrl + arrastar", "Shift + clique", "+ / −", "Ctrl + Z", "Ctrl + Y", "Ctrl + C", "Ctrl + V", "Delete", "Enter", "Ctrl + Shift + 7", "Ctrl + Shift + 8", "Ctrl + Shift + 9", "Shift + Enter", "Esc",
  ]);
  await page.keyboard.press("Enter");
  await expect(shortcutList).toBeHidden();
  await shortcuts.click();
  await expect(shortcutList).toBeVisible();
  await canvas.click({ position: { x: 500, y: 30 } });
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
  for (const label of ["Fonte", "Tamanho"]) {
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
  await drag(page, canvas, { x: 45, y: 65 }, { x: 65, y: 95 });
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "rectangle", x: 65, y: 80, width: 60, height: 55, color: "#dc2638" }),
    expect.objectContaining({ type: "arrow", dx: 65, dy: 0, color: "#16805c" }),
    expect.objectContaining({ type: "text", text: "Meu primeiro quadro", color: "#6337c7" }),
  ]);

  await page.reload();
  await expect(page.getByText("Clique em um elemento ou arraste numa área vazia para selecionar vários.")).toBeVisible();
  await drag(page, canvas, { x: 65, y: 95 }, { x: 95, y: 95 });
  await expect(color).toHaveValue("#dc2638");
  await color.fill("#214bd5");
  const fillMenu = page.getByText("Preenchimento", { exact: true });
  await fillMenu.click();
  await page.getByLabel("Cor do preenchimento").fill("#ffec9a");
  await fillMenu.click();

  await canvas.click({ position: { x: 90, y: 190 } });
  // Começa fora do contorno visível para verificar a área de clique ampliada.
  await drag(page, canvas, { x: 369, y: 194 }, { x: 509, y: 194 });
  await canvas.dblclick({ position: { x: 90, y: 190 } });
  await expect(editor).toHaveCSS("width", "420px");
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
  const bold = page.getByRole("button", { name: "Negrito" });
  await bold.click();
  await expect(bold).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".compact-style").filter({ has: font })).toContainText("Manuscrita");
  await expect(page.locator(".compact-style").filter({ has: page.getByLabel("Tamanho") })).toContainText("32 px");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "rectangle", x: 95, y: 80, width: 60, height: 55, color: "#214bd5", fillColor: "#ffec9a" }),
    expect.objectContaining({ type: "arrow" }),
    expect.objectContaining({ type: "text", text: "Texto atualizado", x: 75, y: 180, width: 420, font: "handwriting", fontSize: 32, bold: true,
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

  await page.keyboard.down("Control");
  await drag(page, canvas, { x: 180, y: 90 }, { x: 220, y: 120 });
  await page.keyboard.up("Control");
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
  const fillMenu = page.getByText("Preenchimento", { exact: true });
  const fill = page.getByLabel("Cor do preenchimento");
  await drag(page, canvas, { x: 100, y: 100 }, { x: 130, y: 140 });
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "circle", noFill: true }),
  ]);
  await page.keyboard.press("Alt+v");
  await canvas.click({ position: { x: 150, y: 100 } });
  await fillMenu.click();
  await fill.fill("#ffec9a");
  await fillMenu.click();
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "circle", x: 100, y: 100, radius: 50, fillColor: "#ffec9a" }),
  ]);

  await page.reload();
  await expect(page.getByRole("button", { name: "Exportar Board" })).toBeEnabled();
  await canvas.click({ position: { x: 100, y: 100 } });
  await fillMenu.click();
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
  await fillMenu.click();
  await expect(noFill).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Aplicar cor" }).click();
  await fillMenu.click();
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

test("seleciona formas sem preenchimento pelo interior e setas perto do traço", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  const canvas = page.locator("canvas").first();

  await page.keyboard.press("Alt+s");
  await drag(page, canvas, { x: 40, y: 50 }, { x: 100, y: 100 });
  await page.keyboard.press("Alt+c");
  await drag(page, canvas, { x: 160, y: 75 }, { x: 185, y: 75 });
  await page.keyboard.press("Alt+a");
  await drag(page, canvas, { x: 220, y: 75 }, { x: 300, y: 75 });

  await page.keyboard.press("Alt+v");
  await drag(page, canvas, { x: 70, y: 75 }, { x: 70, y: 95 });
  await drag(page, canvas, { x: 160, y: 75 }, { x: 160, y: 95 });
  await drag(page, canvas, { x: 250, y: 86 }, { x: 250, y: 106 });
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "rectangle", x: 40, y: 70, noFill: true }),
    expect.objectContaining({ type: "circle", x: 160, y: 95, noFill: true }),
    expect.objectContaining({ type: "arrow", x: 220, y: 95 }),
  ]);

  await drag(page, canvas, { x: 20, y: 30 }, { x: 325, y: 140 });
  const color = page.getByLabel("Cor da ferramenta");
  await expect(color).toBeEnabled();
  await color.fill("#dc2638");
  await expect.poll(async () => (await page.evaluate(savedShapes)).map(({ color }) => color))
    .toEqual(["#dc2638", "#dc2638", "#dc2638"]);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await page.evaluate(savedShapes)).every(({ color }) => color === undefined))
    .toBe(true);
});

test("seleciona por arraste, alterna com Shift e move e apaga o conjunto", async ({ page }) => {
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
  await canvas.click({ position: { x: 177, y: 75 }, modifiers: ["Shift"] });
  await expect(multiple).toBeHidden();
  await canvas.click({ position: { x: 177, y: 75 }, modifiers: ["Shift"] });
  await expect(multiple).toBeVisible();

  await drag(page, canvas, { x: 40, y: 65 }, { x: 70, y: 85 });
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "rectangle", x: 70, y: 70 }),
    expect.objectContaining({ type: "circle", x: 185, y: 95 }),
  ]);
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "rectangle", x: 40, y: 50 }),
    expect.objectContaining({ type: "circle", x: 155, y: 75 }),
  ]);
  await page.keyboard.press("Delete");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([]);
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(savedShapes)).toHaveLength(2);
  await page.keyboard.press("Control+y");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([]);
});

test("desenha à mão livre com lápis e marca-texto e ajusta a espessura pelo teclado", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  const canvas = page.locator("canvas").first();
  await page.keyboard.press("Alt+p");
  await expect(page.getByRole("button", { name: "Lápis" })).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toHaveCSS("cursor", /url\(.+\) 3 21, crosshair/);
  await page.keyboard.press("Shift+Equal");
  await expect(page.getByText(/Espessura: 4 px/)).toBeVisible();
  await drag(page, canvas, { x: 40, y: 50 }, { x: 100, y: 90 });

  await page.keyboard.press("Alt+m");
  await expect(page.getByRole("button", { name: "Marca-texto", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(canvas).toHaveCSS("cursor", /url\(.+\) 4 21, crosshair/);
  await page.keyboard.press("Minus");
  await expect(page.getByText(/Espessura: 16 px/)).toBeVisible();
  await drag(page, canvas, { x: 45, y: 130 }, { x: 125, y: 130 });
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "pencil", x: 40, y: 50, strokeWidth: 4 }),
    expect.objectContaining({ type: "marker", x: 45, y: 130, strokeWidth: 16, color: "#fff176" }),
  ]);

  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  await expect.poll(() => canvas.evaluate((node) =>
    node.getContext("2d").getImageData(80, 130, 1, 1).data[3],
  )).toBeGreaterThan(0);
  await page.keyboard.press("Alt+b");
  await expect(canvas).toHaveCSS("cursor", /data:image\/svg\+xml.*9 9, default/);
  await expect(page.getByRole("button", { name: "Borracha" })).toHaveAttribute("aria-pressed", "true");
  const bounds = await canvas.boundingBox();
  await page.mouse.move(bounds.x + 80, bounds.y + 40);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 80, bounds.y + 160);
  await expect.poll(() => page.evaluate(savedShapes)).toHaveLength(4);
  await expect.poll(() => canvas.evaluate((node) => {
    const context = node.getContext("2d");
    return [60, 80, 100].map((x) => context.getImageData(x, 130, 1, 1).data[3] > 0);
  })).toEqual([true, false, true]);
  await page.mouse.up();
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(savedShapes)).toHaveLength(2);
  await page.keyboard.press("Control+y");
  await expect.poll(() => page.evaluate(savedShapes)).toHaveLength(4);
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(savedShapes)).toHaveLength(2);
  await page.keyboard.press("Alt+s");
  await drag(page, canvas, { x: 170, y: 50 }, { x: 210, y: 90 });
  await expect.poll(() => page.evaluate(savedShapes)).toHaveLength(3);
  await page.keyboard.press("Control+y");
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(savedShapes)).toHaveLength(2);
});

test("confirma a remoção de texto vazio e permite desfazer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  const canvas = page.locator("canvas").first();
  const text = page.getByRole("textbox", { name: "Texto do elemento" });
  const position = { x: 70, y: 80 };
  await page.keyboard.press("Alt+t");
  await canvas.click({ position });
  await text.fill("Anotação");
  await text.press("Enter");
  await expect.poll(() => page.evaluate(savedShapes)).toHaveLength(1);

  await page.keyboard.press("Alt+v");
  await canvas.dblclick({ position: { x: 82, y: 92 } });
  await text.fill("");
  await text.press("Escape");
  await expect.poll(() => page.evaluate(savedShapes)).toHaveLength(1);
  await canvas.dblclick({ position: { x: 82, y: 92 } });
  await text.fill("");
  await text.press("Enter");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([]);
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "text", text: "Anotação" }),
  ]);
});

test("preserva o backup local e recarrega a revisão do servidor após um conflito", async ({ page }) => {
  const revisions = [];
  let reads = 0;
  await page.route("/", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace("</head>",
      '<meta name="whiteboard-storage" content="server"></head>');
    await route.fulfill({ response, body });
  });
  await page.route("**/api/boards", (route) => route.fulfill({
    json: [{ id: "board-test", name: "Board de teste" }],
  }));
  await page.route("**/api/boards/board-test", async (route) => {
    if (route.request().method() === "GET") {
      reads++;
      await route.fulfill({ json: { shapes: [], revision: reads === 1 ? 1 : 2 } });
      return;
    }
    revisions.push(route.request().postDataJSON().revision);
    await route.fulfill(revisions.length === 1
      ? { status: 409, json: { error: "O Board foi alterado em outra aba ou computador." } }
      : { json: { revision: 3 } });
  });

  await page.goto("/");
  const canvas = page.locator("canvas").first();
  await expect(page.getByRole("status")).toHaveText("Salvo no servidor");
  await page.keyboard.press("Alt+s");
  await drag(page, canvas, { x: 40, y: 50 }, { x: 90, y: 90 });
  await expect(page.getByRole("alert")).toContainText("alterado em outra aba");

  const reload = page.getByRole("button", { name: "Carregar versão do servidor" });
  page.once("dialog", (dialog) => dialog.dismiss());
  await reload.click();
  await drag(page, canvas, { x: 100, y: 50 }, { x: 150, y: 90 });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar Board" }).click();
  const { readFile } = await import("node:fs/promises");
  const backup = JSON.parse(await readFile(await (await download).path(), "utf8"));
  expect(backup.shapes).toHaveLength(2);
  expect(revisions).toEqual([1]);

  page.once("dialog", (dialog) => dialog.accept());
  await reload.click();
  await expect(page.getByRole("status")).toHaveText("Salvo no servidor");
  await drag(page, canvas, { x: 40, y: 50 }, { x: 90, y: 90 });
  await expect(page.getByRole("status")).toHaveText("Salvo no servidor");
  expect(revisions).toEqual([1, 2]);
});

test("aplica os três atalhos de lista e salva a formatação", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  await page.keyboard.press("Alt+t");
  await page.locator("canvas").first().click({ position: { x: 60, y: 100 } });
  const editor = page.getByRole("textbox", { name: "Texto do elemento" });
  await editor.fill("Primeiro\nSegundo");
  await editor.press("Control+a");
  await editor.press("Control+Shift+8");
  await expect(editor).toHaveValue("• Primeiro\n• Segundo");
  await editor.press("Control+Shift+7");
  await expect(editor).toHaveValue("1. Primeiro\n2. Segundo");
  await editor.press("Control+Shift+9");
  await expect(editor).toHaveValue("☐ Primeiro\n☐ Segundo");
  await editor.press("Enter");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "text", text: "☐ Primeiro\n☐ Segundo" }),
  ]);
});

test("copia e cola elementos selecionados com Ctrl C e Ctrl V", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  const canvas = page.locator("canvas").first();
  await page.keyboard.press("Alt+s");
  await drag(page, canvas, { x: 40, y: 50 }, { x: 90, y: 90 });
  await page.keyboard.press("Alt+c");
  await drag(page, canvas, { x: 155, y: 75 }, { x: 177, y: 75 });
  await page.keyboard.press("Alt+v");
  await drag(page, canvas, { x: 200, y: 120 }, { x: 20, y: 25 });

  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "rectangle", x: 40, y: 50 }),
    expect.objectContaining({ type: "circle", x: 155, y: 75 }),
    expect.objectContaining({ type: "rectangle", x: 60, y: 70 }),
    expect.objectContaining({ type: "circle", x: 175, y: 95 }),
  ]);
  const shapes = await page.evaluate(savedShapes);
  expect(new Set(shapes.map(({ id }) => id)).size).toBe(4);
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(savedShapes)).toHaveLength(2);
});

test("cola um retângulo, texto e traço de lápis como elementos editáveis", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  const canvas = page.locator("canvas").first();
  await page.keyboard.press("Alt+s");
  await drag(page, canvas, { x: 40, y: 50 }, { x: 190, y: 120 });
  await page.keyboard.press("Alt+t");
  await canvas.click({ position: { x: 55, y: 65 } });
  const editor = page.getByRole("textbox", { name: "Texto do elemento" });
  await editor.fill("Texto original");
  await editor.press("Enter");
  await page.keyboard.press("Alt+p");
  await drag(page, canvas, { x: 60, y: 105 }, { x: 125, y: 105 });

  await page.keyboard.press("Alt+v");
  await drag(page, canvas, { x: 20, y: 25 }, { x: 205, y: 135 });
  await expect(page.getByText(/3 elementos selecionados/)).toBeVisible();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect.poll(() => page.evaluate(savedShapes)).toHaveLength(6);

  await drag(page, canvas, { x: 115, y: 125 }, { x: 415, y: 125 });
  await canvas.dblclick({ position: { x: 395, y: 95 } });
  await expect(editor).toHaveValue("Texto original");
  await editor.fill("Cópia editada");
  await editor.press("Enter");
  await canvas.click({ position: { x: 360, y: 120 } });
  await page.getByLabel("Cor da ferramenta").fill("#0055cc");
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "rectangle", x: 40, y: 50 }),
    expect.objectContaining({ type: "text", x: 55, y: 65, text: "Texto original" }),
    expect.objectContaining({ type: "pencil", x: 60, y: 105 }),
    expect.objectContaining({ type: "rectangle", x: 360, y: 70, color: "#0055cc" }),
    expect.objectContaining({ type: "text", x: 375, y: 85, text: "Cópia editada" }),
    expect.objectContaining({ type: "pencil", x: 380, y: 125 }),
  ]);
  const shapes = await page.evaluate(savedShapes);
  expect(shapes[5].points).toEqual(shapes[2].points);
});

test("desenha uma linha sem ponta e ajusta a curva pelo ponto de controle", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  const canvas = page.locator("canvas").first();
  await page.keyboard.press("Alt+l");
  await drag(page, canvas, { x: 180, y: 100 }, { x: 280, y: 100 });
  await page.keyboard.press("Alt+v");
  await canvas.click({ position: { x: 190, y: 100 } });
  await drag(page, canvas, { x: 230, y: 100 }, { x: 230, y: 145 });
  await drag(page, canvas, { x: 280, y: 100 }, { x: 320, y: 80 });
  await expect.poll(() => page.evaluate(savedShapes)).toEqual([
    expect.objectContaining({ type: "line", dx: 140, dy: -20, bend: { x: 50, y: 45 } }),
  ]);
});

test("alterna os fundos e exibe textos antigos e novos em branco no fundo preto", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Salvo neste navegador");
  const surface = page.getByRole("slider", { name: "Fundo da lousa" });
  const board = page.getByRole("region", { name: "Área de desenho" });
  const canvas = page.locator("canvas").first();
  const editor = page.getByRole("textbox", { name: "Texto do elemento" });
  await expect(surface).toHaveAttribute("aria-valuetext", "50%");
  await page.keyboard.press("Alt+t");
  await page.getByLabel("Cor da ferramenta").fill("#d71920");
  await canvas.click({ position: { x: 50, y: 90 } });
  await editor.fill("Primeiro texto");
  await editor.press("Enter");

  await surface.press("ArrowRight");
  await expect(surface).toHaveAttribute("aria-valuetext", "51%");
  await expect(board).toHaveCSS("background-color", "rgb(250, 248, 239)");
  await surface.press("End");
  await expect(surface).toHaveAttribute("aria-valuetext", "100%");
  await expect(board).toHaveCSS("background-color", "rgb(18, 18, 18)");
  await canvas.click({ position: { x: 50, y: 140 } });
  await editor.fill("Segundo texto");
  await expect(editor).toHaveCSS("caret-color", "rgb(255, 255, 255)");
  await editor.press("Enter");

  async function hasColor(y, red, green, blue) {
    return canvas.evaluate((node, args) => {
      const pixels = node.getContext("2d").getImageData(50, args.y, 230, 28).data;
      return pixels.some((value, index) => index % 4 === 0 && value === args.red &&
        pixels[index + 1] === args.green && pixels[index + 2] === args.blue && pixels[index + 3] === 255);
    }, { y, red, green, blue });
  }
  await expect.poll(() => hasColor(90, 255, 255, 255)).toBe(true);
  await expect.poll(() => hasColor(140, 255, 255, 255)).toBe(true);
  await surface.press("Home");
  await expect(surface).toHaveAttribute("aria-valuetext", "0%");
  await expect(board).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect.poll(() => hasColor(90, 215, 25, 32)).toBe(true);
  await expect.poll(() => hasColor(140, 215, 25, 32)).toBe(true);
});
