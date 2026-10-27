// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const ajudas = trecho("const DAY = 864e5;", "const dow = d => (d.getDay()+6)%7;");
const puro = trecho("/* @pure:start */", "/* @pure:end */");
// new Function (mesmo realm do teste) em vez de vm.createContext: objetos criados em outro realm
// têm outro Object.prototype e falham no deepEqual estrito.
const F = new Function(ajudas + "\n" + puro + "\nreturn {diasPausa, semanasDeslocadas, rampaRetorno, pausaCobre, deslocamentoEm, fatorRetornoEm, semanaEm, semanasAtrasoProva, escalarTreino, minutosPlan, prioridadeTreino, calcularTeto, reduzirParaTeto, fotoValida, motivoGenerico, sugerirSemana, atualizarFavoritas, candidatasRepetir};")();

test("diasPausa conta o primeiro e o último dia", () => {
  assert.equal(F.diasPausa("2026-10-05", "2026-10-05"), 1);
  assert.equal(F.diasPausa("2026-10-05", "2026-10-11"), 7);
  assert.equal(F.diasPausa("2026-10-05", "2026-10-12"), 8);
});

test("semanasDeslocadas: até 7 dias não desloca, depois arredonda para cima", () => {
  assert.equal(F.semanasDeslocadas(7), 0);
  assert.equal(F.semanasDeslocadas(8), 2);
  assert.equal(F.semanasDeslocadas(14), 2);
  assert.equal(F.semanasDeslocadas(15), 3);
});

test("rampaRetorno segue a tabela aprovada", () => {
  assert.deepEqual(F.rampaRetorno(3), {fatores: [], refazer: false});
  assert.deepEqual(F.rampaRetorno(4), {fatores: [0.8], refazer: false});
  assert.deepEqual(F.rampaRetorno(8), {fatores: [0.6, 0.8], refazer: false});
  assert.deepEqual(F.rampaRetorno(15), {fatores: [0.5, 0.65, 0.8], refazer: false});
  assert.deepEqual(F.rampaRetorno(29), {fatores: [0.5, 0.65, 0.8], refazer: true});
});

test("pausaCobre: pausa aberta cobre tudo depois do início, fechada só até o fim", () => {
  const ps = [{inicio: "2026-10-05", fim: "2026-10-08"}, {inicio: "2026-10-20", fim: null}];
  assert.equal(F.pausaCobre(ps, "2026-10-04"), false);
  assert.equal(F.pausaCobre(ps, "2026-10-05"), true);
  assert.equal(F.pausaCobre(ps, "2026-10-08"), true);
  assert.equal(F.pausaCobre(ps, "2026-10-09"), false);
  assert.equal(F.pausaCobre(ps, "2026-10-25"), true);
});

test("deslocamentoEm só conta pausas já terminadas antes do dia", () => {
  const ps = [{inicio: "2026-10-05", fim: "2026-10-18", desl: 2}, {inicio: "2026-11-02", fim: null}];
  assert.equal(F.deslocamentoEm(ps, "2026-10-18"), 0);
  assert.equal(F.deslocamentoEm(ps, "2026-10-19"), 2);
  assert.equal(F.deslocamentoEm(ps, "2026-11-10"), 2);
});

test("fatorRetornoEm: primeira semana de volta usa o primeiro fator, depois sobe, depois volta a 1", () => {
  const ps = [{inicio: "2026-10-05", fim: "2026-10-18", fatores: [0.6, 0.8]}];
  assert.equal(F.fatorRetornoEm(ps, "2026-10-18"), 1);
  assert.equal(F.fatorRetornoEm(ps, "2026-10-19"), 0.6);
  assert.equal(F.fatorRetornoEm(ps, "2026-10-25"), 0.6);
  assert.equal(F.fatorRetornoEm(ps, "2026-10-26"), 0.8);
  assert.equal(F.fatorRetornoEm(ps, "2026-11-02"), 1);
  assert.equal(F.fatorRetornoEm([], "2026-11-02"), 1);
});

