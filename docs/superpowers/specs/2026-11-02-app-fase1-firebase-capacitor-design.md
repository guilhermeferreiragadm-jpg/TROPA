# Tropa como app: Firebase, PWA e Capacitor (fase de testes)

Data: 2026-11-02. Aprovado em conversa. Arquivo alvo: `publicar.html` (continua sendo a fonte principal).

## Objetivo e escopo
Tirar o Tropa de dentro do claude.ai para que o dono e alguns amigos usem como app. Este documento cobre **só a fase de testes**. App Store, compra dentro do app, Sign in with Apple, exclusão de conta e política de privacidade ficam para uma fase 2, com spec própria.

Decisões já tomadas:
- Backend: **Firebase** no plano gratuito Spark (Auth, Firestore, Hosting) e um endpoint de IA na **Vercel Hobby**. Decisão posterior: o dono não quer pôr cartão na Google, e Cloud Functions exige o plano Blaze.
- Amigos usam uma **PWA** publicada no Firebase Hosting (Adicionar à Tela de Início).
- O dono usa a versão nativa via **Capacitor** e Xcode, no próprio iPhone.
- Os dados começam do zero. Não há migração do claude.ai.
- O artifact atual no claude.ai continua funcionando sem mudanças.

## Contexto do código atual
- `publicar.html` tem cerca de 7 mil linhas num arquivo só (HTML, CSS e JS).
- O app toca o claude.ai por quatro pontos de `window.claude.use(...)`, iniciados em `publicar.html` perto da linha 7045:
  - `db`: API no estilo Firestore (`collection`, `doc`, `get`, `set`, `update`, `delete`, `onSnapshot`), com cerca de 29 usos de `db.collection`.
  - `user`: `me()` (id, name, avatarUrl, isOwner), `can("data.write")`, `profiles(ids)`.
  - `sample`: `json(prompt, {cache})` e `limits()` (informa se aceita imagens). É a IA do coach, da nutri, do feedback do dia e da extração de perfil.
  - `downloads`: `save({filename, data})`.
- Se `window.claude` não existe, o app mostra só a tela de abertura (`telaAbertura`).
- O harness em `tests/harness/stub.js` já simula essa API com um banco em memória.
- `ARTIFACT_ID` alimenta o link de convite e o botão de copiar link.

## Arquitetura: camada de compatibilidade (shim)
Um arquivo novo, `app/shim/claude-shim.js`, implementa `window.claude.use("db" | "user" | "sample" | "downloads")` sobre o Firebase. O `publicar.html` quase não muda. Se `window.claude` já existir, o shim não faz nada.

| O app chama | No app fora do claude.ai |
|---|---|
| `db.collection(...)` | Firestore, com os mesmos caminhos de hoje (`data/users/{uid}/...`, `acessos`, `pedidos`, `revisao`, `resumo`, `aprovados`, `grupos`, `papeis`) |
| `user.me()` | Firebase Auth. `id` é o uid, `name` e `avatarUrl` vêm do Google, `isOwner` vem de um custom claim |
| `user.can("data.write")` | Verdadeiro para qualquer pessoa logada e com acesso. O Firestore Rules é quem decide de fato |
| `user.profiles(ids)` | Leitura de `perfis/{uid}` (nome e avatar públicos, gravados no login) |
| `sample.json`, `sample.limits` | Endpoint `POST /api/sample` na Vercel, que chama a API do Claude. `limits()` devolve `{images:{maxInputBytes, maxCount, mediaTypes}}`; as imagens são reduzidas no navegador (JPEG, 1280 px) antes do envio |
| `downloads.save` | Plugins Filesystem e Share do Capacitor no app nativo, `<a download>` na PWA |

Pontos de troca no `publicar.html`:
- `ARTIFACT_ID` e os links de convite passam a usar uma constante `LINK_APP` (URL do Hosting). No claude.ai ela continua apontando para o artifact.
- A tela de abertura ganha o botão "Entrar com Google" quando o shim está ativo.
- Um bloco `<script>` do shim é injetado no build, antes do script principal.

## Estrutura de pastas nova
- `capacitor.config.ts` e `ios/` na raiz: projeto Capacitor; `app/` : shim, scripts de build, ícones e a saída `app/www/`.
- `app/shim/claude-shim.js` : a camada de compatibilidade.
- `app/scripts/build-www.js` : copia `publicar.html` para `app/www/index.html`, injeta o shim e a config do Firebase, gera manifest e service worker.
- `app/www/` : saída do build, não versionada.
- `api/sample.js`, `functions/lib.js`, `functions/http.js`, `vercel.json` : endpoint `sample` na Vercel (adaptador, lógica pura e camada HTTP).
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `.firebaserc`.
- `tests/` : testes novos do shim e das regras.

## Login e papéis
- Entrada com Google (redirect no navegador, plugin nativo no Capacitor) e e-mail com senha como alternativa. A tela de login é do shim.
- No primeiro login o shim grava `perfis/{uid}` com `{name, avatarUrl}` do próprio usuário.
- O dono recebe o custom claim `owner: true` por um script de linha de comando (`functions/scripts/definir-dono.js <e-mail>`), executado com credencial de administrador. O claim nunca é definido pelo cliente.
- O fluxo atual de convite por código, aprovação (`aprovados`) e papéis Personal/Nutri (`papeis`) continua igual, porque os dados e os caminhos são os mesmos.

