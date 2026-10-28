// Uso: node tests/harness/servir.js   (porta 5173)
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..", "..");
const stub = fs.readFileSync(path.join(__dirname, "stub.js"), "utf8");
const EXPOR = "window.__T = {ir, R, toast, celebrar, telaAbertura, telaCodigo, telaPlanoPronto, telaAssinatura, telaMatch, telaSubiu, nivelXP, onb, sheetCheckin, sheetPausar, sheetCompras, sheetPostar, sheetRetomar, sheetDocumento, Mov, fecharSheet};\n";

http.createServer((req, res) => {
  if (!/^\/(\?.*)?$/.test(req.url)){ res.writeHead(404); return res.end("so /"); }
  let html = fs.readFileSync(path.join(raiz, "publicar.html"), "utf8");
  const fim = html.lastIndexOf("})();\n</script>");
  if (fim < 0){ res.writeHead(500); return res.end("não achei o fim do script"); }
  html = html.slice(0, fim) + EXPOR + html.slice(fim);
  html = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><script>" + stub + "</script></head><body>" + html + "</body></html>";
  res.writeHead(200, {"content-type":"text/html; charset=utf-8", "cache-control":"no-store"});
  res.end(html);
}).listen(5173, () => console.log("harness em http://localhost:5173/"));
