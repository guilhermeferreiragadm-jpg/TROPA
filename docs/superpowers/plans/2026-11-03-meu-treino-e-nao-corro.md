# Meu treino e "Não corro" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar a pessoa marcar "Não corro" no cadastro e montar o próprio treino (exercícios e semana), que vira o plano do app.

**Architecture:** Tudo em `publicar.html`. O treino próprio é um `P.plano` no mesmo formato do plano gerado, marcado `custom:true`, com 52 cópias de uma semana-modelo. O editor reaproveita o estilo do editor dos Personal (`edHTML`). Funções puras novas ficam entre `validar` e `NOMEF` para os testes extraírem.

**Tech Stack:** JS puro no HTML, `node --test`, harness em `tests/harness`.

**Spec:** `docs/superpowers/specs/2026-11-03-meu-treino-e-nao-corro-design.md`

## Global Constraints
- Sem dependências novas; o arquivo continua sendo um HTML único.
- Textos em português do Brasil, sem travessão no lugar de vírgula.
- Plano `custom` nunca é regerado pela migração `versao<2` nem pelo botão de trocar objetivo sem aviso.
- Nenhuma mudança no Firestore, nas regras ou no backend.
- Suíte `npm test` verde ao fim de cada tarefa.

---

### Task 1: "Não corro" no cadastro e força sem corrida

**Files:**
- Modify: `publicar.html` (cadastro `onb`, `gerarPlano`, extração por IA)
- Create: `tests/meutreino.test.js`

**Interfaces:**
- Produces: `draft.naoCorre` (boolean), `p.naoCorre` no perfil. `gerarPlano(p)` sem "Cardio leve" de corrida quando `p.naoCorre`.

- [ ] Em `tests/meutreino.test.js`, extrair `trecho("/* ===================== GERADOR DE PLANO (regras fixas)", "const NOMEF")` mais os helpers de data e testar: `gerarPlano({objetivo:"massa", naoCorre:true, academiaMeses:12, diasSem:4})` não tem nenhum treino com `k:"run"` em nenhuma semana e tem um `k:"bike"` "Cardio opcional" no sábado; sem `naoCorre` continua com o "Cardio leve" `k:"run"`.
- [ ] Rodar o teste e ver falhar.
- [ ] No ramo `t.forca` de `gerarPlano`, trocar o `d[5].push(...)` por: se `p.naoCorre`, `{k:"bike", t:"Cardio opcional", min:30, ef:"3/10", passos:["30 min de caminhada rápida ou bike leve, só se estiver com vontade"]}`; senão o "Cardio leve" atual.
- [ ] No passo 3 do cadastro (`i===3`), adicionar acima dos campos de corrida um botão `data-nc` "Não corro" (`aria-pressed` conforme `draft.naoCorre`). Ao ligar, `draft.naoCorre = true` e `corridasSem = 0`, `kmSemana = 0`, `maiorLongao = 0`, `melhorTempo = ""`; ao desligar, `naoCorre = false` e `corridasSem = ""`. Quando `naoCorre`, não desenhar os quatro campos de corrida. Re-renderizar com `onb(3)`.
- [ ] A validação do passo 3 já aceita `corridasSem === 0`; garantir que `0` numérico passa (`draft.corridasSem!=null && draft.corridasSem!==""`).
- [ ] Na extração por IA (`sample.json` do passo 2): incluir `naoCorre` na lista de chaves lidas e no prompt ("naoCorre: true se disser que não corre").
- [ ] Rodar `npm test`, commit.

### Task 2: Plano custom (funções puras)

**Files:**
- Modify: `publicar.html` (entre `validar` e `NOMEF`)
- Test: `tests/meutreino.test.js`

**Interfaces:**
- Produces: `TPL.meu`, `modeloVazio()` → `{dias:[{treinos:[]} x7]}`, `modeloValido(m)` → `string[]` de erros, `planoMeu(modelo, inicioKey, antigo, hojeKey)` → plano `custom` de 52 semanas.

