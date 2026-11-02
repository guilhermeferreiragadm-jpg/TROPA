const test = require("node:test");
const assert = require("node:assert/strict");
const { criarClaude, criarChamadorApi, LIMITES, traduzirErroAuth, erroDaIA } = require("../app/shim/core.js");
const { dimensoes } = require("../app/shim/imagem.js");

function montar(extra) {
  const chamadas = { ia: [], baixar: [], leituras: [], autenticar: 0, saiu: false };
  const perfis = { u1: { name: "Ana", avatarUrl: "a.png" } };
  const db = {
    collection: nome => ({
      doc: id => ({
        get: async () => {
          chamadas.leituras.push(nome + "/" + id);
          const v = nome === "perfis" ? perfis[id] : undefined;
          return { exists: !!v, data: () => v };
        }
      })
    })
  };
  const deps = Object.assign({
    db,
    autenticar: async () => { chamadas.autenticar++; return { uid: "u9", name: "Gui", avatarUrl: "g.png", isOwner: true }; },
    sair: async () => { chamadas.saiu = true; },
    chamarIA: async a => { chamadas.ia.push(a); return { ok: true }; },
    baixar: async a => { chamadas.baixar.push(a); return true; },
    paraBase64: async () => ({ tipo: "image/jpeg", base64: "QUJD" })
  }, extra);
  return { claude: criarClaude(deps), chamadas, db };
}

test("use('db') devolve o banco injetado", async () => {
  const { claude, db } = montar();
  assert.equal(await claude.use("db"), db);
});

test("user.me() devolve id, name, avatarUrl e isOwner, e autentica uma vez só", async () => {
  const { claude, chamadas } = montar();
  const user = await claude.use("user");
  const a = await user.me();
  const b = await user.me();
  assert.deepEqual(a, { id: "u9", name: "Gui", avatarUrl: "g.png", isOwner: true });
  assert.deepEqual(b, a);
  assert.equal(chamadas.autenticar, 1);
});

test("user.me() tenta de novo se o login falhou", async () => {
  let n = 0;
  const { claude } = montar({ autenticar: async () => { n++; if (n === 1) throw new Error("cancelou"); return { uid: "u9", name: "Gui", avatarUrl: "", isOwner: false }; } });
  const user = await claude.use("user");
  await assert.rejects(user.me(), /cancelou/);
  assert.equal((await user.me()).id, "u9");
});

test("user.can('data.write') é verdadeiro", async () => {
  const { claude } = montar();
  assert.equal(await (await claude.use("user")).can("data.write"), true);
});

test("user.profiles lê perfis/{id} e ignora quem não existe", async () => {
  const { claude } = montar();
  const r = await (await claude.use("user")).profiles(["u1", "zz"]);
  assert.deepEqual(r, { u1: { name: "Ana", avatarUrl: "a.png" } });
});

test("sample.limits() no formato que o app espera", async () => {
  const { claude } = montar();
  const lim = await (await claude.use("sample")).limits();
  assert.equal(lim.images.maxCount, 3);
  assert.deepEqual(lim.images.mediaTypes, ["image/jpeg", "image/png", "image/webp"]);
  assert.equal(typeof lim.images.maxInputBytes, "number");
  assert.equal(LIMITES.maxCount, 3);
});

test("sample.json sem imagens chama a IA com lista vazia e devolve o resultado", async () => {
  const { claude, chamadas } = montar();
  const r = await (await claude.use("sample")).json("oi", { cache: false });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(chamadas.ia, [{ prompt: "oi", imagens: [] }]);
});

test("sample.json converte as imagens com paraBase64", async () => {
  const { claude, chamadas } = montar();
  await (await claude.use("sample")).json("foto", { images: [{}, {}], cache: false });
  assert.deepEqual(chamadas.ia[0].imagens, [
    { tipo: "image/jpeg", base64: "QUJD" },
    { tipo: "image/jpeg", base64: "QUJD" }
  ]);
});

test("sample.json recusa mais de 3 imagens", async () => {
  const { claude, chamadas } = montar();
  await assert.rejects((await claude.use("sample")).json("x", { images: [{}, {}, {}, {}] }), /no máximo 3 imagens/);
  assert.equal(chamadas.ia.length, 0);
});