test("semanaEm desloca o plano em semanas inteiras", () => {
  const plano = {inicio: "2026-10-05", semanas: [{n: 1}, {n: 2}, {n: 3}, {n: 4}]};
  assert.equal(F.semanaEm(plano, [], "2026-10-19").w, 3);
  const ps = [{inicio: "2026-10-12", fim: "2026-10-18", desl: 0}];
  assert.equal(F.semanaEm(plano, ps, "2026-10-19").w, 3);
  const ps2 = [{inicio: "2026-10-12", fim: "2026-10-25", desl: 2}];
  assert.equal(F.semanaEm(plano, ps2, "2026-10-26").w, 2);
  assert.equal(F.semanaEm(plano, ps2, "2026-10-26").sem.n, 2);
  assert.equal(F.semanaEm(plano, ps2, "2026-10-25").w, 3);
});

test("semanasAtrasoProva só avisa em plano com prova", () => {
  const ps = [{desl: 2}, {desl: 3}];
  assert.equal(F.semanasAtrasoProva({semProva: false}, ps), 5);
  assert.equal(F.semanasAtrasoProva({semProva: true}, ps), 0);
  assert.equal(F.semanasAtrasoProva({semProva: false}, []), 0);
});

test("escalarTreino reduz volume, tira intensidade e avisa", () => {
  const forte = {k: "run", t: "Intervalado", min: 45, z: "forte", ef: "7–8/10", passos: ["x"]};
  const r = F.escalarTreino(forte, 0.6);
  assert.equal(r.min, 27); assert.equal(r.z, "fácil"); assert.match(r.passos[0], /60%/);
  assert.equal(forte.min, 45, "não pode mudar o original");
  const longo = {k: "run", t: "Longão", km: 10, z: "fácil", passos: []};
  assert.equal(F.escalarTreino(longo, 0.8).km, 8);
  assert.match(F.escalarTreino(longo, 0.8).passos[0], /8 km/);
  assert.equal(F.escalarTreino(longo, 1), longo, "fator 1 devolve o mesmo treino");
  const forca = {k: "gym", t: "Força A", min: 50, passos: ["Agachamento 4×8"]};
  assert.equal(F.escalarTreino(forca, 0.5).passos[1], "Agachamento 4×8");
});

test("minutosPlan e prioridadeTreino", () => {
  assert.equal(F.minutosPlan({min: 40}), 40);
  assert.equal(F.minutosPlan({km: 10}), 70);
  assert.equal(F.minutosPlan({}), 0);
  assert.equal(F.prioridadeTreino({t: "Longão"}), 3);
  assert.equal(F.prioridadeTreino({t: "Intervalado", z: "forte"}), 3);
  assert.equal(F.prioridadeTreino({t: "Regenerativo", z: "muito fácil"}), 1);
});

test("calcularTeto: média das semanas feitas, +10%, piso de +15 min, limite do documento", () => {
  assert.deepEqual(F.calcularTeto([200, 220, 180], 0, 0), {base: 200, teto: 220});
  assert.deepEqual(F.calcularTeto([60, 0, 0], 0, 0), {base: 60, teto: 75});
  assert.deepEqual(F.calcularTeto([0, 0, 0], 100, 0), {base: 100, teto: 115});
  assert.equal(F.calcularTeto([0, 0, 0], 0, 0), null);
  assert.deepEqual(F.calcularTeto([200, 200, 200], 0, 150), {base: 200, teto: 150});
  assert.deepEqual(F.calcularTeto([0, 0, 0], 0, 90), {base: 0, teto: 90});
});

test("reduzirParaTeto corta primeiro o que importa menos e respeita os fixos", () => {
  const dias = [
    {id: "seg", min: 40, prio: 1, fixo: false},
    {id: "qua", min: 45, prio: 3, fixo: false},
    {id: "qui", min: 30, prio: 1, fixo: false},
    {id: "dom", min: 90, prio: 3, fixo: false}
  ];
  assert.deepEqual(F.reduzirParaTeto(dias, 300), {cortes: [], total: 205, excedeu: false});
  const r = F.reduzirParaTeto(dias, 190);
  assert.deepEqual(r.cortes, [{id: "seg", de: 40, para: 24}]);
  assert.equal(r.total, 189); assert.equal(r.excedeu, false);
  const r2 = F.reduzirParaTeto(dias, 100);
  assert.deepEqual(r2.cortes.map(c => c.id), ["seg", "qui", "dom", "qua"]);
  assert.equal(r2.excedeu, true);
  const fixos = dias.map(d => ({...d, fixo: true}));
  const r3 = F.reduzirParaTeto(fixos, 100);
  assert.deepEqual(r3.cortes, []); assert.equal(r3.excedeu, true);
});

