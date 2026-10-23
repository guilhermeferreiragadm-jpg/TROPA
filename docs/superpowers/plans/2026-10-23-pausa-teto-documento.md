# Tropa: pausa, teto de carga e documento de fisioterapia, plano de implementação

> **Para quem executar:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans. Os passos usam caixas `- [ ]`.

**Objetivo:** adicionar ao app Tropa o modo pausa (doença/lesão) com volta gradual, um teto de aumento de carga semanal com explicação visível e a leitura de documento de fisioterapia que só deixa o plano mais conservador.

**Arquitetura:** o app é um arquivo único, `publicar.html`. Toda a matemática nova (pausa, rampa de volta, teto) vai num bloco puro delimitado por `/* @pure:start */` e `/* @pure:end */`, testado em Node por um harness que extrai o bloco. A integração com a tela, o `LOG` e o `P` fica em funções finas fora do bloco.

**Stack:** HTML, CSS e JS puro dentro do artifact do claude.ai (`window.claude.use("db"|"user"|"sample")`), Node 24 para os testes, pdf.js 3.11.174 via cdnjs apenas na Tarefa 5.

**Spec:** `docs/superpowers/specs/2026-10-23-pausa-teto-documento-design.md`

## Restrições globais
- Pasta de trabalho: `/Users/guilhermegomes/TROPA`. Arquivo editado e publicado: `publicar.html`. Não editar `index.html` nem `original-publicado.html`.
- A pasta **não é repositório git**: no lugar de commit, cada tarefa termina com uma cópia de segurança em `backups/`.
- Textos para o usuário em português do Brasil. Nunca usar travessão ou hífen no lugar de vírgula em texto corrido.
- O documento de fisioterapia **nunca** é guardado: só o resumo confirmado vai para `P.perfil.fisio`.
- A IA e qualquer documento só podem **reduzir** carga, nunca aumentar.
- Não mudar as regras do banco nem as capacidades do artifact (`db`, `user`, `sample` com imagens, `downloads`).
- O app só roda dentro do claude.ai: depois de cada tarefa com interface, republicar com `Artifact` no mesmo arquivo e conferir no link `https://claude.ai/artifact/Su8kaFAaifinor4vQ4mZeq`.
- Ao editar, usar `Edit` com trechos únicos (as linhas do arquivo mudam). Se um `old_string` não for único, aumente o trecho.

## Estrutura de arquivos
- Modificar: `publicar.html` (bloco puro, pausa, teto, documento).
- Criar: `tests/pure.test.js` (testes das funções puras), `tests/sintaxe.test.js` (garante que o `<script>` do app compila).
- Criar durante o trabalho: `backups/` (cópias de segurança).

---

### Tarefa 1: bloco puro de pausa, volta gradual e teto, com testes

**Arquivos:**
- Criar: `tests/pure.test.js`, `tests/sintaxe.test.js`
- Modificar: `publicar.html` (inserir o bloco puro antes de `/* ===================== PLANO NO DIA A DIA ===================== */`)

**Interfaces:**
- Produz (todas globais no script do app, sem DOM e sem `LOG`/`P`):
  - `diasPausa(ini, fim)`: dias inclusive entre duas datas `AAAA-MM-DD`.
  - `semanasDeslocadas(dias)`: 0 até 7 dias, senão `ceil(dias/7)`.
  - `rampaRetorno(dias)`: `{fatores:number[], refazer:boolean}`.
  - `pausaCobre(pausas, k)`: `true` se o dia `k` está dentro de uma pausa.
  - `deslocamentoEm(pausas, k)`: semanas deslocadas que valem para o dia `k`.
  - `fatorRetornoEm(pausas, k)`: fator de volume (1 se não houver rampa) para o dia `k`.
  - `semanaEm(plano, pausas, k)`: `{w, ini, sem}` já com deslocamento.
  - `semanasAtrasoProva(plano, pausas)`: semanas de atraso se o plano tem prova.
  - `escalarTreino(t, f)`: cópia do treino com volume `f` (0 a 1).
  - `minutosPlan(t)`, `prioridadeTreino(t)`.
  - `calcularTeto(feitas, perfilMin, limiteDoc)`: `{base, teto}` ou `null`.
  - `reduzirParaTeto(dias, teto)`: `{cortes:[{id,de,para}], total, excedeu}`.
- Consome: `DAY`, `parseD`, `addDays`, `key`, `dow` (já existem no topo do script).

- [ ] **Passo 1: cópia de segurança**

```bash
cd /Users/guilhermegomes/TROPA && mkdir -p backups tests && cp publicar.html backups/publicar-antes-tarefa1.html
```

- [ ] **Passo 2: escrever os testes que falham**

Criar `tests/pure.test.js`:

```js
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
const ctx = {}; vm.createContext(ctx);
vm.runInContext(ajudas + "\n" + puro + "\nthis.F = {diasPausa, semanasDeslocadas, rampaRetorno, pausaCobre, deslocamentoEm, fatorRetornoEm, semanaEm, semanasAtrasoProva, escalarTreino, minutosPlan, prioridadeTreino, calcularTeto, reduzirParaTeto};", ctx);
const F = ctx.F;

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
```

Criar `tests/sintaxe.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("o script do app compila", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
  const i = html.indexOf("<script>\n(function(){");
  const j = html.lastIndexOf("</script>");
  assert.ok(i > 0 && j > i, "não achei o script principal");
  assert.doesNotThrow(() => new vm.Script(html.slice(i + "<script>".length, j), {filename: "app.js"}));
});
```

- [ ] **Passo 3: rodar e ver falhar**

```bash
cd /Users/guilhermegomes/TROPA && node --test tests/*.test.js
```
Esperado: `pure.test.js` falha com "marcador não achado: /* @pure:start */". `sintaxe.test.js` deve passar (confirma o harness).

- [ ] **Passo 4: inserir o bloco puro**

Com `Edit`, em `publicar.html`, trocar o `old_string`
`/* ===================== PLANO NO DIA A DIA ===================== */`
por:

