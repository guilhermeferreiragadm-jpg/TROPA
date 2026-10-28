# Personal e Nutri Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qualquer usuário vira Personal e/ou Nutri, convida alunos por código, acompanha dados liberados e propõe mudanças que o aluno confirma; sino de notificações ao lado do perfil.

**Architecture:** Dois blocos novos em `publicar.html`: um núcleo puro e testável (`/* @pro:start */ ... /* @pro:end */`, logo depois de `@movimento:end`) com regras, estados, patch e cifragem WebCrypto; e uma camada de dados/UI (`Pro`) que usa coleções de topo do `db` com payload cifrado. Cada modo (Aluno, Personal, Nutri) troca o conteúdo da barra inferior fixa.

**Tech Stack:** HTML único (`publicar.html`), `window.claude.use("db"|"user")`, WebCrypto (ECDH P-256, HKDF, AES-GCM), `node --test`, harness local em `tests/harness`.

**Spec:** `docs/superpowers/specs/2026-10-28-personal-nutri-design.md`

## Global Constraints

- Arquivo único `publicar.html`; limite de 700.000 bytes (ruling: o 641.224 era autoimposto pelo redesign). Se estourar, enxugar código existente antes de seguir.
- Marca intocada: laranja `#FF5A00`, nome Tropa, tema claro padrão, escuro por `data-tema="escuro"`. Usar só os tokens existentes (`--bg --surface --surface-2 --tx --tx-2 --sep --go --go-fill --r1..r4 --sh1..3 --mat-*`), alvos de toque de 44px (padrão `.lk.in` / `::after`), movimento via `Mov`.
- A barra inferior continua **fixa** fora do `.wrap` que rola (`rolagem()` é o scroller).
- Texto de interface em português do Brasil, sem travessão no lugar de vírgula.
- Funções puras ficam no bloco `@pro`; sem acesso a DOM, `db` ou `Date.now()` (receber `agora` por parâmetro).
- Dado de saúde nunca vai em claro para o `db`: só cifrado (`{v:1, iv, ct}`). Em claro ficam apenas ids, papel, estado, datas e o mapa de permissões.
- Cada aluno tem no máximo 1 Personal e 1 Nutri: id do vínculo = `alunoId + "~" + papel`.
- Personal só recebe `treino, perf, corpo, feed`. Nutri só recebe `comida, corpo`.
- Toda mudança do profissional passa por proposta aceita pelo aluno. Nunca escrever direto no plano do aluno.
- Toda tarefa termina com `node --test tests/*.test.js` verde e commit.

---

### Task 1: Núcleo puro (papéis, permissões, convite, estados, patch)

**Files:**
- Modify: `publicar.html` (inserir bloco logo depois da linha `/* @movimento:end */`)
- Create: `tests/pro.test.js`

**Interfaces:**
- Produces (globais do bloco `@pro`): `CATEGORIAS, PAPEIS_PRO, CATS_POR_PAPEL, permissoesValidas(papel, perm), vincId(alunoId, papel), podeVer(v, cat), conviteValido(c, agora), novoConvite(profId, papel, agora, cod), conflitoVinculo(existente, profId), proximoEstadoProposta(estado, evento), criarPatch(a, b), aplicarPatch(obj, ops), hash32(s), propostaAtual(prop, planoJson), TIPOS_INBOX, itemInboxValido(it)`.

- [ ] **Step 1: Escrever os testes**

`tests/pro.test.js`:

```js
// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const pro = trecho("/* @pro:start */", "/* @pro:end */");
const F = new Function(pro + "\nreturn {CATEGORIAS, PAPEIS_PRO, CATS_POR_PAPEL, permissoesValidas, vincId, podeVer, conviteValido, novoConvite, conflitoVinculo, proximoEstadoProposta, criarPatch, aplicarPatch, hash32, propostaAtual, TIPOS_INBOX, itemInboxValido};")();

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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/pro.test.js`
Expected: FAIL com "marcador não achado: /* @pro:start */"

- [ ] **Step 3: Implementar o bloco**

Inserir em `publicar.html`, imediatamente depois da linha `/* @movimento:end */`:

