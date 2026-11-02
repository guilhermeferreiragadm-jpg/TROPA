const test = require("node:test");
const assert = require("node:assert/strict");
const { tratar, origensPermitidas } = require("../functions/http.js");

const HOSTING = "https://tropa-app.web.app";
function deps(sobrescreve) {
  const reg = { chamadas: [] };
  return {
    reg,
    deps: Object.assign({
      origens: origensPermitidas("tropa-app", ""),
      verificarToken: async t => { if (t !== "bom") throw new Error("token ruim"); return { uid: "u1", owner: false }; },
      temAcesso: async () => true,
      registrarUso: async () => true,
      chamarClaude: async a => { reg.chamadas.push(a); return '{"ok":true}'; },
      chamarClaudeConversa: async () => ({ content: [{ type: "text", text: "oi" }], stopReason: "end_turn" }),
      agora: () => new Date("2026-11-02T15:00:00Z")
    }, sobrescreve)
  };
}
const post = (corpo, headers) => ({ method: "POST", headers: Object.assign({ authorization: "Bearer bom", origin: HOSTING }, headers), body: corpo });

test("origensPermitidas inclui o Hosting, o app nativo e os extras", () => {
  const l = origensPermitidas("tropa-app", " https://a.com , ,https://b.com");
  ["https://tropa-app.web.app", "https://tropa-app.firebaseapp.com", "capacitor://localhost", "https://a.com", "https://b.com"].forEach(o => assert.ok(l.includes(o), o));
  assert.ok(!origensPermitidas(undefined, "").some(o => o.includes("undefined")));
});

test("preflight de origem permitida: 204 com os cabeçalhos CORS", async () => {
  const { deps: d } = deps();
  const r = await tratar({ method: "OPTIONS", headers: { origin: HOSTING } }, d);
  assert.equal(r.status, 204);
  assert.equal(r.headers["Access-Control-Allow-Origin"], HOSTING);
  assert.match(r.headers["Access-Control-Allow-Headers"], /Authorization/);
});

test("origem desconhecida não recebe cabeçalhos CORS", async () => {
  const { deps: d } = deps();
  const r = await tratar({ method: "OPTIONS", headers: { origin: "https://malvado.com" } }, d);
  assert.deepEqual(r.headers, {});
});

test("só aceita POST", async () => {
  const { deps: d } = deps();
  assert.equal((await tratar({ method: "GET", headers: {} }, d)).status, 405);
});

test("sem token ou com token ruim: 401 unauthenticated", async () => {
  const { deps: d } = deps();
  const a = await tratar({ method: "POST", headers: { origin: HOSTING }, body: { prompt: "oi" } }, d);
  assert.equal(a.status, 401);
  assert.equal(a.body.error.code, "unauthenticated");
  const b = await tratar(post({ prompt: "oi" }, { authorization: "Bearer ruim" }), d);
  assert.equal(b.status, 401);
  assert.equal(b.headers["Access-Control-Allow-Origin"], HOSTING);
});

test("caminho feliz devolve 200 com o JSON da IA", async () => {
  const { deps: d, reg } = deps();
  const r = await tratar(post({ prompt: "oi" }), d);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { json: { ok: true } });
  assert.equal(reg.chamadas.length, 1);
});

test("modo conversa devolve content e stopReason", async () => {
  const { deps: d } = deps();
  const r = await tratar(post({ mensagens: [{ role: "user", content: "oi" }] }), d);
  assert.equal(r.status, 200);
  assert.equal(r.body.stopReason, "end_turn");
});

test("erros do app viram o status certo e o corpo {error:{code,message}}", async () => {
  const casos = [
    [{ temAcesso: async () => false }, { prompt: "oi" }, 403, "permission-denied"],
    [{ registrarUso: async () => false }, { prompt: "oi" }, 429, "resource-exhausted"],
    [{}, { prompt: "" }, 400, "invalid-argument"]
  ];
  for (const [sob, corpo, status, code] of casos) {
    const { deps: d } = deps(sob);
    const r = await tratar(post(corpo), d);
    assert.equal(r.status, status);
    assert.equal(r.body.error.code, code);
    assert.ok(r.body.error.message.length > 0);
  }
});

test("falha inesperada vira 500 sem vazar a mensagem interna", async () => {
  const { deps: d } = deps({ chamarClaude: async () => { throw new Error("segredo interno"); } });
  const orig = console.error; console.error = () => {};
  const r = await tratar(post({ prompt: "oi" }), d);
  console.error = orig;
  assert.equal(r.status, 500);
  assert.equal(r.body.error.code, "internal");
  assert.ok(!JSON.stringify(r.body).includes("segredo"));
});

test("o dono (claim owner) passa direto, sem checar acesso nem limite", async () => {
  const { deps: d } = deps({
    verificarToken: async () => ({ uid: "gui", owner: true }),
    temAcesso: async () => { throw new Error("não devia chamar"); },
    registrarUso: async () => { throw new Error("não devia chamar"); }
  });
  assert.equal((await tratar(post({ prompt: "oi" }), d)).status, 200);
});
