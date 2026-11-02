# Tropa como app (Firebase, PWA e Capacitor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o Tropa rodar fora do claude.ai, como PWA para os amigos e como app Capacitor no iPhone do dono, com banco, login e IA próprios no Firebase.

**Architecture:** Um arquivo `claude-shim.js` implementa `window.claude.use("db" | "user" | "sample" | "downloads")` sobre o Firebase (SDK compat, que tem a mesma API `collection/doc/get/set/onSnapshot` que o app já usa). A lógica pura do shim fica em `core.js` (testável em Node). A IA vira uma Cloud Function chamável que guarda a chave da Anthropic no servidor. Um script de build envolve o `publicar.html` (que é um fragmento, sem `<html>`) num `index.html` com manifest, service worker e o shim.

**Tech Stack:** Node 20+, Firebase (Auth, Firestore, Hosting, Cloud Functions v2, SDK `firebase@10` compat), `@anthropic-ai/sdk`, esbuild, sharp, Capacitor 6, `@firebase/rules-unit-testing`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-02-app-fase1-firebase-capacitor-design.md` (este plano corrige o spec nos pontos listados em "Desvios do spec").

## Desvios do spec (já refletidos na Task 9)
- O projeto Capacitor fica **na raiz do repositório** (`capacitor.config.ts`, `ios/`), não em `app/`, para resolver `node_modules` sem ajuste. `app/` guarda shim, scripts de build, ícones e a saída `app/www/`.
- `sample.limits()` devolve `{images:{maxInputBytes, maxCount, mediaTypes}}` (é o formato que `lerDocumento` espera), não `{images:true}`.
- As imagens são reduzidas no navegador (JPEG, lado maior 1280 px) antes de ir para a função, então o limite de 1,5 MB vale para a imagem já reduzida.
- O Firestore Rules cobre **todas** as coleções que o código usa: `config`, `posts`, `convites`, `vinculos`, `snap`, `prop`, `inbox/{uid}/n`, além das citadas no spec.
- O login é uma tela do próprio shim (Google e e-mail com senha), sem mexer em `telaAbertura`. E-mail e senha existem porque o login com Google em PWA instalada no iOS pode falhar.

## Global Constraints
- Idioma de toda a interface e mensagens: português do Brasil, tom informal e frases curtas, como o resto do app.
- Não usar traço (hífen, meia-risca, travessão) no lugar de vírgula em textos escritos para o usuário (mensagens, README, commits em prosa).
- Node 20 ou mais novo. Testes rodam com `node --test tests/*.test.js` (glob, não a pasta, por causa do Node 24).
- Região das funções: `southamerica-east1`. Modelo da IA: `claude-sonnet-5-5`. Limite diário de IA: 60 chamadas por pessoa (dono sem limite). No máximo 3 imagens por chamada, 1,5 MB (`MAX_BASE64 = 2_000_000` caracteres) cada.
- A chave `ANTHROPIC_API_KEY` só existe no Secret Manager. Nunca no repositório nem no app.
- Custom claim do dono: `owner: true`, definido só por script administrativo.
- `publicar.html` continua sendo a fonte principal e continua funcionando no claude.ai (o shim não faz nada se `window.claude` já existir; o build é quem injeta o shim, o arquivo-fonte não o inclui).
- Fora do escopo: App Store, TestFlight, Sign in with Apple, compra dentro do app, exclusão de conta, push, HealthKit, migração de dados do claude.ai.
- Mensagens de commit terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json` (raiz) | Scripts e dependências de ferramentas (firebase, esbuild, sharp, rules-unit-testing, Capacitor) |
| `app/shim/core.js` | `criarClaude(deps)`: monta o `window.claude` a partir de dependências injetadas. Também `traduzirErroAuth`. Sem Firebase, testável em Node |
| `app/shim/imagem.js` | `dimensoes`, `reduzirParaBase64` (canvas, só no navegador) |
| `app/shim/login-ui.js` | Tela de login (overlay) com Google e e-mail |
| `app/shim/claude-shim.js` | Entrada do navegador: inicializa o Firebase, liga as dependências reais ao `core.js`, define `window.claude` |
| `app/scripts/montar.js` | Funções puras do build: `lerConfig`, `montarIndex`, `versionarSw` |
| `app/scripts/build-www.js` | CLI do build: gera `app/www/` |
| `app/scripts/gerar-icones.js` | Gera os PNGs a partir de `app/icone.svg` |
| `app/sw.js`, `app/manifest.webmanifest`, `app/icone.svg`, `app/icones/*.png` | PWA |
| `app/firebase-config.json` | Config web do Firebase (pública por desenho) |
| `functions/lib.js` | Lógica pura da IA: validação, JSON, limite diário, `processar` |
| `functions/index.js` | Cloud Function `sample` (liga `lib.js` a Firestore e Anthropic) |
| `functions/scripts/definir-dono.js` | Define o claim `owner` |
| `firestore.rules`, `firestore.indexes.json`, `firebase.json` | Regras, índices, hosting e emuladores |
| `tests/shim.test.js`, `tests/functions.test.js`, `tests/build.test.js`, `tests/links.test.js` | Testes de Node |
| `tests/rules/firestore.rules.test.js` | Testes das regras (precisam do emulador e de Java) |

---

### Task 0: Ferramentas, projeto Firebase e esqueleto do repositório

**Files:**
- Create: `package.json`
- Create: `app/firebase-config.json` (valores copiados do console)
- Modify: `.gitignore`

**Interfaces:**
- Produces: scripts `npm test`, `npm run test:rules`, `npm run build:www`, `npm run icones`; `app/firebase-config.json` com as chaves `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.

Esta task tem passos manuais no console do Firebase. Faça-os com o dono.

- [ ] **Step 1: Instalar Java e o Firebase CLI**

O emulador do Firestore precisa de Java 11+. Pode pedir a senha do Mac.

```bash
brew install --cask temurin
```

```bash
java -version
```
Expected: mostra uma versão 11 ou mais nova (por exemplo `openjdk version "21...`).

```bash
npm install -g firebase-tools
```

```bash
firebase --version
```
Expected: um número de versão (13 ou mais novo).

- [ ] **Step 2: Entrar no Firebase**

```bash
firebase login
```
Expected: abre o navegador; ao terminar mostra `Success! Logged in as ...`.

- [ ] **Step 3: Criar o projeto e ligar os serviços (console, manual)**

No console https://console.firebase.google.com/ :
1. Adicionar projeto, nome `tropa-app` (o id real aparece embaixo do nome; anote). Pode desligar o Google Analytics.
2. Build > Authentication > Começar. Em "Método de login" ative **Google** (e-mail de suporte: o do dono) e **E-mail/senha**.
3. Build > Firestore Database > Criar banco. Modo **produção**, local `southamerica-east1`.
4. Engrenagem > Uso e faturamento > Detalhes e configurações > mude para o plano **Blaze** (pede cartão; o gasto esperado é próximo de zero).
5. Configurações do projeto > Seus apps > ícone `</>` (Web). Apelido `tropa-web`. Não marque Hosting aqui. Copie o objeto `firebaseConfig`.

- [ ] **Step 4: Guardar a config web e apontar o CLI para o projeto**

Crie `app/firebase-config.json` com os valores copiados (esta config é pública por desenho, pode ir para o git). Formato:

```json
{
  "apiKey": "...",
  "authDomain": "...firebaseapp.com",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "..."
}
```

```bash
firebase use --add
```
Expected: escolha o projeto criado, apelido `default`. Gera `.firebaserc`.

- [ ] **Step 5: Criar o `package.json` da raiz e instalar**

```json
{
  "name": "tropa",
  "private": true,
  "description": "Ferramentas do Tropa fora do claude.ai (build da PWA, shim, testes das regras)",
  "scripts": {
    "test": "node --test tests/*.test.js",
    "test:rules": "firebase emulators:exec --only firestore \"node --test tests/rules/*.test.js\"",
    "build:www": "node app/scripts/build-www.js",
    "icones": "node app/scripts/gerar-icones.js"
  },
  "dependencies": {
    "firebase": "^10.14.1"
  },
  "devDependencies": {
    "@firebase/rules-unit-testing": "^3.0.4",
    "esbuild": "^0.24.0",
    "sharp": "^0.33.5"
  }
}
```

```bash
npm install
```
Expected: cria `node_modules/` e `package-lock.json` sem erro.

- [ ] **Step 6: Ajustar o `.gitignore`**

Acrescente ao fim de `.gitignore`:

```
app/www/
functions/.secret.local
*-service-account.json
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log
```

- [ ] **Step 7: Confirmar que os testes atuais continuam passando**

```bash
npm test
```
Expected: `pass 136`, `fail 0`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .gitignore .firebaserc app/firebase-config.json
git commit -m "chore: esqueleto do app fora do claude.ai (projeto Firebase, package.json)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Núcleo do shim (`core.js` e `imagem.js`)

**Files:**
- Create: `app/shim/core.js`
- Create: `app/shim/imagem.js`
- Test: `tests/shim.test.js`

**Interfaces:**
- Produces (`core.js`, CommonJS):
  - `LIMITES = {maxCount: 3, maxInputBytes: 20971520, mediaTypes: ["image/jpeg","image/png","image/webp"]}`
  - `criarClaude(deps)` onde `deps = {db, autenticar(): Promise<{uid,name,avatarUrl,isOwner}>, sair(): Promise<void>, chamarIA({prompt, imagens:[{tipo,base64}]}): Promise<any>, baixar({filename,data}): Promise<boolean>, paraBase64(blob): Promise<{tipo,base64}>}`. Devolve `{use(nome), signOut()}`.
  - `traduzirErroAuth(codigo: string): string` (string vazia significa "não mostrar erro").
- Produces (`imagem.js`): `dimensoes(w, h, max) -> {w, h}` e `reduzirParaBase64(blob, max = 1280, qualidade = 0.8) -> Promise<{tipo, base64}>`. Exporta com `module.exports`.

- [ ] **Step 1: Escrever os testes que falham**

Crie `tests/shim.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test tests/shim.test.js
```
Expected: FAIL com `Cannot find module '../app/shim/core.js'`.

- [ ] **Step 3: Implementar `core.js`**

Crie `app/shim/core.js`:

```js
// Monta o window.claude do Tropa fora do claude.ai. Sem Firebase aqui: tudo entra por `deps`, para testar em Node.
const LIMITES = { maxCount: 3, maxInputBytes: 20 * 1024 * 1024, mediaTypes: ["image/jpeg", "image/png", "image/webp"] };

const ERROS_AUTH = {
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Esse e-mail já tem conta. Toque em Entrar.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",
  "auth/network-request-failed": "Sem internet. Tente de novo.",
  "tropa/sem-google-nativo": "Entrar com Google no app nativo ainda não foi configurado. Use e-mail e senha."
};

function traduzirErroAuth(codigo) {
  return Object.prototype.hasOwnProperty.call(ERROS_AUTH, codigo) ? ERROS_AUTH[codigo] : "Não consegui entrar. Tente de novo.";
}

function criarClaude(deps) {
  let sessao = null;
  const entrar = () => {
    if (!sessao) sessao = deps.autenticar().catch(e => { sessao = null; throw e; });
    return sessao;
  };

  const servicos = {
    db: async () => deps.db,
    user: async () => ({
      me: async () => {
        const s = await entrar();
        return { id: s.uid, name: s.name, avatarUrl: s.avatarUrl, isOwner: !!s.isOwner };
      },
      can: async () => true,
      profiles: async ids => {
        await entrar();
        const out = {};
        await Promise.all((ids || []).map(async id => {
          try {
            const s = await deps.db.collection("perfis").doc(id).get();
            if (s.exists) { const d = s.data() || {}; out[id] = { name: d.name || "", avatarUrl: d.avatarUrl || "" }; }
          } catch (e) { /* perfil ilegível: o app mostra sem nome */ }
        }));
        return out;
      }
    }),
    sample: async () => ({
      limits: async () => ({ images: { maxInputBytes: LIMITES.maxInputBytes, maxCount: LIMITES.maxCount, mediaTypes: LIMITES.mediaTypes.slice() } }),
      json: async (prompt, opcoes) => {
        const fotos = (opcoes && opcoes.images) || [];
        if (fotos.length > LIMITES.maxCount) throw new Error("A IA aceita no máximo " + LIMITES.maxCount + " imagens por vez.");
        const imagens = await Promise.all(fotos.map(f => deps.paraBase64(f)));
        return deps.chamarIA({ prompt, imagens });
      }
    }),
    downloads: async () => ({ save: ({ filename, data }) => deps.baixar({ filename, data }) })
  };

  return {
    use: async nome => {
      if (!servicos[nome]) throw new Error("serviço desconhecido: " + nome);
      return servicos[nome]();
    },
    signOut: async () => { sessao = null; await deps.sair(); }
  };
}

