# Tropa: Fase 3, corpo (peso, medidas, fotos e faixa de calorias)

Data: 2026-10-27. Arquivo alvo: `publicar.html`. Fase 3 de 4 do roteiro de melhorias. Base: branch `fase2-ritmo-semana`.

## Escopo (reduzido depois de ler o código)
- **Exportar meus dados:** já existe (Perfil, "Baixar meus dados", JSON com perfil, plano, log e social). Fora da fase.
- **Cartão para compartilhar o treino:** já existe (`cardConquista`, PNG 1080×1920 depois do treino e ao subir de nível). Fora da fase.
- **Lembretes:** o artifact não notifica com o app fechado. Entra só um cartão semanal de pesagem dentro do app.
- **Calorias:** o card "Calorias do dia" (comeu contra gastou) já existe. Entra uma faixa de calorias que acompanha o peso.
- **Peso, medidas e foto de progresso:** hoje só existe um valor de peso no perfil. Entra com histórico.

Decisões do usuário (2026-10-27): faixa de calorias só para adultos com piso de segurança; fotos em miniaturas pequenas, até 6, só adultos; medidas cintura, quadril, peito, braço e coxa; lembrete como cartão semanal na tela Hoje.

## Regras de segurança (valem para tudo desta fase)
- **Menores de 18 anos:** só registram peso (já necessário para as metas de comida). Sem medidas, sem foto, sem tendência, sem faixa de calorias e sem lembrete.
- A faixa de calorias não aparece quando `p.flags.red` tem itens, quando `p.ciclo === "sim"` (ciclo ausente ou irregular, sinal de energia baixa), ou quando faltam peso, altura, idade ou sexo.
- Nunca há meta de peso, nem texto que comemore perda rápida. O app não empurra o déficit mais fundo: se o peso parar, ele pede conversa com o coach, não corta calorias sozinho.
- Foto, medidas e peso nunca vão para o feed, para `social` nem para a IA como imagem. O coach recebe só uma linha de texto com peso e tendência, e só para adultos.

## 1. Registro de peso e medidas
- Dado: `LOG["corpo"] = [{d, kg, m:{cin, qua, pei, bra, cox}}]`, uma entrada por dia (registrar de novo no mesmo dia substitui), no máximo 120 entradas (as mais antigas saem). `m` só existe para adultos, e cada medida é opcional.
- Peso válido entre 30 e 300 kg (uma casa decimal); medida válida entre 10 e 250 cm. Variação de mais de 5 kg em menos de 7 dias pede um "Confere?" antes de salvar (aviso, não bloqueio).
- Ao registrar o peso, o app também atualiza `P.perfil.peso` (e chama `salvarPerfil`) para as metas de comida acompanharem.
- Funções puras no bloco `@pure`:
  - `registrarCorpo(lista, reg, menor)`: devolve a lista nova (substitui o mesmo dia, ordena por data, corta em 120, descarta valores fora da faixa, remove `m` quando `menor`).
  - `tendenciaPeso(lista, hoje)`: regressão linear dos pesos dos últimos 28 dias. Precisa de pelo menos 3 registros que cubram 14 dias ou mais; senão devolve `null`. Devolve `{kgSemana, pesoAtual, n, dias}` com `kgSemana` arredondado a 0,1.
  - `variacaoMedidas(lista)`: para cada medida, primeira e última marcações e a diferença em cm.
- Tela **Corpo**, aberta por um botão novo no Perfil ("Peso, medidas e fotos") e pelo cartão de lembrete: campo de peso, medidas (adultos), gráfico simples de peso dos últimos 90 dias (linhas em SVG inline, sem biblioteca; não aparece para menores), tendência em texto ("Nos últimos 28 dias: −0,3 kg por semana"), variação das medidas, lista de registros com apagar.

## 2. Fotos de progresso
- Só adultos. Dado: `LOG["fp_<AAAA-MM-DD>"] = {th, at}`, onde `th` é a miniatura (lado maior de 240 px, JPEG qualidade 0,5, cerca de 8 a 15 KB) gerada por `miniatura(file, 240, 0.5)`, com uma segunda tentativa em 200 px e qualidade 0,45. Uma foto nova é recusada se o registro (LOG) passar de 200 KB com ela.
- No máximo 6 fotos. Ao adicionar a sétima, a sheet avisa e oferece substituir a mais antiga. A pessoa pode apagar cada foto.
- A poda de rotina (`podarFotos`) não toca em `fp_`. A poda de emergência das miniaturas de refeição usa alvo de 180 KB mais o tamanho das fotos de progresso; acima de 220 KB mantém só as 2 `fp_` mais recentes; acima de 240 KB remove as `fp_` restantes. Quando apaga alguma `fp_`, avisa por toast. Uma foto nova é recusada se o registro passar de 200 KB.
- Tela Corpo mostra as miniaturas em grade, e "Comparar" mostra a primeira e a última lado a lado, com as datas. Nada de download nem compartilhar nesta fase.
- O aviso "A foto fica só no seu registro, não aparece para amigos nem vai para a IA" aparece antes de adicionar a primeira.

