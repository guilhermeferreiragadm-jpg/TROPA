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
4. B: `s = await Pro.lerSnap("ana~personal","treino")`; `await Pro.enviarProposta("ana~personal","carga", s.plano, <plano alterado>, "texto")`.
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
