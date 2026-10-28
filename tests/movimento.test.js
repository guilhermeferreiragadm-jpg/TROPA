// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const F = new Function(trecho("/* @movimento:start */", "/* @movimento:end */") + "\nreturn {MOLAS, molaPasso, molaParada, projetar, elastico, velocidade, maisProximo, tipoTransicao};")();

const simular = (mola, de, alvo, v0, seg) => { let e = {x:de, v:v0}, max = de; for (let t = 0; t < seg*120; t++){ e = F.molaPasso(e, alvo, mola, 1/120); if (e.x > max) max = e.x; } return {...e, max}; };

test("mola crítica chega ao alvo sem passar dele", () => {
  const r = simular(F.MOLAS.suave, 0, 100, 0, 1.5);
  assert.ok(Math.abs(r.x - 100) < 0.05, "x final " + r.x);
  assert.ok(r.max <= 100.01, "passou do alvo: " + r.max);
});

test("mola com amortecimento 0,8 passa do alvo e depois assenta", () => {
  const r = simular(F.MOLAS.lancado, 0, 100, 0, 2);
  assert.ok(r.max > 100.5, "devia ter overshoot, máx " + r.max);
  assert.ok(Math.abs(r.x - 100) < 0.05, "x final " + r.x);
});

test("a velocidade inicial é herdada: partir de v alta passa mais longe no começo", () => {
  const a = F.molaPasso({x:0, v:0}, 100, F.MOLAS.suave, 1/60).x;
  const b = F.molaPasso({x:0, v:1000}, 100, F.MOLAS.suave, 1/60).x;
  assert.ok(b > a + 10, a + " vs " + b);
});

test("o resultado não depende do tamanho do quadro (solução exata)", () => {
  for (const mola of [F.MOLAS.suave, F.MOLAS.lancado]){
    const um = F.molaPasso({x:0, v:300}, 100, mola, 0.1);
    let e = {x:0, v:300}; for (let i = 0; i < 10; i++) e = F.molaPasso(e, 100, mola, 0.01);
    assert.ok(Math.abs(um.x - e.x) < 1e-6 && Math.abs(um.v - e.v) < 1e-4, JSON.stringify([um, e]));
  }
});

test("a solução analítica bate com a conhecida: sobressalto de exp(-π·ζ/√(1-ζ²)) para ζ = 0,8", () => {
  const r = simular(F.MOLAS.lancado, 0, 100, 0, 1);
  const esperado = 100 * (1 + Math.exp(-Math.PI*0.8/Math.sqrt(1 - 0.64)));   // ≈ 101,5
  assert.ok(Math.abs(r.max - esperado) < 0.05, r.max + " vs " + esperado);
});

test("molaParada exige posição e velocidade pequenas", () => {
  assert.equal(F.molaParada({x:99.95, v:0.2}, 100, 0.1), true);
  assert.equal(F.molaParada({x:99.95, v:50}, 100, 0.1), false);
  assert.equal(F.molaParada({x:90, v:0}, 100, 0.1), false);
});

test("projetar usa a taxa de desaceleração (0,998 por padrão)", () => {
  assert.equal(Math.round(F.projetar(0, 1000)), 499);
  assert.equal(Math.round(F.projetar(0, 1000, 0.99)), 99);
  assert.equal(F.projetar(50, 0), 50);
  assert.equal(Math.round(F.projetar(300, -1000)), -199);
});

test("elástico: inclinação inicial de 0,55 e nunca passa da dimensão", () => {
  assert.ok(Math.abs(F.elastico(1, 400) - 0.55) < 0.01);
  assert.ok(F.elastico(100000, 400) < 400);
  assert.equal(F.elastico(0, 400), 0);
  assert.equal(F.elastico(-10, 400), -F.elastico(10, 400));
  assert.ok(F.elastico(200, 400) < 200);
});

test("velocidade usa só os últimos ~100 ms", () => {
  const am = [{t:0, x:0}, {t:100, x:500}, {t:200, x:510}, {t:260, x:516}];
  assert.equal(Math.round(F.velocidade(am)), 100);   // (516-510)/(260-200)*1000
  assert.equal(F.velocidade([{t:0, x:0}]), 0);
  assert.equal(F.velocidade([]), 0);
  assert.equal(F.velocidade([{t:5, x:0}, {t:5, x:9}]), 0);
});

test("velocidade de um arraste rápido", () => {
  const am = [{t:0, x:0}, {t:50, x:50}, {t:100, x:100}];
  assert.equal(Math.round(F.velocidade(am)), 1000);
});

test("maisProximo escolhe o alvo mais perto", () => {
  assert.equal(F.maisProximo(40, [0, 100]), 0);
  assert.equal(F.maisProximo(60, [0, 100]), 100);
  assert.equal(F.maisProximo(-5, [0, 100, 200]), 0);
});

test("tipoTransicao classifica as navegações", () => {
  const T = (a, b) => F.tipoTransicao(a, b);
  const hoje = {tab:"hoje", sub:null, arg:null};
  assert.equal(T(hoje, hoje), "nenhuma");
  assert.equal(T(hoje, {tab:"treino", sub:null, arg:null}), "aba");
  assert.equal(T({tab:"treino", sub:null, arg:null}, {tab:"treino", sub:"treino", arg:"2026-10-27~0"}), "push");
  assert.equal(T({tab:"treino", sub:"treino", arg:"x"}, {tab:"treino", sub:null, arg:null}), "pop");
  assert.equal(T({tab:"treino", sub:"treino", arg:"x"}, {tab:"treino", sub:"ex", arg:"Agachamento"}), "push");
  assert.equal(T({tab:"perf", sub:"grupo", arg:"1"}, {tab:"perf", sub:"grupo", arg:"2"}), "push");
  assert.equal(T(hoje, {tab:"chat", sub:null, arg:null}), "sobe");
  assert.equal(T({tab:"chat", sub:null, arg:null}, hoje), "desce");
  assert.equal(T({tab:"hoje", sub:"checkout", arg:null}, {tab:"perfil", sub:null, arg:null}), "aba");
});