```js
/* @pro:start */
const CATEGORIAS = ["treino","perf","comida","corpo","feed"];
const PAPEIS_PRO = ["personal","nutri"];
const CATS_POR_PAPEL = {personal:["treino","perf","corpo","feed"], nutri:["comida","corpo"]};
const permissoesValidas = (papel, perm) => { const o = {}; (CATS_POR_PAPEL[papel]||[]).forEach(c=>{ o[c] = !!(perm && perm[c]); }); return o; };
const vincId = (alunoId, papel) => alunoId+"~"+papel;
const podeVer = (v, cat) => !!(v && v.estado==="ativo" && v.perm && v.perm[cat] && (CATS_POR_PAPEL[v.papel]||[]).includes(cat));
const conviteValido = (c, agora) => !!(c && !c.usado && c.expira > agora && PAPEIS_PRO.includes(c.papel));
const novoConvite = (profId, papel, agora, cod) => ({cod, profId, papel, criado:agora, expira:agora+7*864e5, usado:false});
const conflitoVinculo = (existente, profId) => existente && existente.estado==="ativo" && existente.profId!==profId ? "ja_vinculado" : null;
const proximoEstadoProposta = (estado, evento) => estado!=="pendente" ? estado : ({aceitar:"aceita", recusar:"recusada", invalidar:"desatualizada"})[evento] || estado;
const mesmoJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ehObj = x => !!x && typeof x === "object";
function criarPatch(a, b, p = []){
  if (mesmoJson(a, b)) return [];
  if (ehObj(a) && ehObj(b) && Array.isArray(a) === Array.isArray(b) && !(Array.isArray(a) && a.length !== b.length)){
    const ks = Array.isArray(a) ? a.map((_, i)=>i) : [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return ks.flatMap(k=>criarPatch(a[k], b[k], p.concat(k)));
  }
  return [{p, v: b === undefined ? null : b}];
}
const caminhoSeguro = p => Array.isArray(p) && p.every(k=>(Number.isInteger(k) && k >= 0) || (typeof k === "string" && !["__proto__","constructor","prototype"].includes(k)));
function aplicarPatch(obj, ops){
  let r = JSON.parse(JSON.stringify(obj));
  for (const op of ops){
    if (!caminhoSeguro(op.p)) throw new Error("caminho inválido");
    if (!op.p.length){ r = JSON.parse(JSON.stringify(op.v)); continue; }
    let c = r;
    for (let i = 0; i < op.p.length-1; i++){ if (!ehObj(c[op.p[i]])) throw new Error("caminho inexistente"); c = c[op.p[i]]; }
    c[op.p[op.p.length-1]] = JSON.parse(JSON.stringify(op.v));
  }
  return r;
}
const hash32 = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h*33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
const propostaAtual = (prop, planoJson) => !!prop && prop.base === hash32(planoJson);
const TIPOS_INBOX = ["convite","vinculo","encerrado","proposta","resposta","perm","comentario"];
const itemInboxValido = it => !!it && TIPOS_INBOX.includes(it.tipo) && typeof it.ref === "string" && it.ref.length > 0 && it.ref.length <= 80 && Number.isFinite(it.quando);
/* @pro:end */
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/*.test.js`
Expected: todos passam (104 antigos + novos).

- [ ] **Step 5: Commit**

```bash
git add tests/pro.test.js publicar.html
git commit -m "feat: núcleo puro de papéis, permissões, convite, estados e patch"
```

---

### Task 2: Cifragem do vínculo (WebCrypto)

**Files:**
- Modify: `publicar.html` (dentro do bloco `@pro`, antes de `/* @pro:end */`)
- Modify: `tests/pro.test.js`

**Interfaces:**
- Consumes: nada do Task 1.
- Produces: `gerarPar() -> Promise<{pub, priv}>` (JWK), `derivarChave(privJwk, pubJwk, vincId) -> Promise<CryptoKey>` (AES-GCM, só encrypt/decrypt), `cifrar(chave, obj) -> Promise<{v:1, iv, ct}>`, `decifrar(chave, env) -> Promise<obj>`. Funções `async`; usam `globalThis.crypto.subtle`.

