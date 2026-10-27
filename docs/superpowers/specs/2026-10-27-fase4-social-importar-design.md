# Tropa: Fase 4, grupos reais, parceiro de responsa e importar treino

Data: 2026-10-27. Arquivo alvo: `publicar.html`. Fase 4 de 4 do roteiro de melhorias. Base: branch `fase3-corpo-dados`.

## Escopo (reduzido depois de ler o código)
- **Desafios:** já existem (km, treinos, força, foguinho; "Quem faz mais" e "Meta juntos"), mas os amigos são simulados (`SOC.people[x].exemplo`, `dz.sim`). Entra o que falta: **grupos reais**, em que cada pessoa publica o próprio progresso e todo mundo vê o placar verdadeiro.
- **Parceiro de responsa:** novo. Um grupo de 2 pessoas, com resumo da semana e uma cutucada por dia.
- **Importar treino:** novo. Lê GPX, TCX e FIT (com `.gz`), mostra um resumo e registra como treino feito.
- Fora desta fase: chat livre entre membros, ranking global, API do Strava (exigiria login e chave; o arquivo exportado resolve), notificação do celular.

Decisões do usuário (2026-10-27): grupos reais por código de convite; GPX, TCX e FIT com `.gz`; dupla com resumo e cutucada.

## Princípio de dados (vale para tudo desta fase)
- O banco do artifact é compartilhado por regra de caminho (nível mínimo de leitura e escrita), não por pertencer a um grupo. Qualquer pessoa admitida no artifact **consegue ler** o que for publicado em `grupos`. Por isso o que vai para lá é o mínimo: apelido, nome do grupo, números da semana e a cutucada do dia.
- **Nunca** vão para `grupos`: peso, medidas, fotos, comida, calorias, saúde, lesão, ciclo, plano, mapa ou trajeto de treino, e-mail.
- O código do grupo não é gravado. O banco guarda só o identificador do grupo (`gid`), que é um SHA-256 do código. Isso evita que quem lê o banco veja os códigos prontos; não impede quem tem muita vontade de adivinhar códigos curtos, por isso o código tem 8 caracteres (31 símbolos, cerca de 8,5 × 10¹¹ combinações).
- Não existe texto livre trocado entre membros: o nome do grupo é escolhido por quem cria (até 30 caracteres) e a cutucada é uma de 4 frases prontas. Não há chat nos grupos reais.
- O aviso "O que os outros veem" aparece antes de criar ou entrar no primeiro grupo e lista exatamente os campos publicados.
- **Menores de 18 anos** podem participar, porque a ferramenta só publica contagens e apelido. Não veem nada além disso, e o apelido é o que já está no perfil.

## 1. Banco: regras novas
Declaração completa (o republish precisa restaurar tudo que já existe):
```
{"db":{"rules":[
 {"path":"acessos","read":"admin","write":"admin"},{"path":"acessos/{self}","read":"view","write":"interact"},
 {"path":"pedidos","read":"admin","write":"admin"},{"path":"pedidos/{self}","read":"view","write":"interact"},
 {"path":"revisao","read":"admin","write":"admin"},{"path":"revisao/{self}","read":"view","write":"interact"},
 {"path":"resumo","read":"admin","write":"admin"},{"path":"resumo/{self}","read":"view","write":"interact"},
 {"path":"aprovados","read":"admin","write":"admin"},{"path":"aprovados/{self}","read":"view","write":"admin"},
 {"path":"grupos","read":"view","write":"owner"},{"path":"grupos/{self}","write":"interact"}
]},"downloads":{},"sample":{"images":true},"user":{}}
```
- `grupos/<meu id>` é o único documento que cada pessoa escreve. Ninguém escreve no documento de outra pessoa (a cutucada fica no documento de quem cutuca).
- Como são 12 regras, ficamos bem abaixo do limite de 64.
- Quem está em nível abaixo de `interact` (só visualiza) não escreve: os botões de criar, entrar e cutucar ficam desativados com o aviso "Peça acesso de colaborador ao dono do app".
- Fase de teste e modo DEMO: sem `realDb`, ou com `LOCAL` ligado, a aba mostra "Grupos precisam do app publicado" e não tenta escrever. O banco local (`hybrid`) não inclui `grupos`.

