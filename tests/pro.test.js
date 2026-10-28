// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const pro = trecho("/* @pro:start */", "/* @pro:end */");
const F = new Function(pro + "\nreturn {CATEGORIAS, PAPEIS_PRO, CATS_POR_PAPEL, permissoesValidas, vincId, vincEfetivo, podeVer, conviteValido, novoConvite, conflitoVinculo, proximoEstadoProposta, criarPatch, aplicarPatch, hash32, propostaAtual, TIPOS_INBOX, itemInboxValido, gerarPar, derivarChave, cifrar, decifrar, diffTxt, exTxt, opsPermitidas, planoValido, avaliarProposta, tipoDe, hash32, corteAlim, textoAviso, quandoRel, idsParaMarcar};")();

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

const planoT = () => ({inicio: "2026-10-26", semanas: [{dias: [0, 1, 2, 3, 4, 5, 6].map(i => ({dia: "d" + i, treinos: i === 0 ? [{k: "gym", t: "Força", min: 40, passos: ["Supino 4×8 · 40 kg", "Remo 3×10"]}, {k: "run", t: "Corrida", km: 5}] : []}))}]});

test("diffTxt cobre todos os treinos de um array que mudou de tamanho e conta o que não sabe descrever", () => {
  const a = planoT(), b = JSON.parse(JSON.stringify(a));
  b.semanas[0].dias[0].treinos[0].passos[0] = "Supino 4×8 · 45 kg";
  b.semanas[0].dias[0].treinos[1].km = 8;
  b.semanas[0].dias[0].treinos.push({k: "run", t: "Extra", min: 20});
  assert.deepEqual(F.diffTxt(a, b), ["Supino: 40 kg → 45 kg", "Segunda (Corrida): distância (km) 5 → 8", "Segunda: Extra adicionado"]);
  assert.deepEqual(F.diffTxt({a: 1}, {a: 2}), ["e mais 1 mudança"]);
});

test("opsPermitidas e planoValido barram caminho vazio, tipo trocado, lixo e valores acima do teto", () => {
  const a = planoT();
  assert.equal(F.opsPermitidas("treino", [{p: ["semanas", 0, "dias", 0, "treinos", 0, "km"], v: 5}]), true);
  assert.equal(F.opsPermitidas("treino", [{p: [], v: {}}]), false);
  assert.equal(F.opsPermitidas("treino", [{p: ["metas", "kcal"], v: 1}]), false);
  assert.equal(F.opsPermitidas("alimentar", [{p: ["semanas", 0], v: 1}]), false);
  assert.equal(F.opsPermitidas("treino", [{p: ["semanas", 0, "x"], v: "a".repeat(3000)}]), false);
  assert.equal(F.opsPermitidas("alimentar", [{p: ["metas", "kcal"], v: 2000}, {p: ["orient"], v: [{ref: "Café", t: "x"}]}]), true);
  assert.equal(F.opsPermitidas("treino", Array(401).fill({p: ["semanas", 0, "a"], v: 1})), false);
  assert.equal(F.planoValido("treino", a), true);
  assert.equal(F.planoValido("treino", "x"), false);
  const b = JSON.parse(JSON.stringify(a)); b.semanas[0].dias[0].treinos[1].km = 501;
  assert.equal(F.planoValido("treino", b), false);
  const c = JSON.parse(JSON.stringify(a)); c.semanas[0].dias[0].treinos[0].passos[0] = "Supino 100×8";
  assert.equal(F.planoValido("treino", c), false);
  assert.equal(F.planoValido("alimentar", {metas: {kcal: 2000}, orient: [{ref: "a", t: "b"}]}), true);
  assert.equal(F.planoValido("alimentar", {metas: {kcal: "2000"}}), false);
  assert.equal(F.planoValido("alimentar", {orient: Array(21).fill({ref: "a", t: "b"})}), false);
  assert.equal(F.planoValido("alimentar", {semanas: []}), false);
});

test("avaliarProposta usa o tipo do vínculo: payload com tipo trocado nunca vira ok", () => {
  const a = planoT(), b = JSON.parse(JSON.stringify(a)); b.semanas[0].dias[0].treinos[1].km = 8;
  const ops = F.criarPatch(a, b), base = F.hash32(JSON.stringify(a));
  assert.equal(F.tipoDe("personal"), "treino");
  assert.equal(F.avaliarProposta("treino", {tipo: "treino", base, ops}, a).st, "ok");
  assert.equal(F.avaliarProposta("treino", {tipo: "alimentar", base, ops}, a).st, "invalida");
  assert.equal(F.avaliarProposta("alimentar", {tipo: "alimentar", base, ops}, {}).st, "velha");
  assert.equal(F.avaliarProposta("treino", {tipo: "treino", base, ops: [{p: [], v: "lixo"}]}, a).st, "invalida");
  assert.equal(F.avaliarProposta("treino", {tipo: "treino", base: "zz", ops}, a).st, "velha");
});