```js
/* @pure:start */
// Pausa, volta gradual e teto de carga: só dados, sem DOM, LOG ou P. Testado em tests/pure.test.js
const PRIO_CHAVE = 3, PRIO_RESTO = 1;
function diasPausa(ini, fim){ return Math.max(1, Math.round((parseD(fim) - parseD(ini))/DAY) + 1); }
function semanasDeslocadas(dias){ return dias <= 7 ? 0 : Math.ceil(dias/7); }
function rampaRetorno(dias){
  if (dias <= 3) return {fatores:[], refazer:false};
  if (dias <= 7) return {fatores:[0.8], refazer:false};
  if (dias <= 14) return {fatores:[0.6,0.8], refazer:false};
  return {fatores:[0.5,0.65,0.8], refazer: dias > 28};
}
function pausaCobre(pausas, k){ return pausas.some(p=>p.inicio <= k && (!p.fim || k <= p.fim)); }
function deslocamentoEm(pausas, k){ return pausas.reduce((s,p)=>s + (p.fim && k > p.fim ? (p.desl||0) : 0), 0); }
function fatorRetornoEm(pausas, k){
  const ps = pausas.filter(p=>p.fim && p.fim < k && (p.fatores||[]).length).sort((a,b)=>a.fim < b.fim ? 1 : -1);
  if (!ps.length) return 1;
  const sem = Math.floor((parseD(k) - addDays(parseD(ps[0].fim), 1))/DAY/7);
  const f = ps[0].fatores[sem];
  return f == null ? 1 : f;
}
function semanaEm(plano, pausas, k){
  const ini = addDays(parseD(plano.inicio), 7*deslocamentoEm(pausas, k));
  const w = Math.floor((parseD(k) - ini)/DAY/7) + 1;
  return {w, ini, sem: plano.semanas[w-1] || null};
}
function semanasAtrasoProva(plano, pausas){ return plano.semProva ? 0 : pausas.reduce((s,p)=>s + (p.desl||0), 0); }
function escalarTreino(t, f){
  if (!(f < 1)) return t;
  const c = Object.assign({}, t), msg = "Volta gradual: ~"+Math.round(f*100)+"% do volume de antes da pausa";
  if (t.km) c.km = Math.max(1, Math.round(t.km*f*2)/2);
  if (t.min) c.min = Math.max(10, Math.round(t.min*f));
  if (/forte/.test(t.z||"")){ c.z = "fácil"; c.ef = "até 5/10"; }
  if (t.k === "gym") c.passos = [msg+" (menos séries, carga leve)"].concat(t.passos||[]);
  else c.passos = [msg+": "+(c.km ? String(c.km).replace(".",",")+" km" : c.min+" min")+", em esforço de conversa"];
  return c;
}
const minutosPlan = t => t.min ? +t.min : (t.km ? Math.round(t.km*7) : 0);
function prioridadeTreino(t){ return /Longão|longa/i.test(t.t||"") || /forte/.test(t.z||"") ? PRIO_CHAVE : PRIO_RESTO; }
function calcularTeto(feitas, perfilMin, limiteDoc){
  const com = feitas.filter(m=>m>0);
  const base = com.length ? com.reduce((a,b)=>a+b,0)/com.length : (perfilMin||0);
  if (!(base > 0)) return limiteDoc > 0 ? {base:0, teto:Math.round(limiteDoc)} : null;
  let teto = Math.max(base*1.1, base+15);
  if (limiteDoc > 0) teto = Math.min(teto, limiteDoc);
  return {base:Math.round(base), teto:Math.round(teto)};
}
function reduzirParaTeto(dias, teto){
  let total = dias.reduce((s,d)=>s+d.min, 0); const cortes = [];
  if (total <= teto) return {cortes, total, excedeu:false};
  const cand = dias.filter(d=>!d.fixo && d.min > 0).sort((a,b)=>a.prio-b.prio || b.min-a.min);
  for (const d of cand){
    if (total <= teto) break;
    const novo = Math.round(d.min*0.6);
    cortes.push({id:d.id, de:d.min, para:novo}); total -= d.min - novo;
  }
  return {cortes, total, excedeu: total > teto};
}
/* @pure:end */

/* ===================== PLANO NO DIA A DIA ===================== */
```

- [ ] **Passo 5: rodar e ver passar**

```bash
cd /Users/guilhermegomes/TROPA && node --test tests/*.test.js
```
Esperado: todos os testes passam. A ordem de corte é "menor prioridade primeiro e, em empate, a maior duração": `seg` (40) e `qui` (30) têm prioridade 1, depois `dom` (90) e `qua` (45) têm prioridade 3.

- [ ] **Passo 6: cópia de segurança**

```bash
cd /Users/guilhermegomes/TROPA && cp publicar.html backups/publicar-tarefa1.html
```

---

### Tarefa 2: pausa no calendário (núcleo, sem tela nova)

**Arquivos:**
- Modificar: `publicar.html`

**Interfaces:**
- Consome: tudo da Tarefa 1; `P`, `LOG`, `planoAtual`, `salvarPerfil`, `render`, `key`, `today`, `addDays`.
- Produz:
  - `PAUSAS()`, `pausaAtiva()`, `pausasDoPlano()`, `NOMEPAUSA`.
  - `inicioPlano(d)`: `Date` de início do plano já deslocado para o dia `d`.
  - `async pausarPlano(tipo, motivo)`: `string`.
  - `async retomarPlano(dor)`: `{ok:boolean, msg:string}`.
  - `P.pausas`: `[{tipo, motivo, inicio, fim, plano, dias?, desl?, fatores?, refazer?}]`.

- [ ] **Passo 1: cópia de segurança**

```bash
cd /Users/guilhermegomes/TROPA && cp publicar.html backups/publicar-antes-tarefa2.html
```

- [ ] **Passo 2: helpers de pausa e `semanaDe` deslocada**

Trocar o `old_string`
`function semanaDe(d){ const pl = planoAtual(); if (!pl) return null; const ini = parseD(pl.inicio); const w = Math.floor((d - ini)/DAY/7)+1; return {w, sem: pl.semanas[w-1]||null}; }`
por:

