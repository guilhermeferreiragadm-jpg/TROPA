# Redesign Apple: especificação

Data: 2026-10-27. Branch: `redesign-apple`. Referência de método: skill `apple-design` de Emil Kowalski (https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md).

## Objetivo

Refazer o visual e a interação do Tropa inteiro, em todas as telas, com a linguagem de interfaces fluidas de iOS: fonte do sistema, cantos arredondados, materiais de vidro, molas, gestos diretos e animações que podem ser interrompidas. A lógica do app, os dados e os fluxos continuam como estão.

## Decisões já tomadas

1. **Marca fica.** Laranja, nome, logo e tema claro como padrão. O tema escuro continua como opção (`data-tema="escuro"`). O código registra que o dono não gosta de preto, então o claro segue sendo o padrão.
2. **Estrutura fica, com seis mudanças** listadas na seção "Mudanças de estrutura".
3. **Abordagem B:** sistema de design novo aplicado tela por tela dentro do `publicar.html`. Sem framework novo, sem dividir o arquivo (o app é um artifact de arquivo único).

## Fora de escopo

- Regras de negócio, plano, nutrição, IA, banco, grupos, importação: nada muda.
- Textos: ficam como estão, exceto o que o layout novo exigir encurtar.
- Recursos novos. Se surgir ideia, vira item separado.
- Nomes de coleções e formatos salvos no banco.

## Sistema de design

### Cores

Claro (padrão). O laranja de marca `#FF5A00` fica para elementos sem texto (anéis, pontos, barras de progresso, ícone ativo). Fundo de botão com texto branco usa `#CF4500` (contraste 4,66:1 com branco), e o estado pressionado usa `#B53B00`. Texto laranja sobre fundo claro usa `#C23E00`.

| Token | Claro | Escuro |
|---|---|---|
| `--bg` (fundo agrupado) | `#F2F2F7` | `#0F1317` |
| `--surface` (cartão) | `#FFFFFF` | `#181D22` |
| `--surface-2` (campo, chip) | `#EBEBF0` | `#20262C` |
| `--tx` | `#0B0D10` | `#F2F4F6` |
| `--tx-2` (secundário) | `#5A626C` | `#A7B0B9` |
| `--sep` (separador) | `rgba(60,60,67,.14)` | `rgba(255,255,255,.12)` |
| `--go` | `#FF5A00` | `#FF5A00` |
| `--go-fill` | `#CF4500` | `#CF4500` |
| `--go-ink` | `#C23E00` | `#FF8A4C` |
| `--done`, `--caution`, `--stop` | os atuais | os atuais |
| `--run`, `--swim`, `--bike`, `--gym` | os atuais | os atuais |

Os tokens `--ink`, `--white`, `--paper`, `--mist`, `--fog`, `--graphite` e `--go-btn` deixam de existir. O JS que escreve cores inline passa a usar os tokens novos ou `var(--c)`.

### Tipografia

- Família: `system-ui, -apple-system, "SF Pro Text", "Segoe UI", Roboto, sans-serif`. Os três Google Fonts de texto (Big Shoulders, Barlow Condensed, Barlow) saem. A carga de `Exo 2` itálico 900 fica só para a palavra do logo, pedindo apenas as letras de "TROPA" (`&text=`).
- Tamanhos em `rem` (respeita o tamanho de texto do aparelho): 

| Estilo | Tamanho | Entrelinha | Peso | Tracking |
|---|---|---|---|---|
| Título grande | 2,125rem | 1,1 | 700 | -0,03em |
| Título 1 | 1,75rem | 1,1 | 700 | -0,025em |
| Título 2 | 1,375rem | 1,15 | 700 | -0,02em |
| Destaque | 1,0625rem | 1,3 | 600 | -0,01em |
| Corpo | 1rem | 1,45 | 400 | 0 |
| Secundário | 0,875rem | 1,4 | 400 | 0 |
| Nota | 0,8125rem | 1,35 | 500 | 0,005em |
| Legenda | 0,75rem | 1,3 | 500 | 0,01em |

- Sem caixa-alta em títulos. Os rótulos pequenos (`.k`) deixam de ser caixa-alta com espaçamento largo e viram Legenda com peso 600.
- Números com `font-variant-numeric: tabular-nums`. Números grandes (distância, XP, nível) usam 700 com tracking -0,04em.