test("downloads.save repassa filename e data", async () => {
  const { claude, chamadas } = montar();
  assert.equal(await (await claude.use("downloads")).save({ filename: "a.txt", data: "oi" }), true);
  assert.deepEqual(chamadas.baixar, [{ filename: "a.txt", data: "oi" }]);
});

test("serviço desconhecido rejeita", async () => {
  const { claude } = montar();
  await assert.rejects(claude.use("outro"), /serviço desconhecido: outro/);
});

test("signOut chama sair e zera a sessão", async () => {
  const { claude, chamadas } = montar();
  const user = await claude.use("user");
  await user.me();
  await claude.signOut();
  assert.equal(chamadas.saiu, true);
  await user.me();
  assert.equal(chamadas.autenticar, 2);
});

test("traduzirErroAuth", () => {
  assert.equal(traduzirErroAuth("auth/wrong-password"), "E-mail ou senha incorretos.");
  assert.equal(traduzirErroAuth("auth/invalid-credential"), "E-mail ou senha incorretos.");
  assert.equal(traduzirErroAuth("auth/email-already-in-use"), "Esse e-mail já tem conta. Toque em Entrar.");
  assert.equal(traduzirErroAuth("auth/weak-password"), "A senha precisa ter pelo menos 6 caracteres.");
  assert.equal(traduzirErroAuth("auth/popup-closed-by-user"), "");
  assert.equal(traduzirErroAuth("auth/network-request-failed"), "Sem internet. Tente de novo.");
  assert.equal(traduzirErroAuth("tropa/sem-google-nativo"), "Entrar com Google no app nativo ainda não foi configurado. Use e-mail e senha.");
  assert.equal(traduzirErroAuth("qualquer/coisa"), "Não consegui entrar. Tente de novo.");
});

// ---------- chat: sample(turns, opts) com laço de ferramentas no navegador ----------

function rodadas(respostas) {
  const pedidos = [];
  const conversar = async p => {
    pedidos.push(JSON.parse(JSON.stringify(p)));
    const r = respostas[Math.min(pedidos.length - 1, respostas.length - 1)];
    if (r instanceof Error) throw r;
    return r;
  };
  return { conversar, pedidos };
}
const txt = t => ({ type: "text", text: t });
const usa = (id, name, input) => ({ type: "tool_use", id, name, input });
const TURNOS = [{ role: "user", content: "CONTEXTO" }, { role: "assistant", content: "Beleza." }, { role: "user", content: "oi" }];

test("use('sample') é função e ainda tem json e limits", async () => {
  const { claude } = montar();
  const s = await claude.use("sample");
  assert.equal(typeof s, "function");
  assert.equal(typeof s.json, "function");
  assert.equal(typeof s.limits, "function");
});

test("sample(turns) sem ferramentas: uma rodada, devolve o texto e chama onText", async () => {
  const { conversar, pedidos } = rodadas([{ content: [txt("Olá, "), txt("tudo certo.")], stopReason: "end_turn" }]);
  const { claude } = montar({ conversar });
  const vistos = [];
  const r = await (await claude.use("sample"))(TURNOS, { cache: false, onText: ({ text }) => vistos.push(text) });
  assert.deepEqual(r, { text: "Olá, tudo certo." });
  assert.equal(pedidos.length, 1);
  assert.deepEqual(pedidos[0].mensagens, TURNOS);
  assert.equal("ferramentas" in pedidos[0], false);
  assert.equal(pedidos[0].esforco, "medium");
  assert.deepEqual(vistos, ["Olá, tudo certo."]);
});

test("sample: modelTier complex pede esforço high e as ferramentas vão no formato da API", async () => {
  const { conversar, pedidos } = rodadas([{ content: [txt("ok")], stopReason: "end_turn" }]);
  const { claude } = montar({ conversar });
  const schema = { type: "object", properties: { dias: { type: "integer" } } };
  await (await claude.use("sample"))(TURNOS, { modelTier: "complex", tools: [{ name: "ver_semana", description: "mostra", inputSchema: schema, execute: () => "x" }] });
  assert.equal(pedidos[0].esforco, "high");
  assert.deepEqual(pedidos[0].ferramentas, [{ name: "ver_semana", description: "mostra", input_schema: schema }]);
});