## 2. Modelo de dados
Documento `grupos/<id>`:
```
{ ap: "Gui", up: "2026-10-27T10:00:00Z", gs: [ { g, nome, tipo, formato, meta, ini, fim, dupla, v, t, f, cut } ] }
```
- `g`: gid (SHA-256 do código com prefixo `tropa:`, 16 primeiros caracteres hexadecimais).
- `nome`, `tipo` (`km|treinos|forca|foguinho`), `formato` (`mais|juntos`), `meta`, `ini`, `fim`, `dupla` (booleano): a definição do grupo. Todo membro guarda a própria cópia, então o grupo continua existindo se quem criou sair.
- `v`: meu progresso no tipo do grupo dentro de `[ini, fim]`, calculado localmente por `meuProgresso`.
- `t`: treinos feitos na semana corrente (segunda a domingo). `f`: foguinho atual (dias seguidos). Os dois só são preenchidos em dupla.
- `cut`: `{d, k}` com a data da última cutucada que enviei e o tipo (0 a 3). Um por dia por grupo.
- Máximo 5 grupos por pessoa, 8 membros por grupo, 2 na dupla.
- Funções puras (no bloco `@pure`):
  - `gidDeCodigo(codigo)`: assíncrona, usa `crypto.subtle.digest`; fica fora do bloco puro (que é síncrono), mas é testada em Node.
  - `normalizarCodigo(s)`: maiúsculas, tira espaços e hífens, aceita só o alfabeto do app; devolve `""` se inválido ou com tamanho diferente de 8.
  - `novoCodigoGrupo(rand)`: 8 caracteres do alfabeto (`rand` injetável para teste).
  - `membrosDoGrupo(docs, gid)`: de uma lista `[{id, data}]` devolve `[{id, ap, def, v, t, f, cut, up}]` das pessoas que têm o gid, descartando documentos malformados e valores fora de faixa (v entre 0 e 100000, t entre 0 e 100, f entre 0 e 3650, ap e nome cortados em 30, tipo e formato validados).
  - `definicaoDoGrupo(membros)`: a definição de quem tem o `ini` mais antigo (desempate por `up`).
  - `placarGrupo(membros, eu)`: lista ordenada por `v`, com o total e, no formato "juntos", o percentual da meta (até 100).
  - `podarGrupos(gs, hoje)`: remove grupos cujo `fim` passou há mais de 30 dias.
  - `cutucadaPermitida(cut, hoje)`: verdadeiro se `cut.d` não é hoje.
  - `resumoDupla(membros, eu)`: devolve `{eu:{t,f}, par:{ap,t,f,cut,up}|null, vazia}`.

## 3. Grupos reais por código
- Fluxo "Criar grupo" (aba Performance, Desafios): mesma tela de "Novo desafio" (tipo, formato, prazo, meta), sem "quem entra" e sem o valendo/pix (continuam só nos desafios locais). Ao confirmar, gera o código e o gid, grava a entrada em `grupos/<eu>` e mostra o código com o botão "Copiar" (usa `copiar`; sem "Compartilhar"). Na dupla vazia, o cartão da tela Hoje mostra "Parceiro: convide alguém" e abre a tela da dupla, onde está o código.
- Fluxo "Entrar com código": campo de 8 caracteres. Lê a coleção `grupos`, calcula `membrosDoGrupo`. Sem membros, "Não achei esse grupo". Com 8 membros, "Grupo cheio". Do contrário copia a definição e grava a própria entrada.
- Tela do grupo: reaproveita o placar de `telaDesafio` (barra por pessoa, "Meta juntos" com percentual, contagem regressiva), sem o bloco de provocações e sem pagamento. Mostra o código para convidar mais gente (só depois de entrar), "Sair do grupo" com confirmação inline e a data da última atualização de cada pessoa ("atualizado há 2 dias"). Nome de alguém sem atualização há mais de 7 dias aparece em cinza.
- Lista em **Desafios**: seção "Grupos de verdade" acima dos desafios locais, que ganham o rótulo "Exemplo (simulado)".
- Atualização do meu progresso: ao abrir o app, ao marcar ou desmarcar treino e ao mudar o foguinho. Só escreve se os números mudaram (comparar com a última cópia enviada) e no máximo uma vez a cada 30 segundos. Falhou, tenta de novo na próxima abertura, sem toast de erro.
- Leitura: um `onSnapshot` na coleção `grupos`, criado uma vez depois do login (`carregarGrupos`), que alimenta o cache em memória `GRUPOS`. Ele não é salvo em `SOC` nem em `LOG`. Se o artifact crescer além de algumas dezenas de pessoas, a leitura vira consulta por gid; registrado como limite conhecido, não como trabalho desta fase.
- Quem sai: apaga o gid de `gs` e escreve o documento. Documento que ficar sem grupos continua existindo com `gs: []`.
- Fim do desafio: o grupo fica visível por 30 dias como encerrado, depois `podarGrupos` o remove na próxima atualização. "Meta juntos" batida dá +200 XP uma vez por grupo (`dz.contado`, guardado em `LOG["gc_<gid>"] = true`).