### Forma, sombra e espaço

- Raios: 10 (controles pequenos), 14 (cartões), 20 (cartões de destaque), 28 (topo de sheet), 999 (pílulas).
- Sombras: `--sh1: 0 1px 2px rgba(0,0,0,.06)`, `--sh2: 0 4px 16px rgba(0,0,0,.08)`, `--sh3: 0 12px 40px rgba(0,0,0,.18)`. Quanto maior a superfície, mais profunda a sombra.
- Grade de 4 px. Margem lateral 16. Espaço entre cartões 12. Área de toque mínima 44 px, com ~10 px de folga invisível nos controles pequenos.
- Cartões sem borda (a separação vem do fundo agrupado e da sombra). Em `prefers-contrast: more` voltam a ter borda `--sep` mais escura.

### Materiais

| Material | Fundo claro | Fundo escuro | Blur | Uso |
|---|---|---|---|---|
| Fino | `rgba(255,255,255,.6)` | `rgba(24,29,34,.6)` | 20px, saturação 180% | barra de abas, cabeçalho fixo, botão Coach |
| Regular | `rgba(255,255,255,.72)` | `rgba(24,29,34,.72)` | 30px, saturação 180% | sheets |
| Grosso | `rgba(255,255,255,.86)` | `rgba(24,29,34,.86)` | 40px, saturação 160% | menus e popovers |

Regras: nunca empilhar material claro sobre material claro (sheet sobre sheet usa o material grosso). Cor de destaque vai numa camada sólida, nunca sobre o vidro. Texto sobre vidro usa peso 500 ou mais. Entrada e saída animam blur e escala juntos, não só opacidade. Prefixo `-webkit-backdrop-filter` junto. Com `prefers-reduced-transparency: reduce` ou sem suporte a `backdrop-filter`, todos viram cor sólida (`--surface`).

### Componentes

Botão primário (`.btn.go`), secundário (cinza claro), terciário (texto), pequeno, ícone redondo. Campo de texto com fundo `--surface-2` e anel de foco laranja de 2 px. Controle segmentado com indicador que desliza por mola. Interruptor e caixa de seleção no estilo iOS. Lista agrupada (linhas com separador recuado dentro de um cartão). Cartão, cartão de destaque, chip, pílula, aviso (`flag`) com ícone. Barra de progresso e anéis com ponta arredondada. Cada componente tem estado normal, pressionado, desativado e foco visível.

## Movimento

Tudo que responde a toque anima só `transform` e `opacity` (mais `backdrop-filter` nas entradas de vidro), via `requestAnimationFrame`, e pode ser interrompido a qualquer momento.

### Núcleo (`/* @movimento:start */ ... /* @movimento:end */`)

Funções puras, testadas em Node como as outras:

- `molaPasso(estado, alvo, {amort, resposta}, dt)`: integra uma mola com massa 1. Rigidez `(2π/resposta)²`, amortecimento `4π·amort/resposta`. Passo fixo de 1/120 s, para não depender da taxa de quadros. Retorna `{x, v}`.
- `projetar(x, v, d = 0.998)`: ponto de repouso `x + (v/1000)·d/(1-d)`, com `v` em px/s.
- `elastico(sobra, dimensao)`: `(sobra·dimensao·0,55)/(dimensao + 0,55·|sobra|)`, com o sinal da sobra.
- `velocidade(amostras)`: velocidade em px/s a partir dos últimos ~100 ms de pontos `{t, x}`.
- `maisProximo(valor, alvos)`.

Parte com DOM (`animar(el, props, alvo, preset)`): lê o valor atual do elemento, nunca o valor de destino, e parte da velocidade que o gesto tinha, então reverter no meio não dá salto. Eixos X e Y usam molas separadas.

Presets (amortecimento, resposta em segundos):

| Preset | Amort. | Resposta | Uso |
|---|---|---|---|
| `suave` | 1,0 | 0,40 | padrão: mover, trocar, abrir |
| `ligeiro` | 1,0 | 0,30 | indicador de aba, controle segmentado |
| `lancado` | 0,8 | 0,30 | sheet depois de arremesso |
| `giro` | 0,8 | 0,40 | rotação e retorno com momentum |

