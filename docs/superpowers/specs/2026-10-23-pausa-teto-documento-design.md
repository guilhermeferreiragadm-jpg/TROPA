# Tropa: modo pausa, teto de carga semanal e documento de fisioterapia

Data: 2026-10-23. Aprovado em conversa. Arquivo alvo: `publicar.html` (artifact `Su8kaFAaifinor4vQ4mZeq`).

## Contexto do código atual
- `gerarPlano(p)` monta todas as semanas de uma vez; semanas começam na segunda (`semanaDe`, `dow`). O longão já sobe no máximo 10% por semana (`validar`).
- Ajustes valem um dia: `LOG["aj_"+dia] = {acao: pular|descanso|leve|trocar, motivo, at}`, lidos em `treinosDe(d)`.
- Check-in (`sheetCheckin`) grava `ci_<dia>` com sono, humor (energia), dor, peito, desmaio. Dor >= 5 abre `sheetAjuste`; `suspenso()` bloqueia o dia.
- A IA do artifact (`sample`) aceita só imagens (JPEG, PNG, WebP, GIF). O fluxo de foto de comida usa `miniatura`, `sample.limits()` e `sample.json`.
- Regra do banco de conhecimento: segurança > plano do usuário > banco.

## 1. Modo pausa
- Dado: `P.pausa = {tipo: doenca|lesao|outro, inicio, fim|null, motivo}` e, depois da volta, `P.pausa.retorno = {inicio, fatores:[...]}`.
- Entrada: botão "Pausar plano" em Hoje, ação do coach `pausar_plano`, oferta no check-in (dor >= 5 em dias seguidos ou doença citada).
- Durante: `treinosDe(d)` devolve `[]` nos dias da pausa; esses dias não contam como falta; check-in continua; o foguinho fica congelado (não zera).
- Saída: botão "Voltar a treinar" pergunta a dor atual; em lesão, dor >= 4 bloqueia e explica.
- Deslocamento: pausa de até 7 dias só esvazia os dias. Acima disso, `plano.inicio` avança `ceil(dias/7)` semanas.
- Volta gradual (valores iniciais, revisar com a equipe): até 3 dias sem redução; 4 a 7 dias 1ª semana 80%; 8 a 14 dias 60% e 80%; 15 a 28 dias 50%, 65% e 80%; mais de 28 dias sugere refazer o plano.
- Prova: se o plano deslocado ultrapassar a data da prova, avisar e oferecer refazer (lógica de `prazoCurto`).

## 2. Teto de carga semanal
- Medida: minutos estimados da semana, todas as modalidades (`minDe`, `minEst`). O longão mantém a regra própria.
- Base: média das últimas 3 semanas realmente feitas (`ck_`). Sem histórico, usa o perfil (`kmSemana`). Teto = base * 1,10, com piso de +15 min.
- Ação: se a semana (atual e a próxima) passar do teto, reduzir o excedente nas sessões menos importantes com o ajuste "leve" (60%); longão e treino principal por último.
- Explicação e controle: cada ajuste guarda `motivo` e `por` ("teto", "dor", "prontidao", "pausa"); card visível na Semana e no treino com "Manter o original" (`teto_off_<semana>`).
- Segurança: o teto nunca aumenta carga e nunca altera ajuste feito pela própria pessoa.

## 3. Documento de fisioterapia
- Entrada: passo opcional ao montar plano/objetivo e no Perfil. Foto ou PDF; PDF convertido em imagens no navegador (pdf.js via cdnjs, a validar), com foto como alternativa.
- IA (`sample.json` com imagens) extrai: lesão, região, fase, evitar, permitido, limites de carga, prazo de retorno, confiança.
- Confirmação obrigatória: a pessoa vê, edita e confirma. Só o resumo é salvo em `P.perfil.fisio` (com `fonte`, `data`). O arquivo é descartado e nunca vai ao banco. Consentimento próprio para dado de saúde; botão para apagar.
- Uso: contexto do coach e da Nutri; marca "lesão em acompanhamento" na triagem; se houver limite de carga, o teto usa esse limite.
- Regra central: documento lido pela IA só pode tornar o plano mais conservador. Aviso fixo: não substitui o fisioterapeuta.
- Confiança baixa: pedir para digitar o resumo.

## Entrega e testes
1. Pausa e volta gradual. 2. Teto e explicações. 3. Documento.
- Funções puras (`deslocamentoPausa`, `fatorRetorno`, `calcularTeto`) em bloco isolado, testadas em Node. Interface verificada no artifact do usuário.
- Banco: regras e capacidades inalteradas (`data/users/{self}`).
