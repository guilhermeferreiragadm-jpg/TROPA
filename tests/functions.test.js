const test = require("node:test");
const assert = require("node:assert/strict");
const { extrairJson, validarEntrada, validarConversa, chaveUso, diaBrasilia, montarConteudo, processar, ErroApp, LIMITE_DIARIO, LIMITE_GLOBAL_DIARIO, MAX_FERRAMENTAS } = require("../functions/lib.js");

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
  assert.deepEqual(reg.usos, [["u1_2026-11-02", LIMITE_DIARIO], ["global_2026-11-02", LIMITE_GLOBAL_DIARIO]]);
  assert.equal(reg.chamadas[0].content[0].type, "image");
  assert.match(reg.chamadas[0].system, /JSON/);
});

// ---------- dia de Brasília e teto global ----------

test("diaBrasilia devolve AAAA-MM-DD em UTC-3 e chaveUso continua igual", () => {
  assert.equal(diaBrasilia(new Date("2026-11-03T01:00:00Z")), "2026-11-02");
  assert.equal(diaBrasilia(new Date("2026-11-03T12:00:00Z")), "2026-11-03");
  assert.equal(chaveUso("u1", new Date("2026-11-03T02:59:00Z")), "u1_2026-11-02");
});

test("processar: depois do limite pessoal, conta no teto global do dia", async () => {
  const { deps, reg } = depsFalsas();
  await processar({ uid: "u1", owner: false, data: { prompt: "oi" }, agora }, deps);
  assert.equal(LIMITE_GLOBAL_DIARIO, 400);
  assert.deepEqual(reg.usos, [["u1_2026-11-02", LIMITE_DIARIO], ["global_2026-11-02", LIMITE_GLOBAL_DIARIO]]);
});

test("processar: teto global estourado bloqueia com mensagem própria", async () => {
  const { deps, reg } = depsFalsas({ registrarUso: async chave => { reg.usos.push(chave); return !chave.startsWith("global_"); } });
  await assert.rejects(
    processar({ uid: "u1", owner: false, data: { prompt: "oi" }, agora }, deps),
    e => e instanceof ErroApp && e.code === "resource-exhausted" && e.message === "O Tropa atingiu o limite de IA de hoje. Volte amanhã."
  );
  assert.equal(reg.chamadas.length, 0);
});

test("processar: limite pessoal estourado nem toca no global", async () => {
  const { deps, reg } = depsFalsas({ registrarUso: async chave => { reg.usos.push(chave); return false; } });
  await assert.rejects(processar({ uid: "u1", owner: false, data: { prompt: "oi" }, agora }, deps), e => e.code === "resource-exhausted");
  assert.deepEqual(reg.usos, ["u1_2026-11-02"]);
});

// ---------- modo conversa (chat do Coach/Nutri) ----------

const MSGS = [{ role: "user", content: "CONTEXTO" }, { role: "assistant", content: "Beleza." }, { role: "user", content: "oi" }];
const FERR = [{ name: "ver_semana", description: "mostra a semana", input_schema: { type: "object", properties: {} } }];

test("validarConversa aceita conversa com blocos e normaliza o esforço", () => {
  assert.deepEqual(validarConversa({ mensagens: MSGS }), { mensagens: MSGS, ferramentas: [], esforco: "medium" });
  const comBlocos = MSGS.concat([
    { role: "assistant", content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "vou ver" }, { type: "tool_use", id: "t1", name: "ver_semana", input: {} }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "[]" }] }
  ]);
  const r = validarConversa({ mensagens: comBlocos, ferramentas: FERR, esforco: "high" });
  assert.equal(r.mensagens.length, 5);
  assert.deepEqual(r.ferramentas, FERR);
  assert.equal(r.esforco, "high");
});

test("validarConversa recusa entrada ruim", () => {
  const ruim = d => assert.throws(() => validarConversa(d), e => e instanceof ErroApp && e.code === "invalid-argument" && /[a-zà-ú]/.test(e.message));
  ruim({ mensagens: [] });
  ruim({ mensagens: "oi" });
  ruim({ mensagens: Array(41).fill({ role: "user", content: "x" }) });
  ruim({ mensagens: [{ role: "system", content: "x" }] });
  ruim({ mensagens: [{ role: "user", content: "" }] });
  ruim({ mensagens: [{ role: "user", content: "x".repeat(60001) }] });
  ruim({ mensagens: [{ role: "user", content: [] }] });
  ruim({ mensagens: [{ role: "user", content: [{ type: "image", source: {} }] }] });
  ruim({ mensagens: [{ role: "user", content: Array(61).fill({ type: "text", text: "a" }) }] });
  ruim({ mensagens: Array(10).fill({ role: "user", content: "x".repeat(50000) }) });
  ruim({ mensagens: MSGS, ferramentas: Array(MAX_FERRAMENTAS + 1).fill(FERR[0]) });
  ruim({ mensagens: MSGS, ferramentas: [{ name: "com espaço", description: "", input_schema: {} }] });
  ruim({ mensagens: MSGS, ferramentas: [{ name: "x", description: "d".repeat(6001), input_schema: {} }] });
  ruim({ mensagens: MSGS, ferramentas: [{ name: "x", description: "d" }] });
  ruim({ mensagens: MSGS, ferramentas: "x" });
  ruim({ mensagens: MSGS, esforco: "max" });
});

