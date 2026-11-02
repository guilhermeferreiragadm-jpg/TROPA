// Camada HTTP do endpoint /api/sample. Pura: login, banco e Anthropic entram por `deps` (o adaptador real fica em api/sample.js).
const { processar, ErroApp } = require("./lib");

const STATUS = {
  "invalid-argument": 400,
  "unauthenticated": 401,
  "permission-denied": 403,
  "resource-exhausted": 429
};

function cabecalhosCors(origem, permitidas) {
  if (!origem || !permitidas.includes(origem)) return {};
  return {
    "Access-Control-Allow-Origin": origem,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function erro(status, code, message, cors) {
  return { status, headers: cors, body: { error: { code, message } } };
}

// req: { method, headers (nomes em minúsculas), body }. deps: o que o processar() pede, mais verificarToken, origens e agora.
async function tratar(req, deps) {
  const origem = req.headers && req.headers.origin;
  const cors = cabecalhosCors(origem, deps.origens || []);
  if (req.method === "OPTIONS") return { status: 204, headers: cors, body: null };
  if (req.method !== "POST") return erro(405, "invalid-argument", "Use POST.", cors);

  const auth = String((req.headers && req.headers.authorization) || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return erro(401, "unauthenticated", "Entre na sua conta para usar a IA.", cors);
  let quem;
  try { quem = await deps.verificarToken(token); }
  catch (e) { return erro(401, "unauthenticated", "Sua sessão expirou. Entre de novo.", cors); }

  try {
    const r = await processar({ uid: quem.uid, owner: quem.owner === true, data: req.body, agora: deps.agora ? deps.agora() : new Date() }, deps);
    return { status: 200, headers: cors, body: r };
  } catch (e) {
    if (e instanceof ErroApp) return erro(STATUS[e.code] || 500, e.code, e.message, cors);
    console.error("sample falhou", e);
    return erro(500, "internal", "A IA não respondeu agora.", cors);
  }
}

// Origens que podem chamar o endpoint: o Hosting do projeto, o app Capacitor e o que vier em TROPA_ORIGENS (separado por vírgula).
function origensPermitidas(projectId, extras) {
  const lista = ["capacitor://localhost", "ionic://localhost", "http://localhost"];
  if (projectId) lista.push("https://" + projectId + ".web.app", "https://" + projectId + ".firebaseapp.com");
  String(extras || "").split(",").map(s => s.trim()).filter(Boolean).forEach(o => lista.push(o));
  return lista;
}

module.exports = { tratar, origensPermitidas, cabecalhosCors };