- [ ] **Step 1: Escrever os testes** (acrescentar a `tests/pro.test.js`, e incluir `gerarPar, derivarChave, cifrar, decifrar` no `return {...}` do `new Function`)

```js
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
```

- [ ] **Step 2: Rodar e ver falhar** — `node --test tests/pro.test.js` → FAIL (`F.gerarPar is not a function`).

- [ ] **Step 3: Implementar** (antes de `/* @pro:end */`)

```js
const cripto = () => globalThis.crypto.subtle;
const paraB64 = u8 => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i+8192)); return btoa(s); };
const deB64 = s => Uint8Array.from(atob(s), c=>c.charCodeAt(0));
const CURVA = {name:"ECDH", namedCurve:"P-256"};
async function gerarPar(){ const k = await cripto().generateKey(CURVA, true, ["deriveBits"]); return {pub: await cripto().exportKey("jwk", k.publicKey), priv: await cripto().exportKey("jwk", k.privateKey)}; }
async function derivarChave(privJwk, pubJwk, vincIdStr){
  const priv = await cripto().importKey("jwk", privJwk, CURVA, false, ["deriveBits"]);
  const pub = await cripto().importKey("jwk", pubJwk, CURVA, false, []);
  const bits = await cripto().deriveBits({name:"ECDH", public:pub}, priv, 256);
  const hk = await cripto().importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const te = new TextEncoder();
  return cripto().deriveKey({name:"HKDF", hash:"SHA-256", salt:te.encode(vincIdStr), info:te.encode("tropa-vinculo-v1")}, hk, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
}
async function cifrar(chave, obj){ const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await cripto().encrypt({name:"AES-GCM", iv}, chave, new TextEncoder().encode(JSON.stringify(obj)))); return {v:1, iv:paraB64(iv), ct:paraB64(ct)}; }
async function decifrar(chave, env){ const pt = await cripto().decrypt({name:"AES-GCM", iv:deB64(env.iv)}, chave, deB64(env.ct)); return JSON.parse(new TextDecoder().decode(pt)); }
```

- [ ] **Step 4: Rodar** — `node --test tests/*.test.js` → verde. Conferir `wc -c publicar.html` (anotar o tamanho no commit).

- [ ] **Step 5: Commit**

```bash
git add tests/pro.test.js publicar.html
git commit -m "feat: cifragem ECDH + AES-GCM do vínculo"
```

---

### Task 3: Camada de dados `Pro` + harness com dois usuários

**Files:**
- Modify: `publicar.html` (novo bloco `/* ===== PRO: dados ===== */` depois do bloco de grupos; chamada de `Pro.iniciar()` no boot, depois de `carregarGrupos();`)
- Modify: `tests/harness/stub.js`, `tests/harness/servir.js`, `tests/harness/roteiro.md`

**Interfaces:**
- Consumes: Task 1 e 2; globais do app `db, realDb, me, meName, P, LOG, toast, esc, planoAtual, base, comTempo`.
- Produces (objeto `Pro`, só dados, sem DOM):
  - estado: `Pro.papeis` (`{personal, nutri}` do usuário), `Pro.vinc` (`Map vincId → doc`), `Pro.inbox` (array), `Pro.naoLidas()`
  - `await Pro.iniciar()`: carrega chaves (cria par se faltar em `data/users/<me>/chaves`), escuta `papeis/<me>`, `vinculos` (filtra os meus como aluno ou profissional) e `inbox/<me>/n`
  - `await Pro.ativarPapel(papel, ligado)`: grava `papeis/<me>` com `{personal, nutri, pub}`
  - `await Pro.gerarConvite(papel)` → `{cod}`; grava `convites/<cod>`
  - `await Pro.aceitarConvite(cod, perm)` → `{ok}` ou `{erro:"codigo"|"expirado"|"ja_vinculado"|"proprio"}`
  - `await Pro.salvarPerm(vincId, perm)`, `await Pro.encerrar(vincId)` (apaga os `snap` do vínculo, estado `encerrado`)
  - `await Pro.publicarSnaps()`: para cada vínculo ativo do aluno, cifra e grava `snap/<vincId>_<cat>` das categorias liberadas; apaga as não liberadas
  - `await Pro.lerSnap(vincId, cat)` → objeto decifrado ou `null`
  - `await Pro.enviarProposta(vincId, tipo, antes, depois, texto)`, `await Pro.responderProposta(vincId, id, "aceitar"|"recusar", motivo)`
  - `Pro.avisar(destId, tipo, ref)`, `await Pro.marcarLidas()`