module.exports = { criarClaude, LIMITES, traduzirErroAuth };
```

- [ ] **Step 4: Implementar `imagem.js`**

Crie `app/shim/imagem.js`:

```js
// Reduz fotos no navegador antes de mandar para a função da IA (celular tira foto de vários MB).
function dimensoes(w, h, max) {
  const maior = Math.max(w, h);
  if (maior <= max) return { w, h };
  const f = max / maior;
  return { w: Math.round(w * f), h: Math.round(h * f) };
}

async function reduzirParaBase64(blob, max = 1280, qualidade = 0.8) {
  const bmp = await createImageBitmap(blob);
  const { w, h } = dimensoes(bmp.width, bmp.height, max);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const url = cv.toDataURL("image/jpeg", qualidade);
  return { tipo: "image/jpeg", base64: url.slice(url.indexOf(",") + 1) };
}

module.exports = { dimensoes, reduzirParaBase64 };
```

- [ ] **Step 5: Rodar e ver passar**

```bash
node --test tests/shim.test.js
```
Expected: todos os testes passam (`pass 14`, `fail 0`).

- [ ] **Step 6: Commit**

```bash
git add app/shim/core.js app/shim/imagem.js tests/shim.test.js
git commit -m "feat: núcleo do shim do window.claude (db, user, sample, downloads) com testes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Cloud Function da IA (`functions/`)

**Files:**
- Create: `functions/lib.js`
- Create: `functions/index.js`
- Create: `functions/package.json`
- Create: `functions/scripts/definir-dono.js`
- Test: `tests/functions.test.js`

**Interfaces:**
- Produces (`lib.js`, CommonJS): `MODELO = "claude-sonnet-5-5"`, `LIMITE_DIARIO = 60`, `ErroApp(code, message)`, `extrairJson(texto)`, `validarEntrada(data) -> {prompt, imagens}`, `chaveUso(uid, agora: Date) -> string`, `montarConteudo(prompt, imagens)`, `processar({uid, owner, data, agora}, deps) -> Promise<{json}>` com `deps = {temAcesso(uid), registrarUso(chave, limite): Promise<boolean>, chamarClaude({system, content}): Promise<string>}`.
- Produces (`index.js`): função chamável `sample` na região `southamerica-east1`. Entrada `{prompt, imagens:[{tipo,base64}]}`, saída `{json: <objeto>}`. Os códigos de erro (`unauthenticated`, `permission-denied`, `resource-exhausted`, `invalid-argument`, `internal`) são os de `HttpsError`.

- [ ] **Step 1: Escrever os testes que falham**

