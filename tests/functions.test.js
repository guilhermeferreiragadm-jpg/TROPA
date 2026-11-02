const test = require("node:test");
const assert = require("node:assert/strict");
const { extrairJson, validarEntrada, chaveUso, montarConteudo, processar, ErroApp, LIMITE_DIARIO } = require("../functions/lib.js");

test("extrairJson: JSON puro, com cerca de código e com texto em volta", () => {
  assert.deepEqual(extrairJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extrairJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extrairJson('Claro! Aqui está: {"a":{"b":2}} espero que ajude'), { a: { b: 2 } });
  assert.deepEqual(extrairJson("[1,2]"), [1, 2]);
});

test("extrairJson: sem JSON ou JSON quebrado vira ErroApp internal", () => {
  assert.throws(() => extrairJson("sem json"), e => e instanceof ErroApp && e.code === "internal");
  assert.throws(() => extrairJson("{quebrado"), e => e instanceof ErroApp && e.code === "internal");
});

test("validarEntrada aceita pedido simples e normaliza imagens", () => {
  assert.deepEqual(validarEntrada({ prompt: "oi" }), { prompt: "oi", imagens: [] });
  const im = { tipo: "image/jpeg", base64: "QUJD" };
  assert.deepEqual(validarEntrada({ prompt: "oi", imagens: [im] }), { prompt: "oi", imagens: [im] });
});

test("validarEntrada recusa entrada ruim", () => {
  const ruim = d => assert.throws(() => validarEntrada(d), e => e instanceof ErroApp && e.code === "invalid-argument");
  ruim(null);
  ruim({});
  ruim({ prompt: "   " });
  ruim({ prompt: "x".repeat(60001) });
  ruim({ prompt: "oi", imagens: Array(4).fill({ tipo: "image/jpeg", base64: "QUJD" }) });
  ruim({ prompt: "oi", imagens: [{ tipo: "image/gif", base64: "QUJD" }] });
  ruim({ prompt: "oi", imagens: [{ tipo: "image/jpeg", base64: "" }] });
  ruim({ prompt: "oi", imagens: [{ tipo: "image/jpeg", base64: "A".repeat(2000001) }] });
});

test("chaveUso usa o dia de Brasília (UTC-3)", () => {
  assert.equal(chaveUso("u1", new Date("2026-11-03T01:00:00Z")), "u1_2026-11-02");
  assert.equal(chaveUso("u1", new Date("2026-11-03T12:00:00Z")), "u1_2026-11-03");
});

test("montarConteudo põe as imagens antes do texto", () => {
  const c = montarConteudo("descreva", [{ tipo: "image/png", base64: "QQ==" }]);
  assert.deepEqual(c, [
    { type: "image", source: { type: "base64", media_type: "image/png", data: "QQ==" } },
    { type: "text", text: "descreva" }
  ]);
});

function depsFalsas(sobrescreve) {
  const reg = { usos: [], chamadas: [] };
  const deps = Object.assign({
    temAcesso: async () => true,
    registrarUso: async (chave, limite) => { reg.usos.push([chave, limite]); return true; },
    chamarClaude: async a => { reg.chamadas.push(a); return '{"ok":true}'; }
  }, sobrescreve);
  return { deps, reg };
}
const agora = new Date("2026-11-02T15:00:00Z");

test("processar: sem login", async () => {
  const { deps } = depsFalsas();
  await assert.rejects(processar({ uid: null, owner: false, data: { prompt: "oi" }, agora }, deps), e => e.code === "unauthenticated");
});

test("processar: sem acesso ao app", async () => {
  const { deps } = depsFalsas({ temAcesso: async () => false });
  await assert.rejects(processar({ uid: "u1", owner: false, data: { prompt: "oi" }, agora }, deps), e => e.code === "permission-denied");
});

test("processar: limite diário estourado", async () => {
  const { deps } = depsFalsas({ registrarUso: async () => false });
  await assert.rejects(processar({ uid: "u1", owner: false, data: { prompt: "oi" }, agora }, deps), e => e.code === "resource-exhausted");
});

test("processar: dono não consulta acesso nem limite", async () => {
  const { deps, reg } = depsFalsas({ temAcesso: async () => { throw new Error("não devia chamar"); } });
  const r = await processar({ uid: "gui", owner: true, data: { prompt: "oi" }, agora }, deps);
  assert.deepEqual(r, { json: { ok: true } });
  assert.equal(reg.usos.length, 0);
});

test("processar: caminho feliz registra o uso e chama o modelo", async () => {
  const { deps, reg } = depsFalsas();
  const im = { tipo: "image/jpeg", base64: "QUJD" };
  const r = await processar({ uid: "u1", owner: false, data: { prompt: "oi", imagens: [im] }, agora }, deps);
  assert.deepEqual(r, { json: { ok: true } });
  assert.deepEqual(reg.usos, [["u1_2026-11-02", LIMITE_DIARIO]]);
  assert.equal(reg.chamadas[0].content[0].type, "image");
  assert.match(reg.chamadas[0].system, /JSON/);
});