test("fotoValida aceita só miniatura JPEG em data URL, pequena", () => {
  const ok = "data:image/jpeg;base64," + "A".repeat(1000);
  assert.equal(F.fotoValida(ok), true);
  assert.equal(F.fotoValida("data:image/jpeg;base64," + "A".repeat(61000)), false, "acima de 60 KB");
  assert.equal(F.fotoValida("data:image/png;base64,AAAA"), false, "só JPEG");
  assert.equal(F.fotoValida("javascript:alert(1)"), false);
  assert.equal(F.fotoValida("https://x.com/a.jpg"), false);
  assert.equal(F.fotoValida('data:image/jpeg;base64,AAA"onerror="x'), false, "caracteres fora do base64");
  assert.equal(F.fotoValida("data:image/jpeg;base64,"), false, "vazia");
  assert.equal(F.fotoValida(""), false);
  assert.equal(F.fotoValida(null), false);
  assert.equal(F.fotoValida({}), false);
});

test("motivoGenerico nunca cita prova, data ou distância que não está no contexto", () => {
  const proibidos = /18\/10|70\.3|fevereiro|10 km de|Hyrox/;
  const casos = [
    {k:"run", t:"Longão", km:12}, {k:"run", t:"Corrida regenerativa"}, {k:"run", t:"Intervalado"},
    {k:"run", t:"Corrida limiar"}, {k:"run", t:"Corrida leve"}, {k:"bike", t:"Bike sweet spot"},
    {k:"bike", t:"Bike zona 2"}, {k:"swim", t:"Natação CSS"}, {k:"swim", t:"Natação contínua"},
    {k:"gym", t:"Força"}
  ];
  for (const t of casos) {
    const m = F.motivoGenerico(t, {});
    assert.ok(m.length > 20, "motivo vazio para " + t.t);
    assert.doesNotMatch(m, proibidos, t.t);
  }
});

test("motivoGenerico usa fase, descarga, longão anterior e prova só quando vêm no contexto", () => {
  const lg = F.motivoGenerico({k:"run", t:"Longão", km:12}, {longaoAnt:10, prova:"Meia maratona", fase:"base", deload:true});
  assert.match(lg, /12 km/);
  assert.match(lg, /semana passada: 10 km/);
  assert.match(lg, /Meia maratona/);
  assert.match(lg, /descarga/i);
  const semProva = F.motivoGenerico({k:"run", t:"Longão", km:12}, {});
  assert.doesNotMatch(semProva, /semana passada|Meia/);
});

test("motivoGenerico: treino de força só cita Hyrox se o nome do treino citar", () => {
  assert.doesNotMatch(F.motivoGenerico({k:"gym", t:"Força"}, {}), /Hyrox/);
  assert.match(F.motivoGenerico({k:"gym", t:"Hyrox · estações"}, {}), /resistência/i);
});

test("motivoGenerico: Corrida longa leve recebe o texto de longão e a regra dos 10% só com longão anterior", () => {
  const com = F.motivoGenerico({k:"run", t:"Corrida longa leve", km:8}, {longaoAnt:6});
  assert.match(com, /8 km/);
  assert.match(com, /semana passada: 6 km/);
  assert.match(com, /Sobe no máximo/);
  const sem = F.motivoGenerico({k:"run", t:"Corrida longa leve", km:8}, {});
  assert.doesNotMatch(sem, /semana passada|Sobe no máximo/);
  const desc = F.motivoGenerico({k:"run", t:"Corrida longa leve", km:8}, {longaoAnt:6, deload:true});
  assert.doesNotMatch(desc, /Sobe no máximo/);
});

test("motivoGenerico: Natação técnica tem texto próprio", () => {
  const m = F.motivoGenerico({k:"swim", t:"Natação técnica"}, {});
  assert.ok(m.length > 20);
  assert.doesNotMatch(m, /contínua/);
});

test("sugerirSemana: precisa de pelo menos 2 treinos", () => {
  assert.equal(F.sugerirSemana([]).tipo, null);
  assert.equal(F.sugerirSemana([{rpe:"limite", comoPlano:true}]).tipo, null);
});

