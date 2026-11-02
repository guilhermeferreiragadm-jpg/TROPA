// Lógica pura da função `sample` (a IA do Tropa). Sem Firebase nem Anthropic aqui: entram por `deps`.
const MODELO = "claude-sonnet-5-5";
const LIMITE_DIARIO = 60;
const MAX_PROMPT = 60000;
const MAX_IMAGENS = 3;
const MAX_BASE64 = 2000000;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const SISTEMA = "Responda somente com JSON válido, sem texto antes ou depois e sem blocos de código.";

class ErroApp extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function extrairJson(texto) {
  const t = String(texto || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch (e) { /* tenta recortar */ }
  const i = t.search(/[\[{]/);
  if (i < 0) throw new ErroApp("internal", "A IA não devolveu JSON.");
  const fecha = t[i] === "{" ? "}" : "]";
  const j = t.lastIndexOf(fecha);
  if (j < i) throw new ErroApp("internal", "A IA devolveu um JSON incompleto.");
  try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { throw new ErroApp("internal", "A IA devolveu um JSON inválido."); }
}

function validarEntrada(data) {
  if (!data || typeof data.prompt !== "string" || !data.prompt.trim()) throw new ErroApp("invalid-argument", "Falta o texto do pedido.");
  if (data.prompt.length > MAX_PROMPT) throw new ErroApp("invalid-argument", "O pedido é grande demais.");
  const imagens = Array.isArray(data.imagens) ? data.imagens : [];
  if (imagens.length > MAX_IMAGENS) throw new ErroApp("invalid-argument", "No máximo " + MAX_IMAGENS + " imagens por vez.");
  imagens.forEach(im => {
    if (!im || !TIPOS.includes(im.tipo) || typeof im.base64 !== "string" || !im.base64 || im.base64.length > MAX_BASE64) {
      throw new ErroApp("invalid-argument", "Imagem inválida ou grande demais.");
    }
  });
  return { prompt: data.prompt, imagens };
}

function chaveUso(uid, agora) {
  const brasilia = new Date(agora.getTime() - 3 * 3600 * 1000);
  return uid + "_" + brasilia.toISOString().slice(0, 10);
}

function montarConteudo(prompt, imagens) {
  return imagens
    .map(im => ({ type: "image", source: { type: "base64", media_type: im.tipo, data: im.base64 } }))
    .concat([{ type: "text", text: prompt }]);
}

async function processar({ uid, owner, data, agora }, deps) {
  if (!uid) throw new ErroApp("unauthenticated", "Entre na sua conta para usar a IA.");
  const { prompt, imagens } = validarEntrada(data);
  if (!owner) {
    if (!(await deps.temAcesso(uid))) throw new ErroApp("permission-denied", "Sua conta ainda não tem acesso ao app.");
    if (!(await deps.registrarUso(chaveUso(uid, agora), LIMITE_DIARIO))) {
      throw new ErroApp("resource-exhausted", "Você usou todas as consultas de IA de hoje. Volte amanhã.");
    }
  }
  const texto = await deps.chamarClaude({ system: SISTEMA, content: montarConteudo(prompt, imagens) });
  return { json: extrairJson(texto) };
}

module.exports = { MODELO, LIMITE_DIARIO, ErroApp, extrairJson, validarEntrada, chaveUso, montarConteudo, processar };
