// Todo texto em português do código precisa estar no dicionário (app/i18n/en.json) ou na lista de mantidos (app/i18n/mantidos.json).
// Se este teste falhar depois de você adicionar texto novo: traduza as chaves que ele lista (ou ponha em app/i18n/extra-en.json) e rode
//   node app/scripts/i18n-embutir.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { extrair } = require("../app/scripts/i18n-extrair.js");

const dir = path.join(__dirname, "..", "app", "i18n");
const dic = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));
const mantidos = new Set(JSON.parse(fs.readFileSync(path.join(dir, "mantidos.json"), "utf8")));

test("todo texto em português tem tradução (ou está na lista de mantidos)", () => {
  const faltam = extrair().map(x => x.texto).filter(t => !(t in dic) && !mantidos.has(t) && !(t.charAt(0).toUpperCase() + t.slice(1) in dic) && !(t.charAt(0).toLowerCase() + t.slice(1) in dic));
  assert.equal(faltam.length, 0, faltam.length + " texto(s) sem tradução, por exemplo:\n  " + faltam.slice(0, 15).map(t => JSON.stringify(t.slice(0, 100))).join("\n  "));
});
