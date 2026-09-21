import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { initStarter } from "./init-ui-ux-starter.mjs";

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const requestedPort = Number(value("--port", "8782"));
if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) throw new Error("--port must be between 1 and 65535.");

const output = join(tmpdir(), "ai-core-ui-starter-preview");
mkdirSync(output, { recursive: true });
initStarter({
  target: output,
  profile: value("--profile", "freepass-product"),
  product: value("--product", "FreePass 업무"),
  force: true,
});

const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relative = pathname === "/" ? "models/index.html" : pathname.replace(/^\/+/, "");
  const file = resolve(output, normalize(relative));
  if (!file.startsWith(resolve(output)) || !existsSync(file)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("찾을 수 없습니다.");
    return;
  }
  response.writeHead(200, { "Content-Type": mime[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
});

let port = requestedPort;
server.on("error", (error) => {
  if (error.code === "EADDRINUSE" && port < requestedPort + 10) {
    port += 1;
    server.listen(port, "127.0.0.1");
    return;
  }
  throw error;
});
server.on("listening", () => {
  console.log(`AI Core 화면 조립표: http://127.0.0.1:${port}/models/index.html`);
  console.log("종료: Ctrl+C");
});
server.listen(port, "127.0.0.1");
