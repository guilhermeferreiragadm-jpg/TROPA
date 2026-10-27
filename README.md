# Tropa

App de treino e nutrição com coach de IA, feed entre amigos e acompanhamento de performance. É um **artifact do claude.ai**: um único arquivo HTML (`publicar.html`) que usa o banco, o login e a IA do próprio claude.ai.

## Como o projeto é organizado
- `publicar.html`: o app inteiro (HTML, CSS e JS). **É a fonte principal.** Edite este arquivo.
- `tests/`: testes em Node das funções puras (pausa, volta gradual, teto de carga, validação da foto) e uma checagem de que o script compila.
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
- Foguinho, XP, medalhas, desafios, feed e retrospectiva.

## Pendências conhecidas
- A fase 1 (sugestão da próxima semana, repetir refeição, motivo do treino) foi validada só por testes de funções puras e leitura de código; falta conferir os cards e a sheet dentro do artifact. Planos personalizados com fases (pl.fases) usam textos de motivo específicos do plano de origem; os planos gerados pelo app usam textos genéricos.
- A integração das novidades do amigo foi feita por merge de três vias e validada só por teste de sintaxe e testes de funções puras. Falta conferir tema escuro, metas, compromissos fixos e missões dentro do artifact, junto com a pausa nova.
- A leitura de PDF usa o pdf.js do cdnjs e ainda não foi validada dentro do artifact. Se falhar, o app pede uma foto.
- Ids repetidos entre telas (`pt`, `pm`, `pok`) e pequenos textos a ajustar.
- A foto de perfil só aparece para a própria pessoa; no feed os amigos aparecem com iniciais.
