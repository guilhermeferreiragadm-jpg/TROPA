# Roteiro de telas do harness

Abrir `http://localhost:5173/` (perfil de exemplo) e, no console da página, chamar `__T`. Largura de verificação: 390 px, também 360 e 430. Repetir com o tema escuro (`localStorage.setItem("tropa-tema", "escuro")` e recarregar) e com `prefers-reduced-motion` ligado.

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

## Dois usuários (Personal e Nutri)

Com `?eu=<id>&nome=<nome>` o stub vira esse usuário (não dono, já com acesso aceito e aprovado) e guarda o banco em `localStorage["tropa-stub-db"]`, compartilhado entre abas do mesmo endereço. Quando outra aba escreve, o evento `storage` dispara os `onSnapshot` dos documentos que mudaram. Sem `?eu=` nada muda (teste-1, dono, banco só em memória). Para zerar: `localStorage.removeItem("tropa-stub-db")` e recarregar. `PORT=5174 node tests/harness/servir.js` sobe em outra porta; o servidor relê `stub.js` a cada carga.

1. Aba A `/?eu=ana&nome=Ana` (aluna) e aba B `/?eu=pedro&nome=Pedro` (profissional). O objeto `Pro` se acessa por `__T.ev("Pro")`.
2. B: `await Pro.ativarPapel("personal", true); (await Pro.gerarConvite("personal")).cod`.
3. A: `await Pro.aceitarConvite("<cod>", {treino:true, perf:true})` e conferir `snap/ana~personal_treino` em `__STUB.S`.
4. B: `s = await Pro.lerSnap("ana~personal","treino")`; `await Pro.enviarProposta("ana~personal","treino", s.plano, <plano alterado só em semanas[...]>, "texto")` (o tipo é `treino` para Personal e `alimentar` para Nutri; tipo diferente do papel, caminho fora de `semanas` ou valor acima dos tetos devolve `{erro:"invalida"}``.
5. A: `await Pro.responderProposta("ana~personal", <id>, "aceitar")`; `planoAtual()` passa a refletir a mudança e B lê o snap atualizado.
6. Proposta com base antiga volta `desatualizada`. A: `await Pro.encerrar("ana~personal")`: os `snap/*` somem e `lerSnap` devolve `null`.
7. Privacidade: `JSON.stringify(__STUB.S["snap/ana~personal_treino"])` e `__STUB.S["prop/..."]` só mostram `iv` e `ct` em base64, nenhum texto legível.

## Fluxo do aluno (convite, permissões, desvincular)

`PORT=5174 node tests/harness/servir.js`; aba P `/?eu=pedro&nome=Pedro`, aba A `/?eu=ana&nome=Ana` (largura 375). Zerar antes: `localStorage.removeItem("tropa-stub-db")`.

1. P: `const Pro=__T.ev("Pro"); await Pro.ativarPapel("personal", true); (await Pro.gerarConvite("personal")).cod` (gere 3 ou 4 códigos).
2. A: `__T.ir("perfil")`, tocar em `Entrar com código de um profissional` (`document.getElementById("cvp").click()`), escrever o código em `#cvc` (hífen e minúsculas valem) e tocar em `#cvok`. Marcar `[data-c=treino]` e `[data-c=perf]` e tocar em `#cvok` (Aceitar e vincular). Conferir `Object.keys(__STUB.S).filter(k=>k.startsWith("snap"))` e `Meus profissionais` com 1 vínculo.
3. Permissões: `#mpro` abre a lista, `[id^=vp_]` abre o vínculo, tocar em `[data-c=feed]`; `__STUB.S["vinculos/ana~personal"].perm` e `Pro.vinc.get("ana~personal").perm` devem bater.
4. Segundo Personal: com o vínculo ativo, outro código em `#cvc` e `#cvok` e depois `#cvok` de novo: "Você já tem um Personal. Desvincule antes."
5. Desvincular: `#vdes` e `#vok`; `Pro.vinc.get("ana~personal").estado` vira `encerrado` e os `snap/*` somem.
6. Erros no campo de código: inexistente (`ZZZZZZZZ`) "Esse código não existe."; usado (aceitar o mesmo código duas vezes) "Esse convite já foi usado."; expirado: em P `await __T.ev("realDb").collection("convites").doc("<cod>").update({expira:Date.now()-5000})` e testar em A: "Esse convite venceu. Peça um novo."; próprio: em P, o código dele no mesmo fluxo: "Você não pode aceitar o seu próprio convite."; papel desligado: em P gerar o código, depois `await Pro.ativarPapel("personal", false)`; em A "Esse profissional ainda não está pronto...".
7. Primeiro acesso: aba nova `/?eu=caio&nome=Caio`, `__T.telaCodigo()`, `#cd` = código válido de P, `#cdok`. `__T.ev("ACESSO")` vira `via:"profissional"` e o sheet do convite abre sozinho na Hoje. Com o papel desligado em P, a tela diz "Esse código não bate..." e o acesso não muda. Falha de rede: `const rd=__T.ev("realDb"), o=rd.collection.bind(rd); rd.collection=n=>{ if(n==="convites") throw 1; return o(n); }` mostra "Não consegui conferir o código agora. Tente de novo." e reabilita o botão.
8. Tema: `localStorage.setItem("tropa-tema","claro"|"escuro"); __T.ev("aplicarTema")()`; os gaps do sheet: `[...document.querySelector("#shb").children].map(e=>e.getBoundingClientRect())` deve dar 12 px entre filhos e `#cvno` centralizado.

## Fluxo do profissional (alunos, convite, detalhe, modelos)

`PORT=5174 node tests/harness/servir.js`; aba P `/?eu=pedro&nome=Pedro`, aba A `/?eu=ana&nome=Ana` (largura 375). Zerar antes: `localStorage.removeItem("tropa-stub-db")` e recarregar as duas.

1. P: `const Pro=__T.ev("Pro"); await Pro.ativarPapel("personal", true); __T.ev("setModo")("personal")`. A aba Alunos mostra o estado vazio.
2. P: tocar em `#alc` (Convidar aluno): o sheet mostra o código grande e o texto de envio. `#cvcp` copia (no harness o clipboard é negado, então aparece o texto em `#cpt` selecionado).
3. A: `await __T.ev("Pro").aceitarConvite("<cod>", {treino:true, perf:true})`. Para dar dados: `__T.ev("salvarLog")("ck_<AAAA-MM-DD>_0", {at:new Date().toISOString(), km:5, min:32})`, `salvarLog("coment", {"Agachamento":"Joelho incomodou"})` e `await __T.ev("Pro").publicarSnaps()`.
4. P: Ana aparece na lista sozinha (sem recarregar) com "treinou ontem" ou "sem treinar há N dias" (em âmbar a partir de 5). Tocar na linha: detalhe com Resumo da semana, Treino atual, Comentários, Performance, e Peso e medidas / Feed com cadeado e "O aluno não liberou". `#vpr` abre o sheet "Em breve".
5. Nutri: P `await Pro.ativarPapel("nutri", true); __T.ev("setModo")("nutri")`, gerar convite pela UI. A aceita com `{comida:true, corpo:false}` e grava `ref_<data>`/`corpo`. P vê "última refeição há N dias" e o detalhe com Plano alimentar, Refeições recentes e Peso e medidas bloqueado.
6. Modelos: aba Biblioteca (Personal) ou Planos (Nutri), `#mdn` Novo modelo, salvar sem nome mostra "Dê um nome ao modelo.", com nome grava em `__STUB.S["data/users/pedro/modelos"]`. Tocar no modelo edita; `#mdex` pede um segundo toque para excluir.
7. Ao vivo: com o sheet de convite aberto em P, o aceite de A não rerenderiza; ao fechar o sheet a lista atualiza em até 2 s. Tema: `localStorage.setItem("tropa-tema","claro"|"escuro"); __T.ev("aplicarTema")()`.

## Propostas e comentário no exercício

`PORT=5174 node tests/harness/servir.js`; abas P `/?eu=pedro&nome=Pedro`, A `/?eu=ana&nome=Ana`, N `/?eu=clara&nome=Clara` (375 px, claro e escuro). Zerar antes: `localStorage.removeItem("tropa-stub-db")` e recarregar. Aba em segundo plano pausa timers: traga a aba à frente antes de rodar scripts com `await`.

1. P: `Pro.ativarPapel("personal", true)`, `setModo("personal")`, `(await Pro.gerarConvite("personal")).cod`. A: `Pro.aceitarConvite(cod, {treino:true, perf:true})` e `Pro.publicarSnaps()`.
2. P: `__T.ir("alunos","det","ana~personal")`, `#vpr` abre o editor (semana atual do plano). Editar por evento `input` em `[data-f="t|6|0|km"]` (distância do longão) e nos três campos de `.exr` (nome, séries e reps, carga). `#pdf` mostra o diff ao vivo ("Agachamento: sem carga → 45 kg"), `#pmsg` a mensagem, `#pse` envia. Remover (`[data-rm]`), mover (`select[data-mv]`) e adicionar (`[data-add]`) treinos também entram no diff.
3. A: Perfil tem a linha `Propostas` (`#pps`) com contador; `__T.ir("perfil","props")` lista pendentes e histórico. Tocar na linha abre o sheet: mensagem, "O que muda", `#pa` Aceitar e `#pr` Recusar (abre `#pmt` e `#pr2`). Aceitar: `planoAtual()` muda, `P.planoProf` salvo e o snap `treino` republicado; P lê o novo plano.
4. Segunda proposta recusada com motivo: P vê "Recusada" e "Motivo: ..." na lista e no sheet.
5. Terceira desatualizada: em A, `P.planoProf` alterado e `salvarPerfil()`; ao abrir o sheet não há `#pa`, aparece o aviso e o estado cifrado vira `desatualizada`; em P o sheet mostra `#pre` Reenviar, que reabre o editor com o plano atual e a mensagem anterior.
6. Comentário: A `__T.ir("treino","forca","<segunda>~0")`, `[data-cm="0"]` (Comentar, depois Editar comentário), `#cmt`, `#cmok`. `LOG.coment["AAAA-MM-DD|Agachamento"] = {t, at}`; P vê em "Comentários dos exercícios" e o sino ganha `comentario`.
7. Nutri: N `Pro.ativarPapel("nutri", true)`, convite; A aceita com `{comida:true, corpo:false}`. N edita metas (`[data-f="m|kcal"]`) e orientações (`#ora`, `[data-f="o|0|ref"]`, `[data-f="o|0|t"]`) e envia. A aceita; `P.planoAlim` é gravado e a aba Comida mostra "Orientações da sua nutri".

Fix das propostas (forjadas e limites): em P, grave direto em `prop/ana~personal.<id>` (cifrado com `Pro._chave` e `cifrar`) propostas com `tipo:"alimentar"` e base do plano de treino, com `ops:[{p:[],v:{}}]` e com texto de 1 MB: em A nenhuma vira `#pa` e `planoAtual()` e `P.planoProf` não mudam; `Pro.responderProposta(vid, id, "aceitar")` na de tipo trocado devolve `{erro:"invalida"}`. No editor, dias de segunda até hoje mostram "Esse dia já tem treino registrado ou já passou" e não têm remover, mover nem adicionar; km 501, séries 100 ou carga 1001 mostram a mensagem no campo e desligam `#pse`.

## Sino (Notificações)

Abas P `/?eu=pedro&nome=Pedro`, A `/?eu=ana&nome=Ana`, N `/?eu=clara&nome=Clara` (375 px, claro e escuro). Zerar `tropa-stub-db` e recarregar. Convites: P `Pro.gerarConvite("personal")`, N `Pro.gerarConvite("nutri")`, A aceita os dois.

1. P: o sino da Alunos mostra `1`. `__T.ir("propostas")`, tocar no sino: título "Notificações", item "Ana aceitou seu convite de Personal" com marcador laranja; depois de 1 s o marcador some, o contador zera. "← Voltar" volta para Propostas (a origem), não para Alunos.
2. N: `Pro.enviarProposta("ana~nutri","alimentar",{},{metas:{kcal:2000}},"Meta")` três vezes (kcal 2000, 2100, 2200). A: sino mostra `3`; abrir o sino e tocar no primeiro item abre o sheet da proposta (`#pa`).
3. A: `responderProposta` recusar com motivo `Muito baixo <b>x</b>`, aceitar outra e `invalidar` a terceira. N com o sino aberto vê, sem recarregar, "recusou: Muito baixo <b>x</b>" (texto literal, sem negrito), "aceitou sua proposta" e "deixou sua proposta como desatualizada". Tocar no convite abre o detalhe do aluno.
4. A: `salvarPerm("ana~personal",{treino:true,perf:false})` e `Pro.avisar("pedro","comentario","ana~personal")`: P com o sino aberto ganha "mudou o que você pode ver" e "comentou um exercício" ao vivo; tocar abre o detalhe da Ana.
5. A: `Pro.encerrar("ana~personal")`: P vê "Ana encerrou o vínculo" e tocar leva à lista de Alunos. Estado vazio: aba nova sem avisos mostra "Nada por aqui ainda".
