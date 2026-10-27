# Fase 2: ritmo da semana Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resumo de domingo com pergunta sobre o corpo e sugestão de aliviar, sugestão de carga da musculação que considera prontidão e dor, e lista de compras da semana montada pela Nutri.

**Architecture:** Regras novas viram funções puras no bloco `/* @pure:start */ ... /* @pure:end */` de `publicar.html`, testadas em Node. A interface reaproveita padrões existentes: `sugestaoSemana`/`bindSugestao` da Fase 1, `sheetResumo`, `telaForca`, `telaComida`, os helpers `copiar` e `baixar`, `salvarLog`.

**Tech Stack:** HTML e JS puro em um arquivo (`publicar.html`), `node --test tests/*.test.js` no Node 24, artifact do claude.ai (`window.claude`).

**Spec:** `docs/superpowers/specs/2026-10-27-fase2-ritmo-semana-design.md`

## Global Constraints

- Um único arquivo de app: `publicar.html`. Não criar outros arquivos de código.
- Comando de teste: `node --test tests/*.test.js` (no Node 24 passar só a pasta falha).
- Texto de interface em português do Brasil, sem travessão no lugar de vírgula.
- O app só roda dentro do claude.ai: nada de `localStorage` para dados importantes; dados novos vão em `LOG` via `salvarLog(chave, valor)`.
- `LOG` tem limite de 256 KB: guardar só texto curto.
- Nada muda no plano sem o toque do usuário (a sugestão só propõe). A sugestão só pode tornar o plano mais conservador.
- O carregador de `tests/pure.test.js` devolve uma lista de nomes (`return {...}`): ao incluir uma função pura nova, acrescente o nome no fim da lista e mantenha todos os anteriores.
- Funções puras novas entram no bloco `@pure`, imediatamente antes da linha `const fotoValida = s =>` (confira com `grep -c "^const fotoValida = s =>" publicar.html` = 1). `normTxt` já existe no bloco e pode ser usada.
- Cada task termina com commit na branch `fase2-ritmo-semana`. Mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Arquivo tem linhas muito longas: use Edit com trechos curtos e únicos; confira com `grep -c` que o trecho aparece uma vez antes de editar. Se um trecho âncora não existir exatamente como descrito, pare e reporte.

## File Structure

- Modify: `publicar.html` (bloco puro; `sugestaoSemana`, `sugestaoHTML`, `bindSugestao`, `sheetResumo`; `sugestao`/`sessaoDe`/`telaForca`; `telaComida`; novas `sheetCompras`, `gerarCompras`, `semanaCompras`).
- Modify: `tests/pure.test.js` (carregador `F` e testes novos).
- Modify: `docs/superpowers/specs/2026-10-27-fase2-ritmo-semana-design.md` e `README.md` (Task 5).

---

### Task 1: `sugerirSemana` aceita o corpo

**Files:**
- Modify: `publicar.html` (função `sugerirSemana` no bloco puro)
- Test: `tests/pure.test.js`

**Interfaces:**
- Produces: `sugerirSemana(feitos, corpo)` com `corpo` opcional (`"bem"|"cansado"|"dolorido"`), mesmo retorno de antes: `{tipo:"aliviar"|"subir"|null, total, pesados, motivo}`. Chamadas com 1 argumento mantêm o comportamento atual.

- [ ] **Step 1: Write the failing tests**

Acrescente ao fim de `tests/pure.test.js`:

