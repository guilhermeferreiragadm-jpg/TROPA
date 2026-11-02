const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");

test("o link do app vem de LINK_APP, que prefere window.TROPA_LINK", () => {
  assert.match(html, /const LINK_APP = \(typeof window !== "undefined" && window\.TROPA_LINK\) \|\| "https:\/\/claude\.ai\/artifact\/"\+ARTIFACT_ID;/);
});

test("nenhum outro lugar monta o link do artifact na mão", () => {
  const sobras = html.split("\n").filter(l => /claude\.ai\/artifact\/"\s*\+\s*ARTIFACT_ID/.test(l) && !/const LINK_APP/.test(l));
  assert.deepEqual(sobras, []);
});

test("sair() encerra a sessão quando o shim oferece signOut", () => {
  const m = html.match(/function sair\(\)\{[^\n]*\}/);
  assert.ok(m, "não achei function sair()");
  assert.match(m[0], /window\.claude\.signOut/);
  assert.match(m[0], /location\.reload\(\)/);
});

test("o texto do Sair não promete mais a conta do Claude", () => {
  const i = html.indexOf("function sheetSair()");
  const bloco = html.slice(i, i + 900);
  assert.ok(!/conta do Claude/.test(bloco));
});

test("com o shim do Firebase o app não cai no modo LOCAL pelo ping de 6 s", () => {
  const linha = html.split("\n").find(l => /LOCAL = true; db = hybrid\(realDb\)/.test(l));
  assert.ok(linha, "não achei o fallback do ping");
  assert.match(linha, /^\s*if \(!isOwner && !window\.TROPA_FIREBASE\)\{ let ok = false;/);
});
