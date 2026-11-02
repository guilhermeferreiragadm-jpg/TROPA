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

// Erro do endpoint da IA para o app: o limite diário vira code "rate_limited" (o app mostra "limite de mensagens").
function erroDaIA(e) {
  const erro = new Error((e && e.message) || "A IA não respondeu agora.");
  if (e && (e.code === "resource-exhausted" || e.code === "functions/resource-exhausted" || e.code === "rate_limited")) erro.code = "rate_limited";
  return erro;
}

// Chamador do endpoint /api/sample: manda o token do login e devolve o JSON da resposta ou lança o erro já traduzido.
function criarChamadorApi({ url, obterToken, fetch, timeoutMs }) {
  return async function chamar(corpo) {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const relogio = ctl ? setTimeout(() => ctl.abort(), timeoutMs || 180000) : null;
    try {
      let token;
      try { token = await obterToken(); } catch (e) { throw erroDaIA({ message: "Entre na sua conta para usar a IA." }); }
      let r;
      try {
        r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
          body: JSON.stringify(corpo),
          signal: ctl ? ctl.signal : undefined
        });
      } catch (e) {
        throw erroDaIA({ message: "Sem conexão com a IA agora. Tente de novo." });
      }
      let dados = null;
      try { dados = await r.json(); } catch (e) { /* corpo vazio ou não JSON */ }
      if (!r.ok) throw erroDaIA(dados && dados.error ? dados.error : { message: "A IA não respondeu agora." });
      return dados;
    } finally {
      if (relogio) clearTimeout(relogio);
    }
  };
}

const MAX_RODADAS = 6;
const textoDe = content => (content || []).filter(b => b && b.type === "text").map(b => b.text).join("");
const paraTexto = r => (typeof r === "string" ? r : r === undefined ? "ok" : JSON.stringify(r));

// Chat do Coach/Nutri: a IA roda na função, as ferramentas rodam aqui (elas mexem no calendário do app).
async function conversarComFerramentas(deps, turns, opts) {
  opts = opts || {};
  const tools = Array.isArray(opts.tools) ? opts.tools : [];
  const pedido = { esforco: opts.modelTier === "complex" ? "high" : "medium" };
  if (tools.length) pedido.ferramentas = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
  const mensagens = (turns || []).map(m => (typeof m.content === "string" && !m.content.trim() ? { role: m.role, content: "…" } : m));
  let ultimo = "";
  for (let rodada = 1; rodada <= MAX_RODADAS; rodada++) {
    let r;
    try { r = await deps.conversar(Object.assign({ mensagens }, pedido)); }
    catch (e) { throw erroDaIA(e); }
    const content = (r && r.content) || [];
    mensagens.push({ role: "assistant", content });
    const texto = textoDe(content);
    if (texto) { ultimo = texto; if (typeof opts.onText === "function") opts.onText({ text: texto }); }
    if (!r || r.stopReason !== "tool_use" || rodada === MAX_RODADAS) break;
    const resultados = [];
    for (const b of content.filter(x => x && x.type === "tool_use")) {
      const tool = tools.find(t => t.name === b.name);
      if (!tool) { resultados.push({ type: "tool_result", tool_use_id: b.id, content: "ferramenta desconhecida", is_error: true }); continue; }
      try { resultados.push({ type: "tool_result", tool_use_id: b.id, content: paraTexto(await tool.execute(b.input || {})) }); }
      catch (e) { resultados.push({ type: "tool_result", tool_use_id: b.id, content: "erro: " + ((e && e.message) || String(e)), is_error: true }); }
    }
    if (!resultados.length) break;
    mensagens.push({ role: "user", content: resultados });
  }
  return { text: ultimo };
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
    sample: async () => {
      const sample = (turns, opts) => conversarComFerramentas(deps, turns, opts);
      sample.limits = async () => ({ images: { maxInputBytes: LIMITES.maxInputBytes, maxCount: LIMITES.maxCount, mediaTypes: LIMITES.mediaTypes.slice() } });
      sample.json = async (prompt, opcoes) => {
        const fotos = (opcoes && opcoes.images) || [];
        if (fotos.length > LIMITES.maxCount) throw new Error("A IA aceita no máximo " + LIMITES.maxCount + " imagens por vez.");
        const imagens = await Promise.all(fotos.map(f => deps.paraBase64(f)));
        return deps.chamarIA({ prompt, imagens });
      };
      return sample;
    },
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

module.exports = { criarClaude, LIMITES, traduzirErroAuth, erroDaIA, criarChamadorApi };