```js
test("sugerirSemana com corpo dolorido sempre propõe aliviar", () => {
  const r = F.sugerirSemana([], "dolorido");
  assert.equal(r.tipo, "aliviar");
  assert.match(r.motivo, /dolorido/);
  assert.match(r.motivo, /fisioterapeuta/);
  assert.equal(F.sugerirSemana([{rpe:"leve", comoPlano:true}], "dolorido").tipo, "aliviar");
});

test("sugerirSemana com corpo cansado só propõe aliviar com sinal de carga", () => {
  const um = F.sugerirSemana([{rpe:"pesado", comoPlano:true}], "cansado");
  assert.equal(um.tipo, "aliviar"); assert.match(um.motivo, /cansado/);
  assert.equal(F.sugerirSemana([{rpe:"ok"}, {rpe:"ok"}], "cansado").tipo, null);
  assert.equal(F.sugerirSemana([], "cansado").tipo, null);
  // sinal de carga já existente continua valendo, com o motivo dos treinos
  assert.match(F.sugerirSemana([{rpe:"pesado"}, {rpe:"ok"}], "cansado").motivo, /pesados/);
});

test("sugerirSemana: cansado nunca sugere subir; bem e ausente mantêm o comportamento", () => {
  const leves = [{rpe:"leve", comoPlano:true}, {rpe:"leve", comoPlano:true}, {rpe:"leve", comoPlano:true}];
  assert.equal(F.sugerirSemana(leves).tipo, "subir");
  assert.equal(F.sugerirSemana(leves, "bem").tipo, "subir");
  assert.equal(F.sugerirSemana(leves, "cansado").tipo, null);
  assert.equal(F.sugerirSemana([{rpe:"pesado"}, {rpe:"ok"}], "bem").tipo, "aliviar");
  assert.equal(F.sugerirSemana([{rpe:"ok"}, {rpe:"ok"}], "bem").tipo, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/*.test.js`
Expected: FAIL nos 3 testes novos (a função ignora o segundo argumento).

- [ ] **Step 3: Implement**

Em `publicar.html`, substitua o corpo inteiro de `function sugerirSemana(feitos){ ... }` (da linha `function sugerirSemana(feitos){` até o `}` que a fecha, logo antes de `const normTxt`) por:

```js
function sugerirSemana(feitos, corpo){
  const f = (feitos||[]).filter(x=>x && x.rpe), total = f.length;
  const pesados = f.filter(x=>x.rpe==="pesado" || x.rpe==="limite").length;
  const limites = f.filter(x=>x.rpe==="limite").length;
  const abaixo = f.filter(x=>x.comoPlano===false).length;
  const nada = {tipo:null, total, pesados, motivo:""};
  if (corpo === "dolorido") return {tipo:"aliviar", total, pesados, motivo:"Você disse que está dolorido. Se a dor continuar, fale com o coach ou com o seu fisioterapeuta"};
  if (total >= 2){
    if (pesados*2 >= total || limites >= 2) return {tipo:"aliviar", total, pesados, motivo:"Seus últimos treinos foram pesados ("+pesados+" de "+total+")"};
    if (abaixo >= 2 && pesados >= 1) return {tipo:"aliviar", total, pesados, motivo:"Você ficou abaixo do plano em "+abaixo+" de "+total+" treinos e sentiu o peso"};
  }
  if (corpo === "cansado") return pesados >= 1 ? {tipo:"aliviar", total, pesados, motivo:"Você disse que está cansado e teve treino pesado nesta semana"} : nada;
  if (total >= 3 && f.every(x=>x.rpe==="leve" && x.comoPlano!==false)) return {tipo:"subir", total, pesados:0, motivo:"Você achou os últimos "+total+" treinos leves"};
  return nada;
}
```