- Coleções: `papeis/{uid}`, `convites/{cod}`, `vinculos/{vincId}`, `snap/{vincId}_{cat}`, `prop/{vincId}.{id}`, `inbox/{uid}/n/{id}`; chaves em `data/users/{me}/chaves` (privado).

- [ ] **Step 1: Ler** `tests/harness/stub.js` e `servir.js` e `wrapDb` (`publicar.html` ~l.701) para entender o stub de `db`. Estender o stub para **compartilhar o banco entre abas** (localStorage `tropa-stub-db` com evento `storage` disparando `onSnapshot`) e aceitar `?eu=<id>&nome=<nome>` para escolher a identidade. Documentar em `roteiro.md` como abrir duas abas (aluno e profissional).

- [ ] **Step 2: Implementar `Pro`** conforme a lista de interfaces. Regras de cada função:
  - `aceitarConvite`: lê `convites/<cod>` (normalizar com `normalizarCodigo`), valida com `conviteValido(c, Date.now())`; recusa `proprio` se `c.profId===me`; checa `conflitoVinculo(Pro.vinc.get(vincId(me,c.papel)), c.profId)`; gera par novo do vínculo (guarda a privada em `data/users/<me>/chaves.v[<vincId>]`); grava `vinculos/<vincId>` `{alunoId, profId, papel, perm: permissoesValidas(...), estado:"ativo", pubA, criado}`; marca o convite `usado:true`; `avisar(c.profId, "vinculo", vincId)`; chama `publicarSnaps()`.
  - `publicarSnaps`: monta cada categoria a partir do estado local: `treino` = `{plano: planoAtual(), feitos: LOG.feitos||{}, coment: LOG.coment||{}}`, `perf` = resumo de `LOG` de corridas/km/foguinho, `comida` = `LOG.comida||{}` e metas, `corpo` = `LOG.corpo||[]`, `feed` = posts do próprio usuário. (Localizar os nomes reais em `telaPerfil`, `telaPerformance`, `telaComida` e `LOG`; usar o que o app já guarda.) Cada categoria vira `await cifrar(chave, dados)`. Chamar também depois de `salvarLog`/`salvarPerfil` com debounce de 3 s, só se houver vínculo ativo.
  - Chave do vínculo: aluno usa `priv` do vínculo + `pub` do profissional (`papeis/<profId>.pub`); profissional usa a própria `priv` + `vinculos/<id>.pubA`.
  - `enviarProposta`: `{id, de:me, tipo, base: hash32(JSON.stringify(antes)), ops: criarPatch(antes, depois), texto, estado:"pendente", em}` cifrado em `prop/<vincId>.<id>` com cabeçalho em claro `{estado, em}`; `avisar(alunoId, "proposta", vincId+"."+id)`.
  - `responderProposta` (aluno): ao `aceitar`, recalcula `propostaAtual`; se falsa, estado `desatualizada` e aviso ao profissional; se verdadeira, `P.planoProf = aplicarPatch(planoAtual(), ops)`, `salvarPerfil()`, `publicarSnaps()`, estado `aceita`. `recusar` grava `motivo`. Sempre `avisar(profId, "resposta", ref)`.
  - `planoAtual()` passa a ser `(P && P.planoProf) || (A && A.plano) || (P && P.plano)` (alterar l.1337).
  - `avisar` grava em `inbox/<destId>/n/<id>` `{tipo, ref, quando:Date.now(), lida:false}`. Ao ler, descartar o que `itemInboxValido` rejeitar ou cujo `ref` não resolva para vínculo/proposta existente.

