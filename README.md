# Tropa

App de treino e nutrição com coach de IA, feed entre amigos e acompanhamento de performance. É um **artifact do claude.ai**: um único arquivo HTML (`publicar.html`) que usa o banco, o login e a IA do próprio claude.ai.

## Como o projeto é organizado
- `publicar.html`: o app inteiro (HTML, CSS e JS). **É a fonte principal.** Edite este arquivo.
- `tests/harness/`: servidor local (`node tests/harness/servir.js`, porta 5173) que serve o `publicar.html` com `window.claude` simulado e banco em memória, para ver as telas sem publicar. `?perfil=0` abre sem perfil (onboarding). O tema escuro se liga pela chave `tropa-tema` do `localStorage` (`claro`, `escuro` ou `auto`): grave `escuro` e recarregue a página. O roteiro de telas está em `tests/harness/roteiro.md`.
- `tests/`: testes em Node das funções puras (pausa, volta gradual, teto de carga, validação da foto, grupos, importação de GPX e TCX, leitor de FIT) e uma checagem de que o script compila.
- `docs/superpowers/specs/`: especificação da pausa, do teto de carga e do documento de fisioterapia.
- `docs/superpowers/plans/`: plano de implementação dessas funcionalidades.

## Rodar os testes
```bash
node --test tests/*.test.js
```
Precisa de Node 20 ou mais novo. No Node 24 use o glob acima, porque passar só a pasta `tests/` falha.

## Importante: o app só roda no claude.ai
O código chama `window.claude.use("db" | "user" | "sample" | "downloads")`. Fora do claude.ai essas chamadas não existem, e o app mostra só a tela de abertura. Para ver uma mudança funcionando é preciso publicar o `publicar.html` como artifact.

### Como publicar
1. Publique `publicar.html` como artifact no claude.ai (pelo Claude Code com a ferramenta Artifact, ou criando um artifact HTML).
2. Declare estas capacidades:
   - `db` com as regras de acesso abaixo
   - `user`
   - `sample` com `images: true`
   - `downloads: true`
3. Cada pessoa publica no **próprio** artifact, com banco próprio. Mexer no artifact de uma não altera o da outra.
4. Troque `ARTIFACT_ID` no código pelo id do seu artifact. Ele alimenta o botão de copiar link e o convite.

### Regras do banco (`db`)
Coleções `acessos`, `pedidos`, `revisao`, `resumo` e `aprovados`: quem tem papel de admin lê e grava tudo. Cada pessoa grava só o próprio documento (`<coleção>/{self}`), e em `aprovados` só o admin grava. Dados pessoais ficam em `data/users/{self}`.
Coleção `grupos` (fase 4): todos com acesso leem (`read: view`), só o dono grava a coleção, e cada pessoa grava só o próprio documento (`grupos/{self}`, `write: interact`). Lá vão apenas apelido, nome do grupo e números da semana (nunca peso, foto, comida, saúde ou trajeto). A declaração `capabilities` do publish precisa restaurar todas as regras acima junto com essas duas.

### Regras do banco (Personal e Nutri)
Acrescente estas regras às declaradas acima (mantenha todas as existentes) na declaração `capabilities` do artifact. Não publique daqui: o publish é decisão do dono.

| Caminho | Leitura | Escrita |
|---|---|---|
| `papeis` | `view` | `owner` |
| `papeis/{self}` | `view` | `interact` |
| `convites` | `view` | `interact` |
| `vinculos` | `view` | `interact` |
| `snap` | `view` | `interact` |
| `prop` | `view` | `interact` |
| `inbox` | `view` | `interact` |

Em formato de regra: `{path:"papeis", read:"view", write:"owner"}`, `{path:"papeis/{self}", write:"interact"}`, e `{path:"<coleção>", read:"view", write:"interact"}` para `convites`, `vinculos`, `snap`, `prop` e `inbox`.