```js
const NOMEPAUSA = {doenca:"doença", lesao:"lesão", outro:"outro motivo"};
const PAUSAS = () => (P && P.pausas) || [];
const pausaAtiva = () => PAUSAS().find(p=>!p.fim) || null;
const pausasDoPlano = () => { const pl = planoAtual(); return PAUSAS().filter(p=>p.plano === (pl && pl.geradoEm || null)); };
function inicioPlano(d){ const pl = planoAtual(); return addDays(parseD(pl.inicio), 7*deslocamentoEm(pausasDoPlano(), key(d))); }
function semanaDe(d){ const pl = planoAtual(); if (!pl) return null; const r = semanaEm(pl, pausasDoPlano(), key(d)); return {w:r.w, sem:r.sem}; }
async function pausarPlano(tipo, motivo){
  if (pausaAtiva()) return "já está em pausa";
  const pl = planoAtual();
  P.pausas = PAUSAS().concat([{tipo: NOMEPAUSA[tipo] ? tipo : "outro", motivo: String(motivo||"").slice(0,120), inicio:key(today), fim:null, plano: pl && pl.geradoEm || null}]);
  await salvarPerfil(); render(true);
  return "ok: plano em pausa a partir de hoje";
}
async function retomarPlano(dor){
  const pa = pausaAtiva(); if (!pa) return {ok:false, msg:"o plano não está em pausa"};
  if (pa.tipo==="lesao" && dor>=4) return {ok:false, msg:"Dor "+dor+"/10: ainda é cedo para voltar de uma lesão. Espere a dor baixar de 4 ou fale com seu fisioterapeuta."};
  const fim = key(addDays(today,-1));
  if (fim < pa.inicio){ P.pausas = PAUSAS().filter(p=>p!==pa); await salvarPerfil(); render(true); return {ok:true, msg:"Pausa cancelada: nada mudou no plano."}; }
  const dias = diasPausa(pa.inicio, fim), r = rampaRetorno(dias), desl = semanasDeslocadas(dias);
  Object.assign(pa, {fim, dias, desl, fatores:r.fatores, refazer:r.refazer});
  await salvarPerfil(); render(true);
  const pl = planoAtual(), atraso = pl ? semanasAtrasoProva(pl, pausasDoPlano()) : 0;
  return {ok:true, msg:"Bem-vindo de volta. "+dias+(dias===1?" dia parado":" dias parados")+(desl?", plano deslocado "+desl+(desl===1?" semana":" semanas"):"")+(r.fatores.length?". As primeiras semanas vão a "+r.fatores.map(f=>Math.round(f*100)+"%").join(", ")+" do volume":"")+"."+(r.refazer?" Pausa longa: considere refazer o plano em Perfil, Meu plano e objetivo.":"")+(atraso?" Atenção: sua prova chega antes do fim do plano deslocado. Refaça o plano em Perfil, Meu plano e objetivo.":"")};
}
```

- [ ] **Passo 3: `treinosDe` com pausa e volta gradual**

Trocar o `old_string`
`const k0 = key(d), b = treinosBase(d).map((t,j)=>{ const tr = LOG["tr_"+k0+"_"+j]; return tr && tr.treino ? tr.treino : t; }), aj = LOG["aj_"+k0];`
por:

```js
const k0 = key(d); if (pausaCobre(PAUSAS(), k0)) return [];
const fr = fatorRetornoEm(pausasDoPlano(), k0);
const b = treinosBase(d).map((t,j)=>{ const tr = LOG["tr_"+k0+"_"+j]; return escalarTreino(tr && tr.treino ? tr.treino : t, fr); }), aj = LOG["aj_"+k0];
```

- [ ] **Passo 4: foguinho congelado na pausa**

Trocar `if (ativoNoDia(k)){ n++; d = addDays(d,-1); continue; }` por:

```js
if (ativoNoDia(k)){ n++; d = addDays(d,-1); continue; }
    if (pausaCobre(PAUSAS(), k)){ d = addDays(d,-1); continue; }
```
Trocar `const estado = hojeOk ? "aceso" : (n>0 ? "risco" : "apagado");` por:

```js
const estado = hojeOk ? "aceso" : (pausaCobre(PAUSAS(), key(today)) ? "pausa" : (n>0 ? "risco" : "apagado"));
```
(O aviso de "foguinho em risco" só aparece com `estado==="risco"`, então o estado "pausa" não dispara alerta.)

- [ ] **Passo 5: "Dia N" e "Seu plano começa" usam o início deslocado**

Trocar `Math.round((today-parseD(pl.inicio))/DAY)+1` por `Math.round((today-inicioPlano(today))/DAY)+1`.
Trocar `fmt(parseD(planoAtual().inicio))` por `fmt(inicioPlano(today))`.

- [ ] **Passo 6: `enviarPerfil` não pode apagar a pausa**

Trocar `P = {perfil:p, plano, viol};` por:

```js
const pausasAnt = (P && P.pausas) || [];
  P = {perfil:p, plano, viol, pausas:pausasAnt};
```

- [ ] **Passo 7: verificar**

```bash
cd /Users/guilhermegomes/TROPA && node --test tests/*.test.js && grep -c 'pausaCobre(PAUSAS()' publicar.html
```
Esperado: testes passam; o `grep` imprime `3` (treinosDe, foguinho loop, foguinho estado).

- [ ] **Passo 8: cópia de segurança**

```bash
cd /Users/guilhermegomes/TROPA && cp publicar.html backups/publicar-tarefa2.html
```

---

### Tarefa 3: pausa na interface e no coach

**Arquivos:**
- Modificar: `publicar.html`

**Interfaces:**
- Consome: Tarefa 2 (`pausarPlano`, `retomarPlano`, `pausaAtiva`, `NOMEPAUSA`, `PAUSAS`), `painScale`, `bindPain`, `toast`, `$("ov")`.
- Produz: `sheetPausar()`, `sheetRetomar()`, `pausaTxt()`, e duas ferramentas do coach (`pausar_plano`, `retomar_plano`).

- [ ] **Passo 1: cópia de segurança**

```bash
cd /Users/guilhermegomes/TROPA && cp publicar.html backups/publicar-antes-tarefa3.html
```

- [ ] **Passo 2: as duas folhas (sheets) e o texto de contexto**

Inserir, com `Edit`, antes de `/* ===================== SEMANA ===================== */`. Trocar esse `old_string` por:

```js
function sheetPausar(){
  const ov = $("ov"); let tipo = "doenca";
  ov.innerHTML = '<div class="dim" id="dim"></div><div class="sheet" role="dialog" aria-label="Pausar plano"><span class="grab"></span><h2 class="h2" style="font-size:1.7rem">Pausar o plano?</h2><p>Os dias de pausa saem do calendário, não contam como falta e o foguinho fica congelado. Na volta, o plano começa mais leve.</p>'+
    '<span class="k">motivo</span><div class="seg" style="--c:3" id="pt">'+[["doenca","Doença"],["lesao","Lesão"],["outro","Outro"]].map(([v,l])=>'<button type="button" data-v="'+v+'" aria-pressed="'+(v===tipo)+'">'+l+'</button>').join("")+'</div>'+
    '<input class="inp" id="pm" maxlength="120" placeholder="Quer contar o que houve? (opcional)"><button type="button" class="btn go" id="pok">Pausar a partir de hoje</button><button type="button" class="lk" id="pno">Cancelar</button></div>';
  const fecha = () => { ov.innerHTML = ""; };
  $("dim").addEventListener("click", fecha); $("pno").addEventListener("click", fecha);
  $("pt").addEventListener("click", e=>{ const b = e.target.closest("button[data-v]"); if (!b) return; tipo = b.dataset.v; $("pt").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", String(x===b))); });
  $("pok").addEventListener("click", async ()=>{ await pausarPlano(tipo, $("pm").value); fecha(); toast("Plano em pausa. Melhoras!"); });
}
function sheetRetomar(){
  const ov = $("ov"), pa = pausaAtiva(); if (!pa) return; let dor = 0;
  ov.innerHTML = '<div class="dim" id="dim"></div><div class="sheet" role="dialog" aria-label="Voltar a treinar"><span class="grab"></span><h2 class="h2" style="font-size:1.7rem">Voltar a treinar?</h2><p>Como está a dor agora?'+(pa.tipo==="lesao"?' Em lesão, só volto com dor abaixo de 4.':'')+'</p>'+painScale("dor", 0)+
    '<button type="button" class="btn go" id="vok">Voltar ao plano</button><button type="button" class="lk" id="vno">Ainda não</button><p class="msg" id="vm"></p></div>';
  const fecha = () => { ov.innerHTML = ""; };
  $("dim").addEventListener("click", fecha); $("vno").addEventListener("click", fecha);
  bindPain(ov, (n,v)=>{ dor = v; });
  $("vok").addEventListener("click", async ()=>{ const r = await retomarPlano(dor); if (!r.ok){ $("vm").textContent = r.msg; $("vm").className = "msg err"; return; } fecha(); toast(r.msg); });
}
function pausaTxt(){
  const pa = pausaAtiva(); if (!pa) return "";
  return "PLANO EM PAUSA desde "+pa.inicio+" ("+(NOMEPAUSA[pa.tipo]||"pausa")+(pa.motivo?": "+pa.motivo:"")+"). Não há treino no calendário. Acolha, não empurre treino, e quando ele disser que está bem pergunte a dor e use retomar_plano.\n";
}

/* ===================== SEMANA ===================== */
```

- [ ] **Passo 3: banner e botão na tela Hoje**

Trocar o `old_string`
`'<div class="recado"><b>Recado do coach</b>'+esc(recadoCoach())+'</div>'+`
por:

```js
'<div class="recado"><b>Recado do coach</b>'+esc(recadoCoach())+'</div>'+
    (pausaAtiva() ? '<div class="flag"><b>Plano em pausa</b> desde '+esc(fmt(parseD(pausaAtiva().inicio)))+' · '+esc(NOMEPAUSA[pausaAtiva().tipo]||"pausa")+'<br><button type="button" class="btn go" id="pv" style="margin-top:8px">Voltar a treinar</button></div>' : '<button type="button" class="lk" id="pz">Doente ou machucado? Pausar o plano</button>')+
```
Trocar o `old_string`
`const u = $("undo"); if (u) u.addEventListener("click", ()=>salvarLog("aj_"+k, null).then(()=>{ render(true); toast("Treino de hoje voltou ao plano."); }));`
por esse mesmo texto seguido de:

```js
if ($("pz")) $("pz").addEventListener("click", sheetPausar);
  if ($("pv")) $("pv").addEventListener("click", sheetRetomar);
```

- [ ] **Passo 3b: check-in oferece a pausa quando a dor persiste**

Em `sheetCheckin`, trocar o `old_string`
`else if (v.dor>=5 && treinosDe(today).length) sheetAjuste("Dor "+v.dor+"/10 pede trocar o treino de hoje.");`
por:

```js
else if (!pausaAtiva() && v.dor>=5 && (LOG["ci_"+key(addDays(today,-1))]||{}).dor>=5){ toast("Dor forte dois dias seguidos. Que tal pausar o plano?"); setTimeout(sheetPausar, 700); }
    else if (v.dor>=5 && treinosDe(today).length) sheetAjuste("Dor "+v.dor+"/10 pede trocar o treino de hoje.");
```
(Para testar: no console, `LOG["ci_<ontem>"]={sono:7,humor:3,dor:6}` e faça o check-in de hoje com dor 6: a folha "Pausar o plano?" deve abrir.)

- [ ] **Passo 4: recado do coach durante a pausa**

Trocar `const ts = treinosDe(today), c = LOG["ci_"+key(today)], s = semanaDe(today), pr = prontidao(c);` por esse mesmo texto seguido de:

```js
const pa = pausaAtiva();
  if (pa) return "Plano em pausa por "+(NOMEPAUSA[pa.tipo]||"motivo pessoal")+". Descanse sem culpa: o foguinho fica guardado. Quando se sentir bem, toque em Voltar a treinar.";
```

- [ ] **Passo 5: Semana mostra os dias de pausa**

Trocar `(LOG["aj_"+kd]?'ajustado pelo coach':'sono e mobilidade')` por:

```js
(pausaCobre(PAUSAS(),kd)?'plano em pausa':LOG["aj_"+kd]?'ajustado pelo coach':'sono e mobilidade')
```

- [ ] **Passo 6: ferramentas e contexto do coach**

Trocar o `old_string`
`mudancas.push(fmt(d)+": "+({pular:"treino cancelado",descanso:"virou descanso",leve:"versão leve"}[inp.acao])+(inp.motivo?" ("+inp.motivo+")":"")); return "ok: calendário atualizado"; }}`
por esse mesmo texto seguido de:

```js
,
    {name:"pausar_plano", description:"Pausa o plano inteiro a partir de hoje quando o usuário disser que está doente, machucado ou impossibilitado de treinar por vários dias. Use só depois que ele concordar. Os dias de pausa saem do calendário e o foguinho fica congelado.",
     inputSchema:{type:"object",properties:{tipo:{type:"string",enum:["doenca","lesao","outro"]},motivo:{type:"string",description:"1 frase curta"}},required:["tipo"]},
     execute:async(inp)=>{ const r = await pausarPlano(inp.tipo, inp.motivo); mudancas.push("Plano em pausa ("+(NOMEPAUSA[inp.tipo]||"outro")+")"); return r; }},
    {name:"retomar_plano", description:"Tira o plano da pausa. Pergunte a dor atual de 0 a 10 antes. Em lesão, dor 4 ou mais bloqueia a volta (a ferramenta avisa).",
     inputSchema:{type:"object",properties:{dor:{type:"integer",minimum:0,maximum:10}},required:["dor"]},
     execute:async(inp)=>{ const r = await retomarPlano(+inp.dor||0); if (r.ok) mudancas.push("Voltou da pausa"); return r.msg; }}
```
Trocar `memTxt+naoFeitos+cal+plano+` por `memTxt+naoFeitos+cal+pausaTxt()+plano+`.