test("sample: roda a ferramenta, devolve tool_result num só turno e termina com o texto final", async () => {
  const { conversar, pedidos } = rodadas([
    { content: [txt("Vou ver."), usa("t1", "ver_semana", { dias: 3 }), usa("t2", "ajustar", { data: "2026-11-03" })], stopReason: "tool_use" },
    { content: [txt("Pronto, mudei.")], stopReason: "end_turn" }
  ]);
  const { claude } = montar({ conversar });
  const exec = [];
  const tools = [
    { name: "ver_semana", description: "", inputSchema: {}, execute: inp => { exec.push(["ver", inp]); return [{ data: "2026-11-02" }]; } },
    { name: "ajustar", description: "", inputSchema: {}, execute: async inp => { exec.push(["aj", inp]); return "ok: calendário atualizado"; } }
  ];
  const vistos = [];
  const r = await (await claude.use("sample"))(TURNOS, { tools, onText: ({ text }) => vistos.push(text) });
  assert.deepEqual(r, { text: "Pronto, mudei." });
  assert.deepEqual(exec, [["ver", { dias: 3 }], ["aj", { data: "2026-11-03" }]]);
  assert.equal(pedidos.length, 2);
  const m = pedidos[1].mensagens;
  assert.equal(m.length, TURNOS.length + 2);
  assert.deepEqual(m[3], { role: "assistant", content: [txt("Vou ver."), usa("t1", "ver_semana", { dias: 3 }), usa("t2", "ajustar", { data: "2026-11-03" })] });
  assert.deepEqual(m[4], { role: "user", content: [
    { type: "tool_result", tool_use_id: "t1", content: JSON.stringify([{ data: "2026-11-02" }]) },
    { type: "tool_result", tool_use_id: "t2", content: "ok: calendário atualizado" }
  ] });
  assert.deepEqual(vistos, ["Vou ver.", "Pronto, mudei."]);
  assert.equal(vistos[vistos.length - 1], r.text);
});

test("sample: erro da ferramenta vira 'erro: ...' e ferramenta desconhecida avisa", async () => {
  const { conversar, pedidos } = rodadas([
    { content: [usa("a", "quebra", {}), usa("b", "sumiu", {})], stopReason: "tool_use" },
    { content: [txt("fim")], stopReason: "end_turn" }
  ]);
  const { claude } = montar({ conversar });
  const tools = [{ name: "quebra", description: "", inputSchema: {}, execute: async () => { throw new Error("data inválida"); } }];
  await (await claude.use("sample"))(TURNOS, { tools });
  const res = pedidos[1].mensagens[pedidos[1].mensagens.length - 1].content;
  assert.deepEqual(res, [
    { type: "tool_result", tool_use_id: "a", content: "erro: data inválida", is_error: true },
    { type: "tool_result", tool_use_id: "b", content: "ferramenta desconhecida", is_error: true }
  ]);
});

test("sample: para em 6 rodadas e devolve o texto que tiver", async () => {
  const { conversar, pedidos } = rodadas([{ content: [txt("pensando"), usa("x", "ver_semana", {})], stopReason: "tool_use" }]);
  const { claude } = montar({ conversar });
  let n = 0;
  const tools = [{ name: "ver_semana", description: "", inputSchema: {}, execute: () => { n++; return "ok"; } }];
  const r = await (await claude.use("sample"))(TURNOS, { tools });
  assert.equal(pedidos.length, 6);
  assert.equal(n, 5, "na última rodada não roda ferramenta que o modelo não vai ver");
  assert.deepEqual(r, { text: "pensando" });
});

test("sample: rodada final sem texto devolve o último texto que apareceu", async () => {
  const { conversar } = rodadas([
    { content: [txt("Trocando o treino."), usa("t", "ver_semana", {})], stopReason: "tool_use" },
    { content: [], stopReason: "end_turn" }
  ]);
  const { claude } = montar({ conversar });
  const vistos = [];
  const r = await (await claude.use("sample"))(TURNOS, { tools: [{ name: "ver_semana", description: "", inputSchema: {}, execute: () => "ok" }], onText: ({ text }) => vistos.push(text) });
  assert.deepEqual(r, { text: "Trocando o treino." });
  assert.equal(vistos[vistos.length - 1], r.text);
});