O que isso significa, sem rodeio:
- O profissional e o aluno gravam em nome um do outro (o banco só distingue níveis de papel, não o vínculo entre duas pessoas). Por isso tudo sensível é cifrado no navegador (ECDH P-256 + HKDF + AES-GCM) e o app descarta qualquer item inválido ou que não corresponda a um vínculo ou proposta real.
- `vinculos` e `prop` são lidos inteiros e filtrados no cliente. Isso vaza metadados (quem é aluno de quem, quando) e não escala bem com muitos vínculos.
- O que um profissional já leu pode ter sido copiado. A cifragem impede a leitura futura, não a passada.
- Não há rotação de chave: o profissional deriva qualquer chave futura a partir da chave pública do aluno. Quem controla o acesso é o que o aluno publica.
- O aluno não confia no vínculo em claro: profissional, papel, permissões e estado valem da cópia privada dele em `data/users/{me}/chaves`, e a pública do vínculo que o profissional usa vem de `papeis/{aluno}.vpub`.
- Convite sequestrável: como `convites` é listável e gravável, um terceiro pode trocar o `profId` de um código pendente e receber o vínculo se o aluno aceitar sem conferir o nome; a correção sugerida (hashes dos códigos no `papeis` do profissional) não fecha o buraco, porque o terceiro lê o código e põe o hash no próprio `papeis`, então fica aceito até haver ids de convite por hash.
- A proteção só vale se essas regras forem reais no artifact publicado. Sem elas, o app não funciona ou fica aberto demais.

## Rodar fora do claude.ai (PWA e app iOS)
O `publicar.html` também roda como PWA e como app iOS, com banco, login e IA no Firebase. O arquivo-fonte não muda: `npm run build:www` o envolve num `index.html` com um shim que reimplementa `window.claude`. Spec: `docs/superpowers/specs/2026-11-02-app-fase1-firebase-capacitor-design.md`. Plano: `docs/superpowers/plans/2026-11-02-app-fase1-firebase-capacitor.md`.

- `app/shim/`: o shim (`core.js` é a lógica testável; `claude-shim.js` liga ao Firebase).
- `api/sample.js` + `functions/`: o endpoint da IA, na Vercel (plano Hobby, sem cartão). `functions/lib.js` tem a lógica pura (validação, limites, extração do JSON), `functions/http.js` a camada HTTP (token, CORS, status) e `api/sample.js` liga ao `firebase-admin` e à Anthropic. Variáveis de ambiente na Vercel: `ANTHROPIC_API_KEY`, `FIREBASE_SERVICE_ACCOUNT` (o JSON inteiro da conta de serviço) e, se precisar liberar outro domínio, `TROPA_ORIGENS`. Precisa de Node 22. Limites: 60 chamadas por pessoa por dia (`LIMITE_DIARIO`) e 400 por dia somando todo mundo (`LIMITE_GLOBAL_DIARIO`), contados no dia de Brasília; o dono não tem limite. O chat do Coach/Nutri gasta uma chamada por rodada (cada vez que a IA usa uma ferramenta é mais uma). O plano Hobby da Vercel só vale para uso pessoal e não comercial: se o Tropa passar a cobrar, mude para o Vercel Pro ou mova o endpoint (a lógica não depende da Vercel).
- `firestore.rules`: as regras do banco. Teste com `npm run test:rules` (precisa de Java e do Firebase CLI; esses testes ainda não foram rodados neste repositório).
- Scripts do projeto raiz: `npm test`, `npm run build:www` (gera `app/www/`), `npm run icones` (gera os ícones da PWA) e `npm run test:rules`.
- `app/firebase-config.json`: crie este arquivo com a config web do app, copiada do console do Firebase (Configurações do projeto, Seus apps). Essa config é pública, então pode ir para o git. Sem ele o `build:www` falha.
- `app/api-config.json`: `{"url": "https://SEU-PROJETO.vercel.app/api/sample"}`, o endereço do endpoint da IA depois do deploy na Vercel. Também público.
- Publicar: `npx vercel --prod` (endpoint da IA) e, com o `api-config.json` pronto, `npm run build:www` e `firebase deploy --only firestore:rules,hosting`. Isso ainda não foi feito (emulador e deploy são as Tasks 7 e 8 do plano).
- Dono: entre no app uma vez e rode `GOOGLE_APPLICATION_CREDENTIALS=<chave> node functions/scripts/definir-dono.js <seu e-mail>`.
- iOS (Capacitor): ainda não configurado, ver Task 9 do plano.
- Teste local sem tocar na produção: `firebase emulators:start --only auth,firestore,hosting` e abra `http://localhost:5000/?emu=1` (ainda não verificado, Task 7 do plano). A IA não funciona nesse modo, porque o endpoint na Vercel não aceita tokens do emulador.
- Custos: Firebase no plano Spark (gratuito, sem cartão), Vercel Hobby (gratuito) e créditos da API da Anthropic (a única parte paga).
- Limitação aceita: `convites`, `vinculos`, `snap`, `prop` e `inbox` são legíveis e graváveis por qualquer pessoa logada (como no claude.ai); o conteúdo sensível é cifrado no navegador. Qualquer pessoa logada consegue gravar o próprio `acessos/{uid}`, até com status `aceito`, e isso também abre a porta da IA. O custo fica preso pelo limite por pessoa (60 por dia) e pelo teto global (400 por dia). Mesmo assim, o dono deve pôr um limite de gasto mensal no workspace da Anthropic onde está a chave.

