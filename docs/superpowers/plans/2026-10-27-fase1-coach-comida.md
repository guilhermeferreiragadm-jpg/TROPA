# Fase 1: coach e comida Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Motivo do treino que serve para qualquer plano, sugestão de aliviar a próxima semana a partir do "Como foi", e botão de repetir refeição com favoritos.

**Architecture:** Regras novas viram funções puras dentro do bloco `/* @pure:start */ ... /* @pure:end */` de `publicar.html`, testadas em Node. A interface (cards, sheet) fica fora do bloco e reaproveita padrões existentes: `reduzirParaTeto` e o `aj_<dia>` do teto de carga, `salvarLog`, `tela`, `bindGo`.

**Tech Stack:** HTML e JS puro em um arquivo (`publicar.html`), `node --test tests/*.test.js` no Node 24, artifact do claude.ai (`window.claude`).

**Spec:** `docs/superpowers/specs/2026-10-27-fase1-coach-comida-design.md`

## Global Constraints

- Um único arquivo de app: `publicar.html`. Não criar outros arquivos de código.
- Comando de teste: `node --test tests/*.test.js` (no Node 24 passar só a pasta falha).
- Texto de interface em português do Brasil, sem travessão no lugar de vírgula.
- O app só roda dentro do claude.ai: nada de `localStorage` para dados importantes; dados novos vão em `LOG` via `salvarLog(chave, valor)`.
- `LOG` tem limite de 256 KB: guardar só texto curto (até 140 caracteres por prato).
- A sugestão da próxima semana só pode tornar o plano mais conservador e nunca altera dias passados, treinos feitos ou dias que já têm `aj_<dia>` de outra origem. Nada acontece durante pausa (`pausaAtiva()`).
- Cada task termina com commit na branch `fase1-coach-comida`. Mensagem de commit termina com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Arquivo tem linhas muito longas: use Edit com trechos curtos e únicos; confira com `grep -c` que o trecho aparece uma vez antes de editar.

## File Structure

- Modify: `publicar.html` (pure block perto de `reduzirParaTeto` e `fotoValida`; `motivoTreino` ~linha 1200; bloco do teto perto de `rotuloAj` ~linha 1860; `telaHoje` ~1641; `telaSemana` ~1865; `registrarRefeicao` ~882; `telaComida` ~2245).
- Modify: `tests/pure.test.js` (carregador `F` e testes novos).
- Modify: `docs/superpowers/specs/2026-10-27-fase1-coach-comida-design.md` (uma frase, Task 5).
- Modify: `README.md` (Task 6).

---

### Task 1: Motivo do treino que serve para qualquer plano

**Files:**
- Modify: `publicar.html` (pure block; função `motivoTreino`)
- Test: `tests/pure.test.js`

**Interfaces:**
- Produces: `motivoGenerico(t, c)` pura, com `t` = treino `{k, t, z?, km?, ...}` e `c` = `{fase, deload, longaoAnt, prova}` (todos opcionais), devolve string (pode ser vazia). `motivoPlanoMisto(t, d)` é o corpo antigo de `motivoTreino`, renomeado. `motivoTreino(t, d)` escolhe entre os dois.

- [ ] **Step 1: Write the failing tests**

No carregador de `tests/pure.test.js`, troque a linha `return {diasPausa, ... fotoValida};` por (acrescentando `motivoGenerico`):

```js
const F = new Function(ajudas + "\n" + puro + "\nreturn {diasPausa, semanasDeslocadas, rampaRetorno, pausaCobre, deslocamentoEm, fatorRetornoEm, semanaEm, semanasAtrasoProva, escalarTreino, minutosPlan, prioridadeTreino, calcularTeto, reduzirParaTeto, fotoValida, motivoGenerico};")();
```

Acrescente ao fim do arquivo:

```js
test("motivoGenerico nunca cita prova, data ou distância que não está no contexto", () => {
  const proibidos = /18\/10|70\.3|fevereiro|10 km de|Hyrox/;
  const casos = [
    {k:"run", t:"Longão", km:12}, {k:"run", t:"Corrida regenerativa"}, {k:"run", t:"Intervalado"},
    {k:"run", t:"Corrida limiar"}, {k:"run", t:"Corrida leve"}, {k:"bike", t:"Bike sweet spot"},
    {k:"bike", t:"Bike zona 2"}, {k:"swim", t:"Natação CSS"}, {k:"swim", t:"Natação contínua"},
    {k:"gym", t:"Força"}
  ];
  for (const t of casos) {
    const m = F.motivoGenerico(t, {});
    assert.ok(m.length > 20, "motivo vazio para " + t.t);
    assert.doesNotMatch(m, proibidos, t.t);
  }
});

test("motivoGenerico usa fase, descarga, longão anterior e prova só quando vêm no contexto", () => {
  const lg = F.motivoGenerico({k:"run", t:"Longão", km:12}, {longaoAnt:10, prova:"Meia maratona", fase:"base", deload:true});
  assert.match(lg, /12 km/);
  assert.match(lg, /semana passada: 10 km/);
  assert.match(lg, /Meia maratona/);
  assert.match(lg, /descarga/i);
  const semProva = F.motivoGenerico({k:"run", t:"Longão", km:12}, {});
  assert.doesNotMatch(semProva, /semana passada|Meia/);
});

test("motivoGenerico: treino de força só cita Hyrox se o nome do treino citar", () => {
  assert.doesNotMatch(F.motivoGenerico({k:"gym", t:"Força"}, {}), /Hyrox/);
  assert.match(F.motivoGenerico({k:"gym", t:"Hyrox · estações"}, {}), /resistência/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/*.test.js`