## 4. Parceiro de responsa (dupla)
- Um grupo com `dupla: true`, criado por "Chamar um parceiro" (tela Desafios, bloco "grupos de verdade"): sem tipo nem meta, só o resumo. Usa o mesmo código, o gid e a entrada de `grupos/<eu>`, e aceita exatamente 2 membros.
- Mostra na tela Hoje um cartão "Parceiro" com: treinos da semana de cada um (`t`), foguinho de cada um (`f`) e a data da última atualização do parceiro. Sem parceiro ainda, mostra o código para convidar.
- **Cutucada:** 4 frases prontas ("Bora treinar?", "Vi que você treinou, boa!", "Não esquece de hoje", "Descansa e volta amanhã"), uma por dia por dupla. Grava `cut: {d: hoje, k}` na minha entrada; o parceiro vê quando abrir o app (cartão na tela Hoje, dispensável por dia com `LOG["cdp_<gid>_<data>"] = true`). Sem notificação do celular.
- Sair da dupla é um botão no cartão ("Sair da dupla"), com confirmação inline, e apaga a minha entrada. O parceiro continua vendo a dupla vazia e pode chamar outra pessoa com o mesmo código.
- O cartão da dupla não mostra nada de saúde, comida ou peso, só `t`, `f` e a cutucada.

## 5. Importar treino (GPX, TCX e FIT, com .gz)
- Entrada: um botão "Importar do relógio ou Strava" na tela de cada treino planejado ainda não feito abre o seletor de arquivo. O app não tem o conceito de treino extra, então o arquivo sempre é registrado **no treino em que o botão foi tocado**; se a data ou o esporte do arquivo não batem, a prévia avisa e o botão vira "Registrar mesmo assim" (`.gpx,.tcx,.fit,.gz`). Limite de 10 MB depois de descompactar e de 60.000 pontos; acima disso recusa com mensagem clara.
- `.gz`: descompactado com `DecompressionStream("gzip")`. Sem suporte no navegador, mensagem "Seu navegador não abre .gz, descompacte antes".
- Detecção do formato pelo conteúdo, não pela extensão: `<gpx` é GPX, `<TrainingCenterDatabase` é TCX, bytes 8 a 11 iguais a `.FIT` é FIT.
- Funções puras (no bloco `@pure`), todas síncronas e sem DOM:
  - `lerGPX(texto)` e `lerTCX(texto)`: lêem por expressão regular os trackpoints (`lat`, `lon`, `ele`, `time`, frequência cardíaca) e devolvem `{pontos, esporte}`. O esporte vem de `<type>` no GPX e de `Sport="..."` no TCX.
  - `lerFIT(bytes)`: leitor binário (cabeçalho de 12 ou 14 bytes, definições e mensagens de dados, campos de `record`: timestamp, posição em semicírculos, distância, altitude, frequência cardíaca; mensagem `session` para o esporte e totais). Ignora mensagens desconhecidas. Valida o CRC do cabeçalho quando existe; arquivo truncado devolve o que foi lido até ali e marca `parcial: true`.
  - `resumirAtividade(leitura)`: devolve `{esporte, data, min, km, paceMinKm, subidaM, fcMedia, fcMax, parcial}`. A distância soma os trechos de Haversine (ou usa `distance` do FIT quando existe), pontos duplicados ou paradas de GPS são ignorados, a subida usa filtro de 3 m, o tempo soma os intervalos entre pontos; um intervalo de mais de 120 s só conta se houve deslocamento acima de 0,5 m/s nele (senão é pausa).
  - `esporteDoApp(esporteImportado)`: mapeia para os esportes do app (`run`, `bike`, `swim`, `walk`, `gym` ou, sem correspondência, `outro`).