## Personal e Nutri
Qualquer usuário pode ser Personal e/ou Nutri, convida alunos por código (link do app + código de 8 caracteres), e o aluno escolhe o que libera. Mudanças de plano vão por proposta que o aluno aceita ou recusa. O sino mostra os avisos. Spec: `docs/superpowers/specs/2026-10-28-personal-nutri-design.md`.

### Como o harness simula dois usuários
- `PORT=5174 node tests/harness/servir.js` sobe o servidor em outra porta.
- `?eu=<id>&nome=<nome>` faz o stub virar esse usuário (não dono, com acesso). Abra duas abas, por exemplo `/?eu=ana&nome=Ana` e `/?eu=pedro&nome=Pedro`.
- O banco simulado é compartilhado entre as abas do mesmo endereço pelo `localStorage["tropa-stub-db"]`; o evento `storage` dispara os `onSnapshot`. Para zerar: `localStorage.removeItem("tropa-stub-db")` e recarregar.
- `?falhachaves=1` simula falha na leitura de `data/users/<eu>/chaves`.
- Passo a passo em `tests/harness/roteiro.md`.

### Coleções
- `papeis/{uid}`: público, papéis ativos, chave pública e `vpub` (pública do aluno por vínculo).
- `convites/{codigo}`: profissional, papel, validade (7 dias), uso único.
- `vinculos/{aluno~papel}`: aluno, profissional, papel, permissões, estado. Em claro, sem dados de saúde.
- `snap/{vinculo}_{categoria}`: resumos cifrados das categorias liberadas.
- `prop/{vinculo}`: propostas, respostas e comentários, cifrados.
- `inbox/{uid}/n`: avisos do sino (só tipo e ponteiro).
- Privado do usuário: `data/users/{me}/chaves` (par de chaves e, por vínculo, o par do aluno com a cópia que vale do vínculo) e `data/users/{me}/modelos` (modelos do profissional).

### Limites da cifragem
Protege contra terceiros e contra leitura futura depois de revogar. Não protege o que o profissional já leu, não rotaciona chaves, e metadados dos vínculos ficam em claro. Detalhes na seção "Regras do banco (Personal e Nutri)" acima e em "Desvios aceitos" na spec.

## Como trabalhar em dupla
- Cada um trabalha numa branch e abre um pull request para `main`.
- Rode os testes antes de abrir o pull request.
- Combinem quem publica a versão da `main` e em qual artifact.
- Dados de saúde: o documento de fisioterapia nunca é guardado, só o resumo confirmado pela pessoa (`P.perfil.fisio`). Mantenha essa regra.