Crie `tests/functions.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { extrairJson, validarEntrada, chaveUso, montarConteudo, processar, ErroApp, LIMITE_DIARIO } = require("../functions/lib.js");

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
  assert.deepEqual(reg.usos, [["u1_2026-11-02", LIMITE_DIARIO]]);
  assert.equal(reg.chamadas[0].content[0].type, "image");
  assert.match(reg.chamadas[0].system, /JSON/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test tests/functions.test.js
```
Expected: FAIL com `Cannot find module '../functions/lib.js'`.

- [ ] **Step 3: Implementar `functions/lib.js`**

```js
// Lógica pura da função `sample` (a IA do Tropa). Sem Firebase nem Anthropic aqui: entram por `deps`.
const MODELO = "claude-sonnet-5-5";
const LIMITE_DIARIO = 60;
const MAX_PROMPT = 60000;
const MAX_IMAGENS = 3;
const MAX_BASE64 = 2000000;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const SISTEMA = "Responda somente com JSON válido, sem texto antes ou depois e sem blocos de código.";

class ErroApp extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function extrairJson(texto) {
  const t = String(texto || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch (e) { /* tenta recortar */ }
  const i = t.search(/[\[{]/);
  if (i < 0) throw new ErroApp("internal", "A IA não devolveu JSON.");
  const fecha = t[i] === "{" ? "}" : "]";
  const j = t.lastIndexOf(fecha);
  if (j < i) throw new ErroApp("internal", "A IA devolveu um JSON incompleto.");
  try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { throw new ErroApp("internal", "A IA devolveu um JSON inválido."); }
}

function validarEntrada(data) {
  if (!data || typeof data.prompt !== "string" || !data.prompt.trim()) throw new ErroApp("invalid-argument", "Falta o texto do pedido.");
  if (data.prompt.length > MAX_PROMPT) throw new ErroApp("invalid-argument", "O pedido é grande demais.");
  const imagens = Array.isArray(data.imagens) ? data.imagens : [];
  if (imagens.length > MAX_IMAGENS) throw new ErroApp("invalid-argument", "No máximo " + MAX_IMAGENS + " imagens por vez.");
  imagens.forEach(im => {
    if (!im || !TIPOS.includes(im.tipo) || typeof im.base64 !== "string" || !im.base64 || im.base64.length > MAX_BASE64) {
      throw new ErroApp("invalid-argument", "Imagem inválida ou grande demais.");
    }
  });
  return { prompt: data.prompt, imagens };
}

function chaveUso(uid, agora) {
  const brasilia = new Date(agora.getTime() - 3 * 3600 * 1000);
  return uid + "_" + brasilia.toISOString().slice(0, 10);
}

function montarConteudo(prompt, imagens) {
  return imagens
    .map(im => ({ type: "image", source: { type: "base64", media_type: im.tipo, data: im.base64 } }))
    .concat([{ type: "text", text: prompt }]);
}

async function processar({ uid, owner, data, agora }, deps) {
  if (!uid) throw new ErroApp("unauthenticated", "Entre na sua conta para usar a IA.");
  const { prompt, imagens } = validarEntrada(data);
  if (!owner) {
    if (!(await deps.temAcesso(uid))) throw new ErroApp("permission-denied", "Sua conta ainda não tem acesso ao app.");
    if (!(await deps.registrarUso(chaveUso(uid, agora), LIMITE_DIARIO))) {
      throw new ErroApp("resource-exhausted", "Você usou todas as consultas de IA de hoje. Volte amanhã.");
    }
  }
  const texto = await deps.chamarClaude({ system: SISTEMA, content: montarConteudo(prompt, imagens) });
  return { json: extrairJson(texto) };
}

module.exports = { MODELO, LIMITE_DIARIO, ErroApp, extrairJson, validarEntrada, chaveUso, montarConteudo, processar };
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test tests/functions.test.js
```
Expected: `pass 11`, `fail 0`.

- [ ] **Step 5: Criar `functions/package.json`, `index.js` e o script do dono**

`functions/package.json`:

```json
{
  "name": "tropa-functions",
  "private": true,
  "main": "index.js",
  "engines": { "node": "20" }
}
```

```bash
cd functions && npm install firebase-admin firebase-functions @anthropic-ai/sdk && cd ..
```
Expected: instala sem erro e acrescenta as três dependências ao `functions/package.json`.

`functions/index.js`:

```js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Anthropic = require("@anthropic-ai/sdk");
const { processar, ErroApp, MODELO } = require("./lib");

admin.initializeApp();
const CHAVE = defineSecret("ANTHROPIC_API_KEY");

exports.sample = onCall(
  { region: "southamerica-east1", secrets: [CHAVE], timeoutSeconds: 60, memory: "512MiB", maxInstances: 5 },
  async req => {
    const fs = admin.firestore();
    const deps = {
      temAcesso: async uid => {
        const s = await fs.collection("acessos").doc(uid).get();
        return s.exists && (s.data() || {}).status === "aceito";
      },
      registrarUso: (chave, limite) => fs.runTransaction(async t => {
        const ref = fs.collection("uso").doc(chave);
        const s = await t.get(ref);
        const n = s.exists ? (s.data().n || 0) : 0;
        if (n >= limite) return false;
        t.set(ref, { n: n + 1 });
        return true;
      }),
      chamarClaude: async ({ system, content }) => {
        const cliente = new Anthropic({ apiKey: CHAVE.value() });
        const r = await cliente.messages.create({ model: MODELO, max_tokens: 3000, system, messages: [{ role: "user", content }] });
        return r.content.filter(b => b.type === "text").map(b => b.text).join("");
      }
    };
    try {
      return await processar({
        uid: req.auth && req.auth.uid,
        owner: !!(req.auth && req.auth.token && req.auth.token.owner),
        data: req.data,
        agora: new Date()
      }, deps);
    } catch (e) {
      if (e instanceof ErroApp) throw new HttpsError(e.code, e.message);
      console.error("sample falhou", e);
      throw new HttpsError("internal", "A IA não respondeu agora.");
    }
  }
);
```

`functions/scripts/definir-dono.js`:

```js
// Uso: GOOGLE_APPLICATION_CREDENTIALS=/caminho/chave-service-account.json node functions/scripts/definir-dono.js email@exemplo.com
// Dá o papel de dono (custom claim owner=true) à conta com esse e-mail. A pessoa precisa entrar no app de novo.
const admin = require("firebase-admin");

async function main() {
  const email = process.argv[2];
  if (!email) { console.error("Passe o e-mail da conta do dono."); process.exit(1); }
  admin.initializeApp();
  const u = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(u.uid, { owner: true });
  console.log("Pronto. uid " + u.uid + " agora é o dono. Feche e abra o app para valer.");
}
main().catch(e => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 6: Conferir que o módulo carrega**

```bash
node -e "require('./functions/lib.js'); console.log('lib ok')" && node --check functions/index.js && node --check functions/scripts/definir-dono.js && echo sintaxe ok
```
Expected: `lib ok` e `sintaxe ok`.

- [ ] **Step 7: Commit**

```bash
git add functions/lib.js functions/index.js functions/package.json functions/package-lock.json functions/scripts/definir-dono.js tests/functions.test.js
git commit -m "feat: Cloud Function sample (IA do coach) com limite diário, e script do dono

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Regras do Firestore e testes com o emulador

**Files:**
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `firebase.json`
- Test: `tests/rules/firestore.rules.test.js`

**Interfaces:**
- Consumes: claim `owner: true` no token (Task 2); documento `acessos/{uid}` com `status: "aceito"`.
- Produces: regras usadas pelo `firebase deploy` (Task 8) e pelo emulador.

- [ ] **Step 1: Criar `firebase.json` e `firestore.indexes.json`**

`firestore.indexes.json`:

```json
{ "indexes": [], "fieldOverrides": [] }
```

`firebase.json`:

```json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "functions": [{ "source": "functions", "codebase": "default", "ignore": ["node_modules", ".git", "*.local"] }],
  "hosting": {
    "public": "app/www",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
      { "source": "/index.html", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
    ]
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": false }
  }
}
```

- [ ] **Step 2: Escrever os testes que falham**

Crie `tests/rules/firestore.rules.test.js`:

```js
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
```

- [ ] **Step 3: Criar o `firestore.rules` mínimo (nega tudo) e ver falhar**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```

```bash
npm run test:rules
```
Expected: vários testes FAIL (por exemplo `dados pessoais`), porque tudo está negado.

- [ ] **Step 4: Escrever as regras de verdade**

Substitua `firestore.rules` por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function logado() { return request.auth != null; }
    function dono() { return logado() && request.auth.token.owner == true; }
    function eu(uid) { return logado() && request.auth.uid == uid; }
    function temAcesso() {
      return dono() || (logado()
        && exists(/databases/$(database)/documents/acessos/$(request.auth.uid))
        && get(/databases/$(database)/documents/acessos/$(request.auth.uid)).data.status == 'aceito');
    }

    // Dados pessoais: perfil, log, rascunho, social, chaves, modelos. Só o próprio uid.
    match /data/users/{uid}/{resto=**} {
      allow read, write: if eu(uid);
    }

    // Acesso e revisão: cada pessoa mexe no próprio documento, o dono em todos.
    match /acessos/{id}  { allow read, write: if dono() || eu(id); }
    match /pedidos/{id}  { allow read, write: if dono() || eu(id); }
    match /revisao/{id}  { allow read, write: if dono() || eu(id); }
    match /resumo/{id}   { allow read, write: if dono() || eu(id); }
    match /aprovados/{id} {
      allow read: if dono() || eu(id);
      allow write: if dono();
    }

    // Grupos: só números da semana e apelido. Lê quem tem acesso, grava o próprio documento.
    match /grupos/{id} {
      allow read: if temAcesso();
      allow write: if dono() || (temAcesso() && eu(id));
    }

    // Personal e Nutri. O conteúdo sensível é cifrado no navegador (ver README, "Limites da cifragem").
    match /papeis/{id}   { allow read: if logado(); allow write: if dono() || eu(id); }
    match /convites/{id} { allow read, write: if logado(); }
    match /vinculos/{id} { allow read, write: if logado(); }
    match /snap/{id}     { allow read, write: if logado(); }
    match /prop/{id}     { allow read, write: if logado(); }
    match /inbox/{uid}/n/{id} { allow read, write: if logado(); }

    // Configuração do dono e posts públicos do dono.
    match /config/{id} { allow read: if logado(); allow write: if dono(); }
    match /posts/{id}  { allow read: if logado(); allow write: if dono(); }

    // Nome e foto públicos, gravados pelo shim no login.
    match /perfis/{id} { allow read: if logado(); allow write: if eu(id); }

    // Contador diário da IA: só a Cloud Function (Admin SDK ignora as regras).
    match /uso/{id} { allow read, write: if false; }
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
npm run test:rules
```
Expected: todos os testes passam (`fail 0`). Se `dados pessoais` falhar por causa do curinga `{uid}` na posição de coleção, troque a linha para `match /data/{users}/{uid}/{resto=**}` com `users == 'users' && eu(uid)` no `allow`, e rode de novo.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firestore.indexes.json firebase.json tests/rules/firestore.rules.test.js
git commit -m "feat: regras do Firestore (todas as coleções do app) e testes com o emulador

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Entrada do navegador (`claude-shim.js`) e tela de login

**Files:**
- Create: `app/shim/login-ui.js`
- Create: `app/shim/claude-shim.js`

**Interfaces:**
- Consumes: `criarClaude`, `traduzirErroAuth` (`core.js`), `reduzirParaBase64` (`imagem.js`), `window.TROPA_FIREBASE` (config injetada pelo build), `window.Capacitor` (só no app nativo).
- Produces: define `window.claude` (se ainda não existir) com `use()` e `signOut()`. Chamadas `functions.httpsCallable("sample")` com `{prompt, imagens}` e retorno `{data:{json}}`.

Esta task não tem teste automático (DOM e SDK reais). A verificação é na Task 7, no emulador.

- [ ] **Step 1: Criar `app/shim/login-ui.js`**

```js
// Tela de login em tela cheia, desenhada fora do app (o app só começa depois que a pessoa entra).
// acoes = {google(): Promise, entrar(email, senha): Promise, criar(nome, email, senha): Promise}
const { traduzirErroAuth } = require("./core.js");

function pedirLogin(acoes) {
  return new Promise(resolve => {
    const ov = document.createElement("div");
    ov.id = "tropa-login";
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:#F2F2F7;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,system-ui,sans-serif;color:#0B0D10;overflow:auto";
    ov.innerHTML =
      '<div style="width:100%;max-width:380px">' +
      '<h1 style="font-size:34px;margin:0 0 6px;font-style:italic;font-weight:900;letter-spacing:-.5px">TROPA</h1>' +
      '<p style="margin:0 0 24px;color:#5A626C">Entre para treinar com a sua tropa.</p>' +
      '<button type="button" id="tl-g" style="width:100%;padding:14px;border:0;border-radius:14px;background:#CF4500;color:#fff;font-size:16px;font-weight:600">Entrar com Google</button>' +
      '<p style="text-align:center;color:#5A626C;margin:18px 0">ou com e-mail</p>' +
      '<form id="tl-f" style="display:grid;gap:10px">' +
      '<input id="tl-n" type="text" placeholder="Seu nome" autocomplete="name" style="display:none;padding:14px;border:1px solid #D0D0D8;border-radius:12px;font-size:16px">' +
      '<input id="tl-e" type="email" placeholder="E-mail" autocomplete="email" required style="padding:14px;border:1px solid #D0D0D8;border-radius:12px;font-size:16px">' +
      '<input id="tl-s" type="password" placeholder="Senha" autocomplete="current-password" required minlength="6" style="padding:14px;border:1px solid #D0D0D8;border-radius:12px;font-size:16px">' +
      '<button type="submit" id="tl-ok" style="padding:14px;border:0;border-radius:14px;background:#0B0D10;color:#fff;font-size:16px;font-weight:600">Entrar</button>' +
      '</form>' +
      '<button type="button" id="tl-t" style="margin-top:12px;background:none;border:0;color:#C23E00;font-size:15px;width:100%">Criar conta com e-mail</button>' +
      '<p id="tl-erro" role="alert" style="color:#C62A20;min-height:20px;text-align:center;margin-top:8px"></p>' +
      '</div>';
    document.body.appendChild(ov);

    const $ = id => ov.querySelector("#" + id);
    let criando = false;
    const botoes = [$("tl-g"), $("tl-ok"), $("tl-t")];
    const mostrar = t => { $("tl-erro").textContent = t || ""; };

    $("tl-t").addEventListener("click", () => {
      criando = !criando;
      $("tl-n").style.display = criando ? "block" : "none";
      $("tl-ok").textContent = criando ? "Criar conta" : "Entrar";
      $("tl-t").textContent = criando ? "Já tenho conta" : "Criar conta com e-mail";
      $("tl-s").autocomplete = criando ? "new-password" : "current-password";
      mostrar("");
    });

    async function executar(fn) {
      mostrar("");
      botoes.forEach(b => { b.disabled = true; });
      try {
        await fn();
        ov.remove();
        resolve();
      } catch (e) {
        mostrar(traduzirErroAuth(e && e.code));
        botoes.forEach(b => { b.disabled = false; });
      }
    }

    $("tl-g").addEventListener("click", () => executar(() => acoes.google()));
    $("tl-f").addEventListener("submit", ev => {
      ev.preventDefault();
      const email = $("tl-e").value.trim(), senha = $("tl-s").value;
      executar(() => (criando ? acoes.criar($("tl-n").value.trim(), email, senha) : acoes.entrar(email, senha)));
    });
  });
}

module.exports = { pedirLogin };
```