Confira com `grep -c "^function sugerirSemana" publicar.html` = 1 e que a linha seguinte ao fim da função é `const normTxt`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/*.test.js`
Expected: todos passam (os testes antigos de `sugerirSemana` com 1 argumento incluídos).

- [ ] **Step 5: Commit**

```bash
git add publicar.html tests/pure.test.js
git commit -m "feat: sugerirSemana considera o corpo (bem, cansado, dolorido)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pergunta e card dentro do Resumo da semana

**Files:**
- Modify: `publicar.html` (`sugestaoSemana`, `sugestaoHTML`, `bindSugestao`, `sheetResumo`)

**Interfaces:**
- Consumes: `sugerirSemana(feitos, corpo)` (Task 1); `sugestaoSemana`, `sugestaoHTML`, `bindSugestao`, `aceitarSugestao`, `recusarSugestao` (Fase 1); `iniSemana()`, `key`, `addDays`, `dow`, `today`, `salvarLog`, `chatModo`, `chatPre`, `ir`.
- Produces: `sugestaoHTML(sug, pre)` e `bindSugestao(aoAgir, pre)` com parâmetros opcionais: `pre` é um prefixo de id (default `""`) para evitar ids duplicados quando o card aparece na sheet por cima do Hoje (use `"r"` na sheet); `aoAgir` é uma função chamada antes de aceitar, recusar ou dispensar (use para fechar a sheet). Chave do LOG: `rs_<segunda>.corpo` (`"bem"|"cansado"|"dolorido"`).

Sem teste de Node (interface); verificação pela suíte completa (inclui a checagem de compilação do script) e greps.

- [ ] **Step 1: `sugestaoSemana` lê o corpo**

Em `publicar.html`, troque a linha `  const res = sugerirSemana(feitosSemana(seg0));` (única, dentro de `sugestaoSemana`) por:

```js
  const res = sugerirSemana(feitosSemana(seg0), (LOG["rs_"+key(seg0)]||{}).corpo);
```

- [ ] **Step 2: Ids com prefixo em `sugestaoHTML` e `bindSugestao`**

Troque `function sugestaoHTML(sug){` por `function sugestaoHTML(sug, pre){ pre = pre || "";`.

Em `sugestaoHTML`, troque cada id pelo id com prefixo (4 edições, cada trecho é único; use o trecho com a classe para garantir):
- `class="btn sm go" id="sgok">` por `class="btn sm go" id="'+pre+'sgok">`
- `class="btn sm ghost" id="sgno">` por `class="btn sm ghost" id="'+pre+'sgno">`
- `class="btn sm go" id="sgco">` por `class="btn sm go" id="'+pre+'sgco">`
- `class="btn sm ghost" id="sgnn">` por `class="btn sm ghost" id="'+pre+'sgnn">`

Substitua a função `bindSugestao` inteira por:

```js
function bindSugestao(aoAgir, pre){
  const sug = sugestaoSemana(); if (!sug) return;
  pre = pre || ""; const depois = () => { if (aoAgir) aoAgir(); };
  const ok = $(pre+"sgok"), no = $(pre+"sgno"), co = $(pre+"sgco"), nn = $(pre+"sgnn");
  if (ok) ok.addEventListener("click", ()=>{ depois(); aceitarSugestao(sug); });
  if (no) no.addEventListener("click", ()=>{ depois(); recusarSugestao(sug); });
  if (co) co.addEventListener("click", ()=>{ depois(); chatModo = "coach"; chatPre = "Os últimos treinos estavam leves. Dá para aumentar a carga da próxima semana?"; ir("chat"); });
  if (nn) nn.addEventListener("click", ()=>{ depois(); salvarLog("fbs_"+key(addDays(today, -dow(today))), true).then(()=>render(true)); });
}
```

As chamadas existentes `bindSugestao()` (Hoje e Semana) e `sugestaoHTML(sugestaoSemana())` continuam válidas sem argumentos.

- [ ] **Step 3: Pergunta, card e botão do coach em `sheetResumo`**

Em `sheetResumo`, na linha `b.innerHTML = '<h3 class="h2" ...` troque o final `+'<button type="button" class="btn ghost" id="rsok">Fechar</button>';` por `+'<div id="rsx"></div>';` (o botão Fechar passa a ser desenhado dentro de `#rsx`). Em seguida substitua a linha:

```js
  $("rsok").onclick = fecha; if (!v.lido){ v.lido = true; salvarLog("rs_"+key(ini), v); }
```

por:

```js
  const atual = +ini === +addDays(today, -dow(today));   // pergunta e card só quando o resumo é da semana atual
  const desenhar = () => {
    const x = $("rsx"); if (!x) return;
    const rs = LOG["rs_"+key(ini)] || v;
    x.innerHTML = (atual ? '<span class="k">como está o corpo para a próxima semana?</span><div class="chips" id="rscorpo">'+[["bem","Bem"],["cansado","Cansado"],["dolorido","Dolorido"]].map(([c,l])=>'<button type="button" class="chip" data-v="'+c+'" aria-pressed="'+(rs.corpo===c)+'">'+l+'</button>').join("")+'</div>'+sugestaoHTML(sugestaoSemana(), "r") : '')+
      '<button type="button" class="btn" id="rscoach">Falar com o coach sobre a semana</button><button type="button" class="btn ghost" id="rsok">Fechar</button>';
    const c = $("rscorpo"); if (c) c.onclick = async e=>{ const bt = e.target.closest("button[data-v]"); if (!bt) return; await salvarLog("rs_"+key(ini), Object.assign({}, LOG["rs_"+key(ini)] || v, {corpo:bt.dataset.v})); desenhar(); };
    if (atual) bindSugestao(fecha, "r");
    $("rscoach").onclick = ()=>{ fecha(); chatModo = "coach"; chatPre = "Como foi a minha semana e o que muda na próxima?"; ir("chat"); };
    $("rsok").onclick = fecha;
  };
  desenhar();
  if (!v.lido){ v.lido = true; salvarLog("rs_"+key(ini), v); }
```

(`fecha` já existe no topo de `sheetResumo`.)

- [ ] **Step 4: Verificar**

Run: `node --test tests/*.test.js`
Expected: todos passam (inclui "o script do app compila").
Run: `grep -c 'id="rsok"' publicar.html`
Expected: 1 (só dentro de `desenhar`).
Run: `grep -c "sugestaoHTML(sugestaoSemana(), \"r\")" publicar.html`
Expected: 1.

- [ ] **Step 5: Commit**

```bash
git add publicar.html
git commit -m "feat: resumo de domingo pergunta como esta o corpo e mostra a sugestao

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Carga da musculação considera prontidão e dor

**Files:**
- Modify: `publicar.html` (bloco puro; novo `sugestaoAjustada` depois de `sugestao`; três pontos de uso)
- Test: `tests/pure.test.js`

**Interfaces:**
- Produces: `ajustarSugestaoCarga(sg, ctx)` pura, com `sg = {kg:number|null, txt:string}` (o retorno de `sugestao`) e `ctx = {pront?:number|null, dor?:number|null, hold?:number|null}`; devolve `sg` (mesmo objeto) ou `{kg:hold, txt}`. `sugestaoAjustada(ex)` (fora do bloco puro) devolve a sugestão já ajustada com o check-in de hoje.

- [ ] **Step 1: Write the failing tests**

Acrescente `ajustarSugestaoCarga` ao `return {...}` do carregador (depois do último nome) e ao fim de `tests/pure.test.js`:

```js
test("ajustarSugestaoCarga não mexe sem contexto ruim ou sem aumento sugerido", () => {
  const sg = {kg:52.5, txt:"Suba para 52,5 kg"};
  assert.equal(F.ajustarSugestaoCarga(sg, {}), sg);
  assert.equal(F.ajustarSugestaoCarga(sg, {pront:80, dor:2, hold:50}), sg);
  assert.equal(F.ajustarSugestaoCarga(sg, {pront:30, dor:6}), sg);               // sem hold
  const manter = {kg:50, txt:"Mantenha 50 kg"};
  assert.equal(F.ajustarSugestaoCarga(manter, {pront:30, dor:6, hold:50}), manter); // não era aumento
  const semKg = {kg:null, txt:"Primeira vez"};
  assert.equal(F.ajustarSugestaoCarga(semKg, {pront:30, dor:6, hold:50}), semKg);
  assert.equal(F.ajustarSugestaoCarga(null, {pront:30}), null);
});

test("ajustarSugestaoCarga segura a carga com prontidão baixa ou dor 5 ou mais", () => {
  const sg = {kg:52.5, txt:"Suba para 52,5 kg"};
  const a = F.ajustarSugestaoCarga(sg, {pront:40, dor:2, hold:50});
  assert.equal(a.kg, 50);
  assert.match(a.txt, /prontidão 40/); assert.match(a.txt, /dor 2\/10/); assert.match(a.txt, /Mantenha 50 kg/);
  assert.doesNotMatch(a.txt, /Pule/);
  const b = F.ajustarSugestaoCarga({kg:52.5, txt:""}, {dor:5, hold:50});
  assert.equal(b.kg, 50); assert.doesNotMatch(b.txt, /prontidão/); assert.match(b.txt, /dor 5\/10/);
  const c = F.ajustarSugestaoCarga({kg:52.5, txt:""}, {pront:49, hold:52.5 - 2.5});
  assert.equal(c.kg, 50); assert.doesNotMatch(c.txt, /dor /);
});

test("ajustarSugestaoCarga com dor 7 ou mais manda pular o movimento que doer", () => {
  const r = F.ajustarSugestaoCarga({kg:22.5, txt:""}, {dor:7, hold:20});
  assert.equal(r.kg, 20); assert.match(r.txt, /Mantenha 20 kg/); assert.match(r.txt, /Pule o movimento que doer/);
  assert.match(F.ajustarSugestaoCarga({kg:22.5, txt:""}, {dor:5, pront:45, hold:17.5}).txt, /Mantenha 17,5 kg/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/*.test.js`
Expected: FAIL com "ajustarSugestaoCarga is not defined" (o nome já está na lista do carregador, a função ainda não existe).

- [ ] **Step 3: Implement the pure function**

Insira antes da linha `const fotoValida = s =>`:

```js
function ajustarSugestaoCarga(sg, ctx){
  ctx = ctx || {};
  const n = v => (v === null || v === undefined || v === "" || !isFinite(+v)) ? null : +v;
  const dor = n(ctx.dor), pront = n(ctx.pront), hold = n(ctx.hold);
  if (!sg || sg.kg == null || hold == null) return sg;
  const ruim = (dor != null && dor >= 5) || (pront != null && pront < 50);
  if (!ruim || !(sg.kg > hold)) return sg;
  const estado = (pront != null ? "prontidão "+pront : "") + (pront != null && dor != null ? ", " : "") + (dor != null ? "dor "+dor+"/10" : "");
  return {kg:hold, txt:"Hoje o seu corpo pede calma ("+estado+"). Mantenha "+String(hold).replace(".",",")+" kg, a carga da última vez, e pare 2 reps antes da falha."+(dor != null && dor >= 7 ? " Pule o movimento que doer." : "")};
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/*.test.js`
Expected: todos passam.

- [ ] **Step 5: `sugestaoAjustada` e uso na tela de força**

Em `publicar.html`, logo antes da linha que começa com `/* animação do movimento: boneco em SVG` (única), insira:

```js
/* sugestão de carga ajustada pelo check-in de hoje: com prontidão baixa ou dor, segura a carga em vez de subir */
function sugestaoAjustada(ex){
  const sg = sugestao(ex), h = historicoEx(ex.nome), c = LOG["ci_"+key(today)];
  const hold = h.length ? Math.max(...h[h.length-1].sets.map(x=>+x.kg||0)) : null;
  return ajustarSugestaoCarga(sg, {pront: c ? prontidao(c) : null, dor: c ? +c.dor : null, hold});
}
```

E troque as três chamadas (confira cada trecho com `grep -c` = 1 antes):
- em `sessaoDe`: `const sg = sugestao(e); const h = historicoEx(e.nome);` por `const sg = sugestaoAjustada(e); const h = historicoEx(e.nome);`
- em `telaForca` (render dos exercícios): `const sg = sugestao(e), h0 = historicoEx(e.nome)` por `const sg = sugestaoAjustada(e), h0 = historicoEx(e.nome)`
- em `telaForca` (botão Aplicar): `sg = sugestao(e); e.sets.forEach(s2=>{ if (!s2.ok) s2.kg = sg.kg; });` por `sg = sugestaoAjustada(e); e.sets.forEach(s2=>{ if (!s2.ok) s2.kg = sg.kg; });`

(A chamada de `sugestao` na tela de demonstração do exercício, dentro de `telaExercicio`, não muda.)

- [ ] **Step 6: Verificar**

Run: `node --test tests/*.test.js`
Expected: todos passam.
Run: `grep -c "sugestaoAjustada(" publicar.html`
Expected: 4 (definição e três usos).

- [ ] **Step 7: Commit**

```bash
git add publicar.html tests/pure.test.js
git commit -m "feat: sugestao de carga considera prontidao e dor do check-in

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Regras puras da lista de compras

**Files:**
- Modify: `publicar.html` (bloco puro)
- Test: `tests/pure.test.js`

**Interfaces:**
- Produces: `GRUPOS_COMPRAS` (array de strings, uso interno), `normalizarCompras(itens)` devolve `[{g, n, q, ok:false}]` (máx. 60, ordenado por grupo na ordem de `GRUPOS_COMPRAS`), `comprasTexto(lista)` devolve texto simples agrupado.

- [ ] **Step 1: Write the failing tests**

Acrescente `normalizarCompras, comprasTexto` ao `return {...}` do carregador e ao fim de `tests/pure.test.js`:

```js
test("normalizarCompras limpa a resposta da IA", () => {
  const r = F.normalizarCompras([
    {grupo:"Hortifrúti", nome:"Banana", qtd:"2 dúzias"},
    {grupo:"hortifruti", nome:"  banana ", qtd:"3"},            // duplicado (ignora acento, caixa e espaço)
    {grupo:"Laticínios", nome:"Leite", qtd:"6 L"},
    {grupo:"Marcianos", nome:"Pão", qtd:""},                      // grupo desconhecido vira Outros
    {grupo:"Mercearia", nome:"   "}, null, {nome:"Arroz", grupo:"Grãos e massas", qtd:"5 kg"}
  ]);
  assert.deepEqual(r.map(x => x.n), ["Banana", "Leite", "Arroz", "Pão"]);
  assert.deepEqual(r.map(x => x.g), ["Hortifrúti", "Laticínios", "Grãos e massas", "Outros"]);
  assert.equal(r[0].q, "2 dúzias"); assert.equal(r[0].ok, false);
});

test("normalizarCompras limita tamanho e quantidade e aceita lixo", () => {
  assert.deepEqual(F.normalizarCompras(null), []);
  assert.deepEqual(F.normalizarCompras("x"), []);
  const grande = Array.from({length: 80}, (_, i) => ({grupo:"Mercearia", nome:"Item " + i, qtd:"y".repeat(50)}));
  const r = F.normalizarCompras(grande);
  assert.equal(r.length, 60); assert.equal(r[0].q.length, 30);
  assert.equal(F.normalizarCompras([{nome:"n".repeat(100)}])[0].n.length, 60);
});

test("comprasTexto agrupa por grupo e marca os itens", () => {
  const t = F.comprasTexto([
    {g:"Hortifrúti", n:"Banana", q:"2 dúzias", ok:true}, {g:"Hortifrúti", n:"Tomate", q:"", ok:false}, {g:"Laticínios", n:"Leite", q:"6 L", ok:false}
  ]);
  assert.equal(t, "Hortifrúti\n[x] Banana (2 dúzias)\n[ ] Tomate\n\nLaticínios\n[ ] Leite (6 L)");
  assert.equal(F.comprasTexto([]), "");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/*.test.js`
Expected: FAIL com "normalizarCompras is not defined".

- [ ] **Step 3: Implement**

Insira antes da linha `const fotoValida = s =>`:

```js
const GRUPOS_COMPRAS = ["Hortifrúti","Carnes e ovos","Laticínios","Grãos e massas","Mercearia","Bebidas","Outros"];
function normalizarCompras(itens){
  const vistos = new Set(), out = [];
  (Array.isArray(itens) ? itens : []).forEach(x=>{
    if (out.length >= 60 || !x) return;
    const n = String(x.nome || x.n || "").trim().slice(0,60); if (!n) return;
    const k = normTxt(n); if (vistos.has(k)) return; vistos.add(k);
    const bruto = normTxt(x.grupo || x.g || ""), g = GRUPOS_COMPRAS.find(y=>normTxt(y) === bruto) || "Outros";
    out.push({g, n, q:String(x.qtd || x.q || "").trim().slice(0,30), ok:false});
  });
  return out.sort((a,b)=>GRUPOS_COMPRAS.indexOf(a.g) - GRUPOS_COMPRAS.indexOf(b.g));
}
function comprasTexto(lista){
  const l = lista || [], grupos = []; l.forEach(i=>{ if (!grupos.includes(i.g)) grupos.push(i.g); });
  return grupos.map(g=>g+"\n"+l.filter(i=>i.g === g).map(i=>"["+(i.ok ? "x" : " ")+"] "+i.n+(i.q ? " ("+i.q+")" : "")).join("\n")).join("\n\n");
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/*.test.js`
Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add publicar.html tests/pure.test.js
git commit -m "feat: regras puras da lista de compras

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Lista de compras na tela Comida, README e especificação

**Files:**
- Modify: `publicar.html` (`telaComida`; novas `semanaCompras`, `gerarCompras`, `sheetCompras`)
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-27-fase2-ritmo-semana-design.md`

**Interfaces:**
- Consumes: `normalizarCompras`, `comprasTexto` (Task 4); helpers existentes `copiar(texto)`, `baixar(nome, data, tipo)`, `comTempo`, `sample`, `metasDia(d)`, `treinosDe`, `key`, `parseD`, `addDays`, `dow`, `fmt`, `esc`, `salvarLog`, `registrarErro`, `toast`, `P`, `LOG`, `today`.
- Produces: chave do LOG `compras_<segunda>` = `{itens:[{g,n,q,ok}], at}`; `semanaCompras()` devolve a string `AAAA-MM-DD` da segunda da semana de compras (no domingo, a segunda seguinte); `gerarCompras(ini)` devolve o registro salvo ou `null`; `sheetCompras()`.

Sem teste de Node (interface); verificação pela suíte e greps.

- [ ] **Step 1: Botão na tela Comida**

Em `telaComida`, imediatamente antes da linha que começa com `    '<p class="s" style="text-align:center">Guia de alimentação com base em consensos` (única), insira a linha:

```js
    '<button type="button" class="btn ghost" id="cpl">Lista de compras da semana</button>'+
```

e logo depois da linha `const g = $("cg"), g2 = $("cg2"); [g,g2].forEach(...)` (única), insira:

```js
  const cl = $("cpl"); if (cl) cl.addEventListener("click", sheetCompras);
```

- [ ] **Step 2: Funções da lista**

Insira antes de `async function analisarRefeicao(ref, f, texto){`:

```js
/* ===== lista de compras da semana (a Nutri monta, você marca o que já tem) ===== */
function semanaCompras(){ return key(dow(today)===6 ? addDays(today,1) : addDays(today, -dow(today))); }
async function gerarCompras(ini){
  const p = P.perfil || {}, m = metasDia(today); let n = 0;
  for (let i=0;i<7;i++) n += treinosDe(addDays(parseD(ini), i)).length;
  const pedido = "Você é a Nutri do app (guia de alimentação, não nutricionista). Monte a lista de compras de supermercado para 7 dias a partir de "+ini+", comida brasileira simples e barata, para UMA pessoa. Restrições: "+((p.restricoes||[]).join(", ")||"nenhuma")+". Orçamento: "+(p.orcamento||"normal")+". Metas diárias: proteína "+(m ? m.prot[0]+"–"+m.prot[1] : "?")+" g, carboidrato "+(m ? m.carb[0]+"–"+m.carb[1] : "?")+" g. Treinos na semana: "+n+"."+(p.menor ? " Menor de idade: sem déficit e sem suplemento." : "")+
    " Use quantidades realistas para a semana (ex.: 1 kg, 2 dúzias, 3 pacotes). No máximo 40 itens. Responda só JSON: {\"itens\":[{\"grupo\":\"Hortifrúti|Carnes e ovos|Laticínios|Grãos e massas|Mercearia|Bebidas|Outros\",\"nome\":\"...\",\"qtd\":\"...\"}]}.";
  try{
    const r = await comTempo(sample.json(pedido, {cache:false}), 40000);
    const itens = normalizarCompras(r && r.itens); if (!itens.length) return null;
    const v = {itens, at:new Date().toISOString()}; await salvarLog("compras_"+ini, v); return v;
  }catch(e){ registrarErro("lista de compras", e); return null; }
}
function sheetCompras(){
  const ov = $("ov"), ini = semanaCompras(), fecha = ()=>{ ov.innerHTML = ""; };
  ov.innerHTML = '<div class="dim" id="dim"></div><div class="sheet" role="dialog" aria-label="Lista de compras"><span class="grab"></span><h2 class="h2" style="font-size:1.7rem">Lista de compras</h2><p class="s">Semana de '+esc(fmt(parseD(ini)))+'. É uma estimativa da Nutri: ajuste ao que você já tem em casa. Não substitui nutricionista.</p><div id="cpb"></div><p class="msg" id="cpm"></p></div>';
  $("dim").addEventListener("click", fecha);
  const montar = async ()=>{
    if (!sample){ $("cpm").textContent = "A Nutri não está disponível agora."; return; }
    $("cpb").innerHTML = '<div class="hint">A Nutri está montando a lista…</div>';
    const v = await gerarCompras(ini);
    if (!v) $("cpm").textContent = "Não consegui montar agora. Tente de novo."; else $("cpm").textContent = "";
    pinta();
  };
  const pinta = ()=>{
    const v = LOG["compras_"+ini], b = $("cpb"); if (!b) return;
    if (!v || !(v.itens||[]).length){ b.innerHTML = '<button type="button" class="btn go" id="cpmk">Montar a lista da semana</button><button type="button" class="lk" id="cpfe">Fechar</button>'; $("cpmk").onclick = montar; $("cpfe").onclick = fecha; return; }
    const grupos = []; v.itens.forEach(i=>{ if (!grupos.includes(i.g)) grupos.push(i.g); });
    b.innerHTML = grupos.map(g=>'<span class="k">'+esc(g)+'</span>'+v.itens.map((i,ix)=>i.g===g ? '<label class="chk"><input type="checkbox" data-i="'+ix+'"'+(i.ok?' checked':'')+'><span>'+esc(i.n)+(i.q?' <small class="s">'+esc(i.q)+'</small>':'')+'</span></label>' : '').join("")).join("")+
      '<div class="row" style="gap:8px;margin-top:10px"><button type="button" class="btn sm" id="cpco">Copiar</button><button type="button" class="btn sm" id="cpba">Baixar</button><button type="button" class="btn sm ghost" id="cpre">Refazer a lista</button></div><button type="button" class="lk" id="cpfe">Fechar</button>';
    b.querySelectorAll("input[data-i]").forEach(c=>c.addEventListener("change", ()=>{ v.itens[+c.dataset.i].ok = c.checked; salvarLog("compras_"+ini, v); }));
    $("cpco").onclick = ()=>copiar(comprasTexto(v.itens));
    $("cpba").onclick = ()=>baixar("lista-de-compras-"+ini+".txt", comprasTexto(v.itens), "text/plain");
    $("cpre").onclick = montar; $("cpfe").onclick = fecha;
  };
  pinta();
}
```

- [ ] **Step 3: README e especificação**

Em `README.md`, na lista "O que já existe", acrescente a linha:

```
- Resumo de domingo com pergunta sobre o corpo e sugestão de aliviar a próxima semana, carga da musculação que considera prontidão e dor, e lista de compras da semana montada pela Nutri.
```

e em "Pendências conhecidas" acrescente:

```
- A fase 2 (resumo de domingo, carga por prontidão, lista de compras) foi validada só por testes de funções puras e leitura de código; falta conferir dentro do artifact. A meta calórica que se ajusta ficou para a fase 3, junto com peso e medidas.
```

Em `docs/superpowers/specs/2026-10-27-fase2-ritmo-semana-design.md` faça duas trocas de texto:
1. Na seção 2, troque o trecho `` `sugestao` passa a expor `hold` no objeto de retorno, sem mudar o que já devolve.`` e o parágrafo seguinte sobre `telaForca` por: `` A função `sugestaoAjustada(ex)` calcula `hold` a partir do histórico, aplica `ajustarSugestaoCarga` com a prontidão e a dor do check-in de hoje e é usada em `sessaoDe` (carga inicial dos sets), na exibição da sugestão e no botão Aplicar de `telaForca`. Sem check-in feito, nada muda. ``
2. Na seção 3, depois da linha `Entrada: ...`, acrescente a linha: `A semana da lista é a atual; no domingo é a semana seguinte (a chave é a segunda-feira dessa semana).`

- [ ] **Step 4: Verificar**

Run: `node --test tests/*.test.js`
Expected: todos passam.
Run: `grep -c "sheetCompras" publicar.html`
Expected: pelo menos 2 (definição e o `addEventListener` do botão).
Run: `grep -c "async function gerarCompras" publicar.html`
Expected: 1.

- [ ] **Step 5: Commit**

```bash
git add publicar.html README.md docs/superpowers/specs/2026-10-27-fase2-ritmo-semana-design.md
git commit -m "feat: lista de compras da semana montada pela Nutri

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Revisão final e publicação

- [ ] **Step 1:** `node --test tests/*.test.js` (esperado: 33 anteriores mais os novos, todos passando).
- [ ] **Step 2:** `git diff --stat fase1-coach-comida...HEAD` deve mostrar só `publicar.html`, `tests/pure.test.js`, `README.md` e os docs da fase 2.
- [ ] **Step 3:** Publicar `publicar.html` no artifact do usuário (`https://claude.ai/artifact/Su8kaFAaifinor4vQ4mZeq`) com a ferramenta Artifact, mesma `file_path`, sem passar `capabilities`. Avisar o que testar: pergunta "Como está o corpo" no resumo de domingo depois das 18h; sugestão de carga com check-in ruim na tela de força; botão "Lista de compras da semana" na Comida (gerar, marcar, copiar, baixar, refazer).
