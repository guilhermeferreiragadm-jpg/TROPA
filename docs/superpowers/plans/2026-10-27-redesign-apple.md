# Redesign Apple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer o visual e a interação do Tropa inteiro (todas as telas e sheets) com a linguagem de interfaces fluidas de iOS, mantendo marca, fluxos e lógica.

**Architecture:** Tudo continua no `publicar.html`. O CSS é reescrito do zero com tokens novos, **mantendo os nomes de classe existentes** (`.btn`, `.box`, `.ci`, `.sheet`, `.tabs`...) e redesenhando cada um, então o JS que gera marcação só muda onde a estrutura muda (Hoje, casca, onboarding, remoção de estilos inline). Um módulo `MOVIMENTO` novo (funções puras testáveis + camada de DOM) cuida de molas, sheets arrastáveis, transições, voltar por gesto e título grande. Um servidor local de verificação (`tests/harness/`) simula `window.claude` para ver cada tela fora do claude.ai.

**Tech Stack:** HTML/CSS/JS puro em arquivo único, `node --test` (Node 20+), navegador do app para verificação visual, sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-10-27-redesign-apple-design.md`

## Desvios da spec (decididos ao ler o código)

1. **Sheets têm um tamanho só** (altura do conteúdo, até 92% da tela), não dois. Os sheets do app são formulários e listas: num tamanho "médio" o fundo do conteúdo ficaria fora da tela e inalcançável. Arrastar para baixo fecha, com projeção de velocidade e rubber-band para cima.
2. **Arrastar o sheet só pela alça** (`.grab`, com área de toque de 44 px), não pelo corpo. Pointer Events de arraste vertical dentro de uma área rolável são cancelados pelo navegador no toque, e não dá para verificar gesto de toque com as ferramentas disponíveis.
3. **O chat continua sendo uma rota** (`R.tab === "chat"`, renderizada em `#app` com estado em `CHAT`), não um sheet. Ele sobe de baixo (`sobe`), fecha arrastando a alça do cabeçalho para baixo e tem um tamanho só.

Na Task 12 a spec é atualizada com esses três pontos.

## Global Constraints

- Marca fica: laranja `#FF5A00`, nome, logo, tema claro como padrão, escuro opcional por `data-tema="escuro"`.
- Fundo de botão com texto branco usa `#CF4500` (contraste 4,66:1); pressionado `#B53B00`; texto laranja sobre claro usa `#C23E00`; `#FF5A00` só em elementos sem texto.
- Fonte do sistema: `system-ui, -apple-system, "SF Pro Text", "Segoe UI", Roboto, sans-serif`. Só `Exo 2` itálico 900 continua, para a palavra do logo, pedindo apenas as letras (`&text=TROPAtropa`).
- Escala de texto em `rem`; sem caixa-alta em títulos; números com `font-variant-numeric: tabular-nums`.
- Raios 10, 14, 20, 28, 999. Grade de 4 px, margem lateral 16, espaço entre cartões 12, área de toque mínima 44 px.
- Materiais: fino `rgba(255,255,255,.6)` com blur 20px e saturação 180%; regular `.72`, 30px; grosso `.86`, 40px. `-webkit-backdrop-filter` junto. Sólido com `prefers-reduced-transparency: reduce` ou sem suporte.
- Molas (amortecimento, resposta em s): `suave` 1,0/0,40; `ligeiro` 1,0/0,30; `lancado` 0,8/0,30; `giro` 0,8/0,40.
- Pressão: `:active` com `scale(.97)` e `transition: transform 100ms ease-out`.
- Movimento guiado por gesto só anima `transform` e `opacity`, via `requestAnimationFrame`, e é interrompível.
- `prefers-reduced-motion: reduce`: sem molas, deslizes nem paralaxe; trocas viram fade de 200 ms. `prefers-reduced-transparency` e `prefers-contrast: more` tratados.
- A lógica, os dados, as coleções do banco e os textos do app não mudam.
- O arquivo final não passa de 110% do tamanho atual (582.931 bytes, ou seja, até 641.224).
- Cada tarefa termina com `node --test tests/*.test.js` passando e um commit na branch `redesign-apple`. Mensagens de commit terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Hífen e travessão não substituem vírgula em texto que o usuário lê (mensagens de commit, README, textos de tela).

## Mapa de arquivos

| Arquivo | O que faz |
|---|---|
| `publicar.html` | O app. CSS reescrito por tarefa; módulo `MOVIMENTO` novo; telas ajustadas. |
| `tests/movimento.test.js` (novo) | Testes das funções puras de movimento. |
| `tests/contraste.test.js` (novo) | Razão de contraste dos pares de cor dos tokens. |
| `tests/harness/servir.js` (novo) | Servidor Node que serve o app com `window.claude` simulado. |
| `tests/harness/stub.js` (novo) | Banco em memória, usuário de teste e perfil de exemplo. |
| `tests/harness/roteiro.md` (novo) | Lista de telas e como abrir cada uma no harness. |
| `.claude/launch.json` (novo) | Configuração para abrir o harness no painel de navegador. |
| `README.md` | Seção do redesign e do harness (Task 12). |

## Convenções do código existente

- O JS está numa IIFE; marcadores `/* @pure:start */ ... /* @pure:end */` delimitam o trecho puro que os testes extraem. O módulo novo usa `/* @movimento:start */ ... /* @movimento:end */` do mesmo jeito e fica logo depois do bloco `@pure`.
- Textos em português, nomes de função em português.
- Telas são funções `telaX()` que chamam `tela(html, opts)` e depois ligam eventos.
- Sheets são abertos com `$("ov").innerHTML = '<div class="dim" id="dim"></div><div class="sheet">...'` e fechados com `ov.innerHTML = ""`.

---

### Task 1: Servidor local de verificação e capturas de referência

**Files:**
- Create: `tests/harness/servir.js`
- Create: `tests/harness/stub.js`
- Create: `tests/harness/roteiro.md`
- Create: `.claude/launch.json`

**Interfaces:**
- Produces: servidor em `http://localhost:5173/` (`?perfil=0` abre sem perfil para ver o onboarding; `?tema=escuro` liga o tema escuro). No navegador, `window.__T` expõe `{ir, R, toast, celebrar, telaAbertura, telaCodigo, telaPlanoPronto, telaAssinatura, telaMatch, telaSubiu, nivelXP, onb, sheetCheckin, sheetPausar, sheetCompras, sheetPostar, sheetRetomar, sheetDocumento}` para abrir qualquer tela.

- [ ] **Step 1: Criar o stub de `window.claude`**

`tests/harness/stub.js` (roda no navegador, antes do app):

```js
(function(){
  const S = {}, ouvintes = {};
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const iso = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  const mais = n => { const d = new Date(hoje); d.setDate(d.getDate()+n); return d; };
  const q = new URLSearchParams(location.search);
  if (q.get("tema")==="escuro") document.documentElement.dataset.tema = "escuro";
  const me = "teste-1";
  if (q.get("perfil")!=="0"){
    S["data/users/"+me+"/perfil"] = {perfil:{
      apelido:"Gui", idade:28, sexo:"m", peso:78, altura:178, objetivo:"10k", temProva:"sim", dataProva:iso(mais(84)),
      corridasSem:3, kmSemana:20, maiorLongao:10, melhorTempo:"", academiaMeses:0, diasSem:4, horasDia:1, melhorHorario:"tarde", sono:7,
      q1:"nao", q2:"nao", q3:"nao", q4:"nao", q5:"nao", q6:"nao", q7:"nao", morte:"nao", ta:"nao", fumo:"nao", fratura:"nao",
      consent1:true, consent2:true, consentAt:new Date().toISOString(), termos:"2026-10-21", menor:false,
      compromisso:{treinos:4, ate:iso(mais(84)), at:new Date().toISOString()},
      assinatura:{plano:"mensal", valor:29.9, cupom:"", status:"teste", at:new Date().toISOString()}
    }, plano:{versao:1, semanas:[]}, viol:[], pausas:[]};   // versão 1 faz o app gerar o plano de novo ao entrar
  }
  const snap = (k) => ({id:k.split("/").pop(), exists:k in S, data:()=>S[k], metadata:{}});
  const avisar = (path) => (ouvintes[path]||[]).forEach(f=>f());
  const col = path => {
    const lista = () => Object.keys(S).filter(k=>k.startsWith(path+"/") && !k.slice(path.length+1).includes("/")).map(snap);
    const api = {
      doc:id=>{ const k = path+"/"+id; return {id, path:k,
        get:async()=>snap(k), set:async v=>{ S[k] = JSON.parse(JSON.stringify(v)); avisar(k); avisar(path); },
        update:async v=>{ S[k] = Object.assign(S[k]||{}, v); avisar(k); }, delete:async()=>{ delete S[k]; avisar(k); },
        onSnapshot:(f)=>{ (ouvintes[k] = ouvintes[k]||[]).push(()=>f(snap(k))); setTimeout(()=>f(snap(k)),0); return ()=>{}; },
        collection:p=>col(k+"/"+p) }; },
      get:async()=>{ const d = lista(); return {docs:d, size:d.length, empty:!d.length}; },
      onSnapshot:(f)=>{ (ouvintes[path] = ouvintes[path]||[]).push(()=>{ const d = lista(); f({docs:d, size:d.length, empty:!d.length}); }); setTimeout(()=>{ const d = lista(); f({docs:d, size:d.length, empty:!d.length}); },0); return ()=>{}; },
      add:async v=>{ const id = "a"+Date.now(); S[path+"/"+id] = v; return {id}; }
    };
    api.where = api.orderBy = api.limit = () => api;
    return api;
  };
  const db = {collection:col, doc:p=>{ const i = p.lastIndexOf("/"); return col(p.slice(0,i)).doc(p.slice(i+1)); }};
  window.claude = {use: async nome => {
    if (nome==="db") return db;
    if (nome==="user") return {me:async()=>({id:me, name:"Gui Teste", avatarUrl:"", isOwner:true}), can:async()=>true, profiles:async()=>({})};
    if (nome==="downloads") return {save:async()=>true};
    throw new Error("sem "+nome);   // "sample" (IA) não existe no harness
  }};
  window.__STUB = {S, iso, mais};
})();
```

- [ ] **Step 2: Criar o servidor**

`tests/harness/servir.js`:

```js
// Uso: node tests/harness/servir.js   (porta 5173)
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..", "..");
const stub = fs.readFileSync(path.join(__dirname, "stub.js"), "utf8");
const EXPOR = "window.__T = {ir, R, toast, celebrar, telaAbertura, telaCodigo, telaPlanoPronto, telaAssinatura, telaMatch, telaSubiu, nivelXP, onb, sheetCheckin, sheetPausar, sheetCompras, sheetPostar, sheetRetomar, sheetDocumento};\n";

http.createServer((req, res) => {
  if (!/^\/(\?.*)?$/.test(req.url)){ res.writeHead(404); return res.end("so /"); }
  let html = fs.readFileSync(path.join(raiz, "publicar.html"), "utf8");
  const fim = html.lastIndexOf("})();\n</script>");
  if (fim < 0){ res.writeHead(500); return res.end("não achei o fim do script"); }
  html = html.slice(0, fim) + EXPOR + html.slice(fim);
  html = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><script>" + stub + "</script></head><body>" + html + "</body></html>";
  res.writeHead(200, {"content-type":"text/html; charset=utf-8", "cache-control":"no-store"});
  res.end(html);
}).listen(5173, () => console.log("harness em http://localhost:5173/"));
```

O `<title>`, o `<link>` e o `<style>` do `publicar.html` ficam dentro do `<body>`, o que o navegador aceita.

- [ ] **Step 3: Configurar o painel de navegador**

`.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    {"name": "harness-tropa", "runtimeExecutable": "node", "runtimeArgs": ["tests/harness/servir.js"], "port": 5173}
  ]
}
```

- [ ] **Step 4: Escrever o roteiro de telas**

`tests/harness/roteiro.md`:

```markdown
# Roteiro de telas do harness

Abrir `http://localhost:5173/` (perfil de exemplo) e, no console da página, chamar `__T`. Largura de verificação: 390 px, também 360 e 430. Repetir com `?tema=escuro` e com `prefers-reduced-motion` ligado.

| Grupo | Como abrir |
|---|---|
| Hoje | `__T.ir("hoje")` |
| Check-in (sheet) | `__T.sheetCheckin()` |
| Pausa (sheet) | `__T.sheetPausar()` |
| Treino semana | `__T.ir("treino")` |
| Treino do dia | clicar num item da semana (abre `treino/treino`) |
| Comida | `__T.ir("comida")` |
| Lista de compras (sheet) | `__T.sheetCompras()` |
| Feed | `__T.ir("feed")` |
| Postar (sheet) | `__T.sheetPostar()` |
| Performance | `__T.ir("perf")` |
| Nível, Liga, Desafios, Grupo, Dupla | `__T.ir("perf","nivel")`, `"liga"`, `"desafios"`, `"ngrupo"`, `"dupla"` |
| Perfil | `__T.ir("perfil")` |
| Corpo, Extras | `__T.ir("perfil","corpo")`, `__T.ir("perfil","extras")` |
| Painel do dono | `__T.ir("painel")` |
| Chat | `__T.ir("chat")` |
| Fechar o dia, Nota | `__T.ir("hoje","checkout")`, `__T.ir("hoje","nota", <data AAAA-MM-DD>)` |
| Subiu de nível | `__T.telaSubiu(__T.nivelXP())` |
| Conquista | `__T.celebrar("Teste")` |
| Abertura, Código, Plano pronto, Assinatura, Match | `__T.telaAbertura()`, `telaCodigo()`, `telaPlanoPronto()`, `telaAssinatura()`, `telaMatch()` |
| Onboarding | abrir `?perfil=0`, tocar em entrar, e `__T.onb(0)` a `__T.onb(5)` |
```

- [ ] **Step 5: Subir o servidor e conferir a tela atual**

Run: `node tests/harness/servir.js` (em segundo plano) e abrir `http://localhost:5173/` no painel de navegador (`preview_start` com o nome `harness-tropa`).
Expected: aparece a tela Hoje com plano gerado (não a tela de abertura nem a de revisão). Se aparecer a tela de revisão ou de abertura, ler `window.__T` e o console: o motivo é um campo faltando no perfil de exemplo; ajuste `stub.js` até a tela Hoje abrir. Esse é o único passo de depuração da tarefa.

- [ ] **Step 6: Capturas de referência**

Para cada linha do roteiro, abrir a tela em 390 px e guardar uma captura mental ou em `/private/tmp/claude-502/-Users-guilhermegomes-TROPA/c08309fc-56cd-47ce-b1aa-44eb5951a7b3/scratchpad/antes/` (não entra no repositório). Servem de comparação nas próximas tarefas.

- [ ] **Step 7: Rodar os testes e commitar**

Run: `node --test tests/*.test.js`
Expected: todos passam (o harness não é testado e não toca no `publicar.html`).

```bash
git add tests/harness .claude/launch.json
git commit -m "test: servidor local de verificação com window.claude simulado

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Núcleo puro do movimento (molas, projeção, elástico, velocidade)

**Files:**
- Modify: `publicar.html` (inserir o bloco `@movimento` logo depois de `/* @pure:end */`)
- Create: `tests/movimento.test.js`

**Interfaces:**
- Produces (funções puras, usadas pelas Tasks 5 a 7):
  - `MOLAS`: `{suave:{amort:1,resposta:.4}, ligeiro:{amort:1,resposta:.3}, lancado:{amort:.8,resposta:.3}, giro:{amort:.8,resposta:.4}}`
  - `molaPasso(est:{x,v}, alvo:number, mola:{amort,resposta}, dt:number /*s*/): {x,v}`
  - `molaParada(est:{x,v}, alvo:number, tol:number): boolean`
  - `projetar(x:number, v:number /*px/s*/, d?:number = 0.998): number`
  - `elastico(sobra:number, dimensao:number): number`
  - `velocidade(amostras:{t:number /*ms*/, x:number}[]): number /*px/s*/`
  - `maisProximo(valor:number, alvos:number[]): number`
  - `tipoTransicao(antes:{tab,sub,arg}, depois:{tab,sub,arg}): "nenhuma"|"aba"|"push"|"pop"|"sobe"|"desce"`

- [ ] **Step 1: Escrever os testes que falham**

`tests/movimento.test.js`:

```js
// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const F = new Function(trecho("/* @movimento:start */", "/* @movimento:end */") + "\nreturn {MOLAS, molaPasso, molaParada, projetar, elastico, velocidade, maisProximo, tipoTransicao};")();

const simular = (mola, de, alvo, v0, seg) => { let e = {x:de, v:v0}, max = de; for (let t = 0; t < seg*120; t++){ e = F.molaPasso(e, alvo, mola, 1/120); if (e.x > max) max = e.x; } return {...e, max}; };