- [ ] **Step 2: Criar `app/shim/claude-shim.js`**

```js
// Entrada do navegador. Liga o Firebase ao core.js e publica window.claude (se o claude.ai não tiver feito isso).
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/functions";
import { criarClaude } from "./core.js";
import { reduzirParaBase64 } from "./imagem.js";
import { pedirLogin } from "./login-ui.js";

if (!window.claude) {
  const cfg = Object.assign({}, window.TROPA_FIREBASE);
  const web = /^https?:$/.test(location.protocol);
  if (web) cfg.authDomain = location.host;   // o redirect do Google volta para o mesmo domínio (precisa disso no Safari)
  firebase.initializeApp(cfg);

  const auth = firebase.auth();
  const db = firebase.firestore();
  const fns = firebase.app().functions("southamerica-east1");
  const emulador = location.hostname === "localhost" && new URLSearchParams(location.search).get("emu") === "1";
  if (emulador) {
    auth.useEmulator("http://127.0.0.1:9099");
    db.useEmulator("127.0.0.1", 8080);
    fns.useEmulator("127.0.0.1", 5001);
  } else {
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  }

  const nativo = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  async function entrarGoogle() {
    if (nativo()) {
      const plugin = window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseAuthentication;
      if (!plugin) throw { code: "tropa/sem-google-nativo" };
      const r = await plugin.signInWithGoogle();
      const cred = firebase.auth.GoogleAuthProvider.credential(r.credential.idToken);
      await auth.signInWithCredential(cred);
      return;
    }
    await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
    await new Promise(() => {});   // a página recarrega quando o Google devolve a pessoa
  }
  const entrarEmail = (email, senha) => auth.signInWithEmailAndPassword(email, senha);
  async function criarConta(nome, email, senha) {
    const c = await auth.createUserWithEmailAndPassword(email, senha);
    if (nome) await c.user.updateProfile({ displayName: nome });
  }

  async function autenticar() {
    try { await auth.getRedirectResult(); } catch (e) { /* o erro aparece na tela de login ao tentar de novo */ }
    let u = await new Promise(res => { const off = auth.onAuthStateChanged(x => { off(); res(x); }); });
    if (!u) {
      await pedirLogin({ google: entrarGoogle, entrar: entrarEmail, criar: criarConta });
      u = auth.currentUser;
    }
    let claims = {};
    try { claims = (await u.getIdTokenResult(true)).claims; } catch (e) { try { claims = (await u.getIdTokenResult()).claims; } catch (e2) { /* sem rede: segue como não dono */ } }
    const nome = u.displayName || (u.email || "").split("@")[0] || "Atleta";
    await db.collection("perfis").doc(u.uid).set({ name: nome, avatarUrl: u.photoURL || "" }, { merge: true }).catch(() => {});
    return { uid: u.uid, name: nome, avatarUrl: u.photoURL || "", isOwner: claims.owner === true };
  }

  const callable = fns.httpsCallable("sample", { timeout: 60000 });
  async function chamarIA(arg) {
    try { return (await callable(arg)).data.json; }
    catch (e) { throw new Error((e && e.message) || "A IA não respondeu agora."); }
  }

  const paraBase64Puro = blob => new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).slice(String(r.result).indexOf(",") + 1));
    r.onerror = () => falha(r.error);
    r.readAsDataURL(blob);
  });

  async function baixar({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: "text/plain" });
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    if (nativo() && plugins && plugins.Filesystem && plugins.Share) {
      const gravado = await plugins.Filesystem.writeFile({ path: filename, data: await paraBase64Puro(blob), directory: "CACHE" });
      await plugins.Share.share({ url: gravado.uri });
      return true;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  }

  window.claude = criarClaude({
    db,
    autenticar,
    sair: () => auth.signOut(),
    chamarIA,
    baixar,
    paraBase64: reduzirParaBase64
  });
}
```

- [ ] **Step 3: Conferir que empacota**

```bash
node -e "require('esbuild').buildSync({entryPoints:['app/shim/claude-shim.js'],bundle:true,format:'iife',write:false}); console.log('empacotou')"
```
Expected: `empacotou` (sem erro de import).

- [ ] **Step 4: Commit**

```bash
git add app/shim/login-ui.js app/shim/claude-shim.js
git commit -m "feat: entrada do shim no navegador (Firebase, login Google e e-mail, IA, downloads)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: PWA e build (`app/www/`)

**Files:**
- Create: `app/scripts/montar.js`
- Create: `app/scripts/build-www.js`
- Create: `app/scripts/gerar-icones.js`
- Create: `app/sw.js`
- Create: `app/manifest.webmanifest`
- Create: `app/icone.svg`
- Create: `app/icones/icone-180.png`, `icone-192.png`, `icone-512.png` (gerados)
- Test: `tests/build.test.js`

**Interfaces:**
- Consumes: `app/firebase-config.json`, `publicar.html`, bundle do shim (Task 4).
- Produces (`montar.js`, CommonJS):
  - `lerConfig(texto: string) -> object` (lança `Error` se faltar `apiKey`, `projectId` ou `appId`).
  - `montarIndex(fragmento: string, config: object, linkApp: string) -> string`.
  - `versionarSw(texto: string, versao: string) -> string` (troca `__VERSAO__`).
  - Saída do build em `app/www/`: `index.html`, `shim.js`, `sw.js`, `manifest.webmanifest`, `icone-180.png`, `icone-192.png`, `icone-512.png`.

- [ ] **Step 1: Escrever os testes que falham**

Crie `tests/build.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { lerConfig, montarIndex, versionarSw } = require("../app/scripts/montar.js");

const CFG = { apiKey: "k", authDomain: "x.firebaseapp.com", projectId: "tropa-app", appId: "1:2:web:3" };

test("lerConfig devolve o objeto quando está completo", () => {
  assert.deepEqual(lerConfig(JSON.stringify(CFG)), CFG);
});

test("lerConfig recusa config incompleta com mensagem clara", () => {
  assert.throws(() => lerConfig(JSON.stringify({ apiKey: "k" })), /projectId/);
  assert.throws(() => lerConfig("não é json"), /app\/firebase-config\.json/);
});

test("montarIndex envolve o fragmento com doctype, manifest, config e shim, nessa ordem", () => {
  const html = montarIndex("<title>Tropa</title><div id=app></div>", CFG, "https://tropa-app.web.app/");
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<meta name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icone-180\.png">/);
  const iCfg = html.indexOf("window.TROPA_FIREBASE=");
  const iShim = html.indexOf('<script src="shim.js"></script>');
  const iCorpo = html.indexOf("<div id=app>");
  assert.ok(iCfg > 0 && iShim > iCfg && iCorpo > iShim, "ordem: config, shim, corpo");
  assert.match(html, /window\.TROPA_LINK="https:\/\/tropa-app\.web\.app\/"/);
});

test("montarIndex escapa < no JSON para não fechar o script antes da hora", () => {
  const html = montarIndex("<p></p>", { ...CFG, apiKey: "a</script>b" }, "https://x/");
  assert.ok(!html.includes('a</script>b'));
  assert.match(html, /a\\u003c\/script>b/);
});

test("montarIndex registra o service worker só em https e fora do localhost", () => {
  const html = montarIndex("<p></p>", CFG, "https://x/");
  assert.match(html, /serviceWorker\.register\("sw\.js"\)/);
  assert.match(html, /location\.hostname!=="localhost"/);
});

