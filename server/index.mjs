import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { basename, extname, resolve } from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";
import { Buffer } from "node:buffer";
import console from "node:console";
import { URL } from "node:url";
import { isShapeList } from "../src/types/shapes.ts";

const { WHITEBOARD_USER, WHITEBOARD_PASSWORD, WHITEBOARD_DB, PORT, HOST } = process.env;
if (!WHITEBOARD_USER || WHITEBOARD_USER.includes(":") || !WHITEBOARD_PASSWORD) {
  throw new Error("Defina WHITEBOARD_USER e WHITEBOARD_PASSWORD para iniciar o servidor.");
}

const dist = resolve("dist");
const index = readFileSync(resolve(dist, "index.html"), "utf8")
  .replace("</head>", '<meta name="whiteboard-storage" content="server"></head>');
const db = new DatabaseSync(WHITEBOARD_DB || "whiteboard.sqlite");
db.exec(`
  CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    shapes TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0
  )
`);
const list = db.prepare("SELECT id, name FROM boards ORDER BY rowid DESC");
const select = db.prepare("SELECT shapes, revision FROM boards WHERE id = ?");
const remove = db.prepare("DELETE FROM boards WHERE id = ?");
const insert = db.prepare("INSERT INTO boards (id, name, shapes) VALUES (?, ?, ?)");
const update = db.prepare(
  "UPDATE boards SET shapes = ?, revision = revision + 1 WHERE id = ? AND revision = ?",
);

const hash = (value) => createHash("sha256").update(value).digest();
const authorization = hash("Basic " + Buffer.from(WHITEBOARD_USER + ":" + WHITEBOARD_PASSWORD).toString("base64"));
const mime = {
  ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".webp": "image/webp",
};

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > 50 * 1024 * 1024) {
      request.resume();
      throw new RangeError("Quadro muito grande.");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function api(request, response, path) {
  const method = request.method;
  if (path === "/api/boards" && method === "GET") return json(response, 200, list.all());

  const match = /^\/api\/boards\/([a-f0-9-]{36})$/.exec(path);
  if (match && method === "GET") {
    const board = select.get(match[1]);
    if (!board) return json(response, 404, { error: "Board não encontrado." });
    let shapes;
    try {
      shapes = JSON.parse(board.shapes);
    } catch {
      throw new Error("JSON inválido no Board armazenado: " + match[1]);
    }
    return json(response, 200, { shapes, revision: board.revision });
  }

  if (match && method === "DELETE") {
    if (request.headers["x-whiteboard"] !== "1") return json(response, 403, {});
    request.resume();
    remove.run(match[1]);
    return json(response, 200, {});
  }

  if ((path === "/api/boards" && method === "POST") || (match && method === "PUT")) {
    // The custom header prevents writes from cross-origin HTML forms.
    if (request.headers["x-whiteboard"] !== "1") return json(response, 403, {});
    let data;
    try {
      data = await readJson(request);
    } catch (error) {
      if (error instanceof RangeError) return json(response, 413, { error: "O Board excede 50 MB." });
      if (error instanceof SyntaxError) return json(response, 400, { error: "Não foi possível concluir a operação." });
      throw error;
    }
    if (!isShapeList(data?.shapes)) return json(response, 400, { error: "Board inválido." });
    const shapes = JSON.stringify(data.shapes);
    if (method === "POST") {
      const name = typeof data.name === "string" ? data.name.trim() : "";
      if (!name || name.length > 100) return json(response, 400, { error: "Nome inválido." });
      const id = randomUUID();
      insert.run(id, name, shapes);
      return json(response, 201, { id, name });
    }
    if (!Number.isSafeInteger(data.revision) || data.revision < 0) return json(response, 400, {});
    if (!update.run(shapes, match[1], data.revision).changes) {
      return json(response, 409, { error: "O Board foi alterado em outra aba ou computador." });
    }
    return json(response, 200, { revision: data.revision + 1 });
  }
  return json(response, 404, {});
}

const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  if (!timingSafeEqual(hash(request.headers.authorization || ""), authorization)) {
    response.writeHead(401, { "WWW-Authenticate": 'Basic realm="Whiteboard", charset="UTF-8"' });
    return response.end("Entre para acessar seus Boards.");
  }

  try {
    const path = new URL(request.url, "http://localhost").pathname;
    if (path.startsWith("/api/")) return await api(request, response, path);
    if (request.method !== "GET") return response.writeHead(405).end();
    if (path === "/") return response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(index);

    const asset = /^\/(assets\/)?([\w.-]+)$/.exec(path);
    const type = asset && mime[extname(asset[2])];
    if (!type) return response.writeHead(404).end();
    const file = resolve(dist, asset[1] || "", basename(asset[2]));
    if (!statSync(file, { throwIfNoEntry: false })?.isFile()) return response.writeHead(404).end();
    response.writeHead(200, { "Content-Type": type });
    createReadStream(file).on("error", () => response.destroy()).pipe(response);
  } catch (error) {
    console.error(error);
    json(response, 500, { error: "Não foi possível concluir a operação." });
  }
});

server.listen(Number(PORT || 5173), HOST || "127.0.0.1", () => {
  console.log("Whiteboard disponível na porta " + server.address().port);
});
