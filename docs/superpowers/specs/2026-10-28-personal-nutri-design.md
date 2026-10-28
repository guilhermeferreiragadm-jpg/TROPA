# Personal e Nutri: design

Data: 2026-10-28. Branch: `personal-nutri` (a partir de `redesign-apple`).

## Objetivo

Qualquer usuário pode ser **Personal** e/ou **Nutri**. O profissional convida alunos por código. O aluno aceita, escolhe o que libera, e o profissional acompanha treino, estatísticas e comida, propondo mudanças que o aluno confirma. O app ganha um **sino** de notificações ao lado do perfil.

## Decisões fechadas com o usuário

- Qualquer usuário pode se cadastrar como Personal e/ou Nutri (Perfil: "Sou Personal", "Sou Nutri").
- Cada aluno tem no máximo 1 Personal e 1 Nutri.
- O aluno aceita o convite (com tela de aceite) e pode se desvincular a qualquer momento.
- O aluno escolhe as permissões, por categoria e por profissional: Treino, Performance, Comida, Peso e medidas, Feed e fotos.
- Personal gerencia treino e performance. Nutri gerencia plano alimentar e Comida, e vê Peso e medidas se liberado. Nutri nunca recebe Treino, Personal nunca recebe Comida.
- O profissional altera o plano por **proposta**. O aluno vê antes e depois e aceita ou recusa. Vale para toda mudança, inclusive carga.
- Recusa chega ao profissional, com motivo opcional.
- Carga não cumprida: o aluno registra **comentário no exercício**, visível ao profissional (campo novo, a criar).
- Aluno que já usa o app entra por um convite novo. Quem é Personal pode ter o próprio treino.
- Quem tem mais de um papel usa um **seletor de modo** (Aluno | Personal | Nutri) no topo, cada modo com a própria barra inferior. Só aparecem os modos que a pessoa tem.
- Atualização ao vivo só para o sino e a lista de alunos. O resto carrega ao abrir.

## Restrições da plataforma

1. O artefato aceita só âncora simples na URL. O convite é **link do app + código de 8 caracteres** (alfabeto `ALFA_GRUPO`, `normalizarCodigo`), digitado pelo aluno.
2. As regras do banco liberam por nível de papel, não por vínculo entre duas pessoas. Por isso a privacidade vem de **cifragem no navegador** (abordagem B).
3. Quem grava dados precisa de permissão de interagir no artefato. O compartilhamento é feito pelo dono do artefato.

## Papéis, abas e sino

- Perfil guarda `papeis: {personal, nutri}`.
- Seletor de modo no cabeçalho, visível só com mais de um modo disponível. A escolha é lembrada por aparelho.
- Modo Aluno: as 5 abas atuais, sem mudança.
- Modo Personal: Alunos, Propostas, Biblioteca (modelos de treino).
- Modo Nutri: Alunos, Propostas, Planos (modelos de plano alimentar).
- Detalhe do aluno (nos dois modos): resumo da semana, estatísticas liberadas, plano atual, comentários do aluno, botão Propor mudança. Categorias não liberadas aparecem bloqueadas, sem dados.
- Lista de alunos: nome, última atividade, sinal de "sem treinar há N dias", contador de propostas pendentes. Atualiza ao vivo.
- Sino ao lado do perfil, com contador de não lidas. Itens: convite recebido, convite aceito, proposta para confirmar, proposta aceita ou recusada (com motivo), permissão alterada, aluno desvinculado, comentário novo. Marcar como lida ao abrir.
- Visual segue o sistema de design atual (tokens, materiais, movimento, alvos de 44px).

## Vínculo por convite

1. O profissional gera o convite (código de 8 caracteres, validade de 7 dias, uso único). O app monta o texto de envio com botão de copiar.
2. O aluno digita o código. Se o código é válido, vê o nome do profissional, o papel, e uma chave por categoria permitida àquele papel.
3. Ao aceitar, nasce o vínculo `{aluno, profissional, papel, permissões, estado}`. Se o aluno já tem profissional do mesmo papel, o app pede para desvincular antes.
4. O aluno altera permissões ou desvincula nas configurações. O profissional pode encerrar o vínculo pelo seu lado.

## Privacidade (cifragem)

- Cada pessoa tem um par de chaves ECDH P-256. A privada fica na área privada do próprio usuário. A pública fica visível no perfil público de papéis.
- Chave do vínculo: ECDH entre aluno e profissional, derivada para AES-GCM 256 (HKDF com o id do vínculo).
- O aluno publica **resumos cifrados** só das categorias liberadas, em documentos por categoria. O banco guarda só texto cifrado, mais um cabeçalho em claro (versão, data).
- Propostas, respostas e comentários também são cifrados com a chave do vínculo.
- Cada vínculo tem um par de chaves do aluno próprio. O profissional usa um único par dele.
- Revogar uma categoria: o aluno apaga o resumo daquela categoria e deixa de publicá-la. Desvincular: apaga todos os resumos do vínculo. **Não há rotação de chave:** o profissional consegue derivar qualquer chave futura a partir da chave pública do aluno, então rotacionar não o excluiria. Quem controla o acesso é o que o aluno publica, e a cifragem protege contra terceiros.
- O sino usa uma caixa de entrada por usuário. Qualquer pessoa pode gravar nela, então cada item guarda só tipo e ponteiro. O app descarta item que não corresponda a um vínculo ou proposta real.
- Limite: o que o profissional já leu pode ter sido copiado. A cifragem impede leitura futura.

## Propostas

- O profissional edita um rascunho do plano e envia: `{id, vínculo, tipo (treino|alimentar), diff, estado: pendente|aceita|recusada, motivo?}`.
- O aluno vê antes e depois no sino ou em Propostas, e aceita ou recusa. Só a aceita altera o plano do aluno. Conflito com edição do aluno feita depois da proposta: a proposta é marcada desatualizada e o profissional precisa reenviar.
- O profissional recebe o resultado no sino.

## Modelo de dados (resumo)

- `papeis/{uid}`: público, `{personal, nutri, pub}`.
- `convites/{codigo}`: `{profId, papel, expira, usado}`.
- `vinculos/{id}`: `{alunoId, profId, papel, perm, estado, criado}` em claro, sem dados de saúde.
- `snap/{vinculoId}/{categoria}`: cifrado.
- `prop/{vinculoId}/{id}`: cifrado.
- `inbox/{uid}/{id}`: `{tipo, ref, quando, lida}`.
- `data/users/{uid}/chaves`: par de chaves, privado.
- Regras de leitura e escrita serão definidas no plano. O que o banco não consegue forçar, a cifragem cobre.

## Fora de escopo

- Pagamento, agenda de aulas, chat entre aluno e profissional (o sino e os comentários cobrem o essencial).
- Mais de um Personal ou Nutri por aluno.
- Notificação push fora do app.
- Teste de papéis em aparelho real. A verificação será no harness, como no redesign.

## Testes

- Puros (sem DOM e sem banco): geração e validade de código de convite, regras de permissão por papel, máquina de estados do vínculo e da proposta, diff e aplicação de proposta, rotação de chave.
- Cifragem: ida e volta com WebCrypto no Node.
- Harness: dois perfis simulados (aluno e profissional) trocando convite, resumos, proposta e recusa; sino com contador.
- Limite de tamanho do artefato continua valendo (hoje 592 KB de 641 KB). Pode exigir enxugar código existente.