- [ ] **Step 3: Teste de integração no harness** (manual, registrado em `roteiro.md`): aba A (`?eu=ana`), aba B (`?eu=pedro`): Pedro liga Personal e gera convite; Ana aceita com `treino` ligado; Pedro lê o snap de treino de Ana; Pedro envia proposta de carga; Ana aceita; `planoAtual()` de Ana muda; Ana encerra e os snaps somem. Conferir no console o conteúdo cifrado: nenhum texto legível no stub.

- [ ] **Step 4:** `node --test tests/*.test.js` verde; `wc -c publicar.html`.

- [ ] **Step 5: Commit** — `git commit -am "feat: camada de dados do Personal e Nutri com harness de dois usuários"`

---

### Task 4: Cabeçalho (sino e seletor de modo) e papéis no Perfil

**Files:**
- Modify: `publicar.html` (marcação `#tabs`/cabeçalho, CSS, `render`/`ir`, `telaPerfil`, `telaHoje`)

**Interfaces:**
- Consumes: `Pro.papeis`, `Pro.naoLidas()`, `Pro.ativarPapel`.
- Produces: `MODO` (`"aluno"|"personal"|"nutri"`, lembrado em `localStorage` chave `tropa-modo`, validado contra `Pro.papeis`), `setModo(m)`, `renderBarra()` (reescreve os botões de `#tabs .tabs-pill` conforme o modo e reposiciona `#tabs-ind`), `iconeSino()`.

- [ ] **Step 1:** Localizar o botão de perfil na cabeçalho da Hoje (`.prof .me`) e nas telas principais. Colocar o **sino** ao lado, mesmo tamanho e área de toque de 44px, `aria-label="Notificações"`, contador numérico em bolinha `--go-fill` com texto `--go-ink` quando `naoLidas()>0` (some em 0; "9+" acima de 9). Toque abre a tela do sino (Task 8); por ora `ir("sino")` com tela vazia "Sem notificações".
- [ ] **Step 2:** Seletor de modo: segmented control de 2 ou 3 opções (Aluno | Personal | Nutri) no topo da Hoje e das telas de nível 1 de cada modo, visível só quando a pessoa tem 2 ou mais modos. Trocar de modo troca a barra inferior (`renderBarra`) e vai para a primeira aba do modo.
- [ ] **Step 3:** Barras: Aluno = as 5 atuais, intocadas. Personal = `Alunos`, `Propostas`, `Biblioteca`. Nutri = `Alunos`, `Propostas`, `Planos`. Reaproveitar o padrão `button.t-xxx > i` com ícones SVG/CSS no estilo atual; botão Coach·Nutri (`#fab`) só no modo Aluno.
- [ ] **Step 4:** Perfil: duas linhas novas `Sou Personal` e `Sou Nutri` com interruptor (padrão `label.lst-i`), ligando `Pro.ativarPapel`. Desligar com alunos ativos pede confirmação (sheet) e encerra os vínculos.
- [ ] **Step 5:** Verificar no harness mobile 375x812, claro e escuro: barra fixa preservada (`tabs.getBoundingClientRect().bottom` constante ao rolar), contador do sino, troca de modo. `node --test tests/*.test.js`. Commit `feat: sino, seletor de modo e papéis no perfil`.

---

### Task 5: Fluxo do aluno (convite, permissões, desvincular)

**Files:**
- Modify: `publicar.html` (`telaCodigo`, `telaPerfil`, nova `sheetConvite`, `sheetProfissionais`)

**Interfaces:**
- Consumes: `Pro.aceitarConvite`, `Pro.salvarPerm`, `Pro.encerrar`, `Pro.vinc`.