test("sugerirSemana: aliviar quando metade ou mais foi pesado ou no limite", () => {
  const r = F.sugerirSemana([{rpe:"pesado", comoPlano:true}, {rpe:"ok", comoPlano:true}]);
  assert.equal(r.tipo, "aliviar"); assert.equal(r.pesados, 1); assert.equal(r.total, 2);
  assert.match(r.motivo, /1 de 2/);
  assert.equal(F.sugerirSemana([{rpe:"pesado"}, {rpe:"ok"}, {rpe:"ok"}]).tipo, null);
  assert.equal(F.sugerirSemana([{rpe:"limite"}, {rpe:"ok"}, {rpe:"limite"}]).tipo, "aliviar");
});

test("sugerirSemana: aliviar com 2 treinos abaixo do plano e algum pesado", () => {
  const r = F.sugerirSemana([{rpe:"pesado", comoPlano:false}, {rpe:"ok", comoPlano:false}, {rpe:"ok", comoPlano:true}, {rpe:"ok", comoPlano:true}]);
  assert.equal(r.tipo, "aliviar");
  assert.equal(F.sugerirSemana([{rpe:"ok", comoPlano:false}, {rpe:"ok", comoPlano:false}, {rpe:"ok"}]).tipo, null);
});

test("sugerirSemana: subir só com 3 ou mais treinos, todos leves e dentro do plano", () => {
  assert.equal(F.sugerirSemana([{rpe:"leve", comoPlano:true}, {rpe:"leve", comoPlano:true}]).tipo, null);
  assert.equal(F.sugerirSemana([{rpe:"leve", comoPlano:true}, {rpe:"leve"}, {rpe:"leve", comoPlano:true}]).tipo, "subir");
  assert.equal(F.sugerirSemana([{rpe:"leve", comoPlano:true}, {rpe:"leve", comoPlano:false}, {rpe:"leve"}]).tipo, null);
});

test("sugerirSemana ignora registros sem rpe", () => {
  assert.equal(F.sugerirSemana([{}, null, {rpe:"ok"}]).total, 1);
});

test("atualizarFavoritas soma usos do mesmo prato e ignora foto sem texto e refeição pulada", () => {
  let l = F.atualizarFavoritas([], {refeicao:"Café da manhã", comeu:"Pão com ovo", estimativa:"~400 kcal"}, "2026-10-26");
  l = F.atualizarFavoritas(l, {refeicao:"Café da manhã", comeu:"  pão  COM ovo ", estimativa:"~420 kcal"}, "2026-10-27");
  assert.equal(l.length, 1); assert.equal(l[0].usos, 2); assert.equal(l[0].ultimo, "2026-10-27"); assert.equal(l[0].estimativa, "~420 kcal");
  assert.equal(F.atualizarFavoritas(l, {refeicao:"Almoço", comeu:"foto enviada"}, "2026-10-27").length, 1);
  assert.equal(F.atualizarFavoritas(l, {refeicao:"Almoço", comeu:"Arroz", pulou:true}, "2026-10-27").length, 1);
});

test("atualizarFavoritas guarda no máximo 12, removendo o menos usado e mais antigo", () => {
  let l = [];
  for (let i = 0; i < 13; i++) l = F.atualizarFavoritas(l, {refeicao:"Almoço", comeu:"Prato " + i}, "2026-10-" + String(10 + i).padStart(2, "0"));
  assert.equal(l.length, 12);
  assert.ok(!l.some(x => x.comeu === "Prato 0"));
  l = F.atualizarFavoritas(l, {refeicao:"Almoço", comeu:"Prato 5"}, "2026-10-27");
  assert.equal(l[0].comeu, "Prato 5");
});

test("atualizarFavoritas não altera a lista original e corta textos longos", () => {
  const orig = [{comeu:"Arroz", estimativa:"", porcao:"", refeicao:"Almoço", usos:1, ultimo:"2026-10-01"}];
  F.atualizarFavoritas(orig, {refeicao:"Almoço", comeu:"Arroz"}, "2026-10-02");
  assert.equal(orig[0].usos, 1);
  assert.equal(F.atualizarFavoritas([], {refeicao:"Almoço", comeu:"x".repeat(300)}, "2026-10-02")[0].comeu.length, 140);
});

