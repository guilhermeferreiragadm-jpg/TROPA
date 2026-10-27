// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const nodeCrypto = require("node:crypto");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const ajudas = trecho("const DAY = 864e5;", "const dow = d => (d.getDay()+6)%7;");
const puro = trecho("/* @pure:start */", "/* @pure:end */");
const F = new Function(ajudas + "\n" + puro + "\nreturn {normalizarCodigo, novoCodigoGrupo, gidDeCodigo, membrosDoGrupo, definicaoDoGrupo, placarGrupo, podarGrupos, cutucadaPermitida, cutucadaRecebida, resumoDupla, situacaoEntrada, gravarGrupo, sairDoGrupo, FRASES_CUT};")();

const doc = (id, gs, ap = "X") => ({id, data: {ap, up: "2026-10-27T10:00:00Z", gs}});
const gA = {g: "abc", nome: "Tropa", tipo: "km", formato: "juntos", meta: 100, ini: "2026-10-26", fim: "2026-11-01", dupla: false, v: 12.34, t: 3, f: 2, cut: {d: "2026-10-27", k: 2}};

test("normalizarCodigo aceita hífen, espaço e minúsculas; recusa símbolos fora do alfabeto e tamanho errado", () => {
  assert.equal(F.normalizarCodigo("abcd-efgh"), "ABCDEFGH");
  assert.equal(F.normalizarCodigo(" ABCD EFGH "), "ABCDEFGH");
  assert.equal(F.normalizarCodigo("ABCD EFG0"), "");
  assert.equal(F.normalizarCodigo("ABC"), "");
  assert.equal(F.normalizarCodigo(null), "");
});

test("novoCodigoGrupo usa só o alfabeto e tem 8 caracteres", () => {
  assert.equal(F.novoCodigoGrupo(() => 0), "AAAAAAAA");
  assert.equal(F.novoCodigoGrupo(() => 0.999999), "99999999");
  const c = F.novoCodigoGrupo();
  assert.equal(c.length, 8);
  assert.equal(F.normalizarCodigo(c), c);
});

test("gidDeCodigo é o SHA-256 de 'tropa:' + código, 16 caracteres hexadecimais", async () => {
  const esperado = nodeCrypto.createHash("sha256").update("tropa:ABCDEFGH").digest("hex").slice(0, 16);
  assert.equal(await F.gidDeCodigo("ABCDEFGH"), esperado);
  assert.notEqual(await F.gidDeCodigo("ABCDEFGJ"), esperado);
});

test("membrosDoGrupo ignora documentos malformados e limita valores", () => {
  const ms = F.membrosDoGrupo([
    doc("u1", [gA], "Ana"),
    doc("u2", [Object.assign({}, gA, {v: 99999999, tipo: "x", formato: "y", ini: "lixo"})], "Beto"),
    doc("u3", [{g: "outro"}]), {id: "u4", data: null}, {id: 5, data: {gs: [gA]}}, doc("u5", "naoarray"),
    doc("u6", [null, gA], "Y".repeat(50))
  ], "abc");
  assert.equal(ms.length, 3);
  assert.equal(ms[0].v, 12.3);
  assert.equal(ms[1].v, 100000);
  assert.equal(ms[1].def.tipo, "treinos");
  assert.equal(ms[1].def.formato, "mais");
  assert.equal(ms[1].def.ini, "");
  assert.equal(ms[2].ap.length, 30);
});

test("definicaoDoGrupo pega a definição de quem tem o ini mais antigo", () => {
  const ms = F.membrosDoGrupo([doc("u1", [Object.assign({}, gA, {nome: "Novo", ini: "2026-10-28"})]), doc("u2", [gA])], "abc");
  assert.equal(F.definicaoDoGrupo(ms).nome, "Tropa");
  assert.equal(F.definicaoDoGrupo([]), null);
});

test("placarGrupo ordena por valor e calcula a porcentagem só no formato juntos", () => {
  const ms = F.membrosDoGrupo([doc("u1", [gA], "Ana"), doc("u2", [Object.assign({}, gA, {v: 90})], "Beto")], "abc");
  const pl = F.placarGrupo(ms, "u1", F.definicaoDoGrupo(ms));
  assert.equal(pl.lista[0].id, "u2");
  assert.equal(pl.total, 102.3);
  assert.equal(pl.pct, 100);
  assert.equal(pl.lista.find(x => x.eu).id, "u1");
  assert.equal(F.placarGrupo(ms, "u1", {formato: "mais", meta: 100}).pct, null);
});

test("podarGrupos remove grupos vencidos há mais de 30 dias e mantém os sem fim", () => {
  const gs = [{g: "a", fim: "2026-09-20"}, {g: "b", fim: "2026-09-27"}, {g: "c", fim: ""}, {g: "d", fim: "2026-11-01"}];
  assert.equal(F.podarGrupos(gs, "2026-10-27").map(x => x.g).join(), "b,c,d");
});

test("cutucada: uma por dia e leitura da recebida", () => {
  assert.equal(F.cutucadaPermitida({d: "2026-10-27", k: 1}, "2026-10-27"), false);
  assert.equal(F.cutucadaPermitida({d: "2026-10-26", k: 1}, "2026-10-27"), true);
  assert.equal(F.cutucadaPermitida(null, "2026-10-27"), true);
  assert.equal(F.cutucadaRecebida({cut: {d: "2026-10-27", k: 2}}, "2026-10-27"), 2);
  assert.equal(F.cutucadaRecebida({cut: {d: "2026-10-26", k: 2}}, "2026-10-27"), -1);
  assert.equal(F.cutucadaRecebida(null, "2026-10-27"), -1);
  assert.equal(F.FRASES_CUT.length, 4);
});

test("resumoDupla e situacaoEntrada (limite 2 na dupla, 8 no grupo)", () => {
  const d1 = Object.assign({}, gA, {dupla: true});
  const so = F.membrosDoGrupo([doc("u1", [d1], "Ana")], "abc");
  assert.equal(F.resumoDupla(so, "u1").vazia, true);
  assert.equal(F.resumoDupla(so, "u1").eu.t, 3);
  const dois = F.membrosDoGrupo([doc("u1", [d1], "Ana"), doc("u2", [d1], "Beto")], "abc");
  assert.equal(F.resumoDupla(dois, "u1").par.ap, "Beto");
  assert.equal(F.situacaoEntrada([], "u9"), "nao_achei");
  assert.equal(F.situacaoEntrada(so, "u1"), "ja");
  assert.equal(F.situacaoEntrada(so, "u9"), "ok");
  assert.equal(F.situacaoEntrada(dois, "u9"), "cheio");
  const oito = F.membrosDoGrupo(Array.from({length: 8}, (_, k) => doc("m" + k, [gA])), "abc");
  assert.equal(F.situacaoEntrada(oito, "u9"), "cheio");
  assert.equal(F.situacaoEntrada(oito.slice(0, 7), "u9"), "ok");
});

test("gravarGrupo limita a 5 grupos e substitui o mesmo gid; sairDoGrupo remove", () => {
  let gs = [];
  for (let k = 0; k < 5; k++) gs = F.gravarGrupo(gs, {g: "g" + k});
  assert.equal(F.gravarGrupo(gs, {g: "g9"}), null);
  assert.equal(F.gravarGrupo(gs, {g: "g1", v: 3}).length, 5);
  assert.equal(F.gravarGrupo(gs, {g: "g1", v: 3}).find(x => x.g === "g1").v, 3);
  assert.equal(F.sairDoGrupo(gs, "g2").length, 4);
  assert.equal(F.sairDoGrupo(undefined, "g2").length, 0);
});
