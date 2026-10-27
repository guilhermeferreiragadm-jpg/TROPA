# Tropa: Fase 1, coach e comida

Data: 2026-10-27. Arquivo alvo: `publicar.html`. Parte do roteiro de melhorias aprovado em conversa (fase 1 de 4). Base: branch `integrar-novidades-amigo`.

## Escopo (reduzido depois de ler o código)
- **Faixa de calorias:** já existe (prompt da Nutri pede mínimo e máximo, porção assumida, confiança, escondido e "Corrigir com a Nutri"). Fora da fase 1.
- **Por que este treino:** o card existe, mas `motivoTreino` tem textos fixos do plano de uma pessoa (prova de 10 km em 18/10, meia de fevereiro, 70.3, Hyrox). Entra como correção (item 1).
- **Como foi:** a tela `sheetFeito` já grava `rpe` (leve, ok, pesado, limite), mas nada ajusta a semana seguinte. Entra (item 2).
- **Repetir refeição e favoritos:** não existe. Entra (item 3).

Decisão do usuário: o item 2 **sugere e espera o aceite**, nunca reduz sozinho.

## 1. Motivo do treino que serve para todos
- `motivoTreino(t, d)` passa a montar o texto a partir dos dados do plano: tipo do treino (`t.k`, nome, zona), fase (`NOMEF`), semana de descarga (`sem.deload`), longão em relação à semana anterior, e objetivo ou prova do perfil quando existirem.
- Os textos específicos atuais (prova de 10 km em 18/10, meia de fevereiro, 70.3, Hyrox) só aparecem quando o plano é o plano misto de origem (fases F0 a F8 com meia e 70.3). Para qualquer outro plano valem os textos genéricos.
- Nunca citar data, prova ou distância que não esteja no plano ou no perfil da pessoa.
- Função pura `motivoGenerico(t, ctx)` no bloco `@pure`, testada em Node: não menciona 18/10, "70.3" nem "meia de fevereiro" quando o contexto não tem essas provas.
- O card "por que esse treino" continua na tela do treino. Sem botão novo: "alguma observação?" com o coach já cobre o "está pesado".

## 2. Como foi sugere a próxima semana
- Medida: os treinos feitos na semana atual (`ck_<dia>_<i>`), com `rpe` e `comoPlano`.
- Função pura `sugerirSemana(feitos)` devolve `{tipo:"aliviar"|"subir"|null, motivo, pesados, total}`:
  - Precisa de pelo menos 2 treinos feitos na semana.
  - **aliviar:** pelo menos metade dos treinos foi "pesado" ou "limite", ou 2 treinos "limite", ou 2 treinos ficaram abaixo do plano (`comoPlano` falso por falta de volume) com algum "pesado".
  - **subir:** 3 ou mais treinos e todos "leve" e dentro do plano. Só mostra uma frase e um botão que abre o chat com o coach. Nunca altera o plano.
  - Caso contrário, `null`.
- Quando `tipo = "aliviar"`, aparece um card na Semana e em Hoje: "Seus últimos treinos foram pesados (3 de 4). Quer aliviar a próxima semana?" com os botões **Aliviar a próxima semana** e **Manter como está**.
- **Aceitar:** usa o mesmo mecanismo do teto de carga. Meta = 85% dos minutos da próxima semana (`minutosPlan`); `reduzirParaTeto` corta os treinos menos importantes para "leve" (60%). Grava `aj_<dia>` com `por:"feedback"` e motivo legível, e `fb_<segunda>` com `{estado:"aceito", de, para, cortes, at}`.
- **Recusar:** grava `fb_<segunda> = {estado:"recusado", at}`; a sugestão não volta nessa semana.
- **Desfazer:** o card da próxima semana ganha "Manter o original", que remove só os `aj_` com `por:"feedback"` (padrão de `manterPlanoOriginal`). Nunca remove ajuste feito pela própria pessoa.
- Nunca altera dias passados, treinos já feitos, nem dias que já têm `aj_` de outra origem. Nada acontece durante pausa (`pausaAtiva()`).
- Se o teto de carga já cortou a próxima semana, a sugestão só considera os minutos restantes; se não sobrar corte possível, o card não aparece.
- Rótulos dos ajustes: `rotuloAj` ganha "Ajustado pelo seu feedback".
- Segurança: a sugestão só pode tornar o plano mais conservador, como o teto.

## 3. Repetir refeição e favoritos
- Dado: `LOG["fav_refs"] = [{comeu, estimativa, porcao, refeicao, usos, ultimo}]`, no máximo 12, ordenadas por uso e data. Fica no LOG, então o `enviarPerfil` não apaga.
- `atualizarFavoritas(lista, reg, hoje)` (pura): chamada em `registrarRefeicao` sempre que há `comeu` e a refeição não foi pulada. Junta por texto normalizado (mesmo prato soma `usos`), corta em 12 removendo o menos usado e mais antigo.
- `candidatasRepetir(ontem, favoritas, refeicao)` (pura): primeiro o que a pessoa comeu naquela refeição ontem, depois até 4 favoritas, sem repetidos.
- UI na tela Comida: cada refeição sem registro hoje ganha o botão **repetir**. Abre uma sheet com as candidatas; um toque registra a refeição com `comeu`, `estimativa`, `porcao` copiados e `repetida:true`, sem foto e sem chamar a IA. A sheet avisa que a estimativa é copiada do registro anterior e orienta a usar "escrever" se a porção mudou.
- Limites do LOG: o doc tem 256 KB; os favoritos guardam só texto curto (140 caracteres).

## Testes
- Funções puras no bloco `@pure`: `motivoGenerico`, `sugerirSemana`, `atualizarFavoritas`, `candidatasRepetir`. Testes em Node com `node --test tests/*.test.js`.
- A interface é verificada no artifact do usuário (card de sugestão, aceitar e desfazer, sheet de repetir).
- Banco: nenhuma regra nova; usa `data/users/{self}` como já usa.

## Fora desta fase
- Planos personalizados com fases (`pl.fases`) usam textos de motivo específicos do plano de origem; os planos gerados pelo app (`gerarPlano`, sem fases) usam textos genéricos. Anotado para depois, junto com a Fase 2.
- Faixa de calorias para o total do dia (hoje o total soma o ponto médio).
