# Meu treino e opção "Não corro"

Data: 2026-11-03. Aprovado em conversa. Arquivo alvo: `publicar.html`.

## Problema
- O cadastro exige "corridas por semana" e pergunta km, maior corrida e melhor tempo. Não existe um "não corro" claro.
- Todo plano sai de modelos fixos (`TPL` e `gerarPlano`), quase todos de corrida. Só "Força e físico" gera academia, e ainda inclui um "Cardio leve" de corrida.
- A pessoa não consegue colocar o treino e os exercícios que já faz.

## Decisões (do dono)
- Abordagem **A**: o treino próprio usa o mesmo formato do plano atual (`P.plano`), marcado como `custom`. Hoje, semana, registro, check-ins e Coach continuam lendo esse formato.
- Quem marca "Não corro" escolhe entre **gerar plano de força sem corrida** ou **montar o próprio treino**.
- Tipos que cabem na semana: musculação (exercícios com séries, repetições e kg), corrida, bike e natação (por tempo ou distância), outros esportes (nome, duração e esforço) e descanso ou mobilidade.

## Cadastro
- Passo 3 ("Onde você está hoje"): botão **Não corro** (`draft.naoCorre = true`). Ele grava `corridasSem = 0`, `kmSemana = 0`, `maiorLongao = 0`, `melhorTempo = ""`, esconde esses quatro campos e a validação de `corridasSem` passa. Desmarcar volta os campos.
- Passo 1 ("O que você quer conquistar?"): nova opção **Montar meu treino** (`objetivo = "meu"`), ao lado das atuais.
- Quem marcou "Não corro" com um objetivo que gera plano de corrida (prova, correr, emagrecer, forma) e não escolheu "Montar meu treino" vê, no fim do cadastro, uma pergunta: **Gerar plano de força** ou **Montar meu treino**. A escolha define `objetivo` (`massa` ou `meu`).
- A extração por IA do passo 2 ("Me conta") aprende o campo: se o relato disser que a pessoa não corre, preenche `naoCorre`.
- Resumo em `revisao` continua igual (valores zerados).

## Plano de força sem corrida
- `TPL.massa` e o ramo `forca` de `gerarPlano` perdem o "Cardio leve" quando `p.naoCorre`. No lugar entra um cardio opcional por caminhada rápida ou bike (`k:"bike"`), 30 min, esforço 3/10, sem km.
- `nivel(p)` já usa `academiaMeses` para plano de força, então não muda.

## Meu treino (plano próprio)
- `TPL.meu = {nome:"Meu treino", pico:0, geral:true, mods:[], custom:true}`.
- Tela **Montar meu treino**: uma semana-modelo de 7 dias. Cada dia: descanso ou até 3 treinos. Treino novo: corrida, força, bike, natação ou outro esporte. Campos reaproveitados do editor dos Personal (`edHTML`, `NOVOTR`, `exTxt`, limites `TETO`): nome, duração ou distância, esforço, exercícios (nome, séries, repetições, kg opcional).
- Outro esporte é `k:"gym"` com nome livre e `passos:[]`, como `TIPOS_FIXO.outro`.
- Salvar gera `P.plano = {versao:2, objetivo:"meu", nome:"Meu treino", nivel:"intermediario", inicio:<segunda desta semana>, semProva:true, custom:true, semanas:52 cópias do modelo (w, dias, longao:0), modelo:<a semana-modelo>, geradoEm}`. O `inicio` e o `geradoEm` seguem as regras de pausas e deslocamentos já existentes.
- Reabrir a tela (Perfil e Treino: "Montar ou editar meu treino") carrega `modelo`. Salvar de novo refaz as semanas a partir de **hoje**: semanas passadas e dias já feitos ou travados (`diaTravado`) não mudam.
- Plano próprio não depende de prova: `dataProva` fica vazio e `semProva` é verdadeiro.

## Pontos do app a ajustar para plano `custom`
O plano de implementação confere cada ponto que supõe corrida, longão, fase ou prova. Em plano `custom` eles ficam neutros ou escondidos:
- `validar(plano, p)` (longão e dias duros): sem validação de longão; mantém "pelo menos 1 dia de descanso" e "no máximo 2 dias duros".
- `fasesDe` e `faseDaSemana` (gráfico de fases): sem fases para `custom`.
- Gráfico de longão por semana, projeção (`projecao`), alvo da prova e textos "dias para a prova".
- `flagsDe` e o aviso do longão em `enviarPerfil` (`pk < t.pico*0.75`): só para plano com `longao`.
- Prompts do Coach que citam `TPL[objetivo].nome`, VDOT e longão: aceitam `custom` (nome "Meu treino", sem VDOT).
- Migração em `entrar` (`versao<2` regenera o plano): não toca plano `custom`.
- "Mudar objetivo ou adicionar prova": se o plano é `custom`, avisa que trocar o objetivo substitui o treino próprio.

## Fora do escopo
- Colar ou fotografar a ficha de treino para a IA converter (fica para depois).
- Editar o plano gerado com o editor novo (os Personal já têm o deles).
- Várias semanas-modelo (A/B) e progressão automática de carga.
- Mudanças em regras do Firestore e no backend: tudo fica em `P.plano` dentro de `data/users/{uid}/perfil`.

## Testes e verificação
- Testes de Node (padrão de `tests/pure.test.js`, extraindo o código de `publicar.html`): `gerarPlano` com `naoCorre` não inclui corrida nem "Cardio leve"; construtor do plano `custom` repete o modelo por 52 semanas com `dias` de 7 itens; refazer a partir de hoje preserva semanas passadas; `validar` ignora longão em `custom`.
- Harness (`tests/harness`): cadastro com "Não corro" passa do passo 3 sem corridas; fluxo "Montar meu treino" cria o plano e a tela Hoje mostra o treino do dia; editar e salvar atualiza as semanas futuras.
- Suíte completa verde antes de publicar. Depois: `npm run build:www` e `firebase deploy --only hosting`.
