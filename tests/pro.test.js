// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const pro = trecho("/* @pro:start */", "/* @pro:end */");
const F = new Function(pro + "\nreturn {CATEGORIAS, PAPEIS_PRO, CATS_POR_PAPEL, permissoesValidas, vincId, podeVer, conviteValido, novoConvite, conflitoVinculo, proximoEstadoProposta, criarPatch, aplicarPatch, hash32, propostaAtual, TIPOS_INBOX, itemInboxValido};")();

test("permissoesValidas corta categorias fora do papel e força booleano", () => {
  assert.deepEqual(F.permissoesValidas("nutri", {comida: 1, treino: true, corpo: false}), {comida: true, corpo: false});
  assert.deepEqual(F.permissoesValidas("personal", {treino: true, comida: true}), {treino: true, perf: false, corpo: false, feed: false});
  assert.deepEqual(F.permissoesValidas("xx", {treino: true}), {});
});

test("vincId é único por aluno e papel", () => {
  assert.equal(F.vincId("u1", "personal"), "u1~personal");
  assert.notEqual(F.vincId("u1", "personal"), F.vincId("u1", "nutri"));
});

test("podeVer exige vínculo ativo, permissão ligada e categoria do papel", () => {
  const v = {estado: "ativo", papel: "nutri", perm: {comida: true, corpo: false}};
  assert.equal(F.podeVer(v, "comida"), true);
  assert.equal(F.podeVer(v, "corpo"), false);
  assert.equal(F.podeVer(v, "treino"), false);
  assert.equal(F.podeVer({...v, estado: "encerrado"}, "comida"), false);
  assert.equal(F.podeVer(null, "comida"), false);
});

test("convite vale 7 dias, uso único, papel válido", () => {
  const c = F.novoConvite("p1", "personal", 1000, "ABCD2345");
  assert.equal(c.expira, 1000 + 7 * 864e5);
  assert.equal(F.conviteValido(c, 1000), true);
  assert.equal(F.conviteValido(c, c.expira), false);
  assert.equal(F.conviteValido({...c, usado: true}, 1000), false);
  assert.equal(F.conviteValido({...c, papel: "dono"}, 1000), false);
  assert.equal(F.conviteValido(null, 1000), false);
});

test("conflitoVinculo bloqueia segundo profissional do mesmo papel", () => {
  assert.equal(F.conflitoVinculo(null, "p1"), null);
  assert.equal(F.conflitoVinculo({estado: "ativo", profId: "p1"}, "p1"), null);
  assert.equal(F.conflitoVinculo({estado: "ativo", profId: "p2"}, "p1"), "ja_vinculado");
  assert.equal(F.conflitoVinculo({estado: "encerrado", profId: "p2"}, "p1"), null);
});

test("proposta só muda a partir de pendente", () => {
  assert.equal(F.proximoEstadoProposta("pendente", "aceitar"), "aceita");
  assert.equal(F.proximoEstadoProposta("pendente", "recusar"), "recusada");
  assert.equal(F.proximoEstadoProposta("pendente", "invalidar"), "desatualizada");
  assert.equal(F.proximoEstadoProposta("aceita", "recusar"), "aceita");
  assert.equal(F.proximoEstadoProposta("pendente", "outro"), "pendente");
});

test("patch: ida e volta em objetos e arrays", () => {
  const a = {sem: [{dias: [{ex: "supino", kg: 40}, {ex: "remada", kg: 30}]}], meta: {x: 1}};
  const b = {sem: [{dias: [{ex: "supino", kg: 45}, {ex: "remada", kg: 30}]}], meta: {x: 1}};
  const ops = F.criarPatch(a, b);
  assert.deepEqual(ops, [{p: ["sem", 0, "dias", 0, "kg"], v: 45}]);
  assert.deepEqual(F.aplicarPatch(a, ops), b);
  assert.equal(a.sem[0].dias[0].kg, 40);
});

test("patch: array de tamanho diferente é substituído inteiro; igual gera vazio", () => {
  assert.deepEqual(F.criarPatch({l: [1, 2]}, {l: [1, 2, 3]}), [{p: ["l"], v: [1, 2, 3]}]);
  assert.deepEqual(F.criarPatch({a: 1}, {a: 1}), []);
});

test("aplicarPatch recusa caminho perigoso ou inexistente", () => {
  assert.throws(() => F.aplicarPatch({}, [{p: ["__proto__", "x"], v: 1}]));
  assert.throws(() => F.aplicarPatch({}, [{p: ["constructor", "x"], v: 1}]));
  assert.throws(() => F.aplicarPatch({}, [{p: ["a", "b"], v: 1}]));
  assert.throws(() => F.aplicarPatch({}, [{p: [-1], v: 1}]));
  assert.equal({}.x, undefined);
});

test("propostaAtual compara o hash do plano de quando foi enviada", () => {
  const plano = JSON.stringify({a: 1});
  const prop = {base: F.hash32(plano)};
  assert.equal(F.propostaAtual(prop, plano), true);
  assert.equal(F.propostaAtual(prop, JSON.stringify({a: 2})), false);
});

test("itemInboxValido: estrutura mínima, tipo conhecido, ref curta", () => {
  assert.equal(F.itemInboxValido({tipo: "proposta", ref: "v~personal.p1", quando: 1, lida: false}), true);
  assert.equal(F.itemInboxValido({tipo: "hack", ref: "x", quando: 1}), false);
  assert.equal(F.itemInboxValido({tipo: "proposta", ref: "x".repeat(200), quando: 1}), false);
  assert.equal(F.itemInboxValido(null), false);
  assert.ok(F.TIPOS_INBOX.includes("convite"));
});
