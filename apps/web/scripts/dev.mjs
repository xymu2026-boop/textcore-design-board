import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { join } from "node:path";

const args = process.argv.slice(2);
const localVite = join(process.cwd(), "node_modules", ".bin", "vite");

if (existsSync(localVite)) {
  const child = spawn(localVite, args, { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  const host = valueAfter("--host") ?? "127.0.0.1";
  const port = Number(valueAfter("--port") ?? "5173");
  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TextCore</title>
  </head>
  <body><div id="root"></div></body>
</html>`;

  createServer((_, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  }).listen(port, host, () => {
    console.log(
      `vite is not installed; serving placeholder app at http://${host}:${port}`,
    );
  });
}

function valueAfter(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