Expected: FAIL com "F.motivoGenerico is not a function" (ou `motivoGenerico is not defined`).

- [ ] **Step 3: Implement `motivoGenerico` in the pure block**

Em `publicar.html`, insira antes da linha que começa com `const fotoValida = s =>` (confira com `grep -c "^const fotoValida = s =>" publicar.html` = 1):

```js
function motivoGenerico(t, c){
  c = c || {};
  const nome = String(t.t||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const km = n => String(n).replace(".",",");
  const desc = c.deload ? " Semana de descarga: volume menor para o corpo absorver as semanas anteriores e voltar mais forte." : "";
  const fase = c.fase ? " Fase do plano: "+c.fase+"." : "";
  const alvo = c.prova ? " para "+c.prova : "";
  if (t.k === "run"){
    if (/longao/.test(nome)) return "Longão de "+km(t.km||"")+" km"+(c.longaoAnt ? " (semana passada: "+km(c.longaoAnt)+" km)" : "")+". É o treino que mais constrói resistência"+alvo+". Sobe no máximo 10% por vez para não machucar."+desc+fase;
    if (/regenerativ/.test(nome)) return "Corrida bem leve para soltar a perna e somar quilômetros sem cansar. Assim você chega inteiro nos treinos fortes da semana."+desc+fase;
    if (/intervalad|tiro/.test(nome)) return "O treino forte de corrida da semana: deixa seu ritmo mais rápido (VO2 máximo). Fica longe do longão para você chegar descansado nele."+desc+fase;
    if (/limiar|tempo/.test(nome)) return "Treino de ritmo: aumenta o quanto você aguenta correr forte por muito tempo."+desc+fase;
    return "Corrida leve para somar volume sem cansar: é a base que deixa os treinos fortes e o longão possíveis."+desc+fase;
  }
  if (t.k === "bike"){
    if (/sweet/.test(nome)) return "Treino forte de bike: o sweet spot é o que mais melhora sua potência por hora de treino."+desc+fase;
    if (/transi|corrida/.test(nome+" "+(t.passos||[]).join(" ").toLowerCase())) return "Bike + corrida logo em seguida (transição): ensina a perna a correr cansada."+desc+fase;
    return "Bike em zona 2: constrói base aeróbica sem impacto na perna."+desc+fase;
  }
  if (t.k === "swim"){
    if (/css/.test(nome)) return "Natação no seu ritmo de limiar: melhora a velocidade que você sustenta."+desc+fase;
    return "Natação contínua e leve: técnica e resistência para nadar mais sem parar."+desc+fase;
  }
  if (/hyrox/.test(nome)) return "Força com resistência: deixa pernas e core fortes para segurar a postura quando o corpo cansa."+desc+fase;
  if (t.k === "gym") return "Força previne lesão e deixa a passada mais econômica: com a perna mais forte, o mesmo ritmo gasta menos energia."+desc+fase;
  return "";
}
```

- [ ] **Step 4: Rewire `motivoTreino`**

Em `publicar.html`, troque a linha `function motivoTreino(t, d){` (única) por:

```js
function motivoTreino(t, d){
  if (t.motivo) return t.motivo;
  const pl = planoAtual(), s = semanaDe(d), sem = s && s.sem; if (!pl || !sem) return "";
  if (pl.fases) return motivoPlanoMisto(t, d);   // plano personalizado com fases F0..F8: textos específicos
  const ant = pl.semanas[s.w-2], tpl = TPL[P && P.perfil && P.perfil.objetivo];
  return motivoGenerico(t, {fase:faseDaSemana(pl, s.w), deload:!!sem.deload, longaoAnt:ant && ant.longao || 0, prova:(!pl.semProva && tpl) ? tpl.nome : ""});
}
function motivoPlanoMisto(t, d){
```