- [ ] **Passo 7: verificar e publicar**

```bash
cd /Users/guilhermegomes/TROPA && node --test tests/*.test.js && cp publicar.html backups/publicar-tarefa3.html
```
Depois, republicar com a ferramenta `Artifact` (`file_path` = `/Users/guilhermegomes/TROPA/publicar.html`, sem passar `capabilities`) e conferir no link, nesta ordem:
1. Hoje mostra o botão "Doente ou machucado? Pausar o plano".
2. Pausar como "Doença": o banner aparece, Hoje fica sem treinos e a Semana mostra "plano em pausa" nos dias de hoje em diante.
3. Voltar: pausa de 1 dia (mesmo dia) cancela sem mudar nada; com a pausa criada hoje e retomada hoje a mensagem é "Pausa cancelada".
4. Para testar a volta gradual sem esperar dias, no console do navegador: `P.pausas[0].inicio="<data de 10 dias atrás>"` e clique em Voltar: a mensagem deve citar "10 dias", "plano deslocado 2 semanas" e "60%, 80%".
5. Em "Lesão" com dor 5 na tela de volta: bloqueia com a mensagem.
6. Mudar o objetivo durante uma pausa ativa: a pausa continua (banner presente).

---

### Tarefa 4: teto de carga semanal com explicação visível

**Arquivos:**
- Modificar: `publicar.html`

**Interfaces:**
- Consome: `calcularTeto`, `reduzirParaTeto`, `minutosPlan`, `prioridadeTreino` (Tarefa 1); `horasSemana(ini)` (já existe, devolve horas por modalidade); `treinosDe`, `feito`, `salvarLog`, `registrarErro`, `pausaAtiva`.
- Produz: `aplicarTeto()`, `manterPlanoOriginal(ini)`, `LOG["teto_<segunda>"] = {base, teto, de, para, cortes, excedeu, at}`, `LOG["teto_off_<segunda>"] = true`, e o campo `por` (`"teto"|"dor"|"prontidao"|"coach"`) nos ajustes `aj_`.

- [ ] **Passo 1: cópia de segurança**

```bash
cd /Users/guilhermegomes/TROPA && cp publicar.html backups/publicar-antes-tarefa4.html
```

- [ ] **Passo 2: `aplicarTeto` e `manterPlanoOriginal`**

Inserir antes de `/* ===================== SEMANA ===================== */` (trocar esse `old_string` por este bloco seguido da mesma linha):

```js
function minFeitosSemana(ini){ const h = horasSemana(ini); return Math.round(Object.values(h).reduce((a,b)=>a+b,0)*60); }
function aplicarTeto(){
  if (!P || !P.perfil || !planoAtual() || pausaAtiva()) return;
  const seg0 = addDays(today, -dow(today));
  [0,1].forEach(n=>{
    const ini = addDays(seg0, 7*n), wk = key(ini);
    if (LOG["teto_off_"+wk] || LOG["teto_"+wk]) return;
    const feitas = [1,2,3].map(i=>minFeitosSemana(addDays(seg0, -7*i)));
    const perfilMin = (+P.perfil.kmSemana||0)*7;
    const lim = P.perfil.fisio && +P.perfil.fisio.limiteMinSemana || 0;
    const ct = calcularTeto(feitas, perfilMin, lim); if (!ct) return;
    const dias = [];
    for (let i=0;i<7;i++){
      const d = addDays(ini,i), k = key(d), ts = treinosDe(d);
      dias.push({id:k, min:ts.reduce((s,t)=>s+minutosPlan(t),0), prio:ts.length?Math.max(...ts.map(prioridadeTreino)):0,
        fixo: d < today || ts.some((t,j)=>feito(d,j)) || !!LOG["aj_"+k]});
    }
    const antes = dias.reduce((s,d)=>s+d.min,0), r = reduzirParaTeto(dias, ct.teto);
    if (!r.cortes.length) return;
    const at = new Date().toISOString();
    r.cortes.forEach(c=>salvarLog("aj_"+c.id, {acao:"leve", por:"teto", motivo:"Teto de carga: a semana passava de "+antes+" min e o limite é "+ct.teto+" min (+10% do que você vem fazendo)", at}));
    salvarLog("teto_"+wk, {base:ct.base, teto:ct.teto, de:antes, para:r.total, cortes:r.cortes.length, excedeu:r.excedeu, at});
  });
}
async function manterPlanoOriginal(ini){
  for (let i=0;i<7;i++){ const k = key(addDays(ini,i)), a = LOG["aj_"+k]; if (a && a.por==="teto") await salvarLog("aj_"+k, null); }
  await salvarLog("teto_"+key(ini), null); await salvarLog("teto_off_"+key(ini), true);
  render(true); toast("Plano original mantido nesta semana.");
}

/* ===================== SEMANA ===================== */
```

Observação de projeto: a presença de `LOG["teto_"+wk]` impede refazer o corte na mesma semana (evita que o botão "manter original" seja desfeito e evita recorte em cascata). Se a pessoa quiser recalcular, apague a chave no console durante o teste.

- [ ] **Passo 3: chamar o teto a cada render**

Trocar `function render(keep){` por:

```js
function render(keep){
  try{ aplicarTeto(); }catch(e){ registrarErro("teto", e); }
```

- [ ] **Passo 4: motivo e origem em todo ajuste**

Trocar `await salvarLog("aj_"+dk, {acao:b.dataset.a, motivo:motivo.slice(0,100), at:new Date().toISOString()});` por:

```js
await salvarLog("aj_"+dk, {acao:b.dataset.a, por:/^Dor/.test(motivo)?"dor":"prontidao", motivo:motivo.slice(0,100), at:new Date().toISOString()});
```
Trocar `await salvarLog("aj_"+key(d), {acao:inp.acao, motivo:String(inp.motivo||"").slice(0,140), at:new Date().toISOString()});` por:

