# Feed real (posts, pessoas, fogo e comentários compartilhados)

## Problema
Hoje o feed é local: `SOC` (posts, pessoas, seguidores, fogos) vive em `data/users/<uid>/social`, legível só pelo dono. Os amigos de exemplo (Marina, Lucas, Gabi) são gerados no próprio celular. Um post de amigo real nunca chega aos outros.

## Decisão do dono
Todos que têm acesso ao app veem os posts de todos. "Seguindo" é só um filtro; "Todos" mostra tudo.

## Dados
- `feedposts/{id}`: `autor` (uid), `nome`, `avatar`, `date`, `at`, `esporte`, `outro`, `titulo`, `stats`, `legenda`, `foto` (miniatura base64), `plano`, `junto` (uids), `selo`, `fogos` (mapa `uid -> ISO`), `coments` (lista de `{de, nome, t, at}`).
- `perfis/{uid}` (já existe: `name`, `avatarUrl`) ganha: `feed:true`, `apelido`, `meta`, `nivel`, `streak`, `feitos`, `km30`, `xpSem`, `kmSem`, `compartilha`, `seguindo` (mapa `uid -> ISO`). Só o próprio uid grava.
- Seguir é gravado em `perfis/<eu>.seguindo`; "segue você" lê o `seguindo` do outro.
- Avisos (fogo, comentário, novo seguidor) são derivados dos snapshots no cliente; o "visto" é local (`SOC.avisosVistoAt`). Nenhuma escrita em dado alheio além de fogo e comentário no post.
- `SOC` em modo real guarda só `notifs`/`avisosVistoAt`/`desafios`; posts, pessoas, seguidores e fogos vêm do Firestore (memória). Modo DEMO continua com os exemplos.

## Regras (`firestore.rules`)
- `feedposts`: ler se `temAcesso()`. Criar se `temAcesso()` e `autor == uid`, só com as chaves acima e foto até 300 KB. Atualizar: o autor (sem trocar `autor`) ou qualquer pessoa com acesso mexendo só em `fogos` (apenas a própria chave) e `coments` (no máximo um item novo, `de == uid`, até 120 caracteres). Apagar: autor ou dono.
- `perfis`: ler se `temAcesso()` ou for o próprio; gravar só o próprio (como hoje).

## Cliente
- Listeners: `feedposts` (50 mais recentes, `at` decrescente) e `perfis` com `feed == true`, ligados ao abrir o app (não DEMO).
- Remover `carregarPostsDono` e a coleção `posts` do dono (substituídas).
- Ações gravam no Firestore: postar, fogo (alternar), comentar, seguir/deixar de seguir, apagar o próprio post.
- Sem Firestore (offline), as telas mostram o que está em memória e as escritas falham em silêncio como o resto do app.

## Fora do escopo
Desafios com amigos continuam simulados. Notificação push com o app fechado fica para o app nativo. Posts antigos do dono na coleção `posts` não são migrados.

## Testes
- Regras no emulador: leitura só com acesso; criação só do próprio autor; fogo só na própria chave; comentário só um por vez e só do próprio uid; terceiros não editam título; apagar só autor/dono; `perfis` só com acesso.
- Unitários: mesclar snapshots em `SOC`, derivar avisos, montar `seguindo`.
- Navegador (harness): fluxo postar, fogo, comentar, seguir e apagar com os dados em memória.
