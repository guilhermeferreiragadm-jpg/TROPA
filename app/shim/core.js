// Monta o window.claude do Tropa fora do claude.ai. Sem Firebase aqui: tudo entra por `deps`, para testar em Node.
const LIMITES = { maxCount: 3, maxInputBytes: 20 * 1024 * 1024, mediaTypes: ["image/jpeg", "image/png", "image/webp"] };

const ERROS_AUTH = {
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Esse e-mail já tem conta. Toque em Entrar.",
  "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",
  "auth/network-request-failed": "Sem internet. Tente de novo.",
  "tropa/sem-google-nativo": "Entrar com Google no app nativo ainda não foi configurado. Use e-mail e senha."
};

function traduzirErroAuth(codigo) {
  return Object.prototype.hasOwnProperty.call(ERROS_AUTH, codigo) ? ERROS_AUTH[codigo] : "Não consegui entrar. Tente de novo.";
}

function criarClaude(deps) {
  let sessao = null;
  const entrar = () => {
    if (!sessao) sessao = deps.autenticar().catch(e => { sessao = null; throw e; });
    return sessao;
  };

  const servicos = {
    db: async () => deps.db,
    user: async () => ({
      me: async () => {
        const s = await entrar();
        return { id: s.uid, name: s.name, avatarUrl: s.avatarUrl, isOwner: !!s.isOwner };
      },
      can: async () => true,
      profiles: async ids => {
        await entrar();
        const out = {};
        await Promise.all((ids || []).map(async id => {
          try {
            const s = await deps.db.collection("perfis").doc(id).get();
            if (s.exists) { const d = s.data() || {}; out[id] = { name: d.name || "", avatarUrl: d.avatarUrl || "" }; }
          } catch (e) { /* perfil ilegível: o app mostra sem nome */ }
        }));
        return out;
      }
    }),
    sample: async () => ({
      limits: async () => ({ images: { maxInputBytes: LIMITES.maxInputBytes, maxCount: LIMITES.maxCount, mediaTypes: LIMITES.mediaTypes.slice() } }),
      json: async (prompt, opcoes) => {
        const fotos = (opcoes && opcoes.images) || [];
        if (fotos.length > LIMITES.maxCount) throw new Error("A IA aceita no máximo " + LIMITES.maxCount + " imagens por vez.");
        const imagens = await Promise.all(fotos.map(f => deps.paraBase64(f)));
        return deps.chamarIA({ prompt, imagens });
      }
    }),
    downloads: async () => ({ save: ({ filename, data }) => deps.baixar({ filename, data }) })
  };

  return {
    use: async nome => {
      if (!servicos[nome]) throw new Error("serviço desconhecido: " + nome);
      return servicos[nome]();
    },
    signOut: async () => { sessao = null; await deps.sair(); }
  };
}

module.exports = { criarClaude, LIMITES, traduzirErroAuth };