- **Tela de prévia:** mostra esporte, data, km, minutos, pace, subida e FC com a nota "O trajeto não é guardado, só estes números", mais a escolha de esforço (leve, ok, pesado, no limite) como no "Fiz o treino". "Registrar neste treino" grava o mesmo registro de treino feito (`ck_<data>_<i>`), com um campo extra `imp: {km, fc, sub, pace}` que marca a origem. Treino já feito não mostra o botão (é preciso desmarcar antes).
- Nada do arquivo (nem o trajeto, nem o horário exato) é guardado. Só os campos do resumo, no mesmo registro do treino feito.
- Duplicatas: se já existe treino importado na data do arquivo com os mesmos km e minutos, avisa "Esse treino já foi importado" e não grava.
- Erros: arquivo vazio, formato desconhecido, sem pontos, datas fora de 1 ano para trás ou 1 dia para a frente, km acima de 500 ou minutos acima de 1.440: mensagem clara e nada é gravado.
- Download do Strava: o texto de ajuda explica "No Strava, abra a atividade, menu, Exportar GPX (ou Exportar original, que pode ser .fit ou .gz)". Nenhuma integração com a conta.

## Testes
- Funções puras no bloco `@pure`, testadas em Node com `node --test tests/*.test.js`: `normalizarCodigo`, `novoCodigoGrupo`, `membrosDoGrupo`, `definicaoDoGrupo`, `placarGrupo`, `podarGrupos`, `cutucadaPermitida`, `resumoDupla`, `lerGPX`, `lerTCX`, `lerFIT`, `resumirAtividade`, `esporteDoApp`.
- Fixtures: um GPX e um TCX pequenos (strings no teste), um FIT montado em memória por um codificador mínimo dentro do teste, e o mesmo GPX comprimido com `zlib.gzipSync` para o caminho `.gz` (a descompactação em si é feita no navegador, testada manualmente).
- `gidDeCodigo` testado com `globalThis.crypto.subtle` do Node.
- Casos de teste obrigatórios: documento de grupo malformado é ignorado; valores gigantes são limitados; 9º membro recusado; cutucada duas vezes no mesmo dia recusada; grupo vencido há mais de 30 dias é podado; FIT truncado devolve `parcial`; pausa longa não conta no tempo; subida filtrada por 3 m; datas fora da faixa recusadas.
- A interface é verificada no artifact do usuário (criar e entrar em grupo, dupla, cutucada, importar).
- Banco: a declaração completa da seção 1 é passada no republish. Conferir depois, lendo o artifact, que as regras antigas continuam presentes.

## Limites e riscos conhecidos
- Qualquer pessoa com acesso ao artifact consegue ler `grupos` por fora do app. O que está lá é só apelido e contagens, e o app diz isso antes do primeiro grupo.
- Códigos de 8 caracteres e SHA-256 dificultam, mas não impedem, descobrir um grupo por força bruta por quem lê o banco. Aceito, dado o conteúdo mínimo.
- Escrever em `grupos` exige nível Contributor. Quem só visualiza vê os grupos de quem já publicou, mas não entra em nenhum.
- A leitura de toda a coleção `grupos` cresce com o número de usuários; aceitável para a fase de teste.
- Dois membros podem entrar ao mesmo tempo num grupo com 7 pessoas e passar de 8; o placar mostra todos e o limite vale só para novas entradas.
- Nenhuma notificação com o app fechado: a cutucada só aparece ao abrir.
- O FIT cobre os campos mais comuns de relógios Garmin, Wahoo e do Strava. Arquivos com campos desenvolvedor (developer fields) são lidos ignorando esses campos.

## Fora desta fase
- Chat nos grupos reais, fotos no grupo, avisos push, integração direta com o Strava, ranking entre grupos, importar de relógio por Bluetooth.