test("versionarSw troca o marcador", () => {
  assert.equal(versionarSw('const V = "__VERSAO__";', "123"), 'const V = "123";');
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test tests/build.test.js
```
Expected: FAIL com `Cannot find module '../app/scripts/montar.js'`.

- [ ] **Step 3: Implementar `montar.js`**

```js
// Funções puras do build da PWA. O build-www.js só lê e grava arquivos em volta delas.
function lerConfig(texto) {
  let cfg;
  try { cfg = JSON.parse(texto); } catch (e) { throw new Error("app/firebase-config.json não é um JSON válido."); }
  for (const k of ["apiKey", "projectId", "appId"]) {
    if (!cfg || !cfg[k]) throw new Error("app/firebase-config.json está sem \"" + k + "\". Copie a config web do console do Firebase.");
  }
  return cfg;
}

const json = v => JSON.stringify(v).replace(/</g, "\\u003c");

function montarIndex(fragmento, config, linkApp) {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="theme-color" content="#F2F2F7">' +
    '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">' +
    '<meta name="apple-mobile-web-app-title" content="Tropa"><meta name="apple-mobile-web-app-status-bar-style" content="default">' +
    '<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icone-180.png">' +
    "<script>window.TROPA_FIREBASE=" + json(config) + ";window.TROPA_LINK=" + json(linkApp) + ";" +
    'if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)&&location.hostname!=="localhost"){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}</script>' +
    '<script src="shim.js"></script></head><body>' + fragmento + "</body></html>";
}

function versionarSw(texto, versao) {
  return texto.replace("__VERSAO__", versao);
}

module.exports = { lerConfig, montarIndex, versionarSw };
```

- [ ] **Step 4: Rodar e ver passar**

```bash
node --test tests/build.test.js
```
Expected: `pass 6`, `fail 0`.

- [ ] **Step 5: Criar os arquivos da PWA**

`app/manifest.webmanifest`:

```json
{
  "name": "Tropa",
  "short_name": "Tropa",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#F2F2F7",
  "theme_color": "#F2F2F7",
  "lang": "pt-BR",
  "icons": [
    { "src": "icone-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

`app/sw.js`:

```js
// Rede primeiro, cache como reserva: o app abre mesmo sem internet, mas sempre pega a versão nova quando há rede.
const VERSAO = "__VERSAO__";
const SHELL = ["./", "./shim.js", "./manifest.webmanifest", "./icone-192.png", "./icone-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/__/")) return;   // handler do login do Firebase: nunca interceptar
  e.respondWith(
    fetch(req)
      .then(r => { const copia = r.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("./")))
  );
});
```

`app/icone.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#FF5A00"/><path d="M120 130h272v70H292v190h-72V200H120z" fill="#fff"/></svg>
```

`app/scripts/gerar-icones.js`:

```js
const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(raiz, "icone.svg"));
fs.mkdirSync(path.join(raiz, "icones"), { recursive: true });

Promise.all([180, 192, 512].map(n =>
  sharp(svg).resize(n, n).png().toFile(path.join(raiz, "icones", "icone-" + n + ".png"))
)).then(() => console.log("ícones gerados em app/icones"));
```

```bash
npm run icones
```
Expected: `ícones gerados em app/icones` e três PNGs na pasta.

- [ ] **Step 6: Criar o `build-www.js`**

```js
// Uso: npm run build:www   (gera app/www/ pronto para o Firebase Hosting e para o Capacitor)
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");
const { lerConfig, montarIndex, versionarSw } = require("./montar.js");

const raiz = path.join(__dirname, "..", "..");
const app = path.join(raiz, "app");
const www = path.join(app, "www");

const config = lerConfig(fs.readFileSync(path.join(app, "firebase-config.json"), "utf8"));
const link = "https://" + config.projectId + ".web.app/";

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

esbuild.buildSync({
  entryPoints: [path.join(app, "shim", "claude-shim.js")],
  bundle: true, minify: true, format: "iife", target: ["safari15", "chrome100"],
  outfile: path.join(www, "shim.js")
});

const fragmento = fs.readFileSync(path.join(raiz, "publicar.html"), "utf8");
fs.writeFileSync(path.join(www, "index.html"), montarIndex(fragmento, config, link));
fs.writeFileSync(path.join(www, "sw.js"), versionarSw(fs.readFileSync(path.join(app, "sw.js"), "utf8"), String(Date.now())));
fs.copyFileSync(path.join(app, "manifest.webmanifest"), path.join(www, "manifest.webmanifest"));
for (const n of [180, 192, 512]) fs.copyFileSync(path.join(app, "icones", "icone-" + n + ".png"), path.join(www, "icone-" + n + ".png"));

console.log("app/www pronto (" + fs.readdirSync(www).join(", ") + ")");
```

- [ ] **Step 7: Rodar o build**

```bash
npm run build:www
```
Expected: `app/www pronto (icone-180.png, icone-192.png, icone-512.png, index.html, manifest.webmanifest, shim.js, sw.js)`.

- [ ] **Step 8: Commit**

```bash
git add app/scripts app/sw.js app/manifest.webmanifest app/icone.svg app/icones tests/build.test.js
git commit -m "feat: build da PWA (index.html envolvendo o publicar.html, manifest, service worker, ícones)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ajustes no `publicar.html` (link do app e botão Sair)

**Files:**
- Modify: `publicar.html:679` (constante `ARTIFACT_ID`), `publicar.html:2505`, `publicar.html:2999`, `publicar.html:4326`, `publicar.html:6159-6166` (`sheetSair`), `publicar.html:6261` (`sair`)
- Test: `tests/links.test.js`

**Interfaces:**
- Consumes: `window.TROPA_LINK` (injetado pelo build), `window.claude.signOut` (Task 1).
- Produces: constante `LINK_APP` (string). `sair()` encerra a sessão quando `window.claude.signOut` existe.

- [ ] **Step 1: Escrever os testes que falham**

Crie `tests/links.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");

test("o link do app vem de LINK_APP, que prefere window.TROPA_LINK", () => {
  assert.match(html, /const LINK_APP = \(typeof window !== "undefined" && window\.TROPA_LINK\) \|\| "https:\/\/claude\.ai\/artifact\/"\+ARTIFACT_ID;/);
});

test("nenhum outro lugar monta o link do artifact na mão", () => {
  const sobras = html.split("\n").filter(l => /claude\.ai\/artifact\/"\s*\+\s*ARTIFACT_ID/.test(l) && !/const LINK_APP/.test(l));
  assert.deepEqual(sobras, []);
});

test("sair() encerra a sessão quando o shim oferece signOut", () => {
  const m = html.match(/function sair\(\)\{[^\n]*\}/);
  assert.ok(m, "não achei function sair()");
  assert.match(m[0], /window\.claude\.signOut/);
  assert.match(m[0], /location\.reload\(\)/);
});

test("o texto do Sair não promete mais a conta do Claude", () => {
  const i = html.indexOf("function sheetSair()");
  const bloco = html.slice(i, i + 900);
  assert.ok(!/conta do Claude/.test(bloco));
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --test tests/links.test.js
```
Expected: 4 testes FAIL.

- [ ] **Step 3: Aplicar as edições**

1. Linha 679: logo abaixo de `const ARTIFACT_ID = "Su8kaFAaifinor4vQ4mZeq";` acrescente uma linha:

```js
const LINK_APP = (typeof window !== "undefined" && window.TROPA_LINK) || "https://claude.ai/artifact/"+ARTIFACT_ID;
```

2. Linha 2505: troque `const u = "https://claude.ai/artifact/"+ARTIFACT_ID;` por `const u = LINK_APP;`.

3. Linha 2999: troque `"Entra no "+BRAND+": https://claude.ai/artifact/"+ARTIFACT_ID+". Código: "` por `"Entra no "+BRAND+": "+LINK_APP+". Código: "`.

4. Linha 4326 (função `convite`): troque o trecho final `+": https://claude.ai/artifact/"+ARTIFACT_ID; }` por `+": "+LINK_APP; }` e troque `Entra pelo link com sua conta do Claude (é grátis)` por `Entra pelo link e cria sua conta (é grátis)`.

5. `sheetSair` (linha 6161-6162): troque o parágrafo por:

```js
'<p class="s">Seus dados continuam salvos na sua conta. Ao voltar, é só entrar de novo.</p>'+
```

6. Linha 6261: troque a função inteira por:

```js
function sair(){ if (window.claude && typeof window.claude.signOut === "function"){ window.claude.signOut().catch(()=>{}).then(()=>{ location.reload(); }); return; } fecharSheet(); R.tab = "hoje"; R.sub = null; R.arg = null; semOff = 0; telaAbertura(); }
```

- [ ] **Step 4: Rodar tudo e ver passar**

```bash
npm test
```
Expected: todos passam, incluindo `links.test.js` e a checagem `o script do app compila` (`fail 0`).

- [ ] **Step 5: Commit**

```bash
git add publicar.html tests/links.test.js
git commit -m "feat: link do app configurável (LINK_APP) e Sair que encerra a sessão com login próprio

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rodar tudo no emulador (verificação ponta a ponta local)

**Files:**
- Create: `functions/.secret.local` (não versionado)

**Interfaces:**
- Consumes: tudo das Tasks 1 a 6.
- Produces: confirmação de que login, banco, regras e IA funcionam juntos sem tocar na produção.

- [ ] **Step 1: Guardar uma chave de teste da Anthropic para o emulador**

```bash
printf 'ANTHROPIC_API_KEY=%s\n' 'COLE_AQUI_A_CHAVE' > functions/.secret.local
```
Troque `COLE_AQUI_A_CHAVE` pela chave real da API da Anthropic, digitada por quem é dono dela. O arquivo está no `.gitignore`.

- [ ] **Step 2: Gerar o build e subir os emuladores**

```bash
npm run build:www
```

```bash
firebase emulators:start --only auth,firestore,functions,hosting
```
Expected: lista Auth 9099, Firestore 8080, Functions 5001, Hosting 5000 e `All emulators ready`. Deixe rodando num terminal.

- [ ] **Step 3: Abrir o app apontando para o emulador**

No navegador do Mac, abra `http://localhost:5000/?emu=1`.
Expected: aparece a tela "TROPA" com o botão "Entrar com Google" e o formulário de e-mail.

- [ ] **Step 4: Criar a conta A e percorrer o app**

Toque em "Criar conta com e-mail", nome `Ana`, e-mail `ana@teste.com`, senha `teste123`.
Expected: a tela de login some e o app abre pedindo o código de convite (a pessoa ainda não tem `acessos`). No console do navegador não deve haver erros `permission-denied`.

- [ ] **Step 5: Dar acesso e testar a IA**

Pegue o uid da Ana: no console do navegador da Ana (aba aberta no passo 4) rode:

```js
(await (await window.claude.use("user")).me()).id
```
Copie o resultado. Depois dê acesso gravando direto no emulador (o token `Bearer owner` ignora as regras, só vale no emulador). Troque `UID_DA_ANA` pelo valor copiado:

```bash
curl -s -X PATCH "http://127.0.0.1:8080/v1/projects/$(node -p "require('./app/firebase-config.json').projectId")/databases/(default)/documents/acessos/UID_DA_ANA?updateMask.fieldPaths=status" -H "Authorization: Bearer owner" -H "Content-Type: application/json" -d '{"fields":{"status":{"stringValue":"aceito"}}}'
```
Recarregue a página, termine o cadastro (onboarding) e abra o Coach.
Expected: o onboarding avança e o Coach responde (a resposta vem da função no emulador, com a chave do `.secret.local`).

- [ ] **Step 6: Testar a separação entre contas**

Abra uma janela anônima em `http://localhost:5000/?emu=1`, crie `bia@teste.com`. No console dela rode:

```js
await window.claude.use("db").then(db => db.doc("data/users/ID_DA_ANA/perfil").get().then(() => "LEU", e => "NEGADO"))
```
Expected: `NEGADO`.

- [ ] **Step 7: Parar o emulador e registrar o resultado**

Feche o emulador (Ctrl+C). Se algo falhou, corrija na task de origem antes de seguir. Não há commit nesta task.

---

### Task 8: Publicar (regras, função e hosting) e usar com amigos

**Files:**
- Modify: nenhum arquivo versionado.

**Interfaces:**
- Consumes: projeto Firebase real (Task 0), build (Task 5).
- Produces: PWA em `https://<projectId>.web.app/`, função `sample` ativa, dono definido.

Estes passos publicam em produção e usam a chave paga da Anthropic. Faça junto com o dono.

- [ ] **Step 1: Guardar a chave da Anthropic no Secret Manager**

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```
Expected: pede o valor (cole a chave) e confirma `Created a new secret version`. Pode pedir para ativar a API Secret Manager: aceite.

- [ ] **Step 2: Publicar regras, função e hosting**

```bash
npm run build:www && firebase deploy --only firestore:rules,functions,hosting
```
Expected: termina com `Deploy complete!` e mostra `Hosting URL: https://<projectId>.web.app`. A primeira publicação das funções pode pedir para ativar APIs (aceite) e levar alguns minutos.

- [ ] **Step 3: Criar a chave de serviço do dono (uma vez)**

No console: Configurações do projeto > Contas de serviço > Gerar nova chave privada. Salve fora do repositório, por exemplo em `~/tropa-service-account.json` (o `.gitignore` também barra `*-service-account.json`).

- [ ] **Step 4: Entrar no app uma vez e virar dono**

Abra `https://<projectId>.web.app/` no seu iPhone ou Mac e entre com a sua conta. Depois:

```bash
GOOGLE_APPLICATION_CREDENTIALS=$HOME/tropa-service-account.json node functions/scripts/definir-dono.js SEU_EMAIL
```
Expected: `Pronto. uid ... agora é o dono.` Feche e reabra o app.
Expected: aparece "Painel do dono" no Perfil e o app gerou o código de convite (`config/convite`).

- [ ] **Step 5: Instalar como PWA e testar com um amigo**

No iPhone: Safari > Compartilhar > Adicionar à Tela de Início. Abra pelo ícone. Peça a um amigo para fazer o mesmo e entrar com a conta dele; ele usa o seu código de convite.
Expected: o amigo cria o plano, o Coach responde, e vocês dois se veem no feed e em grupos sem enxergar os dados pessoais um do outro.

Se o login com Google falhar com `redirect_uri_mismatch`, adicione `https://<projectId>.web.app/__/auth/handler` em Google Cloud Console > APIs e serviços > Credenciais > Cliente OAuth web do Firebase > URIs de redirecionamento. Se o Google continuar falhando dentro da PWA instalada, o amigo usa "Criar conta com e-mail".

- [ ] **Step 6: Conferir custo e limite**

No console do Firebase, aba Uso e faturamento, confirme que o orçamento está em US$ 0 a poucos dólares, e crie um alerta de orçamento (por exemplo US$ 10). Na coleção `uso` do Firestore, confirme que aparecem contadores `uid_AAAA-MM-DD`.

---

### Task 9: App nativo no seu iPhone com Capacitor (opcional na fase 1)

**Files:**
- Create: `capacitor.config.ts`
- Create: `ios/` (gerado)
- Modify: `package.json` (dependências do Capacitor), `.gitignore`

**Interfaces:**
- Consumes: `app/www/` (Task 5), `window.Capacitor.Plugins.FirebaseAuthentication`, `Filesystem`, `Share` (usados pelo `claude-shim.js` da Task 4).
- Produces: app iOS que roda o mesmo código no iPhone do dono.

Pré-requisito: Xcode instalado e a conta Apple do dono logada no Xcode (conta gratuita serve, o app vence em 7 dias).

- [ ] **Step 1: Instalar o Capacitor e os plugins**

```bash
npm install @capacitor/core @capacitor/ios @capacitor/filesystem @capacitor/share @capacitor-firebase/authentication && npm install -D @capacitor/cli
```
Expected: instala sem erro.

- [ ] **Step 2: Criar `capacitor.config.ts`**

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.guilhermegomes.tropa",
  appName: "Tropa",
  webDir: "app/www",
  ios: { contentInset: "always" },
  plugins: {
    FirebaseAuthentication: { skipNativeAuth: true, providers: ["google.com"] }
  }
};

export default config;
```

- [ ] **Step 3: Gerar o projeto iOS**

```bash
npm run build:www && npx cap add ios && npx cap sync ios
```
Expected: cria `ios/` e termina com `Sync finished`.

- [ ] **Step 4: Configurar o login do Google no iOS (manual)**

No console do Firebase: Configurações do projeto > Seus apps > Adicionar app > iOS, com o ID do pacote `com.guilhermegomes.tropa`. Baixe `GoogleService-Info.plist` e coloque em `ios/App/App/`. Abra o projeto:

```bash
npx cap open ios
```
No Xcode: arraste `GoogleService-Info.plist` para o grupo `App` (marque "Copy items"). Em `Info.plist` > URL Types, acrescente um item cujo URL Scheme seja o valor de `REVERSED_CLIENT_ID` do `.plist`. Em Signing & Capabilities, escolha o seu Team.
Se preferir pular o Google nativo agora, o login por e-mail e senha já funciona no app.

- [ ] **Step 5: Rodar no iPhone**

Ligue o iPhone no Mac, escolha-o como destino no Xcode e aperte Run. Na primeira vez: iPhone > Ajustes > Geral > VPN e Gerenciamento de Dispositivo > confie na sua conta de desenvolvedor.
Expected: o app abre na tela de login, entra, e a IA responde. No Perfil, Exportar meus dados abre a folha de compartilhamento do iOS.

- [ ] **Step 6: Ignorar artefatos e commitar**

Acrescente ao `.gitignore`:

```
ios/App/Pods/
ios/App/build/
ios/App/App/public/
ios/App/App/GoogleService-Info.plist
```

```bash
git add capacitor.config.ts package.json package-lock.json .gitignore ios
git commit -m "feat: app iOS com Capacitor (mesmo código web, login por e-mail e Google nativo)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Documentação (README e spec)

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-11-02-app-fase1-firebase-capacitor-design.md`

**Interfaces:**
- Consumes: tudo acima.
- Produces: instruções para outra pessoa publicar a própria cópia e o spec alinhado ao que foi construído.

- [ ] **Step 1: Acrescentar a seção ao README**

Logo depois da seção "Importante: o app só roda no claude.ai", acrescente:

```markdown
## Rodar fora do claude.ai (PWA e app iOS)
O `publicar.html` também roda como PWA e como app iOS, com banco, login e IA no Firebase. O arquivo-fonte não muda: `npm run build:www` o envolve num `index.html` com um shim que reimplementa `window.claude`. Spec: `docs/superpowers/specs/2026-11-02-app-fase1-firebase-capacitor-design.md`. Plano: `docs/superpowers/plans/2026-11-02-app-fase1-firebase-capacitor.md`.

- `app/shim/`: o shim (`core.js` é a lógica testável; `claude-shim.js` liga ao Firebase).
- `functions/`: a função `sample` (IA). A chave da Anthropic fica no Secret Manager (`firebase functions:secrets:set ANTHROPIC_API_KEY`). Limite de 60 chamadas por pessoa por dia, o dono não tem limite.
- `firestore.rules`: as regras do banco. Teste com `npm run test:rules` (precisa de Java e do Firebase CLI).
- `npm run build:www` gera `app/www/`; `firebase deploy --only firestore:rules,functions,hosting` publica.
- Dono: entre no app uma vez e rode `GOOGLE_APPLICATION_CREDENTIALS=<chave> node functions/scripts/definir-dono.js <seu e-mail>`.
- iOS: `npm run build:www && npx cap sync ios && npx cap open ios`.
- Teste local sem tocar na produção: `firebase emulators:start --only auth,firestore,functions,hosting` e abra `http://localhost:5000/?emu=1`.
- Custos: Firebase no plano Blaze (cartão, gasto próximo de zero para poucos amigos) e créditos da API da Anthropic.
- Limitação aceita: `convites`, `vinculos`, `snap`, `prop` e `inbox` são legíveis e graváveis por qualquer pessoa logada (como no claude.ai); o conteúdo sensível é cifrado no navegador. Quem sabe o código de convite do app consegue criar o próprio `acessos`.
```

- [ ] **Step 2: Alinhar o spec ao que foi construído**

No spec, faça estas trocas:
- Na tabela do shim, a linha de `sample` passa a dizer: `limits()` devolve `{images:{maxInputBytes, maxCount, mediaTypes}}`; as imagens são reduzidas no navegador (JPEG, 1280 px) antes do envio.
- Em "Estrutura de pastas nova", troque `app/ : projeto Capacitor (...)` por `capacitor.config.ts e ios/ na raiz: projeto Capacitor; app/ : shim, scripts de build, ícones e a saída app/www/`.
- Em "Regras do Firestore", acrescente as linhas de `config`, `posts` (logado lê, só o dono grava), `convites`, `vinculos`, `snap`, `prop`, `inbox/{uid}/n` (logado lê e grava) e troque "Qualquer outro caminho: negado" mantendo-a no fim.
- Em "Login e papéis", troque a primeira linha por: `Entrada com Google (redirect no navegador, plugin nativo no Capacitor) e e-mail com senha como alternativa. A tela de login é do shim.`

- [ ] **Step 3: Rodar tudo uma última vez**

```bash
npm test && npm run test:rules
```
Expected: ambos terminam com `fail 0`.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-11-02-app-fase1-firebase-capacitor-design.md
git commit -m "docs: como rodar o Tropa fora do claude.ai e spec alinhado ao que foi construído

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Auto-revisão

**Cobertura do spec:** shim de `db/user/sample/downloads` (Tasks 1, 4); login Google e e-mail (4); papéis e claim de dono (2, 8); regras de todas as coleções (3); função da IA com limite diário, acesso e Secret Manager (2, 8); imagens (1, 4); PWA com manifest, service worker e ícones (5); Capacitor (9); build (5); custos (0, 8, 10); erros (login cancelado em `traduzirErroAuth`, IA via mensagens de `ErroApp`); testes (1, 2, 3, 5, 6, 7); fora do escopo respeitado. Lacuna conhecida e assumida: o modo do harness com o shim apontando para o emulador foi substituído pela verificação da Task 7 com `?emu=1`.

**Placeholders:** os únicos valores a preencher são dados que só o dono tem (config web do Firebase, chave da Anthropic, e-mail do dono), sempre com o comando ou lugar exato para obtê-los.

**Consistência de tipos:** `criarClaude(deps)` usa `autenticar`, `sair`, `chamarIA`, `baixar`, `paraBase64`, `db` e o `claude-shim.js` passa exatamente esses nomes. `chamarIA({prompt, imagens})` bate com `processar` (`data.prompt`, `data.imagens`) e a resposta `{json}` bate com `callable(...).data.json`. `LIMITES.maxCount = 3` bate com `MAX_IMAGENS = 3`. `montarIndex(fragmento, config, linkApp)` bate com o `build-www.js`. `LINK_APP` usa `window.TROPA_LINK`, o mesmo nome que `montarIndex` grava.