- [ ] **Step 1: Acesso fechado.** O app só entra com código do dono (`telaCodigo`, `config/convite`). Ajustar `telaCodigo`: se o código digitado não bate com o do dono, tentar `convites/<normalizarCodigo(v)>`; se existir e for válido, liberar `ACESSO = {status:"aceito", via:"profissional", codigo:v, indicadoPor:c.profId, at}` e guardar o código pendente em `localStorage` (`tropa-conv-pend`). Depois de concluir o cadastro (`render()` alcançado), abrir `sheetConvite(cod)` automaticamente.
- [ ] **Step 2:** Para quem já usa o app: linha no Perfil, `Entrar com código de um profissional`, que abre `sheetConvite()` com campo de código (caixa alta, 8 caracteres, aceitar hífen e espaço).
- [ ] **Step 3: `sheetConvite`.** Mostra papel e nome do profissional (de `papeis/<profId>`), explica em 2 linhas o que ele passa a ver, e uma chave por categoria permitida ao papel (rótulos: Treino, Performance e corridas, Comida, Peso e medidas, Feed e fotos), todas desligadas por padrão. Botão `Aceitar e vincular`. Erros mapeados: `codigo` ("Esse código não existe"), `expirado`, `ja_vinculado` ("Você já tem um {papel}. Desvincule antes."), `proprio`.
- [ ] **Step 4: `sheetProfissionais`** (linha `Meus profissionais` no Perfil com contador): lista até 2 vínculos; cada um abre as chaves de permissão (com `Pro.salvarPerm` + `publicarSnaps`) e o botão destrutivo `Desvincular` (confirmar num sheet; `Pro.encerrar`).
- [ ] **Step 5:** Verificar no harness com duas abas (aceitar, trocar permissão, desvincular, tentar segundo Personal). Commit `feat: aluno aceita convite, escolhe permissões e desvincula`.

---

### Task 6: Modos Personal e Nutri (convite, alunos, detalhe)

**Files:**
- Modify: `publicar.html` (novas `telaProAlunos`, `telaProDetalhe`, `sheetNovoConvite`, `telaProBiblioteca`)

**Interfaces:**
- Consumes: `Pro.vinc` (vínculos em que `profId===me`), `Pro.lerSnap`, `Pro.gerarConvite`.

- [ ] **Step 1: `telaProAlunos(papel)`.** Cabeçalho grande com título e botão `Convidar aluno`. Lista de linhas (padrão `.lst`): nome, última atividade ("treinou ontem", "sem treinar há 6 dias" em `--warn-ink` a partir de 5), badge de propostas pendentes. Estado vazio com o convite. Atualiza ao vivo via `render(true)` quando o snapshot de `vinculos` muda (mesmo cuidado de `carregarGrupos`: não rerenderizar com input focado ou sheet aberto).
- [ ] **Step 2: `sheetNovoConvite(papel)`.** Gera o código com `Pro.gerarConvite`, mostra o código grande, o texto de envio ("Entra no {BRAND}: {link do app}. Código: ABCD-EFGH. Vale por 7 dias.") e botão `Copiar` (`navigator.clipboard.writeText` com fallback selecionando o texto).
- [ ] **Step 3: `telaProDetalhe(vincId)`.** Seções só das categorias liberadas, carregadas com `Pro.lerSnap` (decifrar, tratar `null` com "aguardando o aluno abrir o app"). Categoria não liberada aparece bloqueada com cadeado e texto "O aluno não liberou". Personal: resumo da semana, treino atual, performance, comentários dos exercícios. Nutri: plano alimentar, comida, peso e medidas. Botão `Propor mudança` (Task 7).
- [ ] **Step 4:** `Biblioteca` (Personal) e `Planos` (Nutri): lista de modelos que o profissional salva em `data/users/<me>/modelos` (privado), com nome e conteúdo copiado do rascunho; usados como ponto de partida ao propor.
- [ ] **Step 5:** Verificar no harness, claro e escuro, 375px. Commit `feat: modos Personal e Nutri com alunos e detalhe`.

---

### Task 7: Propostas e comentário no exercício

**Files:**
- Modify: `publicar.html` (`telaProPropor`, `telaPropostas`, `sheetPropostaAluno`, linha do exercício em `telaTreino`/`sheetFeito`)

**Interfaces:**
- Consumes: `Pro.enviarProposta`, `Pro.responderProposta`, `criarPatch`, `propostaAtual`.

