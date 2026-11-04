// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const ajudas = trecho("const DAY = 864e5;", "const dow = d => (d.getDay()+6)%7;");
const gerador = trecho("/* ===================== GERADOR DE PLANO (regras fixas)", "const NOMEF").replace(/const NOMEF$/, "");
const F = new Function(ajudas + "\n" + gerador + "\nreturn {TPL, gerarPlano, validar, nivel, modeloVazio, modeloValido, planoMeu, sugerirExercicio, EXERCICIOS, aplicarEdicaoNoPlano};")();
const G = F;

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

test("planoMeu cobre sempre um ano à frente de hoje, mesmo com início antigo", () => {
  const m = modelo({0: [trino()]});
  assert.equal(F.planoMeu(m, "2026-11-02", null, "2026-11-04").semanas.length, 52);
  const ant = F.planoMeu(m, "2025-11-03", null, "2025-11-03");
  const depois = F.planoMeu(m, ant.inicio, ant, "2026-11-04");
  assert.ok(depois.semanas.length >= 52 + 52, "início de um ano atrás pede ~104 semanas");
  assert.equal(depois.semanas[depois.semanas.length - 1].dias[0].treinos.length, 1);
});

test("planoMeu a partir de um plano gerado preserva os dias até hoje", () => {
  const gerado = F.gerarPlano({objetivo: "massa", naoCorre: true, academiaMeses: 12, diasSem: 4});
  const feito = gerado.semanas[0].dias.map(d => d.treinos.map(t => t.t));
  const hoje = gerado.inicio;   // segunda da semana 1
  const pl = F.planoMeu(modelo({0: [trino({t: "Novo"})]}), gerado.inicio, gerado, hoje);
  assert.deepEqual(pl.semanas[0].dias[0].treinos.map(t => t.t), feito[0]);
  assert.equal(pl.semanas[0].dias[1].treinos[0] && pl.semanas[0].dias[1].treinos[0].t, undefined);
});

test("sugestão de exercício: 'sup' completa com os supinos, começando pelo reto", () => {
  const r = G.sugerirExercicio("sup", 6);
  assert.equal(r[0], "Supino reto");
  assert.ok(r.includes("Supino inclinado") && r.includes("Supino declinado"));
  assert.ok(r.every(n => /supino/i.test(n)));
});

test("sugestão de exercício: sem acento, várias palavras, apelido e limite", () => {
  assert.ok(G.sugerirExercicio("agach").includes("Agachamento livre"));
  assert.ok(G.sugerirExercicio("triceps").some(n => /^Tríceps/.test(n)));
  assert.ok(G.sugerirExercicio("sup incl").every(n => /Supino inclinado/.test(n)));
  assert.ok(G.sugerirExercicio("rdl").includes("Levantamento terra romeno"));
  assert.equal(G.sugerirExercicio("s", 6).length, 0, "uma letra só não sugere");
  assert.ok(G.sugerirExercicio("rosca", 3).length === 3);
  assert.deepEqual(G.sugerirExercicio("xyzxyz"), []);
});

test("base de exercícios: nomes únicos e preenchidos", () => {
  const nomes = G.EXERCICIOS.map(e => e.n);
  assert.ok(nomes.length > 150);
  assert.equal(new Set(nomes).size, nomes.length);
  assert.ok(nomes.every(n => n.trim() === n && n.length >= 3 && n.length <= 40));
});

test("aplicarEdicaoNoPlano muda só o treino de mesmo nome no mesmo dia da semana, das semanas livres", () => {
  const gerado = F.gerarPlano({objetivo: "massa", naoCorre: true, academiaMeses: 12, diasSem: 4});
  const ini = new Date(2026, 10, 2);   // segunda
  const sem = d => { const w = Math.floor(Math.round((d - ini) / 864e5) / 7); return gerado.semanas[w] || null; };
  const dias = gerado.semanas[0].dias, iB = dias.findIndex(d => d.treinos.some(t => /superiores/.test(t.t)));
  assert.ok(iB >= 0, "plano de força tem o treino de superiores");
  const nome = dias[iB].treinos.find(t => /superiores/.test(t.t)).t;
  const dia = new Date(2026, 10, 2 + iB), travado = d => +d === +new Date(2026, 10, 2 + iB + 7);   // 2ª semana travada
  const novo = {t: "Força B (meu)", min: 70, ef: "RIR 1", passos: ["Supino reto 5×5 · 80 kg"]};
  const n = F.aplicarEdicaoNoPlano(sem, dia, nome, novo, travado);
  assert.ok(n >= 2 && n < gerado.semanas.length, "mudou várias semanas, menos a travada");
  const em = w => gerado.semanas[w].dias[iB].treinos.find(t => t.edit);
  assert.equal(em(0).t, "Força B (meu)"); assert.equal(em(0).min, 70); assert.deepEqual(em(0).passos, ["Supino reto 5×5 · 80 kg"]);
  assert.ok(!gerado.semanas[1].dias[iB].treinos.some(t => t.edit), "semana travada fica como estava");
  assert.ok(gerado.semanas[2].dias[iB].treinos.some(t => t.edit));
  const outros = gerado.semanas[0].dias.filter((_, j) => j !== iB).flatMap(d => d.treinos);
  assert.ok(outros.every(t => !t.edit), "outros dias não mudam");
});

test("fotos dos exercícios: todo nome mapeado existe na base e todo arquivo existe", () => {
  const mapa = JSON.parse(/const MIDIA_EX = (\{.*?\});\n/s.exec(html)[1]), mus = JSON.parse(/const MUS_EX = (\{.*?\});\n/s.exec(html)[1]);
  const nomes = new Set(F.EXERCICIOS.map(e => e.n)), ids = new Set(Object.values(mapa));
  Object.keys(mapa).forEach(n => assert.ok(nomes.has(n), "nome fora da base: " + n));
  ids.forEach(id => {
    ["0", "1"].forEach(i => assert.ok(fs.existsSync(path.join(__dirname, "..", "app", "exercicios", id, i + ".jpg")), "falta foto " + id + "/" + i));
    assert.ok(mus[id], "falta músculo de " + id);
  });
  assert.ok(Object.keys(mapa).length > 120);
});

test("feed: 'Outro esporte' mostra o nome digitado e os demais esportes seguem iguais", () => {
  const i = html.indexOf("const ESPN ="), j = html.indexOf("\n", html.indexOf("function espNome(p){", i));
  const ESPN = new Function(html.slice(i, j) + "\nreturn espNome;")();
  assert.equal(ESPN({esporte: "outro", outro: "Futebol"}), "Futebol");
  assert.equal(ESPN({esporte: "outro", outro: ""}), "outro esporte");
  assert.equal(ESPN({esporte: "run"}), "corrida");
  assert.equal(ESPN({esporte: "hyrox"}), "hyrox");
  assert.equal(ESPN({esporte: "desconhecido"}), "treino");
});

test("feed: formulário de postar tem Outro, campo do nome e validação", () => {
  const f = trecho("function postarHTML(){", "function bindFeed(app){");
  assert.match(f, /\["outro","Outro"\]/);
  assert.match(f, /id="pf-outro-box"/);
  assert.match(f, /data-f="pf_outro"/);
  assert.match(html, /Diga qual esporte foi\./);
});

test("feed: cartão de post 'outro' mostra o nome do esporte como etiqueta", () => {
  assert.match(trecho("function postFull(p){", "const nc ="), /p\.esporte==="outro" \? '<span class="pill2">'\+esc\(espNome\(p\)\)/);
});