test("validarConversa aceita 10 ferramentas (o Coach manda 10) e recusa 17", () => {
  const dez = Array.from({ length: 10 }, (_, i) => ({ name: "f" + i, description: "d", input_schema: { type: "object", properties: {} } }));
  assert.equal(validarConversa({ mensagens: MSGS, ferramentas: dez }).ferramentas.length, 10);
  const dezessete = dez.concat(Array.from({ length: 7 }, (_, i) => ({ name: "g" + i, description: "d", input_schema: {} })));
  assert.equal(dezessete.length, 17);
  assert.throws(() => validarConversa({ mensagens: MSGS, ferramentas: dezessete }), e => e instanceof ErroApp && e.code === "invalid-argument");
  assert.equal(MAX_FERRAMENTAS, 16);
});

test("o chat do app manda no máximo MAX_FERRAMENTAS ferramentas (Coach e Nutri)", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "publicar.html"), "utf8");
  const corpo = nome => {
    const ini = html.indexOf("function " + nome + "(");
    assert.ok(ini >= 0, "function " + nome + "( não encontrada");
    const resto = html.slice(ini + 5), fim = resto.search(/\nfunction /);
    return fim < 0 ? resto : resto.slice(0, fim);
  };
  const nomes = t => (t.match(/\{name:"(\w+)"/g) || []).map(x => x.slice(7, -1));
  const fonte = corpo("ferramentas");
  const corte = fonte.indexOf("\n  return ferramentasDiario().concat(ferramentasLeitura()");
  assert.ok(corte > 0, "ramo da nutri não encontrado");
  const coach = fonte.slice(0, corte), nutri = fonte.slice(corte);
  // coach: ferramentas do diário e a de consulta mais as da lista, menos as que o filtro final tira
  const filtro = /\.filter\(f=>!\/\^\(([^)]*)\)\$\/\.test\(f\.name\)\)/.exec(coach);
  const fora = filtro ? new RegExp("^(" + filtro[1] + ")$") : /$^/;
  const doCoach = nomes(corpo("ferramentasDiario")).concat(nomes(corpo("ferramentasConsulta")), nomes(coach).filter(n => !fora.test(n)));
  // nutri: diário, as quatro leituras que o filtro deixa passar, as do elo com o coach e a lista própria
  const leituras = nomes(corpo("ferramentasLeitura")).filter(n => /ver_(comida|corpo|agenda|metas)/.test(n));
  const daNutri = nomes(corpo("ferramentasDiario")).concat(leituras, nomes(corpo("ferramentasNutriCoach")), nomes(nutri));
  for (const [nome, lista] of [["coach", doCoach], ["nutri", daNutri]]) {
    assert.equal(new Set(lista).size, lista.length, nome + " tem ferramenta repetida");
    assert.ok(lista.length >= 1 && lista.length <= MAX_FERRAMENTAS, nome + " manda " + lista.length + " ferramentas (teto " + MAX_FERRAMENTAS + ")");
  }
});

function depsConversa(sobrescreve) {
  const base = depsFalsas(Object.assign({
    chamarClaude: async () => { throw new Error("modo json não devia rodar"); },
    chamarClaudeConversa: async a => { base.reg.chamadas.push(a); return { content: [{ type: "text", text: "oi!" }], stopReason: "end_turn" }; }
  }, sobrescreve));
  return base;
}

test("processar modo conversa: devolve content e stopReason, sem prompt de JSON", async () => {
  const { deps, reg } = depsConversa();
  const r = await processar({ uid: "u1", owner: false, data: { mensagens: MSGS, ferramentas: FERR, esforco: "high" }, agora }, deps);
  assert.deepEqual(r, { content: [{ type: "text", text: "oi!" }], stopReason: "end_turn" });
  assert.deepEqual(reg.chamadas, [{ mensagens: MSGS, ferramentas: FERR, esforco: "high" }]);
  assert.deepEqual(reg.usos, [["u1_2026-11-02", LIMITE_DIARIO], ["global_2026-11-02", LIMITE_GLOBAL_DIARIO]]);
});

test("processar modo conversa: mesmas travas de login, acesso e limite", async () => {
  await assert.rejects(processar({ uid: null, owner: false, data: { mensagens: MSGS }, agora }, depsConversa().deps), e => e.code === "unauthenticated");
  await assert.rejects(processar({ uid: "u1", owner: false, data: { mensagens: MSGS }, agora }, depsConversa({ temAcesso: async () => false }).deps), e => e.code === "permission-denied");
  await assert.rejects(processar({ uid: "u1", owner: false, data: { mensagens: MSGS }, agora }, depsConversa({ registrarUso: async () => false }).deps), e => e.code === "resource-exhausted");
  await assert.rejects(processar({ uid: "u1", owner: false, data: { mensagens: [] }, agora }, depsConversa().deps), e => e.code === "invalid-argument");
});

test("processar modo conversa: dono não toca em nenhum contador", async () => {
  const { deps, reg } = depsConversa({ temAcesso: async () => { throw new Error("não devia chamar"); } });
  const r = await processar({ uid: "gui", owner: true, data: { mensagens: MSGS }, agora }, deps);
  assert.equal(r.stopReason, "end_turn");
  assert.equal(reg.usos.length, 0);
});