```js
await salvarLog("aj_"+key(d), {acao:inp.acao, por:"coach", motivo:String(inp.motivo||"").slice(0,140), at:new Date().toISOString()});
```

- [ ] **Passo 5: desfazer em Hoje respeita o teto**

Trocar o `old_string`
`const u = $("undo"); if (u) u.addEventListener("click", ()=>salvarLog("aj_"+k, null).then(()=>{ render(true); toast("Treino de hoje voltou ao plano."); }));`
por:

```js
const u = $("undo"); if (u) u.addEventListener("click", ()=>{ if (aj && aj.por==="teto") return manterPlanoOriginal(addDays(today, -dow(today))); return salvarLog("aj_"+k, null).then(()=>{ render(true); toast("Treino de hoje voltou ao plano."); }); });
```
Atenção: se a Tarefa 3 já acrescentou as linhas `if ($("pz"))...` logo depois da linha antiga, mantenha-as após esta nova linha.

- [ ] **Passo 6: card na Semana e motivo nos dias ajustados**

Trocar `'<div class="phase">'+fasesDe(pl).map(` por:

```js
(LOG["teto_"+key(base0)] ? (tt=>'<div class="flag"><b>Carga reduzida por segurança.</b> Esta semana passava de '+tt.de+' min e o limite é '+tt.teto+' min (+10% do que você vem fazendo). Passei '+tt.cortes+(tt.cortes===1?' dia':' dias')+' para a versão leve.'+(tt.excedeu?' Ainda ficou acima do limite: fale com o coach.':'')+' <button type="button" class="lk" id="toff" style="padding:0">manter o plano original</button></div>')(LOG["teto_"+key(base0)]) : '')+
    '<div class="phase">'+fasesDe(pl).map(
```
Trocar `LOG["aj_"+kd]?' · ajustado':''` por:

```js
LOG["aj_"+kd]?' · '+esc((LOG["aj_"+kd].motivo||"ajustado").slice(0,60)):''
```
No fim de `telaSemana`, depois de `$("mob").addEventListener(...)`, acrescentar:

```js
if ($("toff")) $("toff").addEventListener("click", ()=>manterPlanoOriginal(base0));
```
(Trocar `$("mob").addEventListener("click", ()=>{ Object.assign(draft, P.perfil); mudandoObjetivo = true; onb(1); });` por esse texto seguido da linha acima.)

- [ ] **Passo 7: verificar e publicar**

```bash
cd /Users/guilhermegomes/TROPA && node --test tests/*.test.js && cp publicar.html backups/publicar-tarefa4.html
```
Republicar com `Artifact` e conferir, nesta ordem:
1. Conta nova sem histórico: informe `kmSemana` alto (por exemplo 10 km) e plano com semana atual acima de `10*7*1,1 = 77 min`. Abrir Semana: aparece o card "Carga reduzida por segurança" e dias futuros ficam "· Teto de carga: …".
2. Dias passados e dias já feitos da semana não mudam.
3. Tocar "manter o plano original": o card some, os dias voltam e não são cortados de novo ao recarregar (existe `teto_off_`).
4. Em Hoje, num dia cortado pelo teto, "desfazer" também mantém o original da semana inteira.
5. Fazer check-in com dor 5 e aceitar "Versão leve": o motivo "Dor 5/10 pede trocar o treino de hoje." aparece em Hoje e em Semana.

---

### Tarefa 5: documento de fisioterapia

**Arquivos:**
- Modificar: `publicar.html`

**Interfaces:**
- Consome: `sample` (`limits()`, `json()` com `images`), `comTempo`, `salvarPerfil`, `salvarRascunho`, `draft`, `P.perfil`, `esc`, `toast`, `$("ov")`.
- Produz:
  - `P.perfil.fisio` e `draft.fisio`: `{lesao, regiao, fase, evitar:[], permitido:[], limiteMinSemana:number|null, retorno, fonte:"informado pelo usuário", data, confirmadoEm}`.
  - `async carregarPdfJs()`, `async paginasParaImagens(file, max)`, `async lerDocumento(file)`, `sheetDocumento(onboarding)`, `restricoesTxt()`.

- [ ] **Passo 1: cópia de segurança**

```bash
cd /Users/guilhermegomes/TROPA && cp publicar.html backups/publicar-antes-tarefa5.html
```

- [ ] **Passo 2: validar a leitura de PDF antes de construir a tela (spike)**

O PDF depende de baixar o pdf.js e o worker do cdnjs dentro do artifact. Antes de continuar, acrescentar **temporariamente** no fim do `<script>` (antes de `})();`) o teste abaixo, republicar e abrir o console do navegador no artifact:

```js
window.__spikePdf = async ()=>{ const L = await carregarPdfJs(); return typeof L.getDocument; };
```
junto com a função `carregarPdfJs` do Passo 3. No console: `await __spikePdf()` deve devolver `"function"`. Se falhar (bloqueio de rede ou de worker), **não** construa o caminho de PDF: pule `paginasParaImagens`, aceite só imagem e mostre "Para PDF, tire uma foto ou print da página". Depois do teste, remova a linha `window.__spikePdf`.

- [ ] **Passo 3: leitura do arquivo e extração por IA**

Inserir antes de `/* ===================== SAÚDE ===================== */` (trocar esse `old_string` por este bloco seguido da mesma linha):