Pressão: `:active` com `transform: scale(.97)` e `transition: transform 100ms ease-out`. O feedback aparece no `pointerdown`, não no clique. Sem atrasos artificiais, sem debounce em toque.

### Sheets (substituem `.sheet` e `#ov`)

- Dois tamanhos: médio (50% da altura útil) e grande (até 92%). Sheets curtos abrem só no tamanho do conteúdo.
- Arrastar pela alça ou pelo corpo quando o conteúdo está no topo (`scrollTop === 0`). `setPointerCapture`, posição 1:1 mantendo o ponto de pega, velocidade medida na soltura.
- Ao soltar: `projetar` a posição, escolher o tamanho mais próximo (ou fechar se a projeção passar do limite). Acima do grande ou abaixo do fechado, `elastico`.
- Fundo: o `scrim` escurece em proporção à altura. Com o sheet grande, a página atrás recua (`scale(.96)`, raio de 14 px). Sheet sobre sheet recua o anterior em degraus.
- O sheet nasce e some pelo mesmo caminho (de baixo, ancorado no botão que o abriu quando houver um), e nenhum toque é bloqueado durante a animação.
- Teclado: o sheet sobe com ele (`visualViewport`) sem pulo.

### Navegação e transições

- **Troca de aba:** conteúdo novo entra com opacidade de 0 a 1 e 8 px de deslocamento vertical (`suave`). O indicador da barra desliza por mola (`ligeiro`).
- **Entrar numa tela:** a nova desliza da direita (de 100% a 0), a antiga recua 30% e escurece. **Voltar:** o espelho disso.
- **Voltar por gesto:** `pointerdown` a até 20 px da borda esquerda, depois de 10 px de movimento horizontal (histerese) a tela acompanha o dedo 1:1. Ao soltar, projeta a posição e confirma o voltar se passar de metade ou se a velocidade mandar. Confirmar chama o mesmo caminho do botão "←" atual (`[data-back]` ou `data-go`), então não existe fluxo novo de rota. Gestos de rolagem vertical ganham quando o movimento vertical vier primeiro.
- **Título grande:** telas com título (Treino, Feed, Comida, Performance, Perfil, listas) mostram o título grande no topo. Ao rolar, ele sai e um título pequeno aparece no cabeçalho de vidro. Controlado por `IntersectionObserver`, sem escutar `scroll`.
- **Separador sob o cabeçalho:** só aparece quando há conteúdo passando por baixo (gradiente com máscara, não linha de 1 px).

### Feedback

- `navigator.vibrate(10)` em marcar treino, refeição ou check-in, e `[12,40,12]` em conquista, no mesmo quadro da mudança visual, quando o aparelho suportar. Sem som. Só em momentos de conclusão, nunca em toque comum.
- As celebrações existentes (`#cele`, subida de nível, foguinho) mantêm o conteúdo e ganham as molas novas.

### Acessibilidade

- `prefers-reduced-motion: reduce`: sem molas, deslizes nem paralaxe. Trocas viram fade de opacidade de 200 ms, sem overshoot. As chamas e partículas já tratadas hoje continuam paradas.
- `prefers-reduced-transparency: reduce`: materiais viram sólidos.
- `prefers-contrast: more`: fundos quase sólidos e bordas visíveis.
- Foco visível em tudo, anel laranja de 2 px com 2 px de folga. Rótulos de abas continuam acessíveis. Nada fica só na cor.
- Sem fundo animado de tela cheia e sem saltos bruscos de brilho.

## Mudanças de estrutura

1. **Hoje:** cartão principal "Próximo" no topo (a próxima ação do dia, que hoje é montada em `umaAcao`). Foguinho compacto numa linha com a faixa da semana. O resto do dia vira seções recolhíveis (Check-in, Missões, Seu dia), com a seção mais útil aberta por padrão. Os avisos (pausa, risco do foguinho, ajuste) viram uma faixa de avisos acima do cartão principal.
2. **Coach · Nutri:** deixa de ser o botão flutuante retangular. Fica como botão redondo de vidro ao lado direito da barra de abas, no mesmo contêiner. O chat abre como sheet de dois tamanhos. Se "Performance" não couber a 360 px de largura com as cinco abas e o botão, o botão passa a ficar logo acima da barra, alinhado à direita, em vez de espremer os rótulos. Isso se decide na verificação visual.
3. **Voltar:** botão "←" continua, e ganha o gesto de borda descrito acima.
4. **Telas com título grande** que encolhe ao rolar.
5. **Performance:** anéis, gráficos e cartões de vidro. Anéis e barras animam por mola quando o dado muda. Os gráficos SVG atuais mantêm os dados e as cores por modalidade.
6. **Onboarding:** perguntas com transição horizontal por mola, barra de progresso contínua, escolhas como linhas de lista com marca de seleção.