- [ ] **Step 1: Editor do profissional** (`telaProPropor(vincId, tipo)`): carrega o plano atual do aluno (`lerSnap` treino ou comida), edita uma cópia (Personal: carga, séries, repetições, trocar exercício, dias; Nutri: itens e quantidades do plano alimentar), mostra o diff ao vivo (`criarPatch` em linguagem: "Supino: 40 kg → 45 kg"), campo de mensagem opcional, botão `Enviar para o aluno`.
- [ ] **Step 2: Lado do aluno** (`sheetPropostaAluno`): mostra mensagem do profissional e lista antes e depois; botões `Aceitar` e `Recusar` (recusar abre campo de motivo opcional). Proposta `desatualizada` mostra aviso e nenhum botão de aceitar.
- [ ] **Step 3: `telaPropostas`** (aba Propostas dos modos pro, e linha no sino do aluno): pendentes primeiro, depois histórico com estado (aceita, recusada com motivo, desatualizada). Profissional vê as que enviou; aluno vê as que recebeu.
- [ ] **Step 4: Comentário no exercício.** No treino do aluno, em cada exercício, link `Comentar` abre um sheet com texto (até 280 caracteres), salvo em `LOG.coment[<data>|<exercício>] = {t, at}` e republicado no snap de `treino` (Task 3). O Personal vê os comentários no detalhe do aluno e recebe aviso `comentario` no sino.
- [ ] **Step 5:** Verificar o ciclo completo no harness (propor, aceitar, recusar com motivo, desatualizar por edição do aluno). Commit `feat: propostas com confirmação e comentário por exercício`.

---

### Task 8: Tela do sino

**Files:**
- Modify: `publicar.html` (`telaSino`)

**Interfaces:**
- Consumes: `Pro.inbox`, `Pro.marcarLidas`, `itemInboxValido`.

- [ ] **Step 1:** `telaSino()`: título grande "Notificações", lista por data (mais novas primeiro) com ícone por tipo, texto e hora relativa. Textos: `convite` ("{nome} convidou você como {papel}"), `vinculo` ("{nome} aceitou seu convite"), `encerrado` ("{nome} encerrou o vínculo"), `proposta` ("{nome} propôs uma mudança no seu {treino|plano alimentar}"), `resposta` ("{nome} aceitou" ou "recusou: {motivo}"), `perm` ("{nome} mudou o que você pode ver"), `comentario` ("{nome} comentou em {exercício}"). Item não lido tem marcador `--go-fill`. Tocar abre o destino (sheet da proposta, detalhe do aluno, Meus profissionais).
- [ ] **Step 2:** Marcar como lidas ao abrir (depois de 1 s, `Pro.marcarLidas`). Estado vazio: "Nada por aqui ainda".
- [ ] **Step 3:** O sino atualiza ao vivo (listener de `inbox/<me>/n` já em `Pro.iniciar`); a tela do sino se atualiza se estiver aberta.
- [ ] **Step 4:** Verificar contadores e navegação no harness. Commit `feat: tela de notificações`.

---

### Task 9: Fechamento (regras do banco, tamanho, docs, publicação)

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-28-personal-nutri-design.md`, `tests/harness/roteiro.md`

- [ ] **Step 1:** Rodar `node --test tests/*.test.js`; conferir `wc -c publicar.html` ≤ 641.224. Se estourar, enxugar CSS/JS morto antes de publicar.
- [ ] **Step 2: Regras do banco.** Ler a declaração atual do artefato (`Artifact` action `read` da URL do app) e **acrescentar** (não substituir) as regras: `papeis/{self}` escrita própria, leitura aberta; `convites` leitura `view`, escrita `interact`; `vinculos`, `snap`, `prop`, `inbox` leitura `view`, escrita `interact`. Registrar no ledger que o profissional e o aluno gravam em nome um do outro, por isso tudo sensível é cifrado e o app descarta item inválido.
- [ ] **Step 3:** Percorrer `tests/harness/roteiro.md` completo em duas abas, nos temas claro e escuro, a 375px: convite, aceite, permissões, snap cifrado, proposta aceita, recusada, desatualizada, desvincular, sino.
- [ ] **Step 4:** README: seção "Personal e Nutri" (como o harness simula dois usuários, coleções, limite honesto da cifragem). Spec: seção "Desvios aceitos".
- [ ] **Step 5: Commit** `docs: README e spec do Personal e Nutri`. **Não publicar nem fazer merge sem pedir ao usuário** (publicar o artefato novo exige a decisão dele sobre sobrescrever ou criar outro).
