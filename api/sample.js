// Endpoint da IA do Tropa na Vercel (plano Hobby). Variáveis de ambiente: ANTHROPIC_API_KEY, FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço) e, se precisar, TROPA_ORIGENS.
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const Anthropic = require("@anthropic-ai/sdk");
const { MODELO } = require("../functions/lib");
const { tratar, origensPermitidas } = require("../functions/http");

let cache;
function iniciar() {
  if (cache) return cache;
  const conta = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  if (!getApps().length) initializeApp({ credential: cert(conta) });
  cache = {
    auth: getAuth(),
    fs: getFirestore(),
    claude: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    origens: origensPermitidas(conta.project_id, process.env.TROPA_ORIGENS)
  };
  return cache;
}

module.exports = async (req, res) => {
  let s;
  try { s = iniciar(); }
  catch (e) {
    console.error("configuração inválida", e);
    res.status(500).json({ error: { code: "internal", message: "O servidor da IA está mal configurado." } });
    return;
  }
  const { auth, fs, claude, origens } = s;
  const deps = {
    origens,
    verificarToken: async token => {
      const d = await auth.verifyIdToken(token);
      return { uid: d.uid, owner: d.owner === true };
    },
    temAcesso: async uid => {
      const doc = await fs.collection("acessos").doc(uid).get();
      return doc.exists && (doc.data() || {}).status === "aceito";
    },
    registrarUso: (chave, limite) => fs.runTransaction(async t => {
      const ref = fs.collection("uso").doc(chave);
      const doc = await t.get(ref);
      const n = doc.exists ? (doc.data().n || 0) : 0;
      if (n >= limite) return false;
      t.set(ref, { n: n + 1 });
      return true;
    }),
    chamarClaude: async ({ system, content }) => {
      const r = await claude.messages.create({
        model: MODELO, max_tokens: 16000, system, messages: [{ role: "user", content }], output_config: { effort: "medium" }
      });
      return r.content.filter(b => b.type === "text").map(b => b.text).join("");
    },
    // Chat do Coach/Nutri: uma rodada só. O laço das ferramentas roda no navegador (app/shim/core.js).
    chamarClaudeConversa: async ({ mensagens, ferramentas, esforco }) => {
      const pedido = { model: MODELO, max_tokens: 16000, messages: mensagens, output_config: { effort: esforco } };
      if (ferramentas && ferramentas.length) pedido.tools = ferramentas;
      const r = await claude.messages.create(pedido);
      return { content: JSON.parse(JSON.stringify(r.content)), stopReason: r.stop_reason };
    }
  };
  const r = await tratar({ method: req.method, headers: req.headers, body: req.body }, deps);
  Object.entries(r.headers || {}).forEach(([k, v]) => res.setHeader(k, v));
  if (r.body === null) res.status(r.status).end();
  else res.status(r.status).json(r.body);
};