## Organização do código

Tudo no `publicar.html`, em seções marcadas por comentário, nesta ordem:

1. CSS: tokens, base, tipografia, materiais, componentes, depois uma seção por tela.
2. JS `MOVIMENTO`: núcleo puro, `animar`, `Sheet`, `abas`, `transicao`, `voltarPorGesto`, `haptica`.
3. Telas (já existem), trocando classes e marcação.

Estilos inline estáticos (184 hoje) saem. Valores que dependem de dado (cor da modalidade, largura de barra) passam por variável CSS (`style="--c:..."`, `style="--p:..."`). O comentário de topo do CSS é reescrito para descrever o layout novo.

Compatibilidade: as funções de tela e os ids que o JS usa (`ci`, `fab`, `tabs`, `ov`, `app`, `ban`, `toast`, `cele`) continuam existindo, para o JS de lógica não precisar mudar. Os ids repetidos já listados como pendência (`pt`, `pm`, `pok`) são corrigidos se o redesign tocar neles.

## Plano de execução

Um commit por etapa, na branch `redesign-apple`. Depois de cada etapa: `node --test tests/*.test.js` e verificação visual.

1. Tokens, tipografia, componentes base e módulo de movimento (com testes).
2. Casca: barra de abas, botão Coach, sheets, toast, cabeçalho, transições, voltar por gesto.
3. Hoje.
4. Treino (plano, semana, força, exercício, fim, importação).
5. Comida (comida, repetir, compras).
6. Feed (feed, avisos, postar, convite).
7. Performance (perf, nível, liga, grupos, dupla, desafios).
8. Perfil e telas de apoio (corpo, pausa, documento, checkout, nota, painel do dono, subiu de nível).
9. Onboarding e abertura (abertura, código, pedido, perguntas, match, plano pronto, compromisso, assinatura, revisão).

## Verificação

O app só roda no claude.ai, porque depende de `window.claude`. Para ver cada tela fora dele:

- **Servidor local de verificação** (`tests/harness/`): um script Node que serve o `publicar.html` com um script injetado antes dele, simulando `window.claude.use("db" | "user" | "sample" | "downloads")` com banco em memória e um usuário de teste. Nada disso entra no `publicar.html` publicado.
- **Roteiro por tela:** abrir no navegador do app em 390 px, 360 px e 430 px, claro e escuro, com e sem `prefers-reduced-motion`, e conferir captura de tela e console sem erros.
- **Gestos:** testar arraste de sheet, voltar por borda e interrupção no meio da animação com eventos de ponteiro reais.
- **Testes de Node:** os atuais continuam passando. Novos: `tests/movimento.test.js` (mola chega ao alvo, amortecimento 1 sem overshoot, `projetar`, `elastico`, `velocidade`) e `tests/contraste.test.js` (pares de cor dos tokens com razão mínima de 4,5:1 para texto e 3:1 para elementos).
- O que não dá para verificar fora do claude.ai (banco real, IA, grupos reais, foto, PDF) fica registrado na pendência do README, como nas fases anteriores.

## Riscos

- `backdrop-filter` em aparelho fraco: material cai para sólido por `prefers-reduced-transparency` e por falta de suporte; blur limitado a 20 a 40 px e só em superfícies fixas.
- O app troca a tela inteira por `innerHTML` a cada `render()`. As transições animam o contêiner `#app` depois do `render`, sem exigir que a tela antiga continue no DOM. No voltar por gesto, a tela de baixo é um fundo escurecido, e a tela anterior só aparece quando o voltar é confirmado.
- Largura de 360 px com cinco abas e o botão Coach: tratado na mudança 2.
- Tamanho do arquivo: sai CSS antigo e inline, entra CSS novo e o módulo de movimento. O alvo é não crescer mais de 10% do tamanho atual.
- Contraste do laranja: texto sobre laranja usa `--go-fill`, e o `#FF5A00` fica sem texto.