test("mola crítica chega ao alvo sem passar dele", () => {
  const r = simular(F.MOLAS.suave, 0, 100, 0, 1.5);
  assert.ok(Math.abs(r.x - 100) < 0.05, "x final " + r.x);
  assert.ok(r.max <= 100.01, "passou do alvo: " + r.max);
});

test("mola com amortecimento 0,8 passa do alvo e depois assenta", () => {
  const r = simular(F.MOLAS.lancado, 0, 100, 0, 2);
  assert.ok(r.max > 100.5, "devia ter overshoot, máx " + r.max);
  assert.ok(Math.abs(r.x - 100) < 0.05, "x final " + r.x);
});

test("a velocidade inicial é herdada: partir de v alta passa mais longe no começo", () => {
  const a = F.molaPasso({x:0, v:0}, 100, F.MOLAS.suave, 1/60).x;
  const b = F.molaPasso({x:0, v:1000}, 100, F.MOLAS.suave, 1/60).x;
  assert.ok(b > a + 10, a + " vs " + b);
});

test("o resultado não depende do tamanho do quadro", () => {
  const um = F.molaPasso({x:0, v:0}, 100, F.MOLAS.suave, 0.1).x;
  let e = {x:0, v:0}; for (let i = 0; i < 10; i++) e = F.molaPasso(e, 100, F.MOLAS.suave, 0.01);
  assert.ok(Math.abs(um - e.x) < 0.01, um + " vs " + e.x);
});

test("molaParada exige posição e velocidade pequenas", () => {
  assert.equal(F.molaParada({x:99.95, v:0.2}, 100, 0.1), true);
  assert.equal(F.molaParada({x:99.95, v:50}, 100, 0.1), false);
  assert.equal(F.molaParada({x:90, v:0}, 100, 0.1), false);
});

test("projetar usa a taxa de desaceleração (0,998 por padrão)", () => {
  assert.equal(Math.round(F.projetar(0, 1000)), 499);
  assert.equal(Math.round(F.projetar(0, 1000, 0.99)), 99);
  assert.equal(F.projetar(50, 0), 50);
  assert.equal(Math.round(F.projetar(300, -1000)), -199);
});

test("elástico: segue o dedo no começo e satura longe", () => {
  assert.ok(Math.abs(F.elastico(10, 400) - 10) < 1);
  assert.ok(F.elastico(1000, 400) < 400 * 0.55 * 1.001);
  assert.equal(F.elastico(0, 400), 0);
  assert.equal(F.elastico(-10, 400), -F.elastico(10, 400));
  assert.ok(F.elastico(200, 400) < 200);
});

test("velocidade usa só os últimos ~100 ms", () => {
  const am = [{t:0, x:0}, {t:100, x:500}, {t:200, x:510}, {t:260, x:516}];
  assert.equal(Math.round(F.velocidade(am)), 60);   // (516-510)/(260-200)*1000
  assert.equal(F.velocidade([{t:0, x:0}]), 0);
  assert.equal(F.velocidade([]), 0);
  assert.equal(F.velocidade([{t:5, x:0}, {t:5, x:9}]), 0);
});

test("velocidade de um arraste rápido", () => {
  const am = [{t:0, x:0}, {t:50, x:50}, {t:100, x:100}];
  assert.equal(Math.round(F.velocidade(am)), 1000);
});

test("maisProximo escolhe o alvo mais perto", () => {
  assert.equal(F.maisProximo(40, [0, 100]), 0);
  assert.equal(F.maisProximo(60, [0, 100]), 100);
  assert.equal(F.maisProximo(-5, [0, 100, 200]), 0);
});

