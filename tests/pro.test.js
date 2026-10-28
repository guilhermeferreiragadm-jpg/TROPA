// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const pro = trecho("/* @pro:start */", "/* @pro:end */");
const F = new Function(pro + "\nreturn {CATEGORIAS, PAPEIS_PRO, CATS_POR_PAPEL, permissoesValidas, vincId, podeVer, conviteValido, novoConvite, conflitoVinculo, proximoEstadoProposta, criarPatch, aplicarPatch, hash32, propostaAtual, TIPOS_INBOX, itemInboxValido, gerarPar, derivarChave, cifrar, decifrar, diffTxt, exTxt};")();

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

test("patch: remoção de chave vira del e ida e volta reproduz o destino", () => {
  const a = {x: 1, y: 2};
  const b = {x: 1};
  assert.deepEqual(F.criarPatch(a, b), [{p: ["y"], del: true}]);
  assert.deepEqual(F.aplicarPatch(a, F.criarPatch(a, b)), b);
  const a2 = {n: {x: 1, y: 2}, z: 3};
  const b2 = {n: {x: 1}, z: 3};
  const r = F.aplicarPatch(a2, F.criarPatch(a2, b2));
  assert.deepEqual(r, b2);
  assert.equal("y" in r.n, false);
});

test("aplicarPatch rejeita del com caminho vazio", () => {
  assert.throws(() => F.aplicarPatch({a: 1}, [{p: [], del: true}]), /caminho inválido/);
});

test("aplicarPatch rejeita length e índice além do tamanho em array", () => {
  assert.throws(() => F.aplicarPatch({l: [1, 2]}, [{p: ["l", "length"], v: 0}]), /caminho inválido/);
  assert.throws(() => F.aplicarPatch({l: [1, 2]}, [{p: ["l", 5], v: 9}]), /caminho inválido/);
  assert.deepEqual(F.aplicarPatch({l: [1, 2]}, [{p: ["l", 2], v: 9}]), {l: [1, 2, 9]});
});

test("conviteValido exige expira numérico finito", () => {
  const c = F.novoConvite("p1", "personal", 1000, "ABCD2345");
  assert.equal(F.conviteValido({...c, expira: String(c.expira)}, 1000), false);
});

test("cifragem: aluno e profissional derivam a mesma chave e leem um ao outro", async () => {
  const al = await F.gerarPar(), pf = await F.gerarPar();
  const kA = await F.derivarChave(al.priv, pf.pub, "u1~personal");
  const kP = await F.derivarChave(pf.priv, al.pub, "u1~personal");
  const env = await F.cifrar(kA, {treino: [1, 2, 3], nota: "força"});
  assert.equal(env.v, 1);
  assert.ok(!JSON.stringify(env).includes("força"));
  assert.deepEqual(await F.decifrar(kP, env), {treino: [1, 2, 3], nota: "força"});
});

test("cifragem: terceiro e id de vínculo errado não decifram", async () => {
  const al = await F.gerarPar(), pf = await F.gerarPar(), x = await F.gerarPar();
  const k = await F.derivarChave(al.priv, pf.pub, "u1~personal");
  const env = await F.cifrar(k, {a: 1});
  await assert.rejects(F.decifrar(await F.derivarChave(x.priv, al.pub, "u1~personal"), env));
  await assert.rejects(F.decifrar(await F.derivarChave(pf.priv, al.pub, "u1~nutri"), env));
});

test("cifragem: payload grande (200 KB) volta igual", async () => {
  const al = await F.gerarPar(), pf = await F.gerarPar();
  const k = await F.derivarChave(al.priv, pf.pub, "v");
  const grande = {s: "x".repeat(200000)};
  assert.deepEqual(await F.decifrar(k, await F.cifrar(k, grande)), grande);
});

test("diffTxt descreve carga, distância, dia removido e metas em português", () => {
  const sem = d => ({semanas: [{dias: d.map((t, i) => ({dia: "x" + i, treinos: t}))}]});
  const a = sem([[{k: "gym", t: "Força", passos: ["Supino 4×8 · 40 kg", "Prancha 3×40 s"]}], [], [], [{k: "run", t: "Regenerativo", min: 30}], [], [], [{k: "run", t: "Longão", km: 8}]]);
  const b = JSON.parse(JSON.stringify(a));
  b.semanas[0].dias[0].treinos[0].passos[0] = "Supino 4×8 · 45 kg";
  b.semanas[0].dias[6].treinos[0].km = 10;
  b.semanas[0].dias[3].treinos = [];
  assert.deepEqual(F.diffTxt(a, b), ["Supino: 40 kg → 45 kg", "Quinta: Regenerativo removido", "Domingo (Longão): distância (km) 8 → 10"]);
  assert.deepEqual(F.diffTxt({}, {metas: {kcal: 2000}, orient: [{ref: "Café", t: "mais proteína"}]}), ["Meta de calorias: nenhuma → 2000 kcal", "Café: orientação adicionada, mais proteína"]);
  assert.deepEqual(F.diffTxt({metas: {kcal: 2000}}, {metas: {kcal: 2200}}), ["Meta de calorias: 2000 kcal → 2200 kcal"]);
  assert.equal(F.exTxt("Supino 4×8 · 42,5 kg").kg, "42,5");
});