test("sample: limite diário vira code rate_limited, outros erros mantêm a mensagem", async () => {
  const lim = Object.assign(new Error("Você usou todas as consultas de IA de hoje. Volte amanhã."), { code: "functions/resource-exhausted" });
  const a = montar({ conversar: rodadas([lim]).conversar });
  await assert.rejects((await a.claude.use("sample"))(TURNOS, {}), e => e.code === "rate_limited" && /consultas de IA de hoje/.test(e.message));
  const b = montar({ conversar: rodadas([Object.assign(new Error("A IA não respondeu agora."), { code: "functions/internal" })]).conversar });
  await assert.rejects((await b.claude.use("sample"))(TURNOS, {}), e => e.code !== "rate_limited" && e.message === "A IA não respondeu agora.");
});

test("sample: turno antigo com texto vazio não derruba a conversa (a função recusa vazio)", async () => {
  const { conversar, pedidos } = rodadas([{ content: [txt("ok")], stopReason: "end_turn" }]);
  const { claude } = montar({ conversar });
  await (await claude.use("sample"))([{ role: "user", content: "a" }, { role: "assistant", content: "" }, { role: "user", content: "b" }], {});
  assert.equal(pedidos[0].mensagens[1].content, "…");
});

test("erroDaIA mapeia resource-exhausted para rate_limited e preserva a mensagem", () => {
  const a = erroDaIA({ code: "functions/resource-exhausted", message: "acabou" });
  assert.ok(a instanceof Error);
  assert.equal(a.code, "rate_limited");
  assert.equal(a.message, "acabou");
  const b = erroDaIA({ code: "functions/internal", message: "falhou" });
  assert.equal(b.code, undefined);
  assert.equal(b.message, "falhou");
  assert.equal(erroDaIA(null).message, "A IA não respondeu agora.");
  assert.equal(erroDaIA({ code: "rate_limited", message: "x" }).code, "rate_limited");
});

test("dimensoes reduz pelo lado maior e não amplia", () => {
  assert.deepEqual(dimensoes(4000, 3000, 1280), { w: 1280, h: 960 });
  assert.deepEqual(dimensoes(3000, 4000, 1280), { w: 960, h: 1280 });
  assert.deepEqual(dimensoes(800, 600, 1280), { w: 800, h: 600 });
});

// ---------- tela de login: erro inicial ----------

function domFalso() {
  const els = {};
  const el = id => (els[id] = els[id] || { id, textContent: "", style: {}, disabled: false, value: "", addEventListener() {} });
  const ov = { style: {}, innerHTML: "", querySelector: sel => el(sel.slice(1)), remove() {} };
  global.document = { createElement: () => ov, body: { appendChild() {} } };
  return els;
}

test("pedirLogin mostra acoes.erroInicial na linha de erro ao abrir", () => {
  const els = domFalso();
  const { pedirLogin } = require("../app/shim/login-ui.js");
  pedirLogin({ google() {}, entrar() {}, criar() {}, erroInicial: "Sem internet. Tente de novo." });
  assert.equal(els["tl-erro"].textContent, "Sem internet. Tente de novo.");
  const els2 = domFalso();
  pedirLogin({ google() {}, entrar() {}, criar() {} });
  assert.equal(els2["tl-erro"].textContent, "");
  delete global.document;
});

// ---------- entrada do navegador (claude-shim.js): checagens no texto ----------

const fonteShim = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "app", "shim", "claude-shim.js"), "utf8");

test("claude-shim: ignoreUndefinedProperties antes de useEmulator e enablePersistence", () => {
  const i = fonteShim.indexOf("db.settings({ ignoreUndefinedProperties: true })");
  assert.ok(i > 0, "falta db.settings");
  assert.ok(i < fonteShim.indexOf("db.useEmulator(") && i < fonteShim.indexOf("db.enablePersistence("));
});

