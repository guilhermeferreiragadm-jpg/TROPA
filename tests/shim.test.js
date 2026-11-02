const test = require("node:test");
const assert = require("node:assert/strict");
const { criarClaude, LIMITES, traduzirErroAuth } = require("../app/shim/core.js");
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

test("dimensoes reduz pelo lado maior e não amplia", () => {
  assert.deepEqual(dimensoes(4000, 3000, 1280), { w: 1280, h: 960 });
  assert.deepEqual(dimensoes(3000, 4000, 1280), { w: 960, h: 1280 });
  assert.deepEqual(dimensoes(800, 600, 1280), { w: 800, h: 600 });
});