test("opsPermitidas alimentar: primeira meta, apagar metas, meta isolada e orient do zero ou apagado", () => {
  const ok = op => F.opsPermitidas("alimentar", [op]);
  assert.equal(ok({p: ["metas"], v: {kcal: 2000, prot: 120}}), true);
  assert.equal(ok({p: ["metas"], del: true}), true);
  assert.equal(ok({p: ["metas", "kcal"], v: 2100}), true);
  assert.equal(ok({p: ["metas", "x"], v: 1}), false);
  assert.equal(ok({p: ["metas"], v: {zzz: 1}}), false);
  assert.equal(ok({p: ["metas"], v: {kcal: 99999}}), false);
  assert.equal(ok({p: ["metas"], v: 5}), false);
  assert.equal(ok({p: ["metas"], v: [1]}), false);
  const lista = Array.from({length: 20}, (_, i) => ({ref: "R" + i, t: "x".repeat(300)}));
  assert.equal(ok({p: ["orient"], v: lista}), true);
  assert.equal(ok({p: ["orient"], v: lista.concat(lista[0])}), false);
  assert.equal(ok({p: ["orient"], del: true}), true);
  assert.equal(ok({p: ["orient"], v: "texto"}), false);
  const a = {}, b = {metas: {kcal: 2000}, orient: [{ref: "Café", t: "x"}]};
  assert.equal(F.opsPermitidas("alimentar", F.criarPatch(a, b)), true);
  assert.equal(F.opsPermitidas("alimentar", F.criarPatch(b, {})), true);
  assert.equal(F.avaliarProposta("alimentar", {tipo: "alimentar", base: F.hash32("{}"), ops: F.criarPatch(a, b)}, {}).st, "ok");
});

test("corteAlim usa as 20 primeiras orientações na base e a proposta segue válida", () => {
  const velho = {orient: Array.from({length: 25}, (_, i) => ({ref: "R" + i, t: "t"}))}, cort = F.corteAlim(velho);
  assert.equal(cort.orient.length, 20);
  const dep = {...cort, metas: {kcal: 1800}}, p = {tipo: "alimentar", base: F.hash32(JSON.stringify(cort)), ops: F.criarPatch(cort, dep)};
  assert.equal(F.avaliarProposta("alimentar", p, velho).st, "ok");
});

test("textoAviso mostra a outra parte do vínculo e o texto por tipo", () => {
  const v = {alunoId: "a", profId: "p", papel: "nutri", nomeA: "Ana", nomeP: "Clara"};
  const t = (tipo, eu, x = {}) => F.textoAviso({tipo}, {eu, v, ...x});
  assert.equal(t("vinculo", "p"), "Ana aceitou seu convite de Nutri");
  assert.equal(t("encerrado", "a"), "Clara encerrou o vínculo");
  assert.equal(t("proposta", "a"), "Clara propôs uma mudança no seu plano alimentar");
  assert.equal(F.textoAviso({tipo: "proposta"}, {eu: "a", v: {...v, papel: "personal"}}), "Clara propôs uma mudança no seu treino");
  assert.equal(t("resposta", "p", {estado: "aceita"}), "Ana aceitou sua proposta");
  assert.equal(t("resposta", "p", {estado: "recusada", motivo: "Muito pesado"}), "Ana recusou: Muito pesado");
  assert.equal(t("resposta", "p", {estado: "recusada"}), "Ana recusou sua proposta");
  assert.equal(t("resposta", "p", {estado: "desatualizada"}), "Ana deixou sua proposta como desatualizada");
  assert.equal(t("resposta", "p", {estado: "pendente"}), "Ana respondeu sua proposta");
  assert.equal(t("perm", "p"), "Ana mudou o que você pode ver");
  assert.equal(t("comentario", "p"), "Ana comentou um exercício");
  assert.equal(F.textoAviso({tipo: "vinculo"}, {eu: "p", v: {...v, nomeA: ""}}), "Seu paciente aceitou seu convite de Nutri");
  assert.equal(F.textoAviso({tipo: "x"}, {eu: "p", v}), "");
  assert.equal(F.textoAviso({tipo: "perm"}, {eu: "p"}), "");
});