## 3. Faixa de calorias (só adultos)
- Função pura `faixaKcal(ctx)` com `ctx = {kg, cm, idade, sexo, objetivo, menor, red, ciclo, treinoDia, tendenciaKgSemana}`:
  - Devolve `null` com IMC abaixo de 18,5 (adulto abaixo do peso não recebe faixa) e fora de 120 a 230 cm / 30 a 300 kg. Devolve `null` também se `menor`, se `red` tem itens, se `ciclo === "sim"`, ou se faltar kg, cm, idade ou sexo. A função pura também bloqueia idade menor que 18 e sexo fora de m/f/o. Para sexo "o" (Outro) usa a média das duas fórmulas (deslocamento -78) e piso de 1350 kcal.
  - Taxa basal (Mifflin-St Jeor, a mesma de `gastoDia`) vezes 1,35, mais `treinoDia` (média diária de kcal de treino da semana planejada). É a manutenção estimada.
  - `emagrecer`: faixa de −10% a −20% da manutenção. `massa`: +5% a +10%. Demais objetivos (forma, saúde, correr, provas): manutenção ±5%.
  - **Piso:** a faixa nunca fica abaixo da taxa basal estimada, nem abaixo de 1500 kcal (sexo masculino) ou 1200 kcal (sexo feminino).
  - **Ajuste pela tendência** (só com `tendenciaKgSemana` não nulo): em `emagrecer`, se a perda passar de 0,9% do peso por semana, sobe a faixa em 150 kcal e o motivo diz que estava perdendo rápido. Se a perda ficar abaixo de 0,1% por semana depois de 3 semanas, a faixa não muda e o motivo ("O peso não está caindo") sugere conversar com o coach. Em `massa`, se o ganho passar de 0,5% por semana, desce 100 kcal; se ficar abaixo de 0,1% por semana depois de 3 semanas, sobe 150 kcal. Nunca desce para menos que o piso.
  - Valores arredondados para múltiplos de 50. Retorna `{min, max, manutencao, motivo}`.
- Mostrada como "Faixa de calorias estimada: 2.100 a 2.300 kcal" com o motivo em uma frase e a nota "Estimativa, não é prescrição. Para um plano individual, procure um nutricionista". Aparece na tela Comida (acima das metas) e na tela Corpo. Sem faixa, nada aparece e a tela não mostra explicação.
- O card "Calorias do dia" não muda.

## 4. Lembrete de pesagem
- Configuração: `LOG["corpo_cfg"] = {lembrar:true, dia:0..6}` (padrão segunda, `dow` 0). Só existe depois do primeiro registro de peso; adultos apenas. A tela Corpo tem a chave "Lembrar de me pesar" e a escolha do dia.
- Função pura `lembretePesagem(lista, cfg, hoje, dispensado, menor)`: verdadeiro quando `cfg.lembrar`, hoje é o dia escolhido ou depois (na mesma semana), não houve registro nesta semana e `dispensado` é falso.
- Cartão na tela Hoje (em `extrasHoje`): "Hora de se pesar": o toque no cartão abre a tela Corpo, e **Hoje não** é a ação de dispensa (grava `LOG["cd_<segunda>"] = true` e some até a semana seguinte). Escolher um dia na tela Corpo não liga o lembrete sozinho. Sem peso obrigatório.

## 5. Contexto do coach
- Para adultos, o contexto do coach ganha uma linha: `PESO: 74,2 kg, tendência -0,3 kg/semana em 4 semanas`, que só aparece quando há tendência (o peso já está na linha do usuário). Menores não recebem tendência.

## Testes
- Funções puras no bloco `@pure`: `registrarCorpo`, `tendenciaPeso`, `variacaoMedidas`, `faixaKcal`, `lembretePesagem`. Testes em Node com `node --test tests/*.test.js`, incluindo: menor sem medida e sem faixa, `red` e `ciclo` bloqueiam a faixa, piso respeitado, perda rápida sobe a faixa, estagnação não corta, limites 120, peso fora da faixa descartado.
- A interface é verificada no artifact do usuário (tela Corpo, fotos, cartão de lembrete, faixa na Comida).
- Banco: nenhuma regra nova; usa `data/users/{self}` como já usa.

## Limites do LOG
- `corpo` (120 entradas, cerca de 8 KB), `fp_` (até 6 miniaturas, cerca de 50 a 90 KB no total) e `corpo_cfg`/`cd_` (poucos bytes). Margem sobre os 256 KB: a poda de emergência da seção 2 protege o resto do registro.

## Fora desta fase
- Compartilhar ou baixar a comparação de fotos, importar do relógio ou Strava (Fase 4), grupos com desafio e parceiro de responsa (Fase 4), notificação do celular (só no app oficial).