```js
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
async function carregarPdfJs(){
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((ok,err)=>{ const s = document.createElement("script"); s.src = PDFJS+"pdf.min.js"; s.onload = ok; s.onerror = err; document.head.appendChild(s); });
  const w = await (await fetch(PDFJS+"pdf.worker.min.js")).text();
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([w], {type:"text/javascript"}));
  return window.pdfjsLib;
}
async function paginasParaImagens(file, max){
  const lib = await carregarPdfJs(), doc = await lib.getDocument({data: await file.arrayBuffer()}).promise, out = [];
  for (let i=1; i<=Math.min(doc.numPages, max); i++){
    const pg = await doc.getPage(i), vp = pg.getViewport({scale:1.5}), cv = document.createElement("canvas");
    cv.width = vp.width; cv.height = vp.height;
    await pg.render({canvasContext: cv.getContext("2d"), viewport: vp}).promise;
    out.push(await new Promise(res=>cv.toBlob(res, "image/jpeg", 0.85)));
  }
  return out;
}
async function lerDocumento(file){
  if (!sample) throw new Error("A IA não está disponível agora.");
  const lim = await comTempo(sample.limits(), 5000).catch(()=>null);
  if (!lim || !lim.images) throw new Error("Este app não pode ler imagens agora.");
  if (file.size > lim.images.maxInputBytes) throw new Error("Arquivo grande demais. Tire uma foto menor.");
  let imagens;
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)){
    try{ imagens = await paginasParaImagens(file, Math.min(4, lim.images.maxCount)); }
    catch(e){ throw new Error("Não consegui abrir o PDF aqui. Tire uma foto ou print da página."); }
  } else if (lim.images.mediaTypes.includes(file.type)) imagens = [file];
  else throw new Error("Formato não aceito. Use foto (JPEG, PNG, WebP) ou PDF.");
  const r = await comTempo(sample.json(
    "Você lê documentos de fisioterapia, ortopedia ou laudos de lesão esportiva escritos em português. Extraia SOMENTE o que está escrito, sem inventar e sem dar conselho. Se um campo não aparece, use null ou lista vazia. Responda só JSON: "+
    "{\"lesao\":\"diagnóstico em poucas palavras\",\"regiao\":\"parte do corpo\",\"fase\":\"fase atual do tratamento\",\"evitar\":[\"movimentos ou cargas a evitar\"],\"permitido\":[\"o que está liberado\"],\"limiteMinSemana\":número de minutos de treino por semana permitidos ou null,\"retorno\":\"prazo ou critério de retorno\",\"confianca\":\"alta|media|baixa\"}. Use confianca baixa se a letra ou a imagem estiver difícil de ler.",
    {images:imagens, cache:false}), 45000);
  if (!r || typeof r !== "object") throw new Error("Não consegui ler o documento.");
  const lista = a => (Array.isArray(a)?a:[]).slice(0,8).map(x=>String(x).slice(0,120));
  return {lesao:String(r.lesao||"").slice(0,120), regiao:String(r.regiao||"").slice(0,60), fase:String(r.fase||"").slice(0,120), evitar:lista(r.evitar), permitido:lista(r.permitido),
    limiteMinSemana:(+r.limiteMinSemana>0 && +r.limiteMinSemana<=1200)?Math.round(+r.limiteMinSemana):null, retorno:String(r.retorno||"").slice(0,160), confianca:/^(alta|media|baixa)$/.test(r.confianca)?r.confianca:"baixa"};
}
function restricoesTxt(){
  const r = P && P.perfil && P.perfil.fisio; if (!r || !r.lesao) return "";
  return "RESTRIÇÕES INFORMADAS PELO USUÁRIO (de documento de fisioterapeuta, confirmado por ele; só podem reduzir carga, nunca aumentar; em conflito vale o profissional): lesão "+r.lesao+(r.regiao?" ("+r.regiao+")":"")+(r.fase?", fase "+r.fase:"")+". EVITAR: "+(r.evitar.join("; ")||"não informado")+". PERMITIDO: "+(r.permitido.join("; ")||"não informado")+"."+(r.limiteMinSemana?" LIMITE: "+r.limiteMinSemana+" min de treino por semana.":"")+(r.retorno?" RETORNO: "+r.retorno+".":"")+"\n";
}

/* ===================== SAÚDE ===================== */
```

- [ ] **Passo 4: a folha de envio, revisão e confirmação**

Inserir logo depois de `restricoesTxt` (dentro do mesmo trecho, antes do marcador SAÚDE) esta função:

```js
function sheetDocumento(onboarding){
  const ov = $("ov"), alvo = () => onboarding ? draft : P.perfil, atual = alvo().restricoes || null;
  let rascunho = atual ? JSON.parse(JSON.stringify(atual)) : null;
  const campo = (id, rot, v) => '<div class="fld"><label for="'+id+'">'+rot+'</label><input class="inp" id="'+id+'" value="'+esc(v||"")+'"></div>';
  const lst = id => rascunho ? (rascunho[id]||[]).join("; ") : "";
  const desenha = () => {
    ov.innerHTML = '<div class="dim" id="dim"></div><div class="sheet" role="dialog" aria-label="Documento de fisioterapia"><span class="grab"></span><h2 class="h2" style="font-size:1.6rem">Laudo ou orientação do fisioterapeuta</h2>'+
      '<p class="s">A IA lê o documento e preenche um resumo. Você confere e edita. <b>O arquivo não é guardado</b>, só o resumo. O app só usa isso para deixar seu plano mais cuidadoso e não substitui seu fisioterapeuta: em dúvida, vale o que ele disse.</p>'+
      (rascunho ? '<div class="box">'+(rascunho.confianca==="baixa"?'<div class="flag">Li com pouca certeza. Confira tudo ou digite você mesmo.</div>':'')+
        campo("dl","Lesão",rascunho.lesao)+campo("dr","Região",rascunho.regiao)+campo("df","Fase do tratamento",rascunho.fase)+campo("de","O que evitar (separe com ponto e vírgula)",lst("evitar"))+campo("dp","O que está liberado",lst("permitido"))+
        '<div class="fld"><label for="dm">Limite de treino por semana (minutos, se o documento disser)</label><input class="inp" id="dm" type="number" inputmode="numeric" min="0" max="1200" value="'+(rascunho.limiteMinSemana||"")+'"></div>'+campo("dt","Prazo ou critério de retorno",rascunho.retorno)+
        '<label class="chk"><input type="checkbox" id="dc"><span>Autorizo usar este resumo, que contém dado de saúde, para ajustar meu plano e as respostas do coach e da nutri.</span></label>'+
        '<button type="button" class="btn go" id="dok">Confirmar resumo</button>'+(atual?'<button type="button" class="lk" id="dapaga" style="color:var(--stop)">Apagar meu resumo</button>':'')+'</div>' :
        '<label class="btn ink" for="darq" style="display:block;text-align:center">Escolher foto ou PDF</label><input type="file" id="darq" accept="image/jpeg,image/png,image/webp,application/pdf" hidden><button type="button" class="lk" id="dman">Prefiro digitar</button>')+
      '<p class="msg" id="dmsg"></p></div>';
    $("dim").addEventListener("click", ()=>{ ov.innerHTML = ""; });
    if ($("darq")) $("darq").addEventListener("change", async e=>{
      const f = e.target.files && e.target.files[0]; if (!f) return;
      $("dmsg").textContent = "Lendo o documento…"; $("dmsg").className = "msg";
      try{ rascunho = await lerDocumento(f); desenha(); }catch(err){ $("dmsg").textContent = err.message || "Não consegui ler agora."; $("dmsg").className = "msg err"; }
    });
    if ($("dman")) $("dman").addEventListener("click", ()=>{ rascunho = {lesao:"", regiao:"", fase:"", evitar:[], permitido:[], limiteMinSemana:null, retorno:"", confianca:"alta"}; desenha(); });
    if ($("dapaga")) $("dapaga").addEventListener("click", async ()=>{ delete alvo().restricoes; if (onboarding) salvarRascunho(); else await salvarPerfil(); ov.innerHTML = ""; toast("Resumo apagado."); if (!onboarding) render(true); });
    if ($("dok")) $("dok").addEventListener("click", async ()=>{
      if (!$("dc").checked){ $("dmsg").textContent = "Marque a autorização para guardar o resumo."; $("dmsg").className = "msg err"; return; }
      const quebra = v => String(v||"").split(";").map(x=>x.trim()).filter(Boolean).slice(0,8).map(x=>x.slice(0,120));
      const lm = +$("dm").value;
      const r = {lesao:$("dl").value.trim().slice(0,120), regiao:$("dr").value.trim().slice(0,60), fase:$("df").value.trim().slice(0,120), evitar:quebra($("de").value), permitido:quebra($("dp").value),
        limiteMinSemana:(lm>0&&lm<=1200)?Math.round(lm):null, retorno:$("dt").value.trim().slice(0,160), fonte:"informado pelo usuário", data:key(today), confirmadoEm:new Date().toISOString()};
      if (!r.lesao){ $("dmsg").textContent = "Diga qual é a lesão."; $("dmsg").className = "msg err"; return; }
      alvo().restricoes = r; if (onboarding) salvarRascunho(); else await salvarPerfil();
      ov.innerHTML = ""; toast("Resumo salvo. Seu plano vai ficar mais cuidadoso."); if (!onboarding) render(true);
    });
  };
  desenha();
}
```

