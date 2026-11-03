// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const ajudas = trecho("const DAY = 864e5;", "const dow = d => (d.getDay()+6)%7;");
const gerador = trecho("/* ===================== GERADOR DE PLANO (regras fixas)", "const NOMEF").replace(/const NOMEF$/, "");
const F = new Function(ajudas + "\n" + gerador + "\nreturn {TPL, gerarPlano, validar, nivel};")();

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