## O que já existe
- Treino e plano por objetivo, check-in diário (sono, energia, dor), coach e nutri com IA.
- Modo pausa (doença ou lesão) com volta gradual.
- Teto de aumento de carga semanal, com explicação visível e opção de manter o plano original.
- Leitura de laudo de fisioterapia por foto ou PDF, com confirmação da pessoa.
- Foto de perfil e botão Sair (hoje volta à tela inicial; com login próprio passa a encerrar a sessão).
- Tema escuro, objetivos extras e metas (ex.: 22 km em dezembro), compromissos fixos no plano, missões da semana, resumo semanal do coach e janela da Tropa (trazidos do artifact do amigo).
- Sugestão de aliviar a próxima semana a partir do "Como foi" (você aceita ou recusa), motivo do treino para qualquer plano, e repetir refeição com favoritos.
- Redesign visual (branch `redesign-apple`): fonte do sistema, cantos arredondados, barra de abas e sheets de vidro, molas e gestos (sheet arrastável, voltar pela borda, chat que sobe de baixo), título grande que encolhe ao rolar, tema escuro e respeito a `prefers-reduced-motion`, `prefers-reduced-transparency` e `prefers-contrast`. Os tokens de design (cores, raios, sombras, materiais) ficam no bloco `:root` no começo do CSS do `publicar.html`; a spec está em `docs/superpowers/specs/2026-10-27-redesign-apple-design.md`. Os testes `tests/movimento.test.js` e `tests/contraste.test.js` cobrem o núcleo de movimento e os pares de contraste (`node --test tests/*.test.js`).
- Foguinho, XP, medalhas, desafios, feed e retrospectiva.
- Resumo de domingo com pergunta sobre o corpo e sugestão de aliviar a próxima semana, carga da musculação que considera prontidão e dor, e lista de compras da semana montada pela Nutri.
- Tela Corpo (Perfil): peso, medidas, gráfico e tendência de 4 semanas, fotos de progresso em miniatura (até 6, só adultos), cartão semanal de pesagem na tela Hoje e faixa de calorias estimada com piso de segurança (só adultos, sem alerta de saúde nem ciclo irregular informado).
- Grupos reais por código com desafio coletivo.
- Parceiro de responsa (dupla com cutucada diária).
- Importar treino de GPX, TCX e FIT (inclusive .gz).

## Pendências conhecidas
- O redesign foi verificado no harness local (banco simulado, sem IA, sem grupos reais, sem foto nem PDF). Falta conferir dentro do artifact publicado: o vidro (`backdrop-filter`) dentro do iframe do claude.ai, os gestos no celular real e o desempenho em aparelho fraco.
- A fase 1 (sugestão da próxima semana, repetir refeição, motivo do treino) foi validada só por testes de funções puras e leitura de código; falta conferir os cards e a sheet dentro do artifact. Planos personalizados com fases (pl.fases) usam textos de motivo específicos do plano de origem; os planos gerados pelo app usam textos genéricos.
- A integração das novidades do amigo foi feita por merge de três vias e validada só por teste de sintaxe e testes de funções puras. Falta conferir tema escuro, metas, compromissos fixos e missões dentro do artifact, junto com a pausa nova.
- A leitura de PDF usa o pdf.js do cdnjs e ainda não foi validada dentro do artifact. Se falhar, o app pede uma foto.
- A fase 2 (resumo de domingo, carga por prontidão, lista de compras) foi validada só por testes de funções puras e leitura de código; falta conferir dentro do artifact. A meta calórica que se ajusta ficou para a fase 3, junto com peso e medidas.
- Ids repetidos entre telas (`pt`, `pm`, `pok`) e pequenos textos a ajustar.
- A foto de perfil só aparece para a própria pessoa; no feed os amigos aparecem com iniciais.
- A fase 3 (corpo) foi validada só por testes de funções puras e leitura de código; falta conferir dentro do artifact. Menores de 18 anos registram só o peso: sem medidas, foto, tendência, faixa de calorias ou lembrete. A faixa de calorias não substitui nutricionista.
- A fase 4 (grupos, parceiro de responsa e importação de treino) foi validada só por testes de funções puras e leitura de código; falta conferir dentro do artifact. As regras de banco `grupos` e `grupos/{self}` precisam ser declaradas no publish. O fluxo de grupos e a importação ainda não foram exercitados no app publicado.
