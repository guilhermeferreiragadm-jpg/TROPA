const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "tropa-rules",
    firestore: { rules: fs.readFileSync(path.join(__dirname, "..", "..", "firestore.rules"), "utf8") }
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const anon = () => env.unauthenticatedContext().firestore();
const ana = () => env.authenticatedContext("ana").firestore();
const bia = () => env.authenticatedContext("bia").firestore();
const dono = () => env.authenticatedContext("gui", { owner: true }).firestore();
const semear = fn => env.withSecurityRulesDisabled(ctx => fn(ctx.firestore()));
const comAcesso = uid => semear(db => db.doc("acessos/" + uid).set({ status: "aceito" }));

test("sem login nada passa", async () => {
  await assertFails(anon().doc("config/convite").get());
  await assertFails(anon().doc("data/users/ana/perfil").get());
});

test("dados pessoais: só o próprio uid lê e grava", async () => {
  await assertSucceeds(ana().doc("data/users/ana/perfil").set({ x: 1 }));
  await assertSucceeds(ana().doc("data/users/ana/perfil").get());
  await assertSucceeds(ana().collection("data/users/ana").doc("log").set({ log: {} }));
  await assertFails(bia().doc("data/users/ana/perfil").get());
  await assertFails(bia().doc("data/users/ana/perfil").set({ x: 2 }));
  await assertFails(dono().doc("data/users/ana/perfil").get());
});

for (const col of ["acessos", "pedidos", "revisao", "resumo"]) {
  test(col + ": cada um grava e lê só o próprio documento; dono lê e grava tudo", async () => {
    await assertSucceeds(ana().doc(col + "/ana").set({ a: 1 }));
    await assertSucceeds(ana().doc(col + "/ana").get());
    await assertFails(ana().doc(col + "/bia").set({ a: 1 }));
    await assertFails(bia().doc(col + "/ana").get());
    await assertFails(ana().collection(col).get());
    await assertSucceeds(dono().collection(col).get());
    await assertSucceeds(dono().doc(col + "/bia").set({ a: 1 }));
  });
}

test("aprovados: a pessoa lê o próprio e só o dono grava", async () => {
  await assertFails(ana().doc("aprovados/ana").set({ status: "aprovado" }));
  await assertSucceeds(dono().doc("aprovados/ana").set({ status: "aprovado" }));
  await assertSucceeds(ana().doc("aprovados/ana").get());
  await assertFails(bia().doc("aprovados/ana").get());
});

test("papeis: logado lê tudo, grava só o próprio; dono grava qualquer", async () => {
  await assertSucceeds(ana().doc("papeis/ana").set({ pers: true }));
  await assertFails(ana().doc("papeis/bia").set({ pers: true }));
  await assertSucceeds(bia().doc("papeis/ana").get());
  await assertSucceeds(dono().doc("papeis/bia").set({ pers: true }));
});

test("grupos: precisa ter acesso para ler; grava só o próprio documento", async () => {
  await assertFails(ana().collection("grupos").get());
  await comAcesso("ana");
  await assertSucceeds(ana().collection("grupos").get());
  await assertSucceeds(ana().doc("grupos/ana").set({ apelido: "A" }));
  await assertFails(ana().doc("grupos/bia").set({ apelido: "B" }));
  await assertSucceeds(dono().doc("grupos/bia").set({ apelido: "B" }));
});

test("config e posts: logado lê, só o dono grava", async () => {
  await assertSucceeds(dono().doc("config/convite").set({ codigo: "ABC123" }));
  await assertSucceeds(ana().doc("config/convite").get());
  await assertFails(ana().doc("config/convite").set({ codigo: "X" }));
  await assertSucceeds(dono().doc("posts/p1").set({ publicar: true }));
  await assertSucceeds(ana().doc("posts/p1").get());
  await assertFails(ana().doc("posts/p2").set({ publicar: true }));
});

test("convites, vinculos, snap, prop e inbox: logado lê e grava", async () => {
  for (const caminho of ["convites/c1", "vinculos/v1", "snap/s1", "prop/p1", "inbox/ana/n/n1"]) {
    await assertSucceeds(ana().doc(caminho).set({ a: 1 }));
    await assertSucceeds(bia().doc(caminho).get());
    await assertFails(anon().doc(caminho).get());
  }
});

test("perfis: logado lê, só o próprio grava", async () => {
  await assertSucceeds(ana().doc("perfis/ana").set({ name: "Ana" }));
  await assertSucceeds(bia().doc("perfis/ana").get());
  await assertFails(bia().doc("perfis/ana").set({ name: "X" }));
});

test("uso (contador da IA): o cliente nunca lê nem grava", async () => {
  await assertFails(ana().doc("uso/ana_2026-11-02").set({ n: 0 }));
  await assertFails(dono().doc("uso/ana_2026-11-02").get());
});

test("caminho desconhecido é negado", async () => {
  await assertFails(ana().doc("qualquer/coisa").set({ a: 1 }));
  await assertFails(dono().doc("qualquer/coisa").get());
});