Confira que `grep -c "^function motivoTreino" publicar.html` continua 1 e que `grep -c "^function motivoPlanoMisto" publicar.html` é 1. Se `P.perfil.objetivo` não for o nome da chave de `TPL`, o contexto fica sem prova (aceitável).

- [ ] **Step 5: Run tests and syntax check**

Run: `node --test tests/*.test.js`
Expected: todos passam (14 antigos + 3 novos), incluindo "o script do app compila".

- [ ] **Step 6: Commit**

```bash
git add publicar.html tests/pure.test.js
git commit -m "feat: motivo do treino generico para qualquer plano

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regra pura `sugerirSemana`

**Files:**
- Modify: `publicar.html` (pure block)
- Test: `tests/pure.test.js`

**Interfaces:**
- Produces: `sugerirSemana(feitos)` com `feitos = [{rpe:"leve"|"ok"|"pesado"|"limite", comoPlano:boolean|undefined}]`, devolve `{tipo:"aliviar"|"subir"|null, total:number, pesados:number, motivo:string}`.

- [ ] **Step 1: Write the failing tests**

Acrescente `sugerirSemana` ao `return {...}` do carregador (depois de `motivoGenerico`) e ao fim do arquivo:

```js
test("sugerirSemana: precisa de pelo menos 2 treinos", () => {
  assert.equal(F.sugerirSemana([]).tipo, null);
  assert.equal(F.sugerirSemana([{rpe:"limite", comoPlano:true}]).tipo, null);
});

test("sugerirSemana: aliviar quando metade ou mais foi pesado ou no limite", () => {
  const r = F.sugerirSemana([{rpe:"pesado", comoPlano:true}, {rpe:"ok", comoPlano:true}]);
  assert.equal(r.tipo, "aliviar"); assert.equal(r.pesados, 1); assert.equal(r.total, 2);
  assert.match(r.motivo, /1 de 2/);
  assert.equal(F.sugerirSemana([{rpe:"pesado"}, {rpe:"ok"}, {rpe:"ok"}]).tipo, null);
  assert.equal(F.sugerirSemana([{rpe:"limite"}, {rpe:"ok"}, {rpe:"limite"}]).tipo, "aliviar");
});

test("sugerirSemana: aliviar com 2 treinos abaixo do plano e algum pesado", () => {
  const r = F.sugerirSemana([{rpe:"pesado", comoPlano:false}, {rpe:"ok", comoPlano:false}, {rpe:"ok", comoPlano:true}, {rpe:"ok", comoPlano:true}]);
  assert.equal(r.tipo, "aliviar");
  assert.equal(F.sugerirSemana([{rpe:"ok", comoPlano:false}, {rpe:"ok", comoPlano:false}, {rpe:"ok"}]).tipo, null);
});

test("sugerirSemana: subir só com 3 ou mais treinos, todos leves e dentro do plano", () => {
  assert.equal(F.sugerirSemana([{rpe:"leve", comoPlano:true}, {rpe:"leve", comoPlano:true}]).tipo, null);
  assert.equal(F.sugerirSemana([{rpe:"leve", comoPlano:true}, {rpe:"leve"}, {rpe:"leve", comoPlano:true}]).tipo, "subir");
  assert.equal(F.sugerirSemana([{rpe:"leve", comoPlano:true}, {rpe:"leve", comoPlano:false}, {rpe:"leve"}]).tipo, null);
});