- [ ] Testes: `modeloVazio()` tem 7 dias vazios; `modeloValido` recusa modelo sem nenhum treino ("Monte pelo menos um treino"), mais de 3 treinos num dia, treino sem nome, `k` fora de run/gym/bike/swim, duração/km inválidos (`<=0` ou acima de `TETO`), 7 dias com treino (precisa de 1 descanso); `planoMeu` devolve `{versao:2, objetivo:"meu", custom:true, semProva:true, semanas:52}` com cada semana `{w, deload:false, taper:false, longao:0, dias:[{dia:"Seg",treinos}...]}`; com `antigo` e `hojeKey`, as semanas que terminam antes de `hojeKey` ficam como no `antigo` e as demais vêm do modelo novo.
- [ ] Rodar, ver falhar.
- [ ] Implementar: `TPL.meu = {nome:"Meu treino", pico:0, geral:true, custom:true, mods:[]}`; as três funções acima (copias profundas com `JSON.parse(JSON.stringify())`; `TETO` pode ser copiado para um `const LIM_MEU = {km:500, min:1000, ser:99, rep:999, kg:1000}` próprio, porque `TETO` está fora do trecho extraído).
- [ ] `validar(plano, p)`: se `plano.custom`, devolver `[]`.
- [ ] Rodar `npm test`, commit.

### Task 3: Tela "Montar meu treino" e fluxo

**Files:**
- Modify: `publicar.html` (`onb`, `enviarPerfil`, nova `telaMeuTreino`, Perfil/Treino)

**Interfaces:**
- Consumes: `modeloVazio`, `modeloValido`, `planoMeu`, `TPL.meu`.

- [ ] Passo 1 do cadastro: adicionar a opção `["meu","MEU","Montar meu treino","coloque os seus exercícios e a sua semana"]` e tratá-la em `data-ob` como objetivo direto (`draft.objetivo = "meu"`, `temProva = "nao"`).
- [ ] No fim do passo 5, se `draft.naoCorre` e o objetivo gera plano de corrida (qualquer exceto `massa` e `meu`), mostrar a tela de escolha "Como você quer treinar?" com dois botões: "Gerar plano de força" (`draft.objetivo = "massa"`) e "Montar meu treino" (`draft.objetivo = "meu"`), e só então `enviarPerfil()`.
- [ ] `enviarPerfil`: quando `p.objetivo === "meu"`, não chamar `gerarPlano`; salvar `P` com `plano:null`, e em vez de `telaMatch()` abrir `telaMeuTreino({primeira:true})`.
- [ ] `telaMeuTreino(op)`: carrega `P.plano.modelo` ou `modeloVazio()`; desenha 7 caixas (Segunda a Domingo) com "Descanso" ou os treinos; por treino: nome, duração (ou km em corrida), esforço, e para `gym` a lista de exercícios (nome, séries, repetições, kg) com "Adicionar exercício" e remover; botões "Adicionar: Corrida, Força, Bike, Natação, Outro esporte"; "Remover treino"; "Mover para". Estado em `MT = {modelo, err:Set}`; validação inline com `modeloValido`. Botão "Salvar meu treino" chama `planoMeu`, grava `P.plano`, `P.viol = []`, `salvarPerfil()`, e vai para a primeira tela (`telaMatch()` na primeira vez, senão `ir("treino")` com toast).
- [ ] Entradas: no Perfil e na tela de Treino, botão "Montar ou editar meu treino" (visível quando `P.perfil.objetivo === "meu"`; para os outros, "Montar meu treino próprio" que avisa que substitui o plano atual).
- [ ] Rodar `npm test`, commit.

### Task 4: Neutralizar corrida, longão e prova no plano custom

**Files:**
- Modify: `publicar.html`

- [ ] `fasesDe(pl)` e `faseDaSemana`: devolver `[]` e `""` quando `pl.custom`.
- [ ] Gráfico de longão, `projecao`, alvo da prova, "dias para a prova" e o aviso `pk < t.pico*0.75` de `enviarPerfil`: pular quando `pl.custom` ou `t.pico` é 0. Verificar `grep -n "longao"` e `TPL[` (20 usos) e `maiorLongao`: cada um não pode quebrar com `longao:0` nem com `dataProva` vazio.
- [ ] Prompts do Coach: `(TPL[p.objetivo]||{}).nome` já funciona ("Meu treino"); VDOT e paces só se existirem. Conferir que o texto do coach não manda "longão".
- [ ] Migração `versao<2` no `entrar`: ignorar `P.plano.custom`. "Mudar objetivo ou adicionar prova" com plano custom mostra confirmação antes de sobrescrever.
- [ ] Harness: abrir `tests/harness` com `?perfil=0`, passar pelo cadastro com "Não corro", escolher "Montar meu treino", montar uma semana, salvar e ver a tela Hoje com o treino do dia; ver o console sem erros.
- [ ] Rodar `npm test`, commit.

### Task 5: Revisão, build e publicação

- [ ] `npm test` verde; `npm run build:www`; revisão de código geral do diff; `firebase deploy --only hosting`; conferir `https://tropa-5ad9b.web.app` no navegador.