test("tipoTransicao classifica as navegações", () => {
  const T = (a, b) => F.tipoTransicao(a, b);
  const hoje = {tab:"hoje", sub:null, arg:null};
  assert.equal(T(hoje, hoje), "nenhuma");
  assert.equal(T(hoje, {tab:"treino", sub:null, arg:null}), "aba");
  assert.equal(T({tab:"treino", sub:null, arg:null}, {tab:"treino", sub:"treino", arg:"2026-10-27~0"}), "push");
  assert.equal(T({tab:"treino", sub:"treino", arg:"x"}, {tab:"treino", sub:null, arg:null}), "pop");
  assert.equal(T({tab:"treino", sub:"treino", arg:"x"}, {tab:"treino", sub:"ex", arg:"Agachamento"}), "push");
  assert.equal(T({tab:"perf", sub:"grupo", arg:"1"}, {tab:"perf", sub:"grupo", arg:"2"}), "push");
  assert.equal(T(hoje, {tab:"chat", sub:null, arg:null}), "sobe");
  assert.equal(T({tab:"chat", sub:null, arg:null}, hoje), "desce");
  assert.equal(T({tab:"hoje", sub:"checkout", arg:null}, {tab:"perfil", sub:null, arg:null}), "aba");
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/movimento.test.js`
Expected: FAIL com "marcador não achado: /* @movimento:start */".

- [ ] **Step 3: Implementar o núcleo**

Em `publicar.html`, localizar `/* @pure:end */` e inserir logo depois:

```js
/* @movimento:start */
const MOLAS = {suave:{amort:1, resposta:.4}, ligeiro:{amort:1, resposta:.3}, lancado:{amort:.8, resposta:.3}, giro:{amort:.8, resposta:.4}};
// Mola de massa 1: rigidez (2π/resposta)², amortecimento 2·amort·(2π/resposta). Passo fixo de 1/120 s para não depender da taxa de quadros.
function molaPasso(est, alvo, mola, dt){
  const w = 2*Math.PI/mola.resposta, k = w*w, c = 2*mola.amort*w, passo = 1/120;
  let x = est.x, v = est.v, resto = dt;
  while (resto > 1e-9){ const h = Math.min(passo, resto); v += (-k*(x-alvo) - c*v)*h; x += v*h; resto -= h; }
  return {x, v};
}
function molaParada(est, alvo, tol){ return Math.abs(est.x-alvo) < tol && Math.abs(est.v) < tol*10; }
// Ponto de repouso de um arremesso: (v/1000)·d/(1-d), v em px/s.
function projetar(x, v, d){ d = d==null ? 0.998 : d; return x + (v/1000)*d/(1-d); }
// Resistência progressiva depois do limite (constante 0,55).
function elastico(sobra, dimensao){ const a = Math.abs(sobra); return Math.sign(sobra) * (a*dimensao*0.55)/(dimensao + 0.55*a); }
// px/s a partir dos pontos dos últimos ~100 ms.
function velocidade(am){
  if (!am || am.length < 2) return 0;
  const fim = am[am.length-1]; let ini = fim;
  for (let i = am.length-2; i >= 0; i--){ if (fim.t - am[i].t > 100) break; ini = am[i]; }
  const dt = fim.t - ini.t; return dt > 0 ? (fim.x - ini.x)/dt*1000 : 0;
}
function maisProximo(valor, alvos){ return alvos.reduce((a, b) => Math.abs(b-valor) < Math.abs(a-valor) ? b : a); }
// Como a tela nova entra, a partir da rota que saiu e da que chegou.
function tipoTransicao(a, b){
  if (a.tab===b.tab && a.sub===b.sub && a.arg===b.arg) return "nenhuma";
  if (a.tab!==b.tab) return b.tab==="chat" ? "sobe" : a.tab==="chat" ? "desce" : "aba";
  if (!a.sub && b.sub) return "push";
  if (a.sub && !b.sub) return "pop";
  return "push";
}
/* @movimento:end */
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/*.test.js`
Expected: todos passam, inclusive `movimento.test.js` e `sintaxe.test.js`.

- [ ] **Step 5: Commit**

```bash
git add publicar.html tests/movimento.test.js
git commit -m "feat: núcleo puro do movimento (molas, projeção, elástico, velocidade)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tokens, tipografia, materiais e base do CSS

**Files:**
- Modify: `publicar.html:1-3` (cabeçalho com fontes), `publicar.html:5-51` (comentário, `:root`, tema escuro, base e tipografia)
- Modify: `publicar.html` inteiro (troca mecânica dos nomes de token antigos)
- Create: `tests/contraste.test.js`

**Interfaces:**
- Produces (tokens usados por todas as tarefas seguintes): `--bg --surface --surface-2 --tx --tx-2 --sep --go --go-fill --go-press --go-ink --go-soft --go-line --done --done-ink --done-soft --done-line --caution --caution-soft --warn-ink --stop --stop-ink --stop-soft --run --swim --bike --gym --noite --r1 --r2 --r3 --r4 --sh1 --sh2 --sh3 --mat-fino --mat-reg --mat-grosso --f --f-wm --safe-b`. Variáveis de material aplicadas pela classe utilitária `.mat` (fino), `.mat-reg`, `.mat-grosso`.
- Os tokens `--paper --white --ink --mist --fog --graphite --go-btn --f-d --f-n --f-b` deixam de existir ao fim da tarefa.

- [ ] **Step 1: Escrever o teste de contraste (falha: tokens novos não existem)**

`tests/contraste.test.js`:

```js
// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const bloco = (ini) => { const i = html.indexOf(ini); assert.ok(i >= 0, "bloco não achado: " + ini); return html.slice(i, html.indexOf("}", i)); };
const tokens = (txt) => { const o = {}; for (const m of txt.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) o[m[1]] = m[2]; return o; };
const claro = tokens(bloco(":root{")), escuroSo = tokens(bloco(':root[data-tema="escuro"]{'));
const escuro = Object.assign({}, claro, escuroSo);

const lin = c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
const lum = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126*lin(n>>16&255) + 0.7152*lin(n>>8&255) + 0.0722*lin(n&255); };
const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q-p); return (x+0.05)/(y+0.05); };

// [texto, fundo, mínimo]: 4,5 para texto, 3 para elementos gráficos
const PARES = [
  ["tx","bg",4.5], ["tx","surface",4.5], ["tx","surface-2",4.5],
  ["tx-2","bg",4.5], ["tx-2","surface",4.5], ["tx-2","surface-2",4.5],
  ["#FFFFFF","go-fill",4.5], ["#FFFFFF","go-press",4.5],
  ["go-ink","surface",4.5], ["go-ink","bg",4.5], ["go-ink","go-soft",4.5],
  ["done-ink","surface",4.5], ["done-ink","done-soft",4.5],
  ["stop-ink","surface",4.5], ["stop-ink","stop-soft",4.5],
  ["warn-ink","surface",4.5], ["warn-ink","caution-soft",4.5],
  ["go","surface",3], ["done","surface",3], ["stop","surface",3], ["caution","surface",3]
];
const cor = (t, nome) => t[nome] || (nome.startsWith("#") ? nome : null);

for (const [nome, tema] of [["claro", claro], ["escuro", escuro]]){
  test("contraste no tema "+nome, () => {
    for (const [a, b, min] of PARES){
      const ca = cor(tema, a), cb = cor(tema, b);
      assert.ok(ca && cb, "token faltando: " + a + " ou " + b);
      const r = razao(ca, cb);
      assert.ok(r >= min, a + " (" + ca + ") sobre " + b + " (" + cb + ") = " + r.toFixed(2) + ", mínimo " + min);
    }
  });
}
```

Run: `node --test tests/contraste.test.js`
Expected: FAIL com "token faltando" (os tokens novos ainda não existem).

- [ ] **Step 2: Trocar o cabeçalho das fontes**

Linhas 1 a 3 do `publicar.html` passam a ser:

```html
<title>Tropa</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Exo+2:ital,wght@1,900&text=TROPAtropa&display=swap">
```

- [ ] **Step 3: Reescrever `:root`, tema escuro e base**

Substituir as linhas 5 a 51 (do comentário `/* Layout: ...` até o fim do `.wm i{...}`) por:

```css
/* Layout: app de celular numa coluna de até 480px sobre fundo agrupado; barra de abas de vidro flutuante com o botão Coach · Nutri ao lado; sheets arrastáveis.
   Tema claro por decisão do dono (não gosta de preto); laranja de marca só em elementos sem texto, fundo de botão com texto usa --go-fill; verde/amarelo/vermelho só para estado. */
:root{
  color-scheme:light;
  --bg:#F2F2F7; --surface:#FFFFFF; --surface-2:#F2F2F7; --tx:#0B0D10; --tx-2:#5A626C; --sep:rgba(60,60,67,.14);
  --go:#FF5A00; --go-fill:#CF4500; --go-press:#B53B00; --go-ink:#C23E00; --go-soft:#FFF1EC; --go-line:#FFC9B6;
  --done:#13A150; --done-ink:#0F7A3E; --done-soft:#EAF7EF; --done-line:#BFE6CE;
  --caution:#E5A100; --caution-soft:#FFF7E0; --warn-ink:#9A6B00;
  --stop:#E0362B; --stop-ink:#C62A20; --stop-soft:#FDECEA;
  --run:#FF5A00; --swim:#1E88E5; --bike:#E39A06; --gym:#6E56CF; --noite:#0B0D10;
  --r1:10px; --r2:14px; --r3:20px; --r4:28px;
  --sh1:0 1px 2px rgba(0,0,0,.06); --sh2:0 4px 16px rgba(0,0,0,.08); --sh3:0 12px 40px rgba(0,0,0,.18);
  --mat-fino:rgba(255,255,255,.6); --mat-reg:rgba(255,255,255,.72); --mat-grosso:rgba(255,255,255,.86); --mat-borda:rgba(255,255,255,.4);
  --f:system-ui,-apple-system,"SF Pro Text","Segoe UI",Roboto,sans-serif;
  --f-wm:"Exo 2",system-ui,sans-serif;
  --safe-b:env(safe-area-inset-bottom,0px);
}
*{box-sizing:border-box}
:root[data-tema="escuro"]{color-scheme:dark;--bg:#0F1317;--surface:#181D22;--surface-2:#20262C;--tx:#F2F4F6;--tx-2:#A7B0B9;--sep:rgba(255,255,255,.12);
  --go-ink:#FF8A4C;--go-soft:#2A1A12;--go-line:#6B2F12;--done-ink:#4ADE80;--done-soft:#12261B;--done-line:#1F5A38;--warn-ink:#F0B429;--caution-soft:#2B2410;--stop-ink:#FF7A70;--stop-soft:#2D1512;
  --sh1:0 1px 2px rgba(0,0,0,.4);--sh2:0 4px 16px rgba(0,0,0,.4);--sh3:0 12px 40px rgba(0,0,0,.6);
  --mat-fino:rgba(24,29,34,.6);--mat-reg:rgba(24,29,34,.72);--mat-grosso:rgba(24,29,34,.86);--mat-borda:rgba(255,255,255,.08)}
/* materiais: vidro com blur; sólido quando o usuário pede menos transparência ou o navegador não suporta */
.mat,.mat-reg,.mat-grosso{border:1px solid var(--mat-borda)}
.mat{background:var(--mat-fino);-webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%)}
.mat-reg{background:var(--mat-reg);-webkit-backdrop-filter:blur(30px) saturate(180%);backdrop-filter:blur(30px) saturate(180%)}
.mat-grosso{background:var(--mat-grosso);-webkit-backdrop-filter:blur(40px) saturate(160%);backdrop-filter:blur(40px) saturate(160%)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.mat,.mat-reg,.mat-grosso{background:var(--surface)}}
@media (prefers-reduced-transparency:reduce){.mat,.mat-reg,.mat-grosso{background:var(--surface);-webkit-backdrop-filter:none;backdrop-filter:none}}
@media (prefers-contrast:more){:root{--sep:rgba(0,0,0,.4);--tx-2:#3F464E}:root[data-tema="escuro"]{--sep:rgba(255,255,255,.4);--tx-2:#D2D8DE}.mat,.mat-reg,.mat-grosso{background:var(--surface);-webkit-backdrop-filter:none;backdrop-filter:none}}
[hidden]{display:none!important}
html,body{background:var(--bg);color:var(--tx);-webkit-text-size-adjust:100%}
body{font-family:var(--f);font-size:1rem;line-height:1.45;margin:0;-webkit-font-smoothing:antialiased}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
:focus-visible{outline:2px solid var(--go);outline-offset:2px}
img{max-width:100%}
.wrap{max-width:480px;margin:0 auto;min-height:100vh;position:relative;padding-bottom:calc(112px + var(--safe-b))}
#app{display:flex;flex-direction:column;gap:12px;padding-inline:16px;padding-block:calc(12px + env(safe-area-inset-top,0px)) 24px;transform-origin:50% 0}
#app.full{padding-inline:0;padding-block:0;gap:0}
/* tipografia: tracking negativo nos títulos, entrelinha curta; corpo solto */
.h1{font-weight:700;font-size:2.125rem;line-height:1.1;letter-spacing:-.03em;margin:0;text-wrap:balance}
.h2{font-weight:700;font-size:1.375rem;line-height:1.15;letter-spacing:-.02em;margin:0}
.k{font-size:.75rem;line-height:1.3;font-weight:600;letter-spacing:.01em;color:var(--tx-2)}
.s{font-size:.875rem;line-height:1.4;color:var(--tx-2);margin:0}
p{margin:0}
.n{font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.wm{font-family:var(--f-wm);font-style:italic;font-weight:900;font-size:1.15rem;letter-spacing:.03em;text-transform:uppercase;display:inline-flex;align-items:center;gap:8px}
```

E, logo depois do `.wm{...}`, **manter** a linha existente `.wm i{width:26px;height:18px;background:url("data:image/svg+xml,...")...}` (o logo, sem alteração).

- [ ] **Step 4: Trocar mecanicamente os tokens antigos no arquivo todo**

```bash
cd /Users/guilhermegomes/TROPA
sed -i '' \
 -e 's/var(--paper)/var(--bg)/g' \
 -e 's/var(--white)/var(--surface)/g' \
 -e 's/var(--fog)/var(--surface-2)/g' \
 -e 's/var(--mist)/var(--sep)/g' \
 -e 's/var(--graphite)/var(--tx-2)/g' \
 -e 's/var(--go-btn)/var(--go-fill)/g' \
 -e 's/var(--f-d)/var(--f)/g' -e 's/var(--f-n)/var(--f)/g' -e 's/var(--f-b)/var(--f)/g' \
 publicar.html
grep -c 'var(--ink)' publicar.html
```
Expected: o último comando mostra o que ainda usa `--ink` (cerca de 56). Esses são tratados nas tarefas de cada família, pela tabela abaixo. Para não deixar o app quebrado entre tarefas, **neste passo** definir um apelido temporário no `:root` e no tema escuro, que a Task 12 remove:

```css
  --ink:#0B0D10; /* TEMPORÁRIO: removido na Task 12, cada família troca os usos */
```
no `:root`, e `--ink:#46525D;` no bloco `:root[data-tema="escuro"]`.

Tabela de troca de `--ink` (aplicada em cada tarefa de família, ao reescrever o CSS da família):

| Uso antigo de `--ink` | Troca |
|---|---|
| cor de texto ou de borda neutra | `var(--tx)` |
| estado selecionado de `.seg button`, `.opt`, `.chip` | fundo `var(--go-soft)`, texto `var(--go-ink)`, `box-shadow:inset 0 0 0 1.5px var(--go)` |
| `.pill`, `.badge` com texto branco | fundo `var(--go-soft)`, texto `var(--go-ink)` |
| `.av`, `.me` (avatar) | fundo `var(--go-fill)`, texto `#fff` |
| botão escuro (`.btn.ink`) | estilo "tinted": fundo `var(--go-soft)`, texto `var(--go-ink)` |
| painéis escuros (`.rest`, `.pot`, `.toast`) | material `--mat-grosso` com texto `var(--tx)` |
| cartão escuro sobre foto (`.ph-card`) | `linear-gradient(160deg,#CF4500,#9A3300)` com texto `#fff` |
| barras e preenchimentos (`.bars i`, `.bar i`, `.xpbar`, `.sbars em`, `.cal i.f`) | `var(--go)` (são elementos sem texto) ou `var(--tx-2)` quando neutros |

- [ ] **Step 5: Corrigir os usos de tokens que mudaram de papel**

Trocar nos estilos e nas strings de JS:
- cores de texto de estado: `color:var(--done)` vira `color:var(--done-ink)`; `color:var(--stop)` vira `color:var(--stop-ink)` (apenas quando é cor de **texto**; fundo, borda e ícone continuam `--done` e `--stop`).
- `#0F5E33` (verde de texto no `.cupom` e `.m.sys`) vira `var(--done-ink)`.

Run: `grep -n 'color:var(--done)\|color:var(--stop)' publicar.html | head -40` e trocar cada um.

- [ ] **Step 6: Rodar os testes**

Run: `node --test tests/*.test.js`
Expected: todos passam, inclusive `contraste.test.js` nos temas claro e escuro. Se um par falhar, o teste mostra o valor: ajustar o token (por exemplo escurecer o `--go-ink`) até passar e manter a spec em dia.

- [ ] **Step 7: Conferir no navegador**

Abrir o harness em 390 px (claro e escuro). Expected: o app abre e funciona; fonte do sistema em tudo; as telas ainda têm cantos retos e visual antigo nos componentes (isso muda na Task 4), mas sem texto invisível ou faltando cor. Console sem erros.

- [ ] **Step 8: Commit**

```bash
git add publicar.html tests/contraste.test.js
git commit -m "feat: tokens, tipografia do sistema e materiais do redesign

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Componentes base (botões, campos, listas, cartões, avisos, toast)

**Files:**
- Modify: `publicar.html` (linhas do CSS de `/* botões */` até `.box.strong`, mais `.toast`, `.lst`, `.tbl`, `.cupom`, `.ul`, `.hint`, `.flag`, `.chips`, `.prog`)

**Interfaces:**
- Consumes: tokens da Task 3.
- Produces: regra de pressão compartilhada e componentes com estados normal, pressionado, desativado e foco. Classes: `.btn` (`.go`, `.ink`, `.ghost`, `.sm`), `.lk`, `.back`, `.fld`, `.inp`, `.seg`, `.opt`, `.chk`, `.prog`, `.msg`, `.hint`, `.flag` (`.red`, `.ok`), `.chips`, `.chip`, `.pill`, `.line`, `.box` (`.strong`), `.lst`, `.toast`.

- [ ] **Step 1: Substituir o bloco de botões, formulário e componentes genéricos**

Substituir, no CSS, tudo de `/* botões */` até a linha `.box.strong{...}` (inclusive) por:

```css
/* pressão: feedback no pointerdown, sem espera */
.btn,.chip,.seg button,.opt,.pl,.ci,.pf-link,.nav4 button,.lst>button,.lst>a,.wrow,.mhead button,.mcal button,.lk,.thumbs button,.ck,.kudo{transition:transform .1s ease-out,background-color .15s ease-out,box-shadow .15s ease-out}
.btn:active,.chip:active,.seg button:active,.ck:active,.kudo:active,.mhead button:active,.thumbs button:active{transform:scale(.97)}
.opt:active,.pl:active,.ci:active,.pf-link:active,.nav4 button:active,.lst>button:active,.lst>a:active,.wrow:active,.mcal button:active{transform:scale(.985)}
/* botões */
.btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;border:0;border-radius:var(--r2);background:var(--surface-2);color:var(--tx);font-weight:600;font-size:1.0625rem;letter-spacing:-.01em;width:100%;padding:0 16px;text-decoration:none;text-align:center}
.btn.go{background:var(--go-fill);color:#fff}.btn.go:active{background:var(--go-press)}
.btn.ink{background:var(--go-soft);color:var(--go-ink)}
.btn.ghost{background:transparent;box-shadow:inset 0 0 0 1px var(--sep)}
.btn.sm{min-height:38px;font-size:.9375rem;width:auto;border-radius:999px;padding:0 14px}
.btn:disabled{opacity:.4;cursor:default;transform:none}
.lk{border:0;background:none;font-weight:600;font-size:.9375rem;padding:10px;align-self:center;color:var(--go-ink)}
.back{border:0;background:none;font-weight:600;font-size:1.0625rem;padding:10px 10px 10px 0;margin-left:-4px;align-self:flex-start;display:inline-flex;gap:4px;align-items:center;color:var(--go-ink);min-height:44px}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.between{display:flex;justify-content:space-between;align-items:center;gap:10px}
.stack{display:flex;flex-direction:column;gap:10px}
/* formulário */
.fld{display:flex;flex-direction:column;gap:6px}
.fld>label,.lbl{font-size:.8125rem;font-weight:600;color:var(--tx-2)}
.inp{min-height:48px;border:0;border-radius:var(--r1);background:var(--surface-2);padding:10px 14px;width:100%;box-shadow:inset 0 0 0 1px transparent;transition:box-shadow .15s ease-out,background-color .15s}
.inp:focus{background:var(--surface);box-shadow:inset 0 0 0 2px var(--go);outline:none}
textarea.inp{resize:vertical;min-height:88px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.seg{display:grid;gap:2px;grid-template-columns:repeat(var(--c,4),minmax(0,1fr));background:var(--surface-2);border-radius:var(--r1);padding:2px}
.seg button{border:0;border-radius:8px;min-height:40px;font-weight:600;font-size:.9375rem;background:transparent;padding:4px}
.seg button[aria-pressed="true"]{background:var(--surface);color:var(--go-ink);box-shadow:var(--sh1),inset 0 0 0 1.5px var(--go)}
.opt{border:0;border-radius:var(--r2);padding:12px;display:flex;align-items:center;gap:12px;background:var(--surface);box-shadow:var(--sh1);width:100%;text-align:left}
.opt b{display:block;font-weight:600}.opt small{color:var(--tx-2);font-size:.8125rem;display:block}
.opt[aria-pressed="true"]{background:var(--go-soft);box-shadow:inset 0 0 0 1.5px var(--go)}
.opt .ic{width:36px;height:36px;flex:none;display:grid;place-content:center;font-weight:700;font-size:.8125rem;background:var(--surface-2);border-radius:10px}
.opt[aria-pressed="true"] .ic{background:var(--go-fill);color:#fff}
.chk{display:flex;gap:12px;align-items:flex-start;font-size:.9375rem;line-height:1.4;cursor:pointer}
.chk input{width:24px;height:24px;flex:none;accent-color:var(--go-fill);margin:0}
.prog{display:flex;gap:4px}.prog i{flex:1;height:4px;border-radius:2px;background:var(--sep);transition:background-color .3s}.prog i.on{background:var(--go)}
.msg{font-size:.875rem;font-weight:600;min-height:1em}
.msg.err{color:var(--stop-ink)}
.hint{background:var(--surface-2);border-radius:var(--r1);padding:12px 14px;font-size:.875rem;color:var(--tx-2)}
.hint b{color:var(--tx)}
.flag{border-radius:var(--r2);background:var(--caution-soft);padding:12px 14px;font-size:.9375rem;box-shadow:inset 3px 0 0 var(--caution)}
.flag.red{background:var(--stop-soft);box-shadow:inset 3px 0 0 var(--stop)}
.flag.ok{background:var(--done-soft);box-shadow:inset 3px 0 0 var(--done)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips span,.chip{font-size:.8125rem;font-weight:600;padding:6px 12px;border-radius:999px;background:var(--surface-2);border:0}
.chip[aria-pressed="true"]{background:var(--go-soft);color:var(--go-ink);box-shadow:inset 0 0 0 1.5px var(--go)}
.pill{font-size:.6875rem;font-weight:600;padding:3px 8px;border-radius:999px;color:var(--go-ink);background:var(--go-soft);display:inline-block}
.line{border-top:1px solid var(--sep)}
.box{border-radius:var(--r2);padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--surface);box-shadow:var(--sh1)}
.box.strong{box-shadow:var(--sh2),inset 0 0 0 1.5px var(--go)}
@media (prefers-contrast:more){.box,.opt,.ci{box-shadow:inset 0 0 0 1px var(--sep)}}
```

- [ ] **Step 2: Substituir o toast, as listas e as tabelas**

Substituir as regras `.lst...`, `.lst small`, `.code`, `.tbl...`, `.tblw`, `.demo-ban`, `.toast`, `.toast.on` (todas no bloco "perfil, painel") por:

```css
.lst{display:flex;flex-direction:column;background:var(--surface);border-radius:var(--r2);box-shadow:var(--sh1);overflow:hidden}
.lst>button,.lst>a{display:flex;justify-content:space-between;align-items:center;gap:10px;border:0;border-bottom:1px solid var(--sep);background:none;padding:14px 16px;font-weight:600;text-align:left;width:100%;color:var(--tx);text-decoration:none;min-height:50px}
.lst>button:last-child,.lst>a:last-child{border-bottom:0}
.lst small{display:block;font-weight:400;color:var(--tx-2);font-size:.8125rem}
.code{font-weight:700;font-size:1.8rem;letter-spacing:.12em;font-variant-numeric:tabular-nums}
.tbl{width:100%;border-collapse:collapse;font-size:.875rem}
.tbl th{font-size:.75rem;font-weight:600;color:var(--tx-2);text-align:left;padding:6px 4px;border-bottom:1px solid var(--sep)}
.tbl td{padding:8px 4px;border-bottom:1px solid var(--sep);vertical-align:top}
.tblw{overflow-x:auto}
.demo-ban{background:var(--caution-soft);padding:10px 16px;font-size:.8125rem;display:flex;flex-direction:column;gap:6px}
.toast{position:fixed;left:50%;bottom:calc(112px + var(--safe-b));transform:translate(-50%,16px) scale(.96);background:var(--mat-grosso);-webkit-backdrop-filter:blur(40px) saturate(160%);backdrop-filter:blur(40px) saturate(160%);color:var(--tx);box-shadow:var(--sh3);border-radius:999px;padding:12px 18px;font-weight:600;font-size:.9375rem;opacity:0;transition:opacity .25s ease-out,transform .35s cubic-bezier(.32,.72,0,1);z-index:80;max-width:min(440px,calc(100% - 32px));text-align:center;pointer-events:none}
.toast.on{opacity:1;transform:translate(-50%,0) scale(1)}
@media (prefers-reduced-motion:reduce){.toast{transform:translate(-50%,0)}}
@media (prefers-reduced-transparency:reduce){.toast{background:var(--surface);-webkit-backdrop-filter:none;backdrop-filter:none}}
```

(O `z-index` original do toast fica como estava; ler a linha antiga antes de apagar e manter o valor.)

- [ ] **Step 3: Remover os estilos inline estáticos dos componentes base**

Run: `grep -nE "style=\"[^\"+']*\"" publicar.html | head -60` mostra os estilos inline sem concatenação. Para os que pertencem aos componentes deste passo (campos, listas, avisos dos formulários), trocar por classes utilitárias adicionadas ao fim do bloco de componentes:

```css
.mt0{margin-top:0}.tc{text-align:center}.upper{text-transform:uppercase}.cor-go{color:var(--go-ink)}.cor-2{color:var(--tx-2)}.cor-ok{color:var(--done-ink)}.cor-ruim{color:var(--stop-ink)}.w600{font-weight:600}.mw0{min-width:0}.grow{flex:1;min-width:0}
```
Exemplo: `<b style="font-weight:600">` vira `<b class="w600">`; `style="color:var(--go-ink)"` vira `class="cor-go"`; `style="text-transform:uppercase"` vira `class="inp upper"`. Cada estilo inline que sobrar com valor dinâmico (cor de modalidade, largura de barra) passa a usar variável: `style="--c:..."`.

- [ ] **Step 4: Conferir no navegador**

Abrir o harness em 390 px (claro e escuro) e passar por: Hoje, Perfil, abrir o sheet de check-in (`__T.sheetCheckin()`), tocar em botões e campos. Expected: botões arredondados e com aperto visível ao pressionar; campos com anel laranja no foco; listas agrupadas no Perfil; toast em cápsula de vidro (disparar com `__T.toast("Teste")`). Nenhum texto sumido, console sem erros.

- [ ] **Step 5: Rodar os testes e commitar**

Run: `node --test tests/*.test.js`
Expected: todos passam.

```bash
git add publicar.html
git commit -m "feat: componentes base do redesign (botões, campos, listas, cartões, toast)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Casca visual (barra de abas, botão Coach, cabeçalho de título)

**Files:**
- Modify: `publicar.html` (CSS de `/* tabs */` e `.fab`; HTML `<nav class="tabs">` e `<button class="fab">` perto da linha 432; `ICONE`; `tela()`)

**Interfaces:**
- Consumes: tokens e `.mat` da Task 3.
- Produces: HTML da casca (usado pelas Tasks 6 e 7):

```html
<header class="cab mat" id="cab" aria-hidden="true"><span></span></header>
<div id="ban"></div>
<main id="app" aria-live="polite"></main>
<nav class="tabs" id="tabs" hidden aria-label="Abas">
  <div class="tabs-pill mat"><span class="tabs-ind" id="tabs-ind" aria-hidden="true"></span> ...cinco botões... </div>
  <button type="button" class="fab mat" id="fab" hidden aria-label="Coach · Nutri" title="Coach · Nutri">ícone</button>
</nav>
<div id="ov"></div>
```

  e `ICONE.coach` (SVG do botão). Os ids `ban`, `app`, `tabs`, `fab`, `ov` continuam existindo.

- [ ] **Step 1: Trocar o HTML da casca**

Substituir o bloco `<div class="wrap"> ... </div>` (linhas 432 a 444) por:

```html
<div class="wrap">
  <header class="cab mat" id="cab" aria-hidden="true"><span></span></header>
  <div id="ban"></div>
  <main id="app" aria-live="polite"></main>
  <nav class="tabs" id="tabs" hidden aria-label="Abas">
    <div class="tabs-pill mat">
      <span class="tabs-ind" id="tabs-ind" aria-hidden="true"></span>
      <button type="button" class="t-hoje" data-tab="hoje"><i></i>Hoje</button>
      <button type="button" class="t-treino" data-tab="treino"><i></i>Treino</button>
      <button type="button" class="t-feed" data-tab="feed"><i></i>Feed</button>
      <button type="button" class="t-comida" data-tab="comida"><i></i>Comida</button>
      <button type="button" class="t-perf" data-tab="perf"><i></i>Performance</button>
    </div>
    <button type="button" class="fab mat" id="fab" hidden aria-label="Coach · Nutri" title="Coach · Nutri"></button>
  </nav>
  <div id="ov"></div>
</div>
```

- [ ] **Step 2: Adicionar o ícone do Coach e montá-lo**

No objeto `ICONE` (perto da linha 3523), acrescentar depois de `perf: ...,`:

```js
  coach: SV('<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M12 8.3l.9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9z"/>'),
```

Em `montarIcones()` (logo abaixo), antes do fechamento da função, acrescentar:

```js
  const fab = $("fab"); if (fab && !fab.firstChild) fab.innerHTML = ICONE.coach;
```

O `SV` fixa o SVG em 22 px; o CSS de `.fab svg` (Step 3) leva o ícone a 26 px.

- [ ] **Step 3: Reescrever o CSS de abas, botão e cabeçalho**

Substituir as regras de `/* tabs */` (`.tabs`, `.tabs button`, `.tabs button i`, `.tabs .tico`, `.tabs .t-*`, `.tabs button[aria-selected]`, `.tabs em`) e a regra `.fab` por:

```css
/* barra de abas flutuante de vidro + botão Coach · Nutri ao lado */
.cab{position:fixed;top:0;left:0;right:0;margin:0 auto;width:min(480px,100%);height:calc(48px + env(safe-area-inset-top,0px));padding-top:env(safe-area-inset-top,0px);display:flex;align-items:center;justify-content:center;z-index:25;opacity:0;pointer-events:none;border-width:0 0 1px;border-color:transparent;transition:opacity .2s ease-out,border-color .2s}
.cab.on{opacity:1;border-color:var(--sep)}
.cab span{font-weight:600;font-size:1.0625rem;letter-spacing:-.01em}
.tabs{position:fixed;left:0;right:0;margin:0 auto;width:min(480px,100%);bottom:calc(8px + var(--safe-b));padding:0 12px;display:flex;gap:8px;align-items:center;z-index:30}
.tabs-pill{flex:1;min-width:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-radius:999px;padding:4px;position:relative;box-shadow:var(--sh2)}
.tabs-ind{position:absolute;top:4px;bottom:4px;left:0;width:0;border-radius:999px;background:var(--go-soft);z-index:0;will-change:transform}
.tabs button{position:relative;z-index:1;border:0;background:none;padding:6px 0 5px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:.625rem;line-height:1.2;font-weight:600;color:var(--tx-2);min-height:48px;transition:color .15s}
.tabs button:active{transform:scale(.97)}
.tabs .tico{width:24px;height:24px;display:grid;place-content:center}
.tabs .tico svg{width:22px;height:22px}
.tabs button[aria-selected="true"]{color:var(--go-ink)}
.tabs em{position:absolute;top:3px;left:calc(50% + 6px);background:var(--go-fill);color:#fff;font-style:normal;font-size:.625rem;font-weight:600;min-width:16px;height:16px;border-radius:8px;display:grid;place-content:center;padding:0 4px}
.fab{flex:none;width:56px;height:56px;border-radius:50%;padding:0;display:grid;place-content:center;color:var(--go-ink);box-shadow:var(--sh2);transition:transform .1s ease-out}
.fab:active{transform:scale(.95)}
.fab svg{width:26px;height:26px}
```

Apagar as regras antigas `.tabs .t-hoje i{...}` a `.tabs .t-perf i{...}` (ícones de CSS), porque `montarIcones()` já troca cada `<i>` por SVG.

- [ ] **Step 4: Mostrar o cabeçalho de título em `tela()` (só estrutura; o comportamento vem na Task 7)**

Em `tela()` (linha ~1664), logo depois de `app.innerHTML = html;`, acrescentar:

```js
  const cab = $("cab"); if (cab){ cab.classList.remove("on"); const h1 = app.querySelector("h1.h1"); cab.firstChild.textContent = h1 ? h1.textContent : ""; }
```

- [ ] **Step 5: Conferir no navegador**

Abrir o harness em 390, 360 e 430 px. Expected: barra de abas em pílula de vidro flutuando com o botão redondo do Coach à direita; 5 rótulos legíveis, incluindo "Performance"; o selecionado em laranja (o indicador ainda não desliza, isso é da Task 7). Se "Performance" não couber em 360 px, aplicar o plano B da spec: `.fab{position:absolute;right:12px;bottom:calc(100% + 8px)}` e `.tabs-pill{flex:1}` ocupando a largura toda, e conferir de novo. Clicar no botão Coach abre o chat. Claro e escuro.

- [ ] **Step 6: Rodar os testes e commitar**

Run: `node --test tests/*.test.js`
Expected: todos passam.

```bash
git add publicar.html
git commit -m "feat: barra de abas de vidro e botão Coach ao lado

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Camada de movimento no DOM e sheets arrastáveis

**Files:**
- Modify: `publicar.html` (módulo `MOVIMENTO` no JS, CSS de `/* folha (sheet) */`, todos os `ov.innerHTML = ""`)
- Modify: `tests/harness/servir.js` (expor `Mov` e `fecharSheet`)

**Interfaces:**
- Consumes: `MOLAS`, `molaPasso`, `molaParada`, `projetar`, `elastico`, `velocidade` da Task 2.
- Produces:
  - `const Mov` com: `Mov.reduz(): boolean`, `Mov.estado(el)`, `Mov.aplicar(el)`, `Mov.para(el, alvo:{x?,y?,s?,o?}, preset:string, vel?:{x?,y?}): Promise<void>`, `Mov.arrastarFechar(el, alca, {altura:()=>number, aoMover?, aoFechar:(vy:number)=>void})`.
  - `fecharSheet(vy?: number): void` (substitui todo `ov.innerHTML = ""`).
  - Sheets abertos como hoje (`ov.innerHTML = '<div class="dim" id="dim"></div><div class="sheet">...'`) são "montados" sozinhos (entrada por mola, alça arrastável, scrim proporcional) por um `MutationObserver` em `#ov`.

- [ ] **Step 1: Adicionar o módulo `MOVIMENTO` (camada de DOM)**

Logo depois de `/* @movimento:end */`, inserir:

```js
/* ===================== MOVIMENTO (DOM) ===================== */
const Mov = (() => {
  const reduz = () => { try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };
  const estado = el => el._m || (el._m = {x:0, y:0, s:1, o:1, vx:0, vy:0, vs:0, vo:0, raf:0, alAplicar:null});
  // no repouso o elemento fica sem transform nem opacity, para não criar contexto de empilhamento à toa
  function aplicar(el){
    const m = estado(el), repouso = !m.x && !m.y && m.s===1 && m.o===1;
    el.style.transform = repouso ? "" : "translate3d("+m.x+"px,"+m.y+"px,0) scale("+m.s+")";
    el.style.opacity = m.o===1 ? "" : String(m.o);
    if (m.alAplicar) m.alAplicar(m);
  }
  // Anima rumo ao alvo a partir do valor VIVO (m.x, m.y...), herdando a velocidade em px/s. Cada eixo tem a sua mola.
  function para(el, alvo, preset, vel){
    const m = estado(el), mola = MOLAS[preset || "suave"], eixos = ["x","y","s","o"].filter(k => alvo[k]!=null);
    cancelAnimationFrame(m.raf);
    if (vel) for (const k in vel) m["v"+k] = vel[k];
    if (reduz()){
      el.style.transition = "opacity 200ms ease";
      eixos.forEach(k => { m[k] = alvo[k]; m["v"+k] = 0; }); aplicar(el);
      return new Promise(r => setTimeout(() => { el.style.transition = ""; r(); }, 200));
    }
    return new Promise(res => {
      let t0 = performance.now();
      const tick = t => {
        const dt = Math.min((t - t0)/1000, 0.064); t0 = t; let parado = true;
        for (const k of eixos){
          const r = molaPasso({x:m[k], v:m["v"+k]||0}, alvo[k], mola, dt); m[k] = r.x; m["v"+k] = r.v;
          if (!molaParada(r, alvo[k], (k==="s"||k==="o") ? 0.002 : 0.2)) parado = false;
        }
        if (parado){ eixos.forEach(k => { m[k] = alvo[k]; m["v"+k] = 0; }); aplicar(el); res(); }
        else { aplicar(el); m.raf = requestAnimationFrame(tick); }
      };
      m.raf = requestAnimationFrame(tick);
    });
  }
  // Arrastar uma alça para baixo: 1:1 com o dedo mantendo o ponto de pega, elástico para cima, projeção na soltura.
  function arrastarFechar(el, alca, o){
    let ativo = false, y0 = 0, off0 = 0, am = [];
    alca.style.touchAction = "none";
    alca.addEventListener("pointerdown", e => {
      if (e.button > 0) return;
      ativo = true; alca.setPointerCapture(e.pointerId);
      const m = estado(el); cancelAnimationFrame(m.raf); y0 = e.clientY; off0 = m.y; am = [{t:e.timeStamp, x:e.clientY}];
    });
    alca.addEventListener("pointermove", e => {
      if (!ativo) return;
      const m = estado(el), bruto = off0 + (e.clientY - y0);
      m.y = bruto < 0 ? elastico(bruto, o.altura()) : bruto;
      am.push({t:e.timeStamp, x:e.clientY}); if (am.length > 8) am.shift();
      aplicar(el); if (o.aoMover) o.aoMover(m);
    });
    const fim = () => {
      if (!ativo) return; ativo = false;
      const m = estado(el), v = velocidade(am), h = o.altura();
      if (projetar(m.y, v) > h*0.5) o.aoFechar(v);
      else para(el, {y:0}, "lancado", {y:v});
    };
    alca.addEventListener("pointerup", fim); alca.addEventListener("pointercancel", fim);
  }
  return {reduz, estado, aplicar, para, arrastarFechar};
})();
```

- [ ] **Step 2: Adicionar a montagem e o fechamento de sheets**

Logo depois do `Mov`, inserir:

```js
/* sheets: quem abre continua escrevendo em #ov; o observador monta o sheet (entrada por mola, alça, scrim) antes do primeiro quadro */
function fecharSheet(vy){
  const ov = $("ov"), s = ov.querySelector(".sheet"), limpar = () => { ov.innerHTML = ""; document.documentElement.classList.remove("sheet-aberta"); };
  if (!s){ limpar(); return; }
  if (s.dataset.fechando) return;
  s.dataset.fechando = "1";
  const h = s.offsetHeight || 400;
  Mov.para(s, Mov.reduz() ? {o:0} : {y:h}, "suave", vy ? {y:vy} : null).then(() => { if (ov.querySelector(".sheet")===s) limpar(); });
}
function montarSheet(ov, s){
  s.dataset.m = "1";
  const dim = ov.querySelector(".dim"), h = () => s.offsetHeight || 400, m = Mov.estado(s);
  m.alAplicar = () => { if (dim) dim.style.opacity = String(Math.max(0, Math.min(1, m.y > 0 ? 1 - m.y/h() : 1))); };
  if (dim && !dim.dataset.m){ dim.dataset.m = "1"; dim.addEventListener("click", () => fecharSheet()); }
  document.documentElement.classList.add("sheet-aberta");
  if (Mov.reduz()){ m.y = 0; m.o = 0; Mov.aplicar(s); void s.offsetWidth; Mov.para(s, {o:1}); }
  else { m.y = h(); Mov.aplicar(s); Mov.para(s, {y:0}, "suave"); }
  const alca = s.querySelector(".grab"); if (alca) Mov.arrastarFechar(s, alca, {altura:h, aoFechar:fecharSheet});
}
new MutationObserver(() => { const ov = $("ov"), s = ov && ov.querySelector(".sheet:not([data-m])"); if (s) montarSheet(ov, s); else if (ov && !ov.firstChild) document.documentElement.classList.remove("sheet-aberta"); }).observe($("ov"), {childList:true});
```

Observação: o `dim` já tem handlers de clique escritos por quem abre o sheet (`$("dim").addEventListener("click", fecha)`); o handler extra do observador chama `fecharSheet()`, que é idempotente (`dataset.fechando`).

- [ ] **Step 3: Trocar todos os fechamentos por `fecharSheet()`**

```bash
cd /Users/guilhermegomes/TROPA
grep -n 'ov.innerHTML = ""' publicar.html | cut -c1-140
sed -i '' 's/ov\.innerHTML = "";/fecharSheet();/g' publicar.html
grep -n 'ov.innerHTML = ""' publicar.html
```
Expected: o primeiro `grep` lista os sites antigos (`fecha = () => { ov.innerHTML = ""; }`, `sair()`, etc.); o segundo não lista nada, exceto a linha dentro de `fecharSheet`/`limpar` do Step 2, que usa `ov.innerHTML = ""` sem ponto e vírgula colado em `}`: conferir que só ela sobra. Em `sair()`, o `$("ov").innerHTML = ""` vira `fecharSheet()` também (é seguro: se não há sheet, `limpar()` roda direto).

Em `copiar()` (linha ~2687), que procura `ov.querySelector(".sheet")` para mostrar mensagem dentro do sheet aberto, nada muda.

- [ ] **Step 4: Reescrever o CSS do sheet**

Substituir as regras `.dim`, `.sheet`, `.grab` por:

```css
/* folha (sheet): material regular, topo arredondado, alça com área de toque de 44px */
.dim{position:fixed;inset:0;background:rgba(11,13,16,.4);z-index:40}
.sheet{position:fixed;left:0;right:0;margin:0 auto;bottom:0;width:min(480px,100%);max-height:92vh;overflow-y:auto;overscroll-behavior:contain;background:var(--mat-grosso);-webkit-backdrop-filter:blur(40px) saturate(160%);backdrop-filter:blur(40px) saturate(160%);border-radius:var(--r4) var(--r4) 0 0;box-shadow:var(--sh3);padding:8px 16px calc(24px + var(--safe-b));display:flex;flex-direction:column;gap:12px;z-index:50;will-change:transform}
.sheet .box,.sheet .opt{background:var(--surface)}
.grab{position:relative;display:block;height:28px;margin:0 -16px -8px;flex:none;cursor:grab}
.grab::after{content:"";position:absolute;left:50%;top:8px;width:38px;height:5px;margin-left:-19px;border-radius:3px;background:var(--sep);filter:brightness(.8)}
#rsb,#rsx{display:flex;flex-direction:column;gap:12px}
.sheet-aberta #app{transform:scale(.97);transition:transform .4s cubic-bezier(.32,.72,0,1)}
@media (prefers-reduced-motion:reduce){.sheet-aberta #app{transform:none}}
@media (prefers-reduced-transparency:reduce){.sheet{background:var(--surface);-webkit-backdrop-filter:none;backdrop-filter:none}}
@media (prefers-contrast:more){.sheet{background:var(--surface);box-shadow:0 0 0 1px var(--sep),var(--sh3)}}
```

(Ler a linha antiga de `.sheet` e conservar o `z-index` original dos sheets e do `.dim`: eles precisam ficar acima da barra de abas, que usa 30.)

- [ ] **Step 5: Expor `Mov` e `fecharSheet` no harness**

Em `tests/harness/servir.js`, trocar a constante `EXPOR` para incluir `Mov, fecharSheet`:

```js
const EXPOR = "window.__T = {ir, R, toast, celebrar, telaAbertura, telaCodigo, telaPlanoPronto, telaAssinatura, telaMatch, telaSubiu, nivelXP, onb, sheetCheckin, sheetPausar, sheetCompras, sheetPostar, sheetRetomar, sheetDocumento, Mov, fecharSheet};\n";
```

- [ ] **Step 6: Verificar o sheet no navegador**

Abrir o harness em 390 px. No console: `__T.sheetCheckin()`. Expected:
1. O sheet sobe por mola (sem salto) e o fundo escurece junto; a página atrás recua levemente.
2. Arrastar a alça para baixo devagar: o sheet segue o ponteiro 1:1 e o fundo clareia na mesma proporção. Soltar perto do topo: volta com leve bounce. Arrastar rápido e soltar: fecha (o sheet desce com a velocidade da soltura).
3. Arrastar a alça para cima: resiste (elástico).
4. Tocar no fundo escuro: fecha por animação.
5. Abrir o sheet e, no meio da entrada (clicar no `dim` logo após abrir), ele reverte sem pulo.
6. `__T.sheetCheckin(); __T.sheetPausar()` em seguida (um sheet depois do outro): o segundo aparece e não é apagado pela saída do primeiro.
7. Com `prefers-reduced-motion` ligado (emular no painel): o sheet só faz fade.
Usar eventos de ponteiro reais (`computer` com `left_click_drag` na alça). Console sem erros.

- [ ] **Step 7: Rodar os testes e commitar**

Run: `node --test tests/*.test.js`
Expected: todos passam (`sintaxe.test.js` confirma que o script compila).

```bash
git add publicar.html tests/harness/servir.js
git commit -m "feat: camada de movimento no DOM e sheets arrastáveis por mola

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Transições entre telas, indicador de abas, voltar por gesto, título grande e vibração

**Files:**
- Modify: `publicar.html` (`ir()`, `tela()`, `render()`, `bindChecks()`, `celebrar()`, `telaChat()`, CSS, módulo `MOVIMENTO`)
- Modify: `tests/harness/servir.js` (nada novo a expor; conferir)

**Interfaces:**
- Consumes: `Mov`, `tipoTransicao`, `MOLAS` (Tasks 2 e 6), HTML da casca (Task 5).
- Produces: `let proxTransicao = "nenhuma"` (lida e zerada em `tela()`); `entrada(app, tipo)`; `moverIndicador()`; `voltarPorGesto()`; `tituloGrande(app)`; `haptica(tipo:"ok"|"conquista")`.

- [ ] **Step 1: Adicionar `entrada`, `moverIndicador`, `tituloGrande` e `haptica`**

Depois de `montarSheet`/do observador (Task 6), inserir:

```js
/* transição da tela nova: o estado inicial vai antes do primeiro quadro, a mola leva a tela ao repouso */
let proxTransicao = "nenhuma";
function entrada(app, tipo){
  if (tipo==="nenhuma") return;
  const m = Mov.estado(app);
  if (Mov.reduz()){ m.x = 0; m.y = 0; m.o = 0; Mov.aplicar(app); void app.offsetWidth; Mov.para(app, {o:1}); return; }
  const L = app.parentElement.clientWidth || 390, H = window.innerHeight;
  const de = {aba:{x:0, y:8, o:0}, push:{x:L*0.3, y:0, o:0}, pop:{x:-L*0.3, y:0, o:0}, sobe:{x:0, y:H, o:1}, desce:{x:0, y:8, o:0}}[tipo];
  Object.assign(m, de, {s:1}); Mov.aplicar(app);
  Mov.para(app, {x:0, y:0, o:1}, "suave");
}
/* indicador da barra de abas: capa a aba selecionada e desliza por mola */
function moverIndicador(){
  const pill = document.querySelector(".tabs-pill"), ind = $("tabs-ind"), sel = pill && pill.querySelector('button[aria-selected="true"]');
  if (!pill || !ind || !sel || $("tabs").hidden) return;
  const x = sel.offsetLeft, primeira = !ind.dataset.pos;
  ind.style.width = sel.offsetWidth + "px"; ind.dataset.pos = "1";
  if (primeira){ const m = Mov.estado(ind); m.x = x; Mov.aplicar(ind); } else Mov.para(ind, {x}, "ligeiro");
}
window.addEventListener("resize", () => { const i = $("tabs-ind"); if (i) delete i.dataset.pos; moverIndicador(); });
/* título grande: quando o h1 sai da tela, o título pequeno aparece no cabeçalho de vidro */
let tituloObs = null;
function tituloGrande(app){
  if (tituloObs) tituloObs.disconnect();
  const cab = $("cab"), h1 = app.querySelector("h1.h1"); if (!cab) return;
  cab.classList.remove("on");
  if (!h1 || app.classList.contains("full") || !("IntersectionObserver" in window)) return;
  tituloObs = new IntersectionObserver(es => { cab.classList.toggle("on", !es[0].isIntersecting && es[0].boundingClientRect.top < 0); }, {rootMargin:"-8px 0px 0px 0px"});
  tituloObs.observe(h1);
}
/* vibração curta nos momentos de conclusão, no mesmo quadro da mudança visual; só onde o aparelho suporta */
function haptica(tipo){ try{ if (navigator.vibrate) navigator.vibrate(tipo==="conquista" ? [12,40,12] : 10); }catch(e){} }
```

- [ ] **Step 2: Ligar as transições em `ir()` e `tela()`**

Trocar a função `ir`:

```js
function ir(tab, sub, arg){
  const antes = {tab:R.tab, sub:R.sub, arg:R.arg};
  R.tab = tab; R.sub = sub||null; R.arg = arg==null?null:arg;
  proxTransicao = tipoTransicao(antes, {tab:R.tab, sub:R.sub, arg:R.arg});
  render();
}
```

Em `tela()`, no lugar do trecho acrescentado na Task 5 Step 4 (o que preenche `#cab`), usar:

```js
  const tipo = proxTransicao; proxTransicao = "nenhuma";
  const cab = $("cab"); if (cab) cab.firstChild.textContent = (app.querySelector("h1.h1") || {}).textContent || "";
  tituloGrande(app);
  entrada(app, tipo);
  moverIndicador();
```

Importante: `entrada` vem **depois** de `window.scrollTo(0,0)` e antes do `return app`. As telas que chamam `tela()` direto (onboarding, abertura) ficam com `proxTransicao === "nenhuma"` e não animam (a Task 11 liga o onboarding).

- [ ] **Step 3: Voltar por gesto**

Inserir depois de `haptica`:

```js
/* voltar arrastando da borda esquerda: a tela acompanha o dedo; soltar projeta o ponto de repouso e confirma pelo mesmo botão "←" da tela */
function voltarPorGesto(){
  const app = $("app"), borda = document.createElement("div"); borda.id = "borda"; borda.setAttribute("aria-hidden","true"); document.querySelector(".wrap").appendChild(borda);
  let ativo = false, decidido = false, x0 = 0, y0 = 0, am = [];
  const botao = () => app.querySelector(".back");
  const tel = () => { borda.hidden = !botao(); };
  new MutationObserver(tel).observe(app, {childList:true}); tel();
  borda.addEventListener("pointerdown", e => { if (e.button > 0 || !botao()) return; ativo = true; decidido = false; x0 = e.clientX; y0 = e.clientY; am = [{t:e.timeStamp, x:e.clientX}]; borda.setPointerCapture(e.pointerId); const m = Mov.estado(app); cancelAnimationFrame(m.raf); });
  borda.addEventListener("pointermove", e => {
    if (!ativo) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (!decidido){ if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; if (Math.abs(dy) > Math.abs(dx) || dx < 0){ ativo = false; return; } decidido = true; }
    const m = Mov.estado(app); m.x = Math.max(0, dx); Mov.aplicar(app);
    am.push({t:e.timeStamp, x:e.clientX}); if (am.length > 8) am.shift();
  });
  const fim = () => {
    if (!ativo) return; ativo = false; if (!decidido) return;
    const m = Mov.estado(app), L = app.parentElement.clientWidth || 390, v = velocidade(am);
    if (projetar(m.x, v) > L*0.5 || v > 800){
      Mov.para(app, {x:L, o:0}, "suave", {x:v}).then(() => { const b = botao(); if (b) b.click(); });
    } else Mov.para(app, {x:0}, "lancado", {x:v});
  };
  borda.addEventListener("pointerup", fim); borda.addEventListener("pointercancel", fim);
}
voltarPorGesto();
```

Acrescentar ao CSS (casca):

```css
#borda{position:fixed;top:0;bottom:0;left:max(0px,calc(50% - 240px));width:20px;z-index:20;touch-action:none}
```

Se o clique no botão acontecer enquanto `app` está em `x = L` e `o = 0`, a tela nova entra com `pop` a partir de `-L·0,3`: `entrada` reescreve `x`, `y`, `o` e `s` antes do primeiro quadro, então não há resíduo.

- [ ] **Step 4: Chat sobe de baixo e fecha arrastando a alça**

Em `telaChat()` (linha ~3885), adicionar uma alça logo no início de `.chat-h`: trocar `'<div class="chat"><div class="chat-h"><div class="between">'` por `'<div class="chat"><div class="chat-h mat"><span class="grab" id="cgrab"></span><div class="between">'`. Depois da linha `$("cx").addEventListener("click", ()=>ir("hoje"));` acrescentar:

```js
  Mov.arrastarFechar(app, $("cgrab"), {altura:()=>window.innerHeight, aoFechar:vy=>{ Mov.para(app, {y:window.innerHeight}, "suave", {y:vy}).then(()=>ir("hoje")); }});
```

E no CSS do chat, trocar as regras `.chat-h`, `.cin` e `.mode` por:

```css
.chat-h{position:sticky;top:env(safe-area-inset-top,0px);padding:4px 16px 12px;display:flex;flex-direction:column;gap:10px;z-index:5;border-width:0 0 1px}
.chat-h .grab{margin:0 -16px -4px}
.cin{position:sticky;bottom:0;display:flex;gap:8px;align-items:flex-end;padding:10px 16px calc(12px + var(--safe-b));background:var(--mat-reg);-webkit-backdrop-filter:blur(30px) saturate(180%);backdrop-filter:blur(30px) saturate(180%)}
.cin textarea{flex:1;min-height:46px;max-height:140px;border:0;border-radius:23px;background:var(--surface-2);padding:12px 16px;resize:none}
.cin button{border:0;border-radius:23px;min-height:46px;background:var(--go-fill);color:#fff;font-weight:600;padding:0 18px}
.cin button:active{transform:scale(.97)}
.mode{display:grid;grid-template-columns:1fr 1fr;background:var(--surface-2);border-radius:var(--r1);padding:2px;gap:2px}
.mode button{border:0;border-radius:8px;background:transparent;padding:9px;font-weight:600;font-size:.9375rem}
.mode button[aria-pressed="true"]{background:var(--surface);color:var(--go-ink);box-shadow:var(--sh1),inset 0 0 0 1.5px var(--go)}
```

- [ ] **Step 5: Vibração nos momentos de conclusão**

Em `bindChecks`, na linha que marca o treino como feito (`await salvarLog(key2, {at:..., rapido:true, ...});`), acrescentar `haptica("ok");` logo depois dela; na que registra refeição, `haptica("ok");` logo depois de `await registrarRefeicao(...)`. Em `celebrar(rotulo)`, como primeira linha do corpo (antes do teste de `prefers-reduced-motion`): `haptica("conquista");`. Em `sheetCheckin`, no handler que salva (procurar com `grep -n '"ci_"' publicar.html` o `salvarLog("ci_"+...)` do check-in) acrescentar `haptica("ok");` logo depois.

- [ ] **Step 6: Verificar no navegador**

Abrir o harness em 390 px e conferir:
1. Trocar de aba: a tela nova entra com fade e 8 px de subida; o indicador laranja claro desliza por mola entre as abas (clicar rápido em três abas seguidas: o indicador redireciona sem salto).
2. Entrar numa tela de detalhe (Treino > um item): desliza da direita (30%) com fade. Tocar em "← Voltar": a tela nova vem da esquerda.
3. Voltar por gesto: na tela de detalhe, arrastar do pixel 5 da esquerda para a direita com `left_click_drag` (de x=5 para x=250): a tela acompanha o ponteiro; soltar passando de metade confirma o voltar; soltar antes volta ao lugar com bounce leve. Arrastar na vertical a partir da borda não prende a rolagem.
4. Título grande: em Treino, rolar a página: quando o título grande sai, o cabeçalho de vidro mostra o título pequeno; voltar ao topo esconde.
5. Chat: tocar no botão Coach: a tela sobe de baixo. Arrastar a alça do cabeçalho para baixo e soltar longe: desce e volta para Hoje; soltar perto: volta ao lugar.
6. Reduced motion (emular): todas as trocas viram só fade.
7. Console sem erros.

- [ ] **Step 7: Rodar os testes e commitar**

Run: `node --test tests/*.test.js`
Expected: todos passam.

```bash
git add publicar.html
git commit -m "feat: transições por mola, indicador de abas, voltar por gesto e título grande

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tela Hoje

**Files:**
- Modify: `publicar.html` (`telaHoje` ~1981, `umaAcao` ~2028, CSS de `/* app: topo */`, `/* linha do tempo */`, `.fire-hero`, `.wkstrip`, `.recado`, `.ci`, `.stats3`, `.diatodo`)

**Interfaces:**
- Consumes: tokens, componentes, casca e transições (Tasks 3 a 7).
- Produces: `proxCard(prox, c, k): HTMLElement` (o cartão "Próximo", extraído de `umaAcao`); classes novas `.proxc` (cartão laranja sólido), `.avisos`, `.dia-sec` (seção recolhível).

- [ ] **Step 1: Reescrever o CSS de topo, cartões do dia e linha do tempo**

Substituir as regras `.top`, `.me`, `.me img`, `.fire`, `.stats3`, `.recado`, `.ci...`, `.tline`, `.ti...` (blocos `/* app: topo */` e `/* linha do tempo */`) por:

```css
/* app: topo */
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.me{width:40px;height:40px;border-radius:50%;background:var(--go-fill);color:#fff;display:grid;place-content:center;font-size:.8125rem;font-weight:600;border:0;flex:none;overflow:hidden;padding:0;box-shadow:var(--sh1)}
.me img{width:100%;height:100%;object-fit:cover}
.fire{display:inline-flex;align-items:center;gap:5px;font-weight:700;font-variant-numeric:tabular-nums}
.fire i{width:12px;height:16px;background:var(--go);clip-path:polygon(50% 0,100% 60%,80% 100%,20% 100%,0 60%);display:inline-block}
.fire.off i{background:var(--sep);filter:brightness(.85)}
.stats3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:var(--surface);border-radius:var(--r2);box-shadow:var(--sh1)}
.stats3>div{padding:12px;border-right:1px solid var(--sep);min-width:0}
.stats3>div:last-child{border-right:0}
.stats3 b{display:block;font-weight:700;font-size:1.5rem;line-height:1.1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.stats3 span{font-size:.75rem;color:var(--tx-2);font-weight:500}
.recado{border-radius:var(--r2);background:var(--surface);box-shadow:var(--sh1);padding:12px 14px;font-size:.9375rem}
.recado b{display:block;font-size:.75rem;font-weight:600;color:var(--tx-2);margin-bottom:2px}
.ci{border:0;border-radius:var(--r2);padding:14px;display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--surface);box-shadow:var(--sh1);width:100%;text-align:left}
.ci b{font-size:1.0625rem;font-weight:600;letter-spacing:-.01em}.ci small{display:block;font-size:.8125rem;color:var(--tx-2)}
.ci.done{background:var(--done-soft);box-shadow:inset 0 0 0 1px var(--done-line)}
.ci.hot{background:var(--go-soft);box-shadow:inset 0 0 0 1.5px var(--go)}
.proxc{background:var(--go-fill);color:#fff;border-radius:var(--r3);padding:18px;box-shadow:var(--sh2);display:flex;justify-content:space-between;align-items:center;gap:12px;border:0;width:100%;text-align:left}
.proxc .k,.proxc small{color:rgba(255,255,255,.88)}
.proxc b{display:block;font-size:1.375rem;font-weight:700;letter-spacing:-.02em;line-height:1.15}
.proxc:active{background:var(--go-press);transform:scale(.985)}
.proxc[disabled]{background:var(--done-soft);color:var(--done-ink);box-shadow:inset 0 0 0 1px var(--done-line)}
.proxc[disabled] .k,.proxc[disabled] small{color:var(--done-ink)}
.avisos{display:flex;flex-direction:column;gap:8px}
/* linha do tempo */
.tline{display:flex;flex-direction:column;background:var(--surface);border-radius:var(--r2);box-shadow:var(--sh1);padding:4px 14px}
.ti{display:grid;grid-template-columns:44px 14px minmax(0,1fr);gap:8px;align-items:start;padding:10px 0;position:relative;background:none;border:0;text-align:left;width:100%}
.ti::before{content:"";position:absolute;left:58px;top:0;bottom:0;width:1px;background:var(--sep)}
.ti time{font-weight:600;font-size:.875rem;color:var(--tx-2);text-align:right;padding-top:2px;font-variant-numeric:tabular-nums}
.ti .dot{width:12px;height:12px;border-radius:50%;border:2px solid var(--c,var(--sep));background:var(--surface);margin-top:4px;position:relative;z-index:1}
.ti.done .dot{background:var(--c,var(--done))}
.ti .tc{display:flex;justify-content:space-between;gap:8px;align-items:center;min-width:0}
.ti .tc>span{min-width:0}
.tlink{border:0;background:none;padding:0;text-align:left;flex:1;min-width:0;color:var(--tx)}
.tlink b{display:block}
.ck{display:inline-grid;place-content:center;width:32px;height:32px;border:0;border-radius:50%;font-size:.875rem;background:var(--surface-2);font-weight:700;color:var(--tx-2)}
.ck[aria-pressed="true"],tr.done .ck{background:var(--done);color:#fff}
.ti .ck{flex:none}
.ti .tc b{font-size:1rem;font-weight:600;display:block}
.ti .tc small{font-size:.8125rem;color:var(--tx-2);display:block}
.ti .ph{width:40px;height:40px;flex:none;object-fit:cover;background:var(--surface-2);border-radius:10px}
.ti .cam{width:36px;height:36px;flex:none;border-radius:10px;border:1.5px dashed var(--tx-2);display:grid;place-content:center;font-size:.6875rem;font-weight:600;color:var(--tx-2)}
.ti.big .tc b{font-size:1.1875rem;font-weight:700;letter-spacing:-.02em}
.ti.next .dot{box-shadow:0 0 0 4px rgba(255,90,0,.2);border-color:var(--go)}
.dia-sec{background:var(--surface);border-radius:var(--r2);box-shadow:var(--sh1);overflow:hidden}
.dia-sec>summary{padding:14px 16px;font-weight:600;font-size:1.0625rem;min-height:50px;display:flex;align-items:center;justify-content:space-between;list-style:none;cursor:pointer}
.dia-sec>summary::-webkit-details-marker{display:none}
.dia-sec>summary::after{content:"›";font-size:1.5rem;color:var(--tx-2);transition:transform .25s cubic-bezier(.32,.72,0,1)}
.dia-sec[open]>summary::after{transform:rotate(90deg)}
.dia-sec>.dia-corpo{padding:0 12px 12px;display:flex;flex-direction:column;gap:10px}
```

Apagar também a regra antiga `.diatodo...` (usada só pela `umaAcao` antiga).

- [ ] **Step 2: Reescrever o foguinho como linha compacta**

Substituir as regras `.fire-hero`, `.fire-hero.off`, `.flame`, `.streak b`, `.wkstrip...` por:

```css
.fire-hero{position:relative;border-radius:var(--r3);background:linear-gradient(135deg,var(--go-soft),var(--surface) 70%);padding:12px 16px;display:grid;grid-template-columns:64px 1fr;gap:4px 12px;align-items:center;box-shadow:var(--sh1)}
.fire-hero.off{background:var(--surface)}
.flame{width:64px;height:72px}.flame svg{width:100%;height:100%;overflow:visible}
.streak b{font-weight:700;font-size:2.25rem;line-height:1;letter-spacing:-.04em;display:block;font-variant-numeric:tabular-nums}
.wkstrip{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;grid-column:1/-1;margin-top:2px}
.wkstrip span{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:.6875rem;font-weight:600;color:var(--tx-2)}
.wkstrip i{width:26px;height:26px;border-radius:50%;background:var(--surface-2);display:grid;place-content:center;font-style:normal;font-size:.6875rem;color:#fff}
.wkstrip i.on{background:linear-gradient(160deg,#FFC24B,var(--go))}
.wkstrip i.td{box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--go)}
```

Manter as `@keyframes` e as regras `.f1 .f2 .f3 .glow .spark` como estão (animação da chama). No tema escuro, apagar as regras `:root[data-tema="escuro"] .fire-hero...`, `.wkstrip i...` do bloco de tema escuro antigo (já foram substituídas na Task 3; se sobrou alguma, remover agora).

- [ ] **Step 3: Extrair `proxCard` de `umaAcao`**

Em `umaAcao` (linha ~2028), as quatro ramificações que montam o botão `b` (`prox.tipo==="treino"`, `"ref"`, `"fim"` e "dia completo") viram uma função `proxCard`. Ler as linhas 2028 a 2053 e **mover o conteúdo, sem mudar a lógica nem os textos**, para:

```js
function proxCard(prox, k){
  const b = document.createElement("button"); b.type = "button"; b.className = "proxc";
  // treino, ref e fim: mesmos dataset (data-item, data-go) e mesmos textos que umaAcao já montava em b.innerHTML;
  // só muda a marcação interna para: '<span><span class="k">Próximo</span><b>…título…</b><small>…subtítulo…</small></span><span class="n">→</span>'
  // dia completo: b.disabled = true; b.innerHTML = '<span><span class="k">Hoje</span><b>Dia completo</b><small>Bom trabalho. Descanse e volte amanhã.</small></span><span class="n">✓</span>';
  return b;
}
```

Os títulos atuais ("Próximo: ...", "Próxima: ...", "Fechar o dia") continuam: o `<b>` recebe o nome do treino, da refeição ou "Fechar o dia", e o rótulo `Próximo` vai no `.k`. `bindItens(app)` e `bindGo(app)` já cobrem `data-item` e `data-go`, que continuam nos cartões.

- [ ] **Step 4: Reordenar `telaHoje` e trocar `<details class="diatodo">` por seções**

Na montagem de `h` em `telaHoje`, a nova ordem é:

1. `topo(...)` (inalterado).
2. `<div class="avisos">` com, nesta ordem: o aviso do foguinho em risco, a pausa, a suspensão, o ajuste do dia (`aj`) e a sugestão da semana (`sugestaoHTML(...)`). São os mesmos trechos de string que hoje estão espalhados, apenas agrupados.
3. `<div id="prox"></div>`: slot do cartão principal.
4. O `fire-hero` (foguinho + faixa da semana).
5. O recado do coach.
6. Três seções, cada uma `<details class="dia-sec" data-sec="ci|miss|dia"><summary>…</summary><div class="dia-corpo">…</div></details>`:
   - **Check-in** (`ci`): o botão `#ci` e, quando `agora>=20 && !LOG["co_"+k]`, o cartão "Hora de fechar o dia".
   - **Missões** (`miss`): o `balancoHTML(today, true)`, o `box` das missões de hoje, o baú, `missoesSemanaHTML()` e `janelaLinha()`.
   - **Seu dia** (`dia`): `<div class="tline">`.

Abertas por padrão: **Seu dia** sempre; **Check-in** quando `!c` (check-in ainda não feito); **Missões** fechada. Isso entra assim no template: `'<details class="dia-sec" data-sec="dia" open>'`, e para o check-in `(c ? '' : ' open')`.

Em `umaAcao(app, prox, c, k)`, apagar a criação do `<details class="diatodo">` e a movimentação de nós (`mover`, `det`, `alvo`). Ela passa a fazer só:

```js
function umaAcao(app, prox, c, k){
  const slot = app.querySelector("#prox"); if (!slot) return;
  slot.replaceWith(proxCard(prox, k));
  const recado = app.querySelector(".recado");
  if (recado){ let ex = recado; extrasHoje().forEach(e=>{ ex.after(e); ex = e; }); }
  bindMissoesSemana(app); const tl = app.querySelector("#tjlinha"); if (tl) tl.addEventListener("click", sheetTropa);
  const pv = app.querySelector("#pvolta"); if (pv) pv.addEventListener("click", sheetRetomar);
}
```

(`bindMissoesSemana(det)` e `det.querySelector("#tjlinha")` passaram a usar `app`, porque o conteúdo das seções agora está direto no `app`.) A parte de `pausaAtiva()` em `umaAcao` que criava um `flag` com botão "Voltar a treinar" desaparece junto com o `alvo`, **porque o aviso de pausa já está no grupo `avisos` do template (item 2)**: conferir que o botão `#pv` (retomar) está dentro dele; se o texto do botão estava só na versão de `umaAcao`, copiar o `flag` completo para dentro do grupo `avisos` no template.

- [ ] **Step 5: Remover os estilos inline estáticos da Hoje**

Run: `grep -nE "style=\"[^\"+']*\"" publicar.html | awk -F: '$1>=1981 && $1<=2060'`
Trocar cada ocorrência pelas utilitárias da Task 4 ou por variável CSS. Exemplos que existem na Hoje: `style="grid-template-columns:96px 1fr"` e `style="width:96px;height:108px"` no `fire-hero` (apagar: o CSS novo já define 64 px), `style="font-weight:600"` (virou `.w600`), `style="color:var(--go-ink)"` (virou `.cor-go`).

- [ ] **Step 6: Verificar no navegador**

Abrir o harness em 390 px (claro e escuro). Expected: topo com título grande; o cartão laranja "Próximo" logo abaixo (clicar abre o item); foguinho compacto com a faixa da semana; recado; três seções recolhíveis cuja seta gira por mola; "Seu dia" aberta. Registrar um check-in e conferir: o cartão "Próximo" muda e a seção Check-in fecha. Pausa: `__T.sheetPausar()`, confirmar e ver o aviso de pausa no grupo `avisos`. Conferir também a leitura ao rolar (cabeçalho de vidro com o título pequeno). Console sem erros.

- [ ] **Step 7: Rodar os testes e commitar**

Run: `node --test tests/*.test.js`
Expected: todos passam.

```bash
git add publicar.html
git commit -m "feat: tela Hoje com cartão Próximo, foguinho compacto e seções recolhíveis

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Treino (semana, treino do dia, força, exercício, fim, importação)

**Files:**
- Modify: `publicar.html` (CSS de `/* semana */`, `/* treino */`; `telaSemana` ~2260, `telaTreino` ~2287, `sheetPreviaImport`, `sheetFeito`, `telaForca`, `telaExercicio`, `telaFim`)

**Interfaces:**
- Consumes: tokens, componentes, casca, transições, `.ck` e `.ci` da Task 8.
- Produces: novas regras para `.wrow`, `.zbar`, `.steps`, `.coach`, `.av`, `.exh`, `.demo`, `.movg`, `.movc`, `.sugg`, `.sets`, `.pr`, `.rest`, `.big3`, `.kpi4`, `.ba`.

- [ ] **Step 1: Reescrever o CSS de semana e treino**

Substituir os blocos `/* semana */` e `/* treino */` por:

```css
/* semana */
.wrow{display:grid;grid-template-columns:48px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:12px 16px;border:0;border-bottom:1px solid var(--sep);background:var(--surface);width:100%;text-align:left}
.wrow:first-child{border-radius:var(--r2) var(--r2) 0 0}.wrow:last-child{border-radius:0 0 var(--r2) var(--r2);border-bottom:0}
.wrow .d{font-weight:600;font-size:.8125rem;color:var(--tx-2);line-height:1.1}
.wrow .d b{display:block;font-size:1.375rem;font-weight:700;letter-spacing:-.03em;color:var(--tx)}
.wrow .w{min-width:0}
.wrow .w b{display:block;font-size:1rem;font-weight:600}
.wrow .w small{font-size:.8125rem;color:var(--tx-2)}
.wrow.t{background:var(--go-soft)}
.wrow.ok .w b::after{content:"  ✓";color:var(--done-ink)}
/* treino */
.zbar{display:flex;height:34px;gap:3px;align-items:flex-end}
.zbar i{display:block;border-radius:4px 4px 2px 2px}
.steps{display:flex;flex-direction:column;font-size:.9375rem;background:var(--surface);border-radius:var(--r2);box-shadow:var(--sh1);padding:0 16px}
.steps>div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--sep);padding:12px 0}
.steps>div:last-child{border-bottom:0}
.steps b{font-size:1rem;font-weight:700;flex:none;font-variant-numeric:tabular-nums}
.coach{display:flex;gap:10px;align-items:flex-start;font-size:.9375rem;line-height:1.4}
.av{width:32px;height:32px;border-radius:50%;background:var(--go-fill);color:#fff;display:grid;place-content:center;font-size:.6875rem;font-weight:600;flex:none}
.exh{display:flex;gap:12px;align-items:center}
.demo{width:92px;height:84px;flex:none;background:var(--surface-2);border-radius:var(--r2);padding:4px;cursor:pointer;color:var(--tx)}
.demo.big{width:100%;height:auto;aspect-ratio:7/6;padding:10px;cursor:default}
.movg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.movc{border-radius:var(--r1);padding:10px;background:var(--surface);box-shadow:var(--sh1);display:flex;flex-direction:column;gap:4px;min-width:0}
.exh b{font-weight:700;font-size:1.375rem;line-height:1.15;letter-spacing:-.02em;display:block}
.exh small{font-size:.8125rem;color:var(--tx-2);display:block}
.sugg{background:var(--go-soft);border-radius:var(--r2);padding:12px 14px;font-size:.9375rem;display:flex;justify-content:space-between;align-items:center;gap:8px}
.sugg button{border:0;background:none;font-weight:600;color:var(--go-ink);flex:none}
.sets{width:100%;border-collapse:collapse;font-size:.875rem}
.sets th{font-size:.75rem;font-weight:600;color:var(--tx-2);text-align:center;padding:4px 0;border-bottom:1px solid var(--sep)}
.sets td{text-align:center;padding:6px 2px;border-bottom:1px solid var(--sep);font-weight:700;font-size:1.0625rem;font-variant-numeric:tabular-nums}
.sets td.prev{color:var(--tx-2);font-size:.875rem;font-weight:500}
.sets tr.done td{background:var(--done-soft)}
.sets input{width:100%;max-width:68px;min-height:38px;border:0;border-radius:var(--r1);background:var(--surface-2);text-align:center;font-weight:700;font-size:1.0625rem;padding:0;font-variant-numeric:tabular-nums}
.sets input:focus{outline:none;box-shadow:inset 0 0 0 2px var(--go);background:var(--surface)}
.pr{display:inline-flex;font-size:.625rem;font-weight:700;background:var(--go-soft);color:var(--go-ink);padding:2px 6px;border-radius:999px;margin-left:4px;vertical-align:2px}
.rest{position:sticky;bottom:calc(112px + var(--safe-b));background:var(--mat-grosso);-webkit-backdrop-filter:blur(40px) saturate(160%);backdrop-filter:blur(40px) saturate(160%);color:var(--tx);border-radius:var(--r3);box-shadow:var(--sh3);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:8px;z-index:5}
.rest b{font-size:1.75rem;line-height:1;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.rest small{font-size:.75rem;color:var(--tx-2);display:block}
.rest button{font-size:.8125rem;font-weight:600;border:0;border-radius:999px;padding:8px 12px;background:var(--surface-2);color:var(--tx)}
.big3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));background:var(--surface);border-radius:var(--r2);box-shadow:var(--sh1)}
.big3>div{padding:14px 4px;text-align:center;border-right:1px solid var(--sep)}
.big3>div:last-child{border-right:0}
.big3 b{display:block;font-weight:700;font-size:1.625rem;line-height:1.1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.big3 span{font-size:.75rem;color:var(--tx-2);font-weight:500}
.up{color:var(--done-ink)}
.kpi4{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.kpi4>div{border-radius:var(--r2);background:var(--surface);box-shadow:var(--sh1);padding:12px;min-width:0}
.kpi4 b{display:block;font-weight:700;font-size:1.75rem;line-height:1.1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.kpi4 span{font-size:.75rem;color:var(--tx-2);font-weight:500}
.kpi4 em{font-style:normal;font-size:.75rem;font-weight:600;color:var(--done-ink);display:block}
.cax{display:flex;justify-content:space-between;font-size:.75rem;color:var(--tx-2);font-variant-numeric:tabular-nums}
.ba{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--sep);font-size:.9375rem}
.ba b{font-size:1.125rem;font-variant-numeric:tabular-nums}
```

- [ ] **Step 2: Agrupar a semana em cartão e trocar os estilos inline**

Em `telaSemana` (linha ~2260), as linhas `.wrow` ficam dentro de um contêiner `<div class="grp">`. Adicionar ao CSS: `.grp{background:var(--surface);border-radius:var(--r2);box-shadow:var(--sh1);overflow:hidden}` e remover `background` e `border-radius` do `.wrow` e de seus `:first-child`/`:last-child`, deixando só `.wrow{...;background:none}` e o `.wrow.t{background:var(--go-soft)}`. Run: `grep -nE "style=\"[^\"+']*\"" publicar.html | awk -F: '$1>=2260 && $1<=2480'` e trocar cada ocorrência pelas utilitárias ou por `style="--c:..."`.

- [ ] **Step 3: Conferir a regra do marcador de recorde e do descanso em tema escuro**

Apagar do bloco de tema escuro qualquer regra restante de `.rest`, `.pr`, `.bars`, `.cal` (as cores agora vêm dos tokens).

- [ ] **Step 4: Verificar no navegador**

Abrir `__T.ir("treino")` em 390 px (claro e escuro): semana em cartão agrupado com o dia de hoje destacado; abrir um treino (push com mola e voltar por gesto); em treino de força, `__T.ir("treino","forca","<chave do dia>~0")` (usar a chave que o clique na semana gera): tabela de séries com campos arredondados, marcar uma série (`.ck` redondo e verde), o card de descanso flutuando em vidro acima da barra de abas, o botão de sugestão. Abrir `sheetFeito` e `sheetPreviaImport` pelo fluxo normal (botões da tela do treino). Console sem erros.

- [ ] **Step 5: Rodar os testes e commitar**

Run: `node --test tests/*.test.js`
Expected: todos passam.

```bash
git add publicar.html
git commit -m "feat: redesign das telas de Treino

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Comida, Feed e Performance

**Files:**
- Modify: `publicar.html` (CSS de `/* comida */`, `/* feed */`, `/* performance */`, e o bloco de performance após `.pot`; `telaComida` ~2692, `sheetRepetir`, `sheetCompras`, `telaFeed` ~2611, `avisosHTML`, `sheetPostar`, `telaPerf` ~2862, `telaNivel`, `telaLiga`, `telaGrupo`, `telaDupla`, `telaDesafios`, `telaNovoGrupo`, `telaNovoDesafio`, `aneisSVG`)

**Interfaces:**
- Consumes: tokens, componentes, casca, transições, `.big3`/`.kpi4` (Task 9).
- Produces: regras novas para `.macro`, `.bar`, `.meal`, `.post`, `.ph-big`, `.ph-card`, `.ph-row`, `.act`, `.kudo`, `.badge`, `.person`, `.score`, `.xpbar`, `.rk`, `.rings`, `.meds`, `.cal`, `.sbars`, `.rcard`, `.rtiles`, `.nav4`, `.pbar`, `.mcal`, `.peek`, `.actv`, `.race-card`, `.photos`, `.hexes`, `.track`, `.runner`, `.finish`, `.pot`, `.pf-*`.

- [ ] **Step 1: CSS de Comida e Feed**

Substituir os blocos `/* comida */` e `/* feed */` por:

```css
/* comida */
.macro{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.macro>div{border-radius:var(--r2);background:var(--surface);box-shadow:var(--sh1);padding:12px;min-width:0}
.macro b{display:block;font-weight:700;font-size:1.25rem;line-height:1.1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.macro span{font-size:.75rem;color:var(--tx-2);font-weight:500}
.bar{height:6px;border-radius:3px;background:var(--surface-2);margin-top:8px;position:relative;overflow:hidden}.bar i{position:absolute;left:0;top:0;bottom:0;background:var(--go);border-radius:3px;max-width:100%;transition:width .4s cubic-bezier(.32,.72,0,1)}
.meal{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--sep);background:var(--surface)}
.meal .ph{width:52px;height:52px;flex:none;object-fit:cover;background:var(--surface-2);border-radius:12px}
.meal label.cam,.meal .cam{width:52px;height:52px;flex:none;border-radius:12px;border:1.5px dashed var(--tx-2);display:grid;place-content:center;font-size:.6875rem;font-weight:600;color:var(--tx-2);text-align:center;cursor:pointer}
.meal>span{min-width:0;flex:1}
.meal b{display:block;font-size:1rem;font-weight:600}.meal small{font-size:.8125rem;color:var(--tx-2);display:block}
.meal .ok{font-weight:700;color:var(--done-ink)}
.file{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
/* feed */
.post{background:var(--surface);border-radius:var(--r3);box-shadow:var(--sh1);padding:14px 14px 12px;display:flex;flex-direction:column;gap:10px;overflow:hidden}
.ph-big{aspect-ratio:4/5;position:relative;margin:0 -14px;background:var(--surface-2);overflow:hidden;max-width:calc(100% + 28px)}
.ph-big img{width:100%;height:100%;object-fit:cover;display:block}
.ph-big .ov{position:absolute;left:0;right:0;bottom:0;padding:48px 16px 14px;display:flex;gap:18px;color:#fff;background:linear-gradient(180deg,rgba(11,13,16,0),rgba(11,13,16,.7))}
.ph-big .ov b{display:block;font-weight:700;font-size:1.625rem;line-height:1.1;letter-spacing:-.03em}
.ph-big .ov span{font-size:.75rem;font-weight:500;opacity:.9}
.ph-card{aspect-ratio:1/1;margin:0 -14px;background:linear-gradient(160deg,#CF4500,#9A3300);color:#fff;padding:20px;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;max-width:calc(100% + 28px)}
.ph-card .t{font-weight:700;font-size:2rem;line-height:1.05;letter-spacing:-.03em}
.ph-card .nums{display:flex;gap:18px;flex-wrap:wrap}
.ph-card .nums b{font-weight:700;font-size:2rem;line-height:1.1;letter-spacing:-.03em;display:block}
.ph-card .nums span{font-size:.75rem;color:rgba(255,255,255,.88);font-weight:500}
.ph-card .bad{font-size:.75rem;font-weight:600;color:#fff;opacity:.9}
.ph-row{display:flex;align-items:center;gap:10px;border:0;background:none;padding:0;text-align:left;width:100%}
.ph-row b{font-size:1rem;font-weight:600;display:block}.ph-row small{font-size:.8125rem;color:var(--tx-2);display:block}
.ph-row .tag{margin-left:auto;font-size:.75rem;font-weight:600;color:var(--tx-2)}
.act{display:flex;align-items:center;gap:14px;font-size:.875rem}
.kudo{border:0;background:none;padding:6px 0;min-height:44px;display:inline-flex;align-items:center;gap:6px;font-weight:600}
.kudo i{width:16px;height:20px;background:var(--sep);filter:brightness(.8);clip-path:polygon(50% 0,100% 60%,80% 100%,20% 100%,0 60%);display:inline-block;transition:background-color .15s,transform .35s cubic-bezier(.34,1.56,.64,1)}
.kudo[aria-pressed="true"] i{background:var(--go);filter:none;transform:scale(1.15)}
.badge{font-size:.75rem;font-weight:600;padding:3px 9px;border-radius:999px;align-self:flex-start;background:var(--surface-2)}
.person{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--sep)}
.person>button:first-child{flex:1;min-width:0}
```

- [ ] **Step 2: CSS de Performance**

Substituir o bloco `/* performance */` (de `.score` até `.sbars b`) e o bloco de performance que vem depois de `.lvl .big` (de `.rcard` até `.pot`, mais `.pf*`) pelos seguintes. Primeiro o bloco `/* performance */`:

```css
/* performance */
.score{display:flex;align-items:flex-end;gap:6px}
.score b{font-weight:700;font-size:4.5rem;line-height:.85;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.score small{font-size:1.25rem;color:var(--tx-2);padding-bottom:6px}
.xpbar{height:8px;border-radius:4px;background:var(--surface-2);position:relative;overflow:hidden}.xpbar i{position:absolute;left:0;top:0;bottom:0;background:var(--go);border-radius:4px;transition:width .5s cubic-bezier(.32,.72,0,1)}
.rk{display:grid;grid-template-columns:24px 34px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--sep)}
.rk.me{background:var(--go-soft);margin:0 -10px;padding:10px;border-radius:var(--r1)}
.rk b.n{font-size:1rem}
.rings{display:flex;gap:16px;align-items:center}
.rings svg{flex:none}
.rings ul{list-style:none;margin:0;padding:0;font-size:.875rem;display:flex;flex-direction:column;gap:4px}
.rings li b{font-variant-numeric:tabular-nums}
.meds{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;text-align:center;font-size:.75rem;font-weight:600}
.meds i{display:block;width:40px;height:40px;margin:4px auto 8px;border:2px solid var(--go);border-radius:10px;transform:rotate(45deg)}
.meds div.off{color:var(--tx-2)}.meds div.off i{border-color:var(--sep)}
.meds div.sec i{border-style:dashed}
.cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.cal i{aspect-ratio:1;background:var(--surface-2);border-radius:6px;display:block}
.cal i.f{background:var(--go)}.cal i.p{background:var(--tx-2);opacity:.5}.cal i.t{outline:2px solid var(--go);outline-offset:1px}
.sbars{display:flex;flex-direction:column;gap:8px;font-size:.875rem}
.sbars>div{display:grid;grid-template-columns:80px minmax(0,1fr) 44px;gap:8px;align-items:center}
.sbars i{height:6px;border-radius:3px;background:var(--surface-2);display:block;position:relative;overflow:hidden}
.sbars i em{position:absolute;left:0;top:0;bottom:0;background:var(--go);border-radius:3px}
.sbars b{text-align:right;font-variant-numeric:tabular-nums}
```

E o bloco que começa em `.rcard` (abaixo da regra de `.lvl .big`), até `.pot`, mais as regras `.pf*`:

```css
.rcard{border-radius:var(--r2);padding:14px;background:var(--surface);box-shadow:var(--sh1);display:flex;flex-direction:column;gap:10px}
.lvlc{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;align-items:center;text-align:left;width:100%}
.pbar{height:8px;border-radius:999px;background:var(--surface-2);overflow:hidden}.pbar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#FF8A3D,var(--go));transition:width .5s cubic-bezier(.32,.72,0,1)}
.rtiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rtiles>div{border-radius:var(--r2);background:var(--surface);box-shadow:var(--sh1);padding:12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.rtiles b{font-weight:700;font-size:1.75rem;line-height:1.1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.rtiles em{font-style:normal;font-size:.75rem;font-weight:600;color:var(--done-ink)}
.nav4{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.nav4 button{border-radius:var(--r2);padding:14px;display:flex;flex-direction:column;gap:2px;border:0;background:var(--surface);box-shadow:var(--sh1);text-align:left}
.nav4 button:first-child{background:var(--go-soft)}
.nav4 b{font-size:1rem;font-weight:600}.nav4 small{font-size:.8125rem;color:var(--tx-2)}
.chartc svg{width:100%;display:block}
.legend{display:flex;flex-wrap:wrap;gap:12px;font-size:.75rem;color:var(--tx-2);font-weight:500}
.legend span::before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;background:var(--c);vertical-align:-1px}
.mhead{display:flex;justify-content:space-between;align-items:center}
.mhead button{border:0;background:var(--surface-2);border-radius:50%;width:40px;height:40px;font-weight:700;font-size:1.1rem}
.mcal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.mcal .dw{font-size:.6875rem;font-weight:600;color:var(--tx-2);text-align:center}
.mcal button{aspect-ratio:1/1.08;border-radius:var(--r1);background:var(--surface-2);border:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:4px 0 5px;font-weight:600;font-size:.875rem;font-variant-numeric:tabular-nums}
.mcal .x{visibility:hidden}
.mcal .act{background:var(--surface)}
.mcal .race{box-shadow:inset 0 0 0 2px var(--go)}
.mcal .sel{background:var(--go-fill);color:#fff}
.mcal .tod{box-shadow:inset 0 0 0 2px var(--go)}
.mcal .fut{opacity:.45}
.dots{display:flex;gap:2px;min-height:5px}.dots i{width:5px;height:5px;border-radius:50%;background:var(--c)}
.peek{border-radius:var(--r2);background:var(--surface-2);padding:12px;display:flex;flex-direction:column;gap:8px}
.actv{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;font-size:.9375rem}
.actv i{width:34px;height:34px;border-radius:10px;background:var(--c);display:grid;place-content:center;color:#fff;font-style:normal;font-weight:600;font-size:.75rem}
.actv b{display:block;font-weight:600}.actv small{color:var(--tx-2);font-size:.8125rem;display:block}
.race-card{border-radius:var(--r3);padding:16px;background:linear-gradient(150deg,var(--go-soft),var(--surface) 65%);box-shadow:var(--sh1);display:flex;flex-direction:column;gap:6px}
.photos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.photos img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--r1)}
.hexes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.hx{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;font-size:.75rem;font-weight:600}
.hx svg{width:72px;height:80px}.hx small{color:var(--tx-2);font-weight:500}.hx.lock{color:var(--tx-2)}
.track{position:relative;border-radius:var(--r2);background:linear-gradient(180deg,var(--go-soft),var(--surface));box-shadow:var(--sh1);overflow:hidden}
.lane{position:absolute;left:14px;right:22px;height:2px;background:repeating-linear-gradient(90deg,var(--sep) 0 8px,transparent 8px 14px)}
.runner{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:1px;transition:left .6s cubic-bezier(.32,.72,0,1)}
.runner .av{border:2px solid var(--surface);box-shadow:var(--sh2)}
.runner small{font-weight:700;font-size:.75rem;white-space:nowrap;font-variant-numeric:tabular-nums}
.finish{position:absolute;right:12px;top:8px;bottom:8px;width:6px;background:repeating-linear-gradient(180deg,var(--tx) 0 6px,var(--surface) 6px 12px);border-radius:3px}
.pot{border-radius:var(--r2);background:var(--go-soft);color:var(--go-ink);padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:600}
```

e, no bloco `.pf*`, trocar as regras por:

```css
.pf{display:flex;flex-direction:column;gap:12px}
.pf-card{border-radius:var(--r2);padding:14px;background:var(--surface);box-shadow:var(--sh1);display:flex;flex-direction:column;gap:10px;min-width:0}
.pf-row{display:flex;justify-content:space-between;align-items:center;gap:10px;min-width:0}
.pf-n{display:inline-grid;place-content:center;width:22px;height:22px;border-radius:50%;background:var(--go-fill);color:#fff;font-size:.75rem;font-weight:600;margin-right:6px}
.pf-bar{height:8px;background:var(--surface-2);border-radius:99px;overflow:hidden}.pf-bar i{display:block;height:100%;border-radius:99px;background:var(--go)}
.pf-chip{border:0;border-radius:99px;padding:6px 12px;font-size:.8125rem;background:var(--surface-2);color:var(--tx);font-weight:600}
.pf-chips{display:flex;gap:8px;flex-wrap:wrap}
.pf-link{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border:0;border-top:1px solid var(--sep);background:none;color:var(--tx);text-align:left;min-height:48px}
.pf-ok{color:var(--done-ink)}.pf-dn{color:var(--stop-ink)}
.pf-card .fire-hero{margin:0}
```

- [ ] **Step 3: Trocar as cores fixas no JS de Performance, Feed e gráficos**

Run: `grep -n '#0B0D10\|#5A626C\|#c9ced4\|#9aa3ad\|#FFF6EF\|#FFD6C2' publicar.html`
Trocar:
- `cor:"#0B0D10"` em `pessoa()` (linha ~2593) por `cor:"var(--go-fill)"` (avatar de você);
- `cor:"#5A626C"` (atleta genérico) por `cor:"var(--tx-2)"`;
- `#c9ced4` em SVGs inline (trilho neutro de gráficos) por `var(--sep)`; em atributos SVG (`stroke="..."`, `fill="..."`) usar `style="stroke:var(--sep)"`, porque variáveis CSS não valem em atributos de apresentação.

Cada estilo inline estático dessas telas vira utilitária ou `--c`: `grep -nE "style=\"[^\"+']*\"" publicar.html | awk -F: '$1>=2480 && $1<=3500'`.

- [ ] **Step 4: Animar anéis e barras por mola quando o dado muda**

Os anéis de `aneisSVG` e as barras `.pbar i`, `.xpbar i`, `.bar i` já têm `transition` de largura no CSS acima. Para os anéis, acrescentar ao CSS:

```css
.rings circle[stroke-dasharray]{transition:stroke-dasharray .6s cubic-bezier(.32,.72,0,1)}
```

(Transições CSS aqui são aceitáveis porque são animações de estado que não seguem gesto e não precisam herdar velocidade.) Em `prefers-reduced-motion`, a regra global `*{transition:none!important}` já existente no CSS continua valendo; conferir que ela está depois dessas regras no arquivo.

- [ ] **Step 5: Verificar no navegador**

Em 390 px (claro e escuro), abrir: `__T.ir("comida")` (macros, refeições em cartão, `__T.sheetCompras()`), `__T.ir("feed")` (cartões de post; o seed social do app cria posts de exemplo), `__T.sheetPostar()`, `__T.ir("perf")`, `__T.ir("perf","nivel")`, `"liga"`, `"desafios"`, `"dupla"`, `"ngrupo"`. Expected: cartões brancos sobre fundo agrupado, sem bordas retas, números tabulares, anéis do `perf` animando ao abrir. Console sem erros.

- [ ] **Step 6: Rodar os testes e commitar**

Run: `node --test tests/*.test.js`
Expected: todos passam.

```bash
git add publicar.html
git commit -m "feat: redesign de Comida, Feed e Performance

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Perfil, telas de apoio, onboarding e abertura

**Files:**
- Modify: `publicar.html` (CSS `.prof`, `.plans`, `.pl`, `.cupom`, `.ul`, `.open`, `.dark`, `.mline`, `.mbar`, `.who3`, `.proj`, `.phase`, `.wk`, `.bars`, `.pledge`, `.sig`, `.lvl`, `#cele`; funções `telaPerfil`, `telaCorpo`, `telaExtras`, `telaPainel`, `telaCheckout`, `telaNota`, `telaSubiu`, `telaAbertura`, `telaCodigo`, `telaPedido`, `telaMenor`, `onb`, `avancar`, `telaMatch`, `telaPlanoPronto`, `telaCompromisso`, `telaAssinatura`, `telaRevisao`, `sheetDocumento`)

**Interfaces:**
- Consumes: tudo das Tasks 3 a 10.
- Produces: estas telas no visual novo, e transição horizontal entre as perguntas do onboarding.

- [ ] **Step 1: CSS do onboarding, do plano e da assinatura**

Substituir os blocos `/* abertura */`, `/* match */`, `/* plano */`, `/* assinatura */` por:

```css
/* abertura */
.open{min-height:100vh;background:var(--noite);color:#fff;position:relative;display:flex;flex-direction:column;justify-content:flex-end;padding:22px 20px calc(34px + var(--safe-b));gap:14px;overflow:hidden}
.open .photo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,13,16,.1),rgba(11,13,16,.25) 40%,rgba(11,13,16,.95) 80%),repeating-linear-gradient(115deg,#2a2f36 0 2px,#23272d 2px 9px)}
.open>*{position:relative}
.open .wm{position:absolute;top:calc(22px + env(safe-area-inset-top,0px));left:20px;color:#fff;font-size:1.9rem}.open .wm i{width:44px;height:31px}
.mani{font-weight:700;font-size:3rem;line-height:1.02;letter-spacing:-.04em}
.mani em{font-style:normal;color:var(--go)}
.open .btn{background:rgba(255,255,255,.14);color:#fff;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}
.open .btn.go{background:var(--go-fill)}
.open .s{color:rgba(255,255,255,.78)}
/* match */
.dark{background:var(--noite);color:#fff;min-height:100vh;padding:24px 20px;display:flex;flex-direction:column;gap:12px}
.dark .s,.dark .k{color:rgba(255,255,255,.7)}
.mline{display:grid;grid-template-columns:20px minmax(0,1fr);gap:10px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.1);font-size:.9375rem;opacity:.2;transition:opacity .4s}
.mline.on{opacity:1}
.mline i{font-style:normal;font-weight:700;color:var(--done)}
.mline small{display:block;color:rgba(255,255,255,.7);font-size:.8125rem}
.mbar{height:4px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden}.mbar i{display:block;height:100%;width:0;background:var(--go);transition:width .5s cubic-bezier(.32,.72,0,1)}
.who3{display:flex;gap:6px}
.who3 span{flex:1;border-radius:999px;box-shadow:inset 0 0 0 1px var(--go);color:#FFB07A;padding:6px;font-size:.6875rem;font-weight:600;text-align:center}
/* plano */
.proj{border-radius:var(--r3);background:var(--surface);box-shadow:var(--sh2);padding:16px;display:flex;flex-direction:column;gap:2px}
.proj b{font-weight:700;font-size:2.75rem;line-height:1;letter-spacing:-.05em;font-variant-numeric:tabular-nums}
.phase{display:flex;height:24px;gap:3px;border-radius:8px;overflow:hidden}
.phase span{display:grid;place-content:center;font-size:.625rem;font-weight:600;color:#fff;overflow:hidden;white-space:nowrap}
.wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.wk div{border-radius:var(--r1);background:var(--surface);box-shadow:var(--sh1);padding:6px 2px;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:.625rem;font-weight:600;color:var(--tx-2);text-align:center;min-width:0}
.wk div b{font-size:.8125rem;color:var(--tx);line-height:1.1;word-break:break-word}
.wk div.r{background:var(--surface-2)}
.bars{display:flex;align-items:flex-end;gap:3px;height:80px;border-bottom:1px solid var(--sep)}
.bars i{flex:1;background:var(--go);border-radius:4px 4px 0 0;display:block;min-height:3px}
.bars i.dl{background:var(--tx-2);opacity:.4}.bars i.now{background:var(--go-fill)}
.pledge{font-weight:700;font-size:1.5rem;line-height:1.15;letter-spacing:-.02em}
.pledge em{font-style:normal;color:var(--go-ink)}
.sig{border-radius:var(--r2);height:110px;background:var(--surface-2);touch-action:none;display:block;width:100%}
/* assinatura */
.plans{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pl{border:0;border-radius:var(--r2);padding:16px 12px 12px;display:flex;flex-direction:column;gap:4px;background:var(--surface);box-shadow:var(--sh1);text-align:left;position:relative}
.pl[aria-pressed="true"]{background:var(--go-soft);box-shadow:inset 0 0 0 1.5px var(--go)}
.pl b{font-weight:700;font-size:1.875rem;line-height:1.05;letter-spacing:-.03em}
.pl small{font-size:.8125rem;color:var(--tx-2)}
.pl .tag{position:absolute;top:-9px;right:10px;background:var(--go-fill);color:#fff;font-size:.6875rem;font-weight:600;padding:2px 8px;border-radius:999px}
.cupom{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:.875rem;background:var(--done-soft);border-radius:var(--r1);padding:10px 12px;color:var(--done-ink);font-weight:600}
.ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;font-size:.9375rem}
.ul li::before{content:"✓  ";color:var(--done-ink);font-weight:700}
```

Substituir também `.lvl`, `.lvl .big` por:

```css
.lvl{background:var(--noite);color:#fff;position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;justify-content:center;gap:12px;padding:24px;text-align:center;overflow-y:auto}
.lvl .big{font-weight:700;font-size:8rem;line-height:.85;letter-spacing:-.06em;color:#FF8A4C;font-variant-numeric:tabular-nums}
```

e `#cele .cele-m` conserva a regra atual com `font-family:var(--f-wm)` no lugar do Exo 2 literal.

- [ ] **Step 2: CSS de Perfil e painel**

Trocar `.prof` e `.prof .me` por:

```css
.prof{display:flex;gap:14px;align-items:center}
.prof .me{width:64px;height:64px;font-size:1.125rem}
```

- [ ] **Step 3: Transição horizontal entre perguntas do onboarding**

Em `onb(i)` (linha ~1717), como primeira linha:

```js
  proxTransicao = i > step ? "push" : i < step ? "pop" : "nenhuma";
```

(Ler `onb` antes: `step` é atualizado dentro dela; a linha acima precisa vir **antes** da atribuição `step = i`, comparando o passo antigo com o novo.) A barra de progresso `.prog` já anima a cor por `transition`; para ficar contínua, trocar no `onb` o desenho de `<i class="on">` por segmentos que preenchem: manter a marcação e o CSS da Task 4 (`.prog i{transition:background-color .3s}`).

- [ ] **Step 4: Estilos inline estáticos e cores fixas nas telas de apoio e onboarding**

Run: `grep -nE "style=\"[^\"+']*\"" publicar.html` e tratar o que sobrar (deve restar só o que for dinâmico). Run: `grep -n 'var(--ink)' publicar.html` e trocar todos os usos restantes pela tabela da Task 3 Step 4. Run também: `grep -n 'var(--f-wm)\|Exo 2' publicar.html` e confirmar que só o logo (`.wm`) e a celebração (`#cele`) usam a família.

- [ ] **Step 5: Verificar no navegador**

Em 390 px (claro e escuro): Perfil (`__T.ir("perfil")`), Corpo, Extras, Painel do dono (`__T.ir("painel")`, abas), Fechar o dia (`__T.ir("hoje","checkout")`), Nota (`__T.ir("hoje","nota",__STUB.iso(new Date()))`), Subiu de nível (`__T.telaSubiu(__T.nivelXP())`), Documento (`__T.sheetDocumento(false)`). Depois abrir `?perfil=0`: abertura, entrar, `__T.onb(0)` até `__T.onb(5)` clicando em "Continuar": as perguntas entram deslizando da direita e voltam da esquerda; `__T.telaMatch()`, `__T.telaPlanoPronto()`, `__T.telaAssinatura()`. Expected: sem cantos retos, sem fundo preto fora da abertura/match/nível (que mantêm o fundo noite por decisão de marca), sem texto ilegível. Console sem erros.

- [ ] **Step 6: Rodar os testes e commitar**

Run: `node --test tests/*.test.js`
Expected: todos passam.

```bash
git add publicar.html
git commit -m "feat: redesign de Perfil, telas de apoio, onboarding e abertura

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Limpeza, acessibilidade, verificação final e documentação

**Files:**
- Modify: `publicar.html` (apagar tokens e regras temporários)
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-27-redesign-apple-design.md`

**Interfaces:**
- Consumes: tudo das tarefas anteriores.
- Produces: o app final do redesign, README e spec atualizados.

- [ ] **Step 1: Remover o apelido temporário `--ink` e conferir que nada antigo sobrou**

Apagar as duas linhas `--ink:...` (claro e escuro) da Task 3 Step 4.

```bash
cd /Users/guilhermegomes/TROPA
for t in '\-\-ink' '\-\-paper' '\-\-white' '\-\-mist' '\-\-fog' '\-\-graphite' '\-\-go-btn' '\-\-f-d' '\-\-f-n' '\-\-f-b'; do printf '%s: ' "$t"; grep -c -- "$t" publicar.html; done
grep -nE "style=\"[^\"+']*\"" publicar.html
grep -c 'Big Shoulders\|Barlow' publicar.html
grep -n 'text-transform:uppercase' publicar.html
wc -c publicar.html
```
Expected: todos os tokens antigos com contagem 0; o `grep` de `style=` sem concatenação não lista nada (se listar, converter); nenhuma menção a Big Shoulders ou Barlow; `text-transform:uppercase` só no `.wm` (logo) e em `.upper`; tamanho do arquivo ≤ 641.224 bytes. Se passar do limite, procurar CSS morto (classes sem uso: `grep -o 'class="[^"]*"' publicar.html | tr ' ' '\n' | sort -u`) e apagar.

- [ ] **Step 2: Conferir reduced-motion, reduced-transparency e contraste alto em todo o app**

No painel de navegador, emular `prefers-reduced-motion`, depois `prefers-reduced-transparency` (se o painel não oferecer, ligar pelo console: `matchMedia` não pode ser forçado, então conferir lendo o CSS: toda regra com `backdrop-filter` tem contraparte em `@media (prefers-reduced-transparency:reduce)`):

```bash
grep -c 'backdrop-filter:blur' publicar.html
grep -c 'prefers-reduced-transparency' publicar.html
```
Expected: cada superfície de vidro (`.mat`, `.mat-reg`, `.mat-grosso`, `.sheet`, `.toast`, `.rest`, `.cin`, `.open .btn`) tem a contraparte sólida. Para as que faltarem, acrescentar ao final do CSS:

```css
@media (prefers-reduced-transparency:reduce){.rest,.cin{background:var(--surface);-webkit-backdrop-filter:none;backdrop-filter:none}.open .btn{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(255,255,255,.2)}}
```

Conferir que a regra global `@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}` continua no fim do CSS (as animações por mola do JS já tratam `Mov.reduz()`).

- [ ] **Step 3: Passada final de verificação visual**

Para cada linha do `tests/harness/roteiro.md`, em 390 px claro e escuro, mais as telas principais (Hoje, Treino, Comida, Feed, Performance, Perfil, chat) em 360 e 430 px: tirar captura, comparar com as de referência da Task 1, e conferir texto cortado, rótulo da aba "Performance" inteiro, botão Coach sem sobrepor a barra, nada atrás da barra de abas (o `.wrap` tem 112 px de folga embaixo). Gestos: sheet (arrastar e arremessar), voltar por borda, chat arrastado para baixo, interrupção no meio de uma troca de aba. Console sem erros e sem avisos de violação de CSP.

- [ ] **Step 4: Atualizar a spec com os desvios**

Em `docs/superpowers/specs/2026-10-27-redesign-apple-design.md`:
1. Na seção "Sheets", trocar os itens sobre "Dois tamanhos" e "Arrastar pela alça ou pelo corpo" por: "Um tamanho só (altura do conteúdo, até 92% da tela). Arrastar pela alça, que tem área de toque de 44 px; o corpo rola normalmente."
2. Na mudança de estrutura 2, trocar "O chat abre como sheet de dois tamanhos" por "O chat continua sendo uma rota; sobe de baixo e fecha arrastando a alça do cabeçalho para baixo."
3. Na seção "Organização do código", acrescentar: "Os nomes de classe existentes foram mantidos e redesenhados; classes novas só onde a estrutura mudou (`.proxc`, `.avisos`, `.dia-sec`, `.cab`, `.tabs-pill`, `.tabs-ind`, `.mat`)."

- [ ] **Step 5: Atualizar o README**

Em `README.md`, na lista "Como o projeto é organizado", acrescentar:

```markdown
- `tests/harness/`: servidor local (`node tests/harness/servir.js`, porta 5173) que serve o `publicar.html` com `window.claude` simulado e banco em memória, para ver as telas sem publicar. `?perfil=0` abre sem perfil (onboarding) e `?tema=escuro` liga o tema escuro. O roteiro de telas está em `tests/harness/roteiro.md`.
```

E na seção "O que já existe", acrescentar a linha:

```markdown
- Redesign visual (branch `redesign-apple`): fonte do sistema, cantos arredondados, barra de abas e sheets de vidro, molas e gestos (sheet arrastável, voltar pela borda, chat que sobe de baixo), título grande que encolhe ao rolar, tema escuro e respeito a `prefers-reduced-motion`, `prefers-reduced-transparency` e `prefers-contrast`.
```

E nas "Pendências conhecidas", acrescentar:

```markdown
- O redesign foi verificado no harness local (banco simulado, sem IA, sem grupos reais, sem foto nem PDF). Falta conferir dentro do artifact publicado: o vidro (`backdrop-filter`) dentro do iframe do claude.ai, os gestos no celular real e o desempenho em aparelho fraco.
```

- [ ] **Step 6: Rodar tudo e commitar**

Run: `node --test tests/*.test.js`
Expected: todos passam (puros, importação, grupos, sintaxe, movimento, contraste).

```bash
git add publicar.html README.md docs/superpowers/specs/2026-10-27-redesign-apple-design.md
git commit -m "chore: limpeza do redesign, README e spec atualizados

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Auto-revisão

**Cobertura da spec:**
- Cores, tipografia, forma, sombra, espaço, materiais, componentes: Tasks 3, 4 e 5 (tokens e `.mat` na 3; componentes na 4; barra e botão na 5), com famílias nas Tasks 8 a 11.
- Núcleo de movimento puro (`molaPasso`, `projetar`, `elastico`, `velocidade`, `maisProximo`): Task 2. `animar`: `Mov.para` na Task 6.
- Pressão `scale(.97)`: Task 4 (regra compartilhada).
- Sheets: Task 6 (com os desvios 1 e 2 documentados).
- Transições (aba, push, pop), voltar por gesto, título grande, separador do cabeçalho (`.cab` com borda só quando ligado): Task 7.
- Vibração e feedback: Task 7 Step 5.
- Acessibilidade (reduced motion, transparency, contrast, foco): Tasks 3, 4, 6, 12.
- Seis mudanças de estrutura: (1) Hoje na Task 8; (2) Coach ao lado da barra e plano B de 360 px na Task 5, chat como rota que sobe na Task 7 (desvio 3); (3) voltar por gesto na Task 7; (4) título grande na Task 7; (5) Performance na Task 10; (6) onboarding na Task 11.
- Plano de 9 etapas da spec: Tasks 3 a 11 cobrem; harness e núcleo vêm antes (1 e 2); limpeza na 12.
- Verificação: harness (Task 1), `tests/movimento.test.js` (Task 2), `tests/contraste.test.js` (Task 3), roteiro visual em todas as tarefas.
- Riscos: material sólido (Tasks 3 e 12), `innerHTML` por render (Tasks 6 e 7: o estado inicial vai antes do quadro), 360 px (Task 5 Step 5), tamanho do arquivo (Task 12 Step 1), contraste do laranja (Task 3).

**Placeholders:** não há "TBD" nem "depois". Os passos de migração de estilos inline e de `--ink` trazem o comando que lista os casos (`grep`), a tabela de troca e exemplos; a decisão por ocorrência depende do que cada linha contém e não cabe listar sem ler o arquivo, então fica ancorada nesses comandos de listagem.

**Consistência de nomes:** `MOLAS`, `molaPasso`, `molaParada`, `projetar`, `elastico`, `velocidade`, `maisProximo`, `tipoTransicao` (Task 2) são os usados nas Tasks 6 e 7. `Mov.reduz/estado/aplicar/para/arrastarFechar` (Task 6) são os usados na 7 e na chat. `fecharSheet`, `montarSheet`, `proxTransicao`, `entrada`, `moverIndicador`, `tituloGrande`, `haptica`, `voltarPorGesto`, `proxCard` têm uma definição cada. Ids da casca: `cab`, `tabs`, `tabs-ind`, `fab`, `ov`, `app`, `ban`, `borda`, `cgrab`.