- [ ] **Passo 5: pontos de entrada (onboarding e Perfil) e uso nos prompts e na triagem**

Onboarding, tela do objetivo. Trocar `'<button type="button" class="lk" id="sug">Não sei. Me sugere.</button>'+nav();` por:

```js
'<button type="button" class="lk" id="sug">Não sei. Me sugere.</button>'+
      '<button type="button" class="lk" id="docb">'+(draft.fisio&&draft.fisio.lesao?'✓ Laudo informado: '+esc(draft.fisio.lesao)+' (editar)':'Tenho laudo ou orientação de fisioterapeuta')+'</button>'+nav();
```
Trocar `const sg = $("sug"); if (sg) sg.addEventListener("click", ()=>{ draft.temProva = "sugere"; onb(2); });` por esse texto seguido de:

```js
const db0 = $("docb"); if (db0) db0.addEventListener("click", ()=>sheetDocumento(true));
```
Perfil. Trocar `'<button type="button" id="obj">Meu plano e objetivo<small>mudar objetivo ou adicionar prova</small><span>→</span></button>'+` por esse texto seguido de:

```js
'<button type="button" id="doc">Laudo de fisioterapia<small>'+(p.restricoes&&p.restricoes.lesao?esc(p.restricoes.lesao)+' · toque para editar':'suba um documento para o plano respeitar sua lesão')+'</small><span>→</span></button>'+
```
Trocar `$("obj").addEventListener("click", ()=>{ Object.assign(draft, P.perfil); mudandoObjetivo = true; onb(1); });` por esse texto seguido de:

```js
$("doc").addEventListener("click", ()=>sheetDocumento(false));
```
Triagem. Em `flagsDe`, trocar `if ((+p.sono||7) <= 5) amarelo.push("Dorme 5 h ou menos");` por esse texto seguido de:

```js
if (p.restricoes && p.restricoes.lesao) amarelo.push("Lesão em acompanhamento: "+String(p.restricoes.lesao).slice(0,60));
```
Coach e Nutri. Trocar `memTxt+naoFeitos+cal+pausaTxt()+plano+` por `memTxt+naoFeitos+cal+pausaTxt()+restricoesTxt()+plano+`.

- [ ] **Passo 6: verificar e publicar**

```bash
cd /Users/guilhermegomes/TROPA && node --test tests/*.test.js && cp publicar.html backups/publicar-tarefa5.html
```
Republicar com `Artifact` (sem `capabilities`, o `sample` com imagens já está declarado) e conferir, nesta ordem:
1. Perfil mostra "Laudo de fisioterapia". Tocar abre a folha.
2. Enviar uma foto de um documento de teste (use um texto digitado em papel ou um exemplo seu; **não use laudo real de terceiros**): aparece "Lendo o documento…" e depois o resumo editável. Documento ilegível deve mostrar o aviso de pouca certeza.
3. Sem marcar a autorização, "Confirmar resumo" pede a marcação. Marcando, salva e o Perfil mostra a lesão.
4. "Apagar meu resumo" remove.
5. Digitar à mão (botão "Prefiro digitar") funciona sem IA.
6. Com `limiteMinSemana` preenchido, voltar à Semana: o teto passa a respeitar o limite (se a semana passar do limite, aparece o card de carga reduzida).
7. No chat do coach, perguntar "o que eu devo evitar?": a resposta deve citar as restrições confirmadas.
8. PDF: se o Passo 2 deu certo, enviar um PDF de uma página e conferir que leu; se falhou, a mensagem de fallback aparece.
9. Confirmar no console que nada foi guardado do arquivo: `JSON.stringify(P).length` não cresce com o tamanho do arquivo e não há `data:` no perfil.

---

### Tarefa 6: fechamento

- [ ] **Passo 1: todos os testes e checagem final**

```bash
cd /Users/guilhermegomes/TROPA && node --test tests/*.test.js && grep -c '@pure:start' publicar.html
```
Esperado: testes passam e o `grep` imprime `1`.

- [ ] **Passo 2: sincronizar o `index.html`**

```bash
cd /Users/guilhermegomes/TROPA && { echo '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'; cat publicar.html; } > index.html
```

- [ ] **Passo 3: publicar a versão final**

Publicar `publicar.html` com `Artifact` e repetir os roteiros de verificação das Tarefas 3, 4 e 5 uma vez no artifact publicado. Informar ao usuário o que foi exercitado e o que ficou sem teste (por exemplo, leitura de PDF se o Passo 2 da Tarefa 5 falhou).