test("quandoRel: agora, minutos, horas, ontem e data", () => {
  const agora = new Date(2026, 9, 28, 15, 0, 0).getTime(), antes = ms => agora - ms;
  assert.equal(F.quandoRel(antes(30e3), agora), "agora");
  assert.equal(F.quandoRel(antes(5 * 60e3), agora), "há 5 min");
  assert.equal(F.quandoRel(antes(2 * 3600e3), agora), "há 2 h");
  assert.equal(F.quandoRel(new Date(2026, 9, 27, 23, 0).getTime(), agora), "ontem");
  assert.equal(F.quandoRel(new Date(2026, 9, 25, 10, 0).getTime(), agora), "25/10");
  assert.equal(F.quandoRel(agora + 5000, agora), "agora");
});

test("idsParaMarcar devolve só os não lidos exibidos", () => {
  assert.deepEqual(F.idsParaMarcar([{id: "a", lida: false}, {id: "b", lida: true}, {id: "c"}, null]), ["a", "c"]);
  assert.deepEqual(F.idsParaMarcar(null), []);
});

test("vincEfetivo: aluno usa só a cópia privada (pin) para profissional, papel, permissões e estado", () => {
  const pin = {profId:"paulo", papel:"nutri", perm:{comida:true, corpo:false}, estado:"ativo", criado:1};
  const doc = {alunoId:"ana", profId:"paulo", papel:"nutri", perm:{comida:true, corpo:false}, estado:"ativo", nomeP:"Paulo"};
  const v = F.vincEfetivo("ana~nutri", doc, "ana", pin);
  assert.equal(v.id, "ana~nutri"); assert.equal(v.profId, "paulo"); assert.equal(v.estado, "ativo"); assert.equal(v.nomeP, "Paulo");
  // profissional reescreve papel, perm e profId: nada disso vale
  const forj = F.vincEfetivo("ana~nutri", Object.assign({}, doc, {profId:"x", perm:{comida:true, corpo:true, treino:true}}), "ana", pin);
  assert.equal(forj.profId, "paulo"); assert.deepEqual(forj.perm, {comida:true, corpo:false});
  assert.equal(F.podeVer(forj, "treino"), false); assert.equal(F.podeVer(forj, "corpo"), false);
  // papel trocado no doc: o id deixa de bater com aluno~papel
  assert.equal(F.vincEfetivo("ana~nutri", Object.assign({}, doc, {papel:"personal"}), "ana", pin), null);
  // aluno encerrou (pin): doc regravado como ativo não reabre
  const fim = F.vincEfetivo("ana~nutri", doc, "ana", Object.assign({}, pin, {estado:"encerrado"}));
  assert.equal(fim.estado, "encerrado"); assert.equal(fim.estadoDoc, "ativo"); assert.equal(F.podeVer(fim, "comida"), false);
  // profissional encerrou no doc: encerrado também
  assert.equal(F.vincEfetivo("ana~nutri", Object.assign({}, doc, {estado:"encerrado"}), "ana", pin).estado, "encerrado");
  // sem pin (doc criado por terceiro) ou pin de outro papel: ignorado
  assert.equal(F.vincEfetivo("ana~nutri", doc, "ana", null), null);
  assert.equal(F.vincEfetivo("ana~nutri", doc, "ana", Object.assign({}, pin, {papel:"personal"})), null);
});

test("vincEfetivo: id precisa ser aluno~papel e o doc tem de ser meu", () => {
  const doc = {alunoId:"ana", profId:"paulo", papel:"personal", perm:{treino:true}, estado:"ativo"};
  assert.equal(F.vincEfetivo("ana~personal", doc, "paulo").id, "ana~personal");
  assert.equal(F.vincEfetivo('"><img src=x onerror=alert(1)>', doc, "paulo"), null);
  assert.equal(F.vincEfetivo("ana~personal", doc, "x"), null);
  assert.equal(F.vincEfetivo("ana~coach", Object.assign({}, doc, {papel:"coach"}), "paulo"), null);
  assert.equal(F.vincEfetivo("ana~personal", null, "paulo"), null);
  assert.equal(F.vincEfetivo("ana~personal", Object.assign({}, doc, {alunoId:1}), "paulo"), null);
});
