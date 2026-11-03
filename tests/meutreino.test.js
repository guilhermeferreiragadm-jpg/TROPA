// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const ajudas = trecho("const DAY = 864e5;", "const dow = d => (d.getDay()+6)%7;");
const gerador = trecho("/* ===================== GERADOR DE PLANO (regras fixas)", "const NOMEF").replace(/const NOMEF$/, "");
const F = new Function(ajudas + "\n" + gerador + "\nreturn {TPL, gerarPlano, validar, nivel, modeloVazio, modeloValido, planoMeu};")();

const todos = pl => pl.semanas.flatMap(s => s.dias.flatMap(d => d.treinos));

test("força sem corrida: nenhum treino de corrida e cardio opcional em bike ou caminhada", () => {
  const pl = F.gerarPlano({objetivo: "massa", naoCorre: true, academiaMeses: 12, diasSem: 4});
  assert.ok(!todos(pl).some(t => t.k === "run"), "não pode ter corrida");
  const cardio = todos(pl).filter(t => /Cardio/.test(t.t));
  assert.ok(cardio.length > 0);
  cardio.forEach(t => { assert.equal(t.k, "bike"); assert.equal(t.t, "Cardio opcional"); assert.equal(t.min, 30); });
});

test("força para quem corre continua com o Cardio leve de corrida", () => {
  const pl = F.gerarPlano({objetivo: "massa", academiaMeses: 12, diasSem: 4});
  assert.ok(todos(pl).some(t => t.k === "run" && t.t === "Cardio leve"));
});

test("força sem corrida não tem longão (a semana fica sem km de corrida)", () => {
  const pl = F.gerarPlano({objetivo: "massa", naoCorre: true, academiaMeses: 12, diasSem: 4});
  assert.ok(pl.semanas.every(s => s.longao === 0));
});

// ---------- plano próprio (custom) ----------

const trino = (o) => Object.assign({k: "gym", t: "Peito e tríceps", min: 50, ef: "RIR 2", passos: ["Supino 4×8 · 60 kg", "Tríceps corda 3×12"]}, o);
const modelo = (dias) => { const m = F.modeloVazio(); Object.entries(dias).forEach(([i, ts]) => { m.dias[i].treinos = ts; }); return m; };

test("modeloVazio tem 7 dias sem treino", () => {
  const m = F.modeloVazio();
  assert.equal(m.dias.length, 7);
  assert.ok(m.dias.every(d => Array.isArray(d.treinos) && d.treinos.length === 0));
});

test("modeloValido aceita uma semana boa e recusa os erros comuns", () => {
  assert.deepEqual(F.modeloValido(modelo({0: [trino()], 2: [trino({t: "Costas"})], 5: [trino({k: "run", t: "Corrida", km: 5, min: undefined, passos: []})]})), []);
  const erro = (m, re) => assert.ok(F.modeloValido(m).some(x => re.test(x)), "esperava erro " + re);
  erro(F.modeloVazio(), /pelo menos um treino/);
  erro(modelo({0: [trino(), trino(), trino(), trino()]}), /no máximo 3/);
  erro(modelo({0: [trino({t: "  "})]}), /nome/);
  erro(modelo({0: [trino({k: "surf"})]}), /tipo/);
  erro(modelo({0: [trino({min: 0})]}), /duração/);
  erro(modelo({0: [trino({min: 5000})]}), /duração/);
  erro(modelo({0: [trino({k: "run", min: undefined, km: 0})]}), /duração|distância/);
  erro(modelo([0, 1, 2, 3, 4, 5, 6].reduce((o, i) => { o[i] = [trino()]; return o; }, {})), /descanso/);
  assert.ok(F.modeloValido(null).length > 0);
  assert.ok(F.modeloValido({dias: []}).length > 0);
});

test("planoMeu repete o modelo por 52 semanas no formato do plano", () => {
  const m = modelo({0: [trino()], 3: [trino({t: "Pernas"})]});
  const pl = F.planoMeu(m, "2026-11-02", null, "2026-11-02");
  assert.equal(pl.versao, 2); assert.equal(pl.objetivo, "meu"); assert.equal(pl.custom, true); assert.equal(pl.semProva, true);
  assert.equal(pl.inicio, "2026-11-02"); assert.equal(pl.semanas.length, 52);
  const s = pl.semanas[10];
  assert.equal(s.w, 11); assert.equal(s.longao, 0); assert.equal(s.deload, false); assert.equal(s.dias.length, 7);
  assert.deepEqual(s.dias.map(d => d.dia), ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]);
  assert.equal(s.dias[3].treinos[0].t, "Pernas");
  assert.deepEqual(pl.modelo, m);
  s.dias[0].treinos[0].t = "mudou";   // cópias independentes
  assert.equal(pl.semanas[11].dias[0].treinos[0].t, "Peito e tríceps");
  assert.equal(F.validar(pl, {}).length, 0);
});

test("planoMeu sem plano anterior deixa vazios só os dias antes de hoje", () => {
  const pl = F.planoMeu(modelo({0: [trino()], 2: [trino()], 4: [trino()]}), "2026-11-02", null, "2026-11-04");
  assert.equal(pl.semanas[0].dias[0].treinos.length, 0);   // seg 02: passou
  assert.equal(pl.semanas[0].dias[2].treinos.length, 1);   // qua 04: hoje
  assert.equal(pl.semanas[0].dias[4].treinos.length, 1);
  assert.equal(pl.semanas[1].dias[0].treinos.length, 1);
});

test("planoMeu com plano anterior mantém os dias até hoje e troca o resto", () => {
  const antes = F.planoMeu(modelo({0: [trino({t: "Antigo"})], 2: [trino({t: "Antigo"})]}), "2026-11-02", null, "2026-11-02");
  const depois = F.planoMeu(modelo({0: [trino({t: "Novo"})], 2: [trino({t: "Novo"})]}), antes.inicio, antes, "2026-11-04");
  assert.equal(depois.semanas[0].dias[0].treinos[0].t, "Antigo");   // seg 02 já passou
  assert.equal(depois.semanas[0].dias[2].treinos[0].t, "Antigo");   // hoje também fica
  assert.equal(depois.semanas[1].dias[0].treinos[0].t, "Novo");
  assert.equal(depois.geradoEm, antes.geradoEm);
  assert.equal(depois.modelo.dias[0].treinos[0].t, "Novo");
});