test("sugerirSemana ignora registros sem rpe", () => {
  assert.equal(F.sugerirSemana([{}, null, {rpe:"ok"}]).total, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/*.test.js`
Expected: FAIL com "F.sugerirSemana is not a function".

- [ ] **Step 3: Implement in the pure block**

Insira antes da linha `const fotoValida = s =>`:

```js
function sugerirSemana(feitos){
  const f = (feitos||[]).filter(x=>x && x.rpe), total = f.length;
  const pesados = f.filter(x=>x.rpe==="pesado" || x.rpe==="limite").length;
  const limites = f.filter(x=>x.rpe==="limite").length;
  const abaixo = f.filter(x=>x.comoPlano===false).length;
  const nada = {tipo:null, total, pesados, motivo:""};
  if (total < 2) return nada;
  if (pesados*2 >= total || limites >= 2) return {tipo:"aliviar", total, pesados, motivo:"Seus últimos treinos foram pesados ("+pesados+" de "+total+")"};
  if (abaixo >= 2 && pesados >= 1) return {tipo:"aliviar", total, pesados, motivo:"Você ficou abaixo do plano em "+abaixo+" de "+total+" treinos e sentiu o peso"};
  if (total >= 3 && f.every(x=>x.rpe==="leve" && x.comoPlano!==false)) return {tipo:"subir", total, pesados:0, motivo:"Você achou os últimos "+total+" treinos leves"};
  return nada;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/*.test.js`
Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add publicar.html tests/pure.test.js
git commit -m "feat: regra pura sugerirSemana

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sugestão na interface (aceitar, recusar, desfazer)

**Files:**
- Modify: `publicar.html` (`rotuloAj`, novo bloco antes de `/* ===================== SEMANA ===================== */`, `telaHoje`, `telaSemana`, botão desfazer do Hoje)

**Interfaces:**
- Consumes: `sugerirSemana`, `reduzirParaTeto`, `minutosPlan`, `prioridadeTreino` (puras, já no bloco); `treinosDe(d)`, `feito(d,i)`, `pausaAtiva()`, `salvarLog`, `render(true)`, `toast`, `ir`, `chatModo`, `chatPre`, `esc`, `dow`, `addDays`, `key`, `today`.
- Produces: `feitosSemana(ini)`, `sugestaoSemana()` (devolve `null` ou `{tipo, total, pesados, motivo, ...}`; para `aliviar` também `{next, de, para, cortes}`), `sugestaoHTML(sug)`, `bindSugestao()`, `aceitarSugestao(sug)`, `recusarSugestao(sug)`, `manterOriginalFeedback(ini)`. Chaves do LOG: `fb_<segunda da próxima semana>` = `{estado:"aceito"|"recusado", de?, para?, cortes?, at}` e `fbs_<segunda atual>` = `true` (aviso de "subir" dispensado). Ajuste gravado em `aj_<dia>` com `por:"feedback"`.

Esta task não tem teste de Node (é interface); a verificação é a checagem de sintaxe e a leitura do código. A regra já está testada na Task 2.

- [ ] **Step 1: Rótulo do ajuste**

Em `publicar.html`, na linha `function rotuloAj(aj){ ...`, troque `por==="prontidao" ? "Ajustado pela sua prontidão" :` por `por==="prontidao" ? "Ajustado pela sua prontidão" : por==="feedback" ? "Ajustado pelo seu feedback" :`.

- [ ] **Step 2: Bloco de lógica e HTML**

Insira imediatamente antes da linha `/* ===================== SEMANA ===================== */` (única):

```js
/* ===================== SUGESTÃO DA PRÓXIMA SEMANA (a partir do "Como foi") ===================== */
function feitosSemana(ini){
  const out = [];
  for (let i=0;i<7;i++){ const d = addDays(ini,i); if (d > today) break; treinosDe(d).forEach((t,j)=>{ const c = feito(d,j); if (c && c.rpe) out.push({rpe:c.rpe, comoPlano:c.comoPlano}); }); }
  return out;
}
function sugestaoSemana(){
  if (!P || !P.perfil || !planoAtual() || pausaAtiva()) return null;
  const seg0 = addDays(today, -dow(today)), next = addDays(seg0, 7), nk = key(next);
  const res = sugerirSemana(feitosSemana(seg0));
  if (res.tipo === "subir") return LOG["fbs_"+key(seg0)] ? null : res;
  if (res.tipo !== "aliviar" || LOG["fb_"+nk]) return null;
  const dias = [];
  for (let i=0;i<7;i++){
    const d = addDays(next,i), k = key(d), ts = treinosDe(d);
    dias.push({id:k, min:ts.reduce((s,t)=>s+minutosPlan(t),0), prio:ts.length?Math.max(...ts.map(prioridadeTreino)):0, fixo:!!LOG["aj_"+k]});
  }
  const de = dias.reduce((s,d)=>s+d.min,0); if (!(de > 0)) return null;
  const r = reduzirParaTeto(dias, Math.round(de*0.85)); if (!r.cortes.length) return null;
  return Object.assign({}, res, {next:nk, de, para:r.total, cortes:r.cortes});
}
function sugestaoHTML(sug){
  if (!sug) return "";
  if (sug.tipo === "aliviar") return '<div class="flag"><b>Quer aliviar a próxima semana?</b> '+esc(sug.motivo)+'. Posso passar '+sug.cortes.length+(sug.cortes.length===1?' dia':' dias')+' da próxima semana para a versão leve ('+sug.de+' para '+sug.para+' min). Nada muda sem o seu aceite.<div class="row" style="margin-top:8px;gap:8px"><button type="button" class="btn sm go" id="sgok">Aliviar a próxima semana</button><button type="button" class="btn sm ghost" id="sgno">Manter como está</button></div></div>';
  return '<div class="flag ok"><b>'+esc(sug.motivo)+'.</b> Se quiser mais desafio, converse com o coach: o plano só sobe se você pedir.<div class="row" style="margin-top:8px;gap:8px"><button type="button" class="btn sm go" id="sgco">Falar com o coach</button><button type="button" class="btn sm ghost" id="sgnn">Agora não</button></div></div>';
}
async function aceitarSugestao(sug){
  const at = new Date().toISOString();
  for (const c of sug.cortes) await salvarLog("aj_"+c.id, {acao:"leve", por:"feedback", motivo:"Você sentiu a semana pesada ("+sug.pesados+" de "+sug.total+" treinos): aliviei a semana de "+sug.de+" para "+sug.para+" min", at});
  await salvarLog("fb_"+sug.next, {estado:"aceito", de:sug.de, para:sug.para, cortes:sug.cortes.length, at});
  render(true); toast("Próxima semana aliviada.");
}
async function recusarSugestao(sug){ await salvarLog("fb_"+sug.next, {estado:"recusado", at:new Date().toISOString()}); render(true); }
async function manterOriginalFeedback(ini){
  for (let i=0;i<7;i++){ const k = key(addDays(ini,i)), a = LOG["aj_"+k]; if (a && a.por==="feedback") await salvarLog("aj_"+k, null); }
  await salvarLog("fb_"+key(ini), {estado:"recusado", at:new Date().toISOString()});
  render(true); toast("Plano original mantido nesta semana.");
}
function bindSugestao(){
  const sug = sugestaoSemana(); if (!sug) return;
  const ok = $("sgok"), no = $("sgno"), co = $("sgco"), nn = $("sgnn");
  if (ok) ok.addEventListener("click", ()=>aceitarSugestao(sug));
  if (no) no.addEventListener("click", ()=>recusarSugestao(sug));
  if (co) co.addEventListener("click", ()=>{ chatModo = "coach"; chatPre = "Os últimos treinos estavam leves. Dá para aumentar a carga da próxima semana?"; ir("chat"); });
  if (nn) nn.addEventListener("click", ()=>salvarLog("fbs_"+key(addDays(today, -dow(today))), true).then(()=>render(true)));
}
```

- [ ] **Step 3: Card na tela Hoje**

Em `telaHoje`, na linha que começa com `'<div class="recado"><b>Recado do coach</b>'` (confira `grep -c` = 1), coloque `sugestaoHTML(sugestaoSemana())+` imediatamente antes do literal, ficando:

```js
    sugestaoHTML(sugestaoSemana())+'<div class="recado"><b>Recado do coach</b>'+esc(recadoCoach())+'</div>'+
```

(Mantenha o restante da linha como está.) O card fica antes do recado, então a função `umaAcao` (que só move o que vem depois do `#ci`) não o esconde. Antes da linha `const u = $("undo"); if (u) ...` de `telaHoje` insira `bindSugestao();` e, na mesma linha do `undo`, troque `if (aj && aj.por==="teto") return manterPlanoOriginal(addDays(today, -dow(today)));` por:

```js
if (aj && aj.por==="teto") return manterPlanoOriginal(addDays(today, -dow(today))); if (aj && aj.por==="feedback") return manterOriginalFeedback(addDays(today, -dow(today)));
```

- [ ] **Step 4: Cards na tela Semana**

Em `telaSemana`, antes da linha que começa com `'<div class="phase">'+fasesDe(pl).map(f=>'<span style="flex:'+f[1]+';background:'+(f[0]===fase` (confira `grep -c` = 1 para o fragmento `fasesDe(pl).map(f=>'<span style="flex:'+f[1]+';background:'+(f[0]===fase`), insira duas linhas:

```js
    (semOff===0 ? sugestaoHTML(sugestaoSemana()) : '')+
    (LOG["fb_"+key(base0)] && LOG["fb_"+key(base0)].estado==="aceito" ? '<div class="flag"><b>Semana aliviada pelo seu feedback.</b> Passei '+LOG["fb_"+key(base0)].cortes+(LOG["fb_"+key(base0)].cortes===1?' dia':' dias')+' para a versão leve ('+LOG["fb_"+key(base0)].de+' para '+LOG["fb_"+key(base0)].para+' min). <button type="button" class="lk" id="fboff" style="padding:0">manter o plano original</button></div>' : '')+
```

E depois da linha `if ($("toff")) $("toff").addEventListener("click", ()=>manterPlanoOriginal(base0));` insira:

```js
  if ($("fboff")) $("fboff").addEventListener("click", ()=>manterOriginalFeedback(base0));
  if (semOff===0) bindSugestao();
```

- [ ] **Step 5: Verificar sintaxe e testes**

Run: `node --test tests/*.test.js`
Expected: todos passam (o teste "o script do app compila" cobre erros de sintaxe).
Run: `grep -c "sugestaoSemana()" publicar.html`
Expected: 4 ocorrências (definição, bindSugestao, Hoje, Semana).

- [ ] **Step 6: Commit**

```bash
git add publicar.html
git commit -m "feat: sugestao de aliviar a proxima semana a partir do Como foi

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Regras puras de favoritos e repetição

**Files:**
- Modify: `publicar.html` (pure block)
- Test: `tests/pure.test.js`

**Interfaces:**
- Produces: `normTxt(s)` (minúsculas, sem acento, espaços colapsados), `atualizarFavoritas(lista, reg, hoje)` devolve nova lista (máx. 12) de `{comeu, estimativa, porcao, refeicao, usos, ultimo}`; `candidatasRepetir(ontem, favoritas, refeicao)` devolve `[{comeu, estimativa, porcao, origem:"ontem"|"favorita"}]`. `reg` = `{refeicao, comeu, estimativa?, porcao?, pulou?}`; `hoje` = string `AAAA-MM-DD`.

- [ ] **Step 1: Write the failing tests**

Acrescente `atualizarFavoritas, candidatasRepetir` ao `return {...}` do carregador e ao fim do arquivo:

```js
test("atualizarFavoritas soma usos do mesmo prato e ignora foto sem texto e refeição pulada", () => {
  let l = F.atualizarFavoritas([], {refeicao:"Café da manhã", comeu:"Pão com ovo", estimativa:"~400 kcal"}, "2026-10-26");
  l = F.atualizarFavoritas(l, {refeicao:"Café da manhã", comeu:"  pão  COM ovo ", estimativa:"~420 kcal"}, "2026-10-27");
  assert.equal(l.length, 1); assert.equal(l[0].usos, 2); assert.equal(l[0].ultimo, "2026-10-27"); assert.equal(l[0].estimativa, "~420 kcal");
  assert.equal(F.atualizarFavoritas(l, {refeicao:"Almoço", comeu:"foto enviada"}, "2026-10-27").length, 1);
  assert.equal(F.atualizarFavoritas(l, {refeicao:"Almoço", comeu:"Arroz", pulou:true}, "2026-10-27").length, 1);
});

test("atualizarFavoritas guarda no máximo 12, removendo o menos usado e mais antigo", () => {
  let l = [];
  for (let i = 0; i < 13; i++) l = F.atualizarFavoritas(l, {refeicao:"Almoço", comeu:"Prato " + i}, "2026-10-" + String(10 + i).padStart(2, "0"));
  assert.equal(l.length, 12);
  assert.ok(!l.some(x => x.comeu === "Prato 0"));
  l = F.atualizarFavoritas(l, {refeicao:"Almoço", comeu:"Prato 5"}, "2026-10-27");
  assert.equal(l[0].comeu, "Prato 5");
});

test("atualizarFavoritas não altera a lista original e corta textos longos", () => {
  const orig = [{comeu:"Arroz", estimativa:"", porcao:"", refeicao:"Almoço", usos:1, ultimo:"2026-10-01"}];
  F.atualizarFavoritas(orig, {refeicao:"Almoço", comeu:"Arroz"}, "2026-10-02");
  assert.equal(orig[0].usos, 1);
  assert.equal(F.atualizarFavoritas([], {refeicao:"Almoço", comeu:"x".repeat(300)}, "2026-10-02")[0].comeu.length, 140);
});

test("candidatasRepetir: ontem primeiro, depois até 4 favoritas, sem repetidos", () => {
  const ontem = [{refeicao:"Café da manhã", comeu:"Pão com ovo", estimativa:"~400 kcal"}, {refeicao:"Almoço", comeu:"Arroz e feijão"}, {refeicao:"Café da manhã", comeu:"Café", pulou:true}];
  const fav = [
    {comeu:"Pão com ovo", refeicao:"Café da manhã", usos:5}, {comeu:"Tapioca", refeicao:"Café da manhã", usos:4},
    {comeu:"Iogurte", refeicao:"Lanche", usos:3}, {comeu:"Banana", refeicao:"Lanche", usos:2},
    {comeu:"Vitamina", refeicao:"Lanche", usos:2}, {comeu:"Ovo", refeicao:"Jantar", usos:1}
  ];
  const r = F.candidatasRepetir(ontem, fav, "Café da manhã");
  assert.deepEqual(r.map(x => x.comeu), ["Pão com ovo", "Tapioca", "Iogurte", "Banana", "Vitamina"]);
  assert.equal(r[0].origem, "ontem"); assert.equal(r[0].estimativa, "~400 kcal"); assert.equal(r[1].origem, "favorita");
  assert.deepEqual(F.candidatasRepetir([], [], "Almoço"), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/*.test.js`
Expected: FAIL com "F.atualizarFavoritas is not a function".

- [ ] **Step 3: Implement in the pure block**

Insira antes da linha `const fotoValida = s =>`:

```js
const normTxt = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").trim();
function atualizarFavoritas(lista, reg, hoje){
  const out = (lista||[]).map(x=>Object.assign({}, x));
  const comeu = String(reg && reg.comeu || "").trim().slice(0,140);
  if (!reg || reg.pulou || !comeu || comeu === "foto enviada") return out;
  const chave = normTxt(comeu), i = out.findIndex(x=>normTxt(x.comeu) === chave);
  const estimativa = String(reg.estimativa||"").slice(0,80), porcao = String(reg.porcao||"").slice(0,80);
  if (i >= 0){ const x = out[i]; x.usos = (x.usos||0)+1; x.ultimo = hoje; x.estimativa = estimativa || x.estimativa || ""; x.porcao = porcao || x.porcao || ""; x.refeicao = reg.refeicao || x.refeicao || ""; }
  else out.push({comeu, estimativa, porcao, refeicao:String(reg.refeicao||""), usos:1, ultimo:hoje});
  out.sort((a,b)=>(b.usos||0)-(a.usos||0) || (a.ultimo < b.ultimo ? 1 : a.ultimo > b.ultimo ? -1 : 0));
  return out.slice(0,12);
}
function candidatasRepetir(ontem, favoritas, refeicao){
  const out = [], vistos = new Set();
  const add = (x, origem)=>{ const c = String(x && x.comeu || "").trim(); if (!c || c === "foto enviada") return false; const k = normTxt(c); if (vistos.has(k)) return false; vistos.add(k); out.push({comeu:c, estimativa:String(x.estimativa||""), porcao:String(x.porcao||""), origem}); return true; };
  (ontem||[]).filter(r=>r && r.refeicao === refeicao && !r.pulou).forEach(r=>add(r, "ontem"));
  const fav = (favoritas||[]), ordem = fav.filter(f=>f.refeicao === refeicao).concat(fav.filter(f=>f.refeicao !== refeicao));
  let n = 0; for (const f of ordem){ if (n >= 4) break; if (add(f, "favorita")) n++; }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/*.test.js`
Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add publicar.html tests/pure.test.js
git commit -m "feat: regras puras de favoritos e repeticao de refeicao

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Repetir refeição na tela Comida

**Files:**
- Modify: `publicar.html` (`registrarRefeicao`, `telaComida`, nova `sheetRepetir`)
- Modify: `docs/superpowers/specs/2026-10-27-fase1-coach-comida-design.md`

**Interfaces:**
- Consumes: `atualizarFavoritas`, `candidatasRepetir`, `registrarRefeicao(nome, dados)`, `salvarLog`, `registrarErro`, `key`, `addDays`, `today`, `esc`, `$`, `toast`, `render`.
- Produces: `sheetRepetir(ref)`; chave do LOG `fav_refs` (lista de favoritos); registro repetido grava `{comeu, estimativa, porcao, repetida:true}` via `registrarRefeicao`.

- [ ] **Step 1: Alimentar os favoritos em `registrarRefeicao`**

Troque o corpo de `registrarRefeicao` (arquivo `publicar.html`, ~linha 882) por:

```js
async function registrarRefeicao(nome, dados){
  const k = key(today), lst = (LOG["ref_"+k] || []).slice();
  lst.push(Object.assign({refeicao:nome, at:new Date().toISOString()}, dados));
  await salvarLog("ref_"+k, lst);
  try{ await salvarLog("fav_refs", atualizarFavoritas(LOG["fav_refs"]||[], Object.assign({refeicao:nome}, dados), k)); }catch(e){ registrarErro("favoritas", e); }
}
```

- [ ] **Step 2: Botão "repetir" na lista de refeições**

Em `telaComida`, logo depois da linha `const agua = LOG["agua_"+k]||0;` insira:

```js
  const regsOntem = LOG["ref_"+key(addDays(today,-1))] || [], favs = LOG["fav_refs"] || [];
```

Na linha das refeições, troque o trecho final do botão `escrever`:

```js
(r.comeu?'<span class="ok">✓</span>':'<button type="button" class="btn sm ghost" data-txt="'+esc(r.refeicao)+'">escrever</button>')
```

por:

```js
(r.comeu?'<span class="ok">✓</span>':'<button type="button" class="btn sm ghost" data-txt="'+esc(r.refeicao)+'">escrever</button>'+(candidatasRepetir(regsOntem, favs, r.refeicao).length?'<button type="button" class="btn sm ghost" data-rep="'+esc(r.refeicao)+'">repetir</button>':''))
```

(Confira com `grep -c` que o trecho original aparece uma vez antes de editar.) E depois da linha `app.querySelectorAll("[data-txt]")...` de `telaComida`, insira:

```js
  app.querySelectorAll("[data-rep]").forEach(b=>b.addEventListener("click", ()=>sheetRepetir(b.dataset.rep)));
```

- [ ] **Step 3: A sheet**

Insira logo antes de `async function analisarRefeicao(ref, f, texto){`:

```js
function sheetRepetir(ref){
  const cands = candidatasRepetir(LOG["ref_"+key(addDays(today,-1))]||[], LOG["fav_refs"]||[], ref), ov = $("ov");
  if (!cands.length){ toast("Nada para repetir ainda."); return; }
  ov.innerHTML = '<div class="dim" id="dim"></div><div class="sheet" role="dialog" aria-label="Repetir refeição"><span class="grab"></span><h2 class="h2" style="font-size:1.7rem">Repetir: '+esc(ref)+'</h2>'+
    '<p class="s">A estimativa de calorias é copiada do registro anterior. Se a porção mudou, use "escrever" e conte o que comeu.</p>'+
    cands.map((c,i)=>'<button type="button" class="btn ghost" data-i="'+i+'" style="text-align:left">'+esc(c.comeu)+'<small class="s" style="display:block">'+(c.origem==="ontem"?"ontem":"favorita")+(c.estimativa?' · '+esc(c.estimativa):'')+'</small></button>').join("")+
    '<button type="button" class="lk" id="rno">Cancelar</button></div>';
  const fecha = ()=>{ ov.innerHTML = ""; };
  $("dim").addEventListener("click", fecha); $("rno").addEventListener("click", fecha);
  ov.querySelectorAll("[data-i]").forEach(b=>b.addEventListener("click", async ()=>{
    const c = cands[+b.dataset.i]; fecha();
    await registrarRefeicao(ref, {comeu:c.comeu, estimativa:c.estimativa, porcao:c.porcao, repetida:true});
    render(true); toast(ref+": repetido.");
  }));
}
```

- [ ] **Step 4: Ajustar a especificação**

Em `docs/superpowers/specs/2026-10-27-fase1-coach-comida-design.md`, na seção 3, troque a frase `A sheet avisa "estimativa copiada de outro dia" e oferece "Corrigir com a Nutri".` por `A sheet avisa que a estimativa é copiada do registro anterior e orienta a usar "escrever" se a porção mudou.`

- [ ] **Step 5: Verificar**

Run: `node --test tests/*.test.js`
Expected: todos passam.
Run: `grep -c "sheetRepetir" publicar.html`
Expected: pelo menos 2 (a definição `function sheetRepetir` e a chamada dentro do `data-rep`).

- [ ] **Step 6: Commit**

```bash
git add publicar.html docs/superpowers/specs/2026-10-27-fase1-coach-comida-design.md
git commit -m "feat: repetir refeicao e favoritos na tela Comida

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Revisão final, README e publicação

**Files:**
- Modify: `README.md`
- Modify: `publicar.html` (apenas correções da revisão)

- [ ] **Step 1: README**

Em `README.md`, na lista "O que já existe", acrescente a linha:

```
- Sugestão de aliviar a próxima semana a partir do "Como foi" (você aceita ou recusa), motivo do treino para qualquer plano, e repetir refeição com favoritos.
```

Na lista "Pendências conhecidas", acrescente:

```
- A fase 1 (sugestão da próxima semana, repetir refeição, motivo do treino) foi validada só por testes de funções puras e leitura de código; falta conferir os cards e a sheet dentro do artifact. O gerador de plano ainda tem fases fixas (festas, meia, tri) herdadas do plano de origem.
```

- [ ] **Step 2: Checagem completa**

Run: `node --test tests/*.test.js`
Expected: todos passam (14 antigos + 3 + 5 + 4 = 26).
Run: `git diff --stat main...HEAD | tail -3` e confira que só `publicar.html`, `tests/pure.test.js`, `README.md` e os docs mudaram.

- [ ] **Step 3: Revisão de código dos pontos de risco**

Confirme lendo o código:
1. `sugestaoSemana()` devolve `null` em pausa, sem plano, ou quando `fb_<próxima segunda>` existe.
2. `aceitarSugestao` só escreve `aj_` em dias que `sugestaoSemana` marcou como cortes (dias com `aj_` anterior vêm com `fixo:true` e nunca entram).
3. `manterOriginalFeedback` só remove `aj_` com `por==="feedback"`.
4. `registrarRefeicao` com `dados.comeu` vazio não cria favorita.
5. Nenhum texto novo usa travessão no lugar de vírgula.

- [ ] **Step 4: Commit, push e publicar**

```bash
git add README.md publicar.html
git commit -m "docs: README da fase 1

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push
```

Publique `publicar.html` no artifact do usuário (`https://claude.ai/artifact/Su8kaFAaifinor4vQ4mZeq`) com a ferramenta Artifact, mesma `file_path`, sem passar `capabilities` (a declaração anterior é mantida). Avise o usuário o que testar: card de sugestão (precisa de 2 treinos feitos na semana com "pesado"), aceitar, "manter o plano original", botão "repetir" na Comida e o card "por que esse treino" em um plano gerado pelo app.
