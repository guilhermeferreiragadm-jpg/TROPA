const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const Anthropic = require("@anthropic-ai/sdk");
const { processar, ErroApp, MODELO } = require("./lib");

admin.initializeApp();
const CHAVE = defineSecret("ANTHROPIC_API_KEY");

exports.sample = onCall(
  { region: "southamerica-east1", secrets: [CHAVE], timeoutSeconds: 60, memory: "512MiB", maxInstances: 5 },
  async req => {
    const fs = getFirestore();
    const deps = {
      temAcesso: async uid => {
        const s = await fs.collection("acessos").doc(uid).get();
        return s.exists && (s.data() || {}).status === "aceito";
      },
      registrarUso: (chave, limite) => fs.runTransaction(async t => {
        const ref = fs.collection("uso").doc(chave);
        const s = await t.get(ref);
        const n = s.exists ? (s.data().n || 0) : 0;
        if (n >= limite) return false;
        t.set(ref, { n: n + 1 });
        return true;
      }),
      chamarClaude: async ({ system, content }) => {
        const cliente = new Anthropic({ apiKey: CHAVE.value() });
        const r = await cliente.messages.create({ model: MODELO, max_tokens: 3000, system, messages: [{ role: "user", content }] });
        return r.content.filter(b => b.type === "text").map(b => b.text).join("");
      }
    };
    try {
      return await processar({
        uid: req.auth && req.auth.uid,
        owner: !!(req.auth && req.auth.token && req.auth.token.owner),
        data: req.data,
        agora: new Date()
      }, deps);
    } catch (e) {
      if (e instanceof ErroApp) throw new HttpsError(e.code, e.message);
      console.error("sample falhou", e);
      throw new HttpsError("internal", "A IA não respondeu agora.");
    }
  }
);
