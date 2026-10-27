# Tropa: Fase 2, ritmo da semana

Data: 2026-10-27. Arquivo alvo: `publicar.html`. Fase 2 de 4 do roteiro de melhorias. Base: branch `fase1-coach-comida`.

## Escopo (reduzido depois de ler o código)
- **Musculação, descanso e carga:** já existe (cronômetro de descanso, coluna "Anterior", sugestão de progressão com "Aplicar", platô). Só falta a sugestão de carga considerar prontidão e dor. Entra como item 2.
- **Check-in de domingo do coach:** já existe o "Resumo da semana" (`semanaDoResumo`, `gerarResumo`, `sheetResumo`), que aparece no domingo depois das 18h, na segunda e na terça. Falta a conversa e ligar à sugestão de aliviar da Fase 1. Entra como item 1.
- **Lista de compras da semana:** não existe. Entra como item 3.
- **Meta calórica que se ajusta:** hoje não existe meta de calorias, só proteína, carboidrato e água. Ajustar pelo peso exige registro de peso. **Movida para a Fase 3**, junto com peso e medidas (decisão do usuário).

Decisão do usuário: a Nutri monta a lista da semana toda.

## 1. Resumo de domingo com conversa
- A pergunta e o card só aparecem quando o resumo é da **semana atual** (domingo depois das 18h, `semanaDoResumo()` igual a `iniSemana()`). Na segunda e na terça o resumo é da semana passada e a sheet mostra só o resumo e o botão de conversa com o coach, porque aliviar "a próxima semana" nesse momento seria outra semana.
- Dentro de `sheetResumo`, depois do resumo, aparece a pergunta "Como está o corpo para a próxima semana?" com 3 botões: **Bem**, **Cansado**, **Dolorido**. A resposta é gravada no mesmo registro do resumo (`rs_<segunda>.corpo`), sem apagar o que já está nele, e a sheet se redesenha com o card.
- `sugerirSemana(feitos, corpo)` ganha o segundo parâmetro opcional `corpo`:
  - `"dolorido"` gera `tipo:"aliviar"` com motivo "Você disse que está dolorido. Se a dor continuar, fale com o coach ou com o seu fisioterapeuta.", mesmo com menos de 2 treinos feitos.
  - `"cansado"` gera `tipo:"aliviar"` com motivo "Você disse que está cansado" quando já havia pelo menos 1 treino "pesado" ou "no limite" ou quando o resultado sem `corpo` já seria `aliviar`. Sem nenhum sinal de carga, apenas "cansado" não propõe redução.
  - `"bem"` ou ausente: comportamento atual.
- `sugestaoSemana()` lê `LOG["rs_"+key(seg0)]` e repassa `.corpo` a `sugerirSemana`. Como o resumo da semana atual só existe depois de domingo 18h e a pergunta só aparece lá, o `corpo` só influencia a sugestão nesse momento.
- O card de sugestão (`sugestaoHTML`) também aparece dentro da sheet do resumo, logo abaixo da pergunta, com os mesmos botões e a mesma regra: nada muda sem o toque do usuário.
- O botão **Falar com o coach sobre a semana** (sempre presente na sheet) abre o chat do coach com `chatPre` preenchido ("Como foi a minha semana e o que muda na próxima?").
- Sem alteração no que o app grava de `rs_<segunda>.lido`.

## 2. Carga de musculação considera prontidão e dor
- Função pura `ajustarSugestaoCarga(sg, ctx)` com `ctx = {pront, dor, hold}`:
  - Se `sg.kg == null` ou o contexto não tem `pront` nem `dor`, devolve `sg` igual.
  - Se `dor >= 5` ou `pront < 50`: devolve `{kg: hold, txt}` com texto "Hoje o seu corpo pede calma (prontidão X, dor Y/10). Mantenha a carga da última vez e pare 2 reps antes da falha." quando `sg.kg > hold` (ou seja, a sugestão era subir); se a sugestão já era manter ou reduzir, devolve `sg` igual.
  - Se `dor >= 7`: o texto acrescenta "Pule o movimento que doer."
- A função `sugestaoAjustada(ex)` calcula `hold` a partir do histórico, aplica `ajustarSugestaoCarga` com a prontidão e a dor do check-in de hoje e é usada em `sessaoDe` (carga inicial dos sets), na exibição da sugestão e no botão Aplicar de `telaForca`. Sem check-in feito, nada muda.
- O botão **Aplicar** passa a aplicar a carga ajustada (hold).

## 3. Lista de compras da semana
- Entrada: na tela Comida, botão **Lista de compras da semana**. Abre uma sheet.
A semana da lista é a atual; no domingo é a semana seguinte (a chave é a segunda-feira dessa semana).
- Dados: `LOG["compras_<segunda>"] = {itens:[{g, n, q, ok}], at}`, no máximo 60 itens; `g` grupo, `n` nome (até 60 caracteres), `q` quantidade (até 30 caracteres), `ok` marcado.
- Geração: um pedido à Nutri (`sample.json`) com restrições, orçamento, metas de proteína e carboidrato, número de treinos da semana e a data da semana, em comida brasileira simples e barata. Responde `{"itens":[{"grupo":"...","nome":"...","qtd":"..."}]}`.
- Funções puras no bloco `@pure`:
  - `normalizarCompras(itens)`: aceita a resposta da IA e devolve a lista segura: descarta itens sem nome, corta textos, limita a 60 itens, junta duplicados pelo nome normalizado (`normTxt`), e coloca grupo desconhecido em "Outros". Grupos válidos: Hortifrúti, Carnes e ovos, Laticínios, Grãos e massas, Mercearia, Bebidas, Outros.
  - `comprasTexto(lista)`: texto simples agrupado, com `[x]` e `[ ]`, para copiar e baixar.
- Sheet: itens agrupados com caixa de marcar (grava em `compras_<segunda>` a cada toque), botões **Copiar**, **Baixar** (usa o helper `baixar` existente) e **Refazer a lista**. Se não houver IA disponível, mostra a mensagem "A Nutri não está disponível agora" e não gera nada.
- Menores de idade: o pedido à Nutri inclui "sem déficit e sem suplemento".
- Limite do LOG: a lista fica em torno de 4 a 6 KB; ao criar uma nova semana a lista antiga continua no LOG até o fim do período de poda existente (sem regra nova de poda nesta fase).

## Testes
- Funções puras no bloco `@pure`: `sugerirSemana(feitos, corpo)` (estendida), `ajustarSugestaoCarga`, `normalizarCompras`, `comprasTexto`. Testes em Node com `node --test tests/*.test.js`.
- Interface verificada no artifact do usuário: pergunta e card dentro do resumo, aplicar carga ajustada, sheet de compras (gerar, marcar, copiar, baixar).
- Banco: nenhuma regra nova; usa `data/users/{self}`.

## Fora desta fase
- Meta calórica que se ajusta (Fase 3, com peso e medidas).
- Tendência de peso, medidas e fotos de progresso (Fase 3).