## Regras do Firestore
Reproduzem a tabela do README:
- `acessos`, `pedidos`, `revisao`, `resumo`, `aprovados`: admin (dono) lê e grava tudo. Cada pessoa grava só `<coleção>/{uid}`. Em `aprovados`, só o admin grava.
- `data/users/{uid}/**`: só o próprio uid lê e grava. O dono não tem leitura automática, apenas o que as regras de `acessos`/`revisao` já permitiam.
- `grupos`: leitura para quem tem acesso (`acessos/{uid}` existe), escrita só no próprio `grupos/{uid}`.
- `papeis`: leitura para quem está logado, escrita só do dono.
- `perfis/{uid}`: leitura para quem está logado, escrita só do próprio uid.
- `config`, `posts`: quem está logado lê, só o dono grava.
- `convites`, `vinculos`, `snap`, `prop`, `inbox/{uid}/n`: quem está logado lê e grava.
- Qualquer outro caminho: negado.

## IA do coach (endpoint `/api/sample` na Vercel)
- `POST` com `Authorization: Bearer <ID token do Firebase>`, região `gru1`, duração máxima 170 s. O token é conferido com o `firebase-admin`; o Firestore é lido e gravado com uma conta de serviço guardada em variável de ambiente da Vercel.
- CORS liberado só para o Hosting do projeto, `capacitor://localhost` e o que vier em `TROPA_ORIGENS`.
- Erros: `{error:{code,message}}` com status 400, 401, 403, 429 ou 500.
- Exige usuário autenticado e com `acessos/{uid}`.
- Limite diário por pessoa (valor inicial: 60 chamadas por dia por pessoa e 400 no total, contador em `uso/{uid}_{AAAA-MM-DD}`), com erro claro ao estourar. O dono não tem limite.
- Entrada: `{prompt, imagens?}`. Imagens chegam em base64, com no máximo 3 itens e `MAX_BASE64` (2 MB) cada. O corpo todo precisa caber nos 4,5 MB da Vercel; as fotos reduzidas no navegador ficam em centenas de KB.
- Chama a API do Claude com a chave guardada como variável de ambiente da Vercel (`ANTHROPIC_API_KEY`). A chave nunca vai para o app.
- Saída: o JSON já interpretado, no mesmo formato que `sample.json` devolve hoje. O shim reutiliza a validação de resposta atual do app.
- `limits()` devolve os limites de imagem sem chamar a rede.
- Falha ou timeout: o shim rejeita com `Error`, e as telas continuam usando o `comTempo` e as mensagens que já existem.

## Instalação e uso
- **Amigos (PWA):** `firebase deploy --only hosting` publica `app/www/`. A pessoa abre o link no Safari ou no Chrome e adiciona à tela de início. O manifest define nome, ícones e `display: standalone`. O service worker guarda o shell para abrir rápido e com o app vazio sem rede. O Firestore usa persistência local.
- **Dono (nativo):** `npm run build:www && npx cap sync ios && npx cap open ios` abre o Xcode, e o app roda no iPhone com assinatura gratuita (vence em 7 dias) ou com conta paga, se houver.
- Fotos de comida usam o seletor de arquivos/câmera do navegador na PWA e o do WebView no Capacitor, como hoje.

## Custos e pré-requisitos
- Firebase no plano **Spark** e Vercel **Hobby**: nenhum pede cartão. O Hobby da Vercel só vale para uso pessoal e não comercial; na fase 2, se houver cobrança, troque para Pro ou outro host.
- Chave e créditos da **API da Anthropic** da conta do dono. Hoje a IA é paga por cada pessoa através do claude.ai, então isso muda.
- Node 20 ou mais novo, Xcode instalado, `firebase-tools` e CLI do Capacitor.

## Tratamento de erros
- Sem rede: o Firestore continua lendo e gravando no cache local e sincroniza ao voltar. A IA mostra a mensagem de falha existente.
- Login cancelado ou recusado: volta para a tela de abertura com o botão de entrar.
- Regra negada: o shim propaga o erro do Firestore, e o app mantém o comportamento de hoje para `PODE_ESCREVER` falso.
- Limite diário da IA: mensagem explicando que o limite do dia acabou.

## Testes
- Os testes de Node atuais continuam valendo (`node --test tests/*.test.js`).
- Novo `tests/shim.test.js`: o shim contra um Firestore falso, cobrindo `get`, `set`, `update`, `delete`, `onSnapshot`, `user.me`, `sample.json` e `downloads.save`.
- Novo teste das regras com o **Firebase Emulator Suite** (`@firebase/rules-unit-testing`): um amigo não lê os dados de outro, só o dono grava `aprovados` e `papeis`, e `grupos` respeita o acesso.
- O harness local ganha um modo com o shim apontando para o emulador, para ver as telas sem internet.
- Verificação manual: abrir a PWA publicada num iPhone, entrar com uma segunda conta Google e conferir que o convite, o treino e a IA funcionam e que os dados das duas contas ficam separados.

## Fora do escopo
- App Store, TestFlight, compra dentro do app, Sign in with Apple, exclusão de conta no app, política de privacidade, HealthKit, notificações push.
- Migração de dados do claude.ai.
- Versão Android nativa (a PWA já cobre Android no Chrome).
- Painel de custos e cobrança por uso da IA.
