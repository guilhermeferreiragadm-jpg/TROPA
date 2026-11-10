# Idioma inglês completo (EUA): plano de implementação

> Para quem executar: use superpowers:subagent-driven-development. Passos com `- [ ]`.

**Meta:** o app inteiro em inglês americano (telas, exercícios, alimentos, erros do servidor, coach e Nutri), com milhas e libras por escolha, sem mexer no que é gravado.

**Spec:** `docs/superpowers/specs/2026-11-09-idioma-ingles-design.md`

## Regras globais

- Armazenamento e lógica seguem em português e em unidades métricas. Só a exibição muda.
- Não reescrever o código das telas: a tradução é em tempo de execução.
- Testes: `node --test tests/*.test.js` (243 hoje) devem continuar passando.
- Commits em português, terminados com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Nada é publicado nem enviado ao GitHub.

## Tarefas

### Tarefa 1: extrator de textos e lotes
Arquivos: criar `app/scripts/i18n-extrair.js`; criar `tests/i18n-extrair.test.js`.
- Produz a lista de literais em português do script do `publicar.html`, de `app/shim/*.js` e de `functions/lib.js` (acorn, que já está em `node_modules` do scratchpad; usar `require` com caminho por variável de ambiente `ACORN_PATH` ou o pacote instalado como devDependency).
- Regra de "provável português": acento ou palavra funcional; ignora base64, URLs, nomes de classe CSS, JSON da base de conhecimento (`KBC`) e dados de foto.
- Saída em lotes por tamanho (cerca de 300 textos curtos ou 60 longos por lote) em `app/i18n/lotes/NN.json` (`{"pt": ""}`).
- [ ] Teste: extrai um texto conhecido; ignora um base64; é determinístico.

### Tarefa 2: núcleo do tradutor, preferências e formatos
Arquivos: modificar `publicar.html` (bloco `@i18n`, `num`, `fmt`, `fmtLongo`, `toLocaleString("pt-BR")`, tela Perfil); criar `app/scripts/i18n-embutir.js`; criar `tests/i18n-nucleo.test.js`.
- Funções puras: `traduzir`, `converterUnidades`, `numFmt`, `localeDoIdioma`.
- Passagem no DOM e `MutationObserver`; `P.perfil.idioma` e `P.perfil.unidades` com padrão por `navigator.language`; linhas Idioma e Unidades em Perfil; `<html lang>`.
- [ ] Testes: busca exata, padrão com número, troca de trechos em fronteira de palavra, conversões (km/mi, kg/lb, ritmo, cm/pés), idioma pt devolve igual.

### Tarefas 3 a N: traduções por lote (uma por lote, em paralelo)
Cada subagente traduz um `app/i18n/lotes/NN.json` para `app/i18n/en/NN.json` com as regras do glossário (`docs/superpowers/plans/glossario-en.md`).
- [ ] Validação automática: mesmas chaves, nenhum valor vazio, mesmos marcadores (`{n}`, `%`, entidades HTML, tags) e emojis, nenhum português residual.

### Tarefa: padrões e varredura
- Padrões em `app/i18n/padroes-en.json` para frases com número e plural.
- Varredura no harness com idioma inglês: percorre telas e lista texto ainda em português; vira entradas ou padrões; repetir até zerar nas telas principais.

### Tarefa: unidades nas entradas
- Peso, altura, medidas do corpo, distância e ritmo digitados: mostram e leem na unidade escolhida e gravam em métrico.

### Tarefa: coach e Nutri em inglês
- Mandar `idioma` e `unidades` e acrescentar a instrução nos prompts; mensagens de erro do servidor no dicionário.

### Tarefa: cobertura e documentação
- Teste de cobertura (extrator contra dicionário e lista de ignorados) e README.