test("candidatasRepetir: ontem primeiro, depois até 4 favoritas, sem repetidos", () => {
  const ontem = [{refeicao:"Café da manhã", comeu:"Pão com ovo", estimativa:"~400 kcal"}, {refeicao:"Almoço", comeu:"Arroz e feijão"}, {refeicao:"Café da manhã", comeu:"Café", pulou:true}];
  const fav = [
    {comeu:"Pão com ovo", refeicao:"Café da manhã", usos:5}, {comeu:"Tapioca", refeicao:"Café da manhã", usos:4},
    {comeu:"Iogurte", refeicao:"Lanche", usos:3}, {comeu:"Banana", refeicao:"Lanche", usos:2},
    {comeu:"Vitamina", refeicao:"Lanche", usos:2}, {comeu:"Ovo", refeicao:"Jantar", usos:1}
  ];
  const r = F.candidatasRepetir(ontem, fav, "Café da manhã");
  assert.deepEqual(r.map(x => x.comeu), ["Pão com ovo", "Tapioca", "Iogurte", "Banana", "Vitamina"]);
  assert.equal(r[0].origem, "ontem"); assert.equal(r[0].estimativa, "~400 kcal"); assert.equal(r[1].origem, "favorita");
  assert.deepEqual(F.candidatasRepetir([], [], "Almoço"), []);
});

test("atualizarFavoritas ignora check rápido e texto de correção", () => {
  const l0 = [{comeu:"Arroz", estimativa:"", porcao:"", refeicao:"Almoço", usos:1, ultimo:"2026-10-01"}];
  const a = F.atualizarFavoritas(l0, {refeicao:"Almoço", comeu:"comeu", rapido:true}, "2026-10-02");
  assert.deepEqual(a, l0); assert.notEqual(a, l0);
  assert.equal(F.atualizarFavoritas([], {refeicao:"Almoço", comeu:"Arroz", rapido:true}, "2026-10-02").length, 0);
  const c = F.atualizarFavoritas(l0, {refeicao:"Almoço", comeu:"Arroz e feijão. Correção da pessoa: era integral"}, "2026-10-02");
  assert.deepEqual(c, l0);
});

test("atualizarFavoritas: prato novo nunca é cortado quando a lista está cheia de favoritos usados", () => {
  let l = [];
  for (let i = 0; i < 12; i++) l.push({comeu:"Prato " + i, estimativa:"", porcao:"", refeicao:"Almoço", usos:3, ultimo:"2026-10-" + String(10 + i).padStart(2, "0")});
  const r = F.atualizarFavoritas(l, {refeicao:"Almoço", comeu:"Prato novo"}, "2026-10-27");
  assert.equal(r.length, 12);
  assert.ok(r.some(x => x.comeu === "Prato novo"));
  assert.ok(!r.some(x => x.comeu === "Prato 0"));
  assert.ok(r.some(x => x.comeu === "Prato 1"));
});

test("candidatasRepetir ignora registros de check rápido de ontem", () => {
  const ontem = [{refeicao:"Almoço", comeu:"comeu", rapido:true}, {refeicao:"Almoço", comeu:"Arroz e feijão"}];
  assert.deepEqual(F.candidatasRepetir(ontem, [], "Almoço").map(x => x.comeu), ["Arroz e feijão"]);
});

test("motivoGenerico: planos de massa (força superior e cardio leve) têm texto próprio", () => {
  const b = F.motivoGenerico({k:"gym", t:"Força B · superiores"}, {});
  const d = F.motivoGenerico({k:"gym", t:"Força D · ombro e braço"}, {});
  for (const m of [b, d]) { assert.ok(m.length > 20); assert.doesNotMatch(m, /perna|corr|passada|econ/i); assert.match(m, /postura|músculo|hipertrofia/i); }
  const a = F.motivoGenerico({k:"gym", t:"Força A · pernas"}, {});
  assert.match(a, /perna/);
  const c = F.motivoGenerico({k:"run", t:"Cardio leve", min:30}, {});
  assert.match(c, /coração/); assert.doesNotMatch(c, /longão/i);
});

test("motivoGenerico: sessão ajustada (leve) explica a versão leve", () => {
  const m = F.motivoGenerico({k:"run", t:"Intervalado (leve)"}, {deload:true, fase:"base"});
  assert.match(m, /Versão leve hoje/); assert.match(m, /60%/); assert.match(m, /descarga/i); assert.match(m, /Fase do plano: base/);
  assert.doesNotMatch(m, /VO2/);
  assert.match(F.motivoGenerico({k:"gym", t:"Força (leve)"}, {}), /Versão leve hoje/);
});