test("claude-shim: gravar o perfil não segura o login (sem await)", () => {
  assert.match(fonteShim, /db\.collection\("perfis"\)\.doc\(u\.uid\)\.set\([^\n]*\.catch\(\(\) => \{\}\)/);
  assert.ok(!/await db\.collection\("perfis"\)/.test(fonteShim));
});

test("claude-shim: chama o endpoint com 180 s, conversar ligado e sem Cloud Functions", () => {
  assert.match(fonteShim, /url: window\.TROPA_API/);
  assert.match(fonteShim, /timeoutMs: 180000/);
  assert.match(fonteShim, /async function conversar\(/);
  assert.match(fonteShim, /^\s+conversar,$/m);
  assert.ok(!/httpsCallable|compat\/functions/.test(fonteShim));
});

test("claude-shim: erro da volta do Google vai para a tela de login", () => {
  assert.match(fonteShim, /catch \(e\) \{ erroInicial = traduzirErroAuth\(e && e\.code\); \}/);
  assert.match(fonteShim, /if \(erroInicial\) acoes\.erroInicial = erroInicial;/);
});

test("reduzirParaBase64 pinta o fundo de branco antes de desenhar e libera o bitmap", async () => {
  const passos = [];
  const ctx = {
    set fillStyle(v) { passos.push("fillStyle " + v); },
    fillRect: (...a) => passos.push("fillRect " + a.join(",")),
    drawImage: (_b, ...a) => passos.push("drawImage " + a.join(","))
  };
  global.createImageBitmap = async () => ({ width: 2560, height: 1280, close: () => passos.push("close") });
  global.document = { createElement: () => ({ getContext: () => ctx, toDataURL: () => "data:image/jpeg;base64,QUJD" }) };
  const { reduzirParaBase64 } = require("../app/shim/imagem.js");
  const r = await reduzirParaBase64({});
  assert.deepEqual(r, { tipo: "image/jpeg", base64: "QUJD" });
  assert.deepEqual(passos, ["fillStyle #fff", "fillRect 0,0,1280,640", "drawImage 0,0,1280,640", "close"]);
  global.createImageBitmap = async () => ({ width: 10, height: 10 });   // sem close (navegador antigo): não quebra
  await reduzirParaBase64({});
  delete global.createImageBitmap;
  delete global.document;
});

// ---------- chamador do endpoint /api/sample ----------

function respostaFalsa(status, corpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => { if (corpo === undefined) throw new Error("sem corpo"); return corpo; } };
}

test("criarChamadorApi manda POST com Bearer e o corpo em JSON", async () => {
  let visto;
  const chamar = criarChamadorApi({
    url: "https://x/api/sample", obterToken: async () => "tok",
    fetch: async (u, o) => { visto = { u, o }; return respostaFalsa(200, { json: { a: 1 } }); }
  });
  assert.deepEqual(await chamar({ prompt: "oi" }), { json: { a: 1 } });
  assert.equal(visto.u, "https://x/api/sample");
  assert.equal(visto.o.method, "POST");
  assert.equal(visto.o.headers.Authorization, "Bearer tok");
  assert.equal(visto.o.body, JSON.stringify({ prompt: "oi" }));
});

test("criarChamadorApi: 429 vira rate_limited com a mensagem do servidor", async () => {
  const chamar = criarChamadorApi({
    url: "u", obterToken: async () => "t",
    fetch: async () => respostaFalsa(429, { error: { code: "resource-exhausted", message: "acabou o dia" } })
  });
  await assert.rejects(chamar({}), e => e.code === "rate_limited" && e.message === "acabou o dia");
});

test("criarChamadorApi: outros erros mantêm a mensagem e não viram rate_limited", async () => {
  const chamar = criarChamadorApi({ url: "u", obterToken: async () => "t", fetch: async () => respostaFalsa(500, { error: { code: "internal", message: "falhou" } }) });
  await assert.rejects(chamar({}), e => e.code !== "rate_limited" && e.message === "falhou");
  const semCorpo = criarChamadorApi({ url: "u", obterToken: async () => "t", fetch: async () => respostaFalsa(502) });
  await assert.rejects(semCorpo({}), e => e.message === "A IA não respondeu agora.");
});

test("criarChamadorApi: sem rede e sem login dão mensagens claras", async () => {
  const semRede = criarChamadorApi({ url: "u", obterToken: async () => "t", fetch: async () => { throw new TypeError("Failed to fetch"); } });
  await assert.rejects(semRede({}), e => /Sem conexão/.test(e.message));
  const semLogin = criarChamadorApi({ url: "u", obterToken: async () => { throw new Error("x"); }, fetch: async () => { throw new Error("não devia chamar"); } });
  await assert.rejects(semLogin({}), e => /Entre na sua conta/.test(e.message));
});

test("erroDaIA também entende o code resource-exhausted do endpoint", () => {
  assert.equal(erroDaIA({ code: "resource-exhausted", message: "x" }).code, "rate_limited");
});
