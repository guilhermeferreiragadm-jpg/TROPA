// Lógica pura da função `sample` (a IA do Tropa). Sem Firebase nem Anthropic aqui: entram por `deps`.
const MODELO = "claude-sonnet-5-5";
const LIMITE_DIARIO = 60;
const LIMITE_GLOBAL_DIARIO = 400;   // teto do app inteiro por dia (qualquer pessoa logada consegue se dar acesso)
const MAX_PROMPT = 60000;
const MAX_IMAGENS = 3;
const MAX_BASE64 = 2000000;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_MENSAGENS = 40;
const MAX_BLOCOS = 60;
const MAX_CONVERSA = 400000;
const MAX_FERRAMENTAS = 16;
const MAX_DESCRICAO = 6000;
const ESFORCOS = ["low", "medium", "high"];
// thinking volta junto: o modelo pensa por padrão e, no meio de um laço de ferramentas, a API quer esses blocos de volta.
const BLOCOS = ["text", "tool_use", "tool_result", "thinking", "redacted_thinking"];
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

function validarConversa(data) {
  const ruim = msg => { throw new ErroApp("invalid-argument", msg); };
  const mensagens = data && data.mensagens;
  if (!Array.isArray(mensagens) || !mensagens.length) ruim("Falta a conversa.");
  if (mensagens.length > MAX_MENSAGENS) ruim("A conversa tem mensagens demais.");
  mensagens.forEach(m => {
    if (!m || (m.role !== "user" && m.role !== "assistant")) ruim("Mensagem inválida na conversa.");
    const c = m.content;
    if (typeof c === "string") {
      if (!c.trim()) ruim("Mensagem vazia na conversa.");
      if (c.length > MAX_PROMPT) ruim("Uma mensagem da conversa é grande demais.");
    } else if (Array.isArray(c)) {
      if (!c.length || c.length > MAX_BLOCOS) ruim("Mensagem inválida na conversa.");
      c.forEach(b => { if (!b || !BLOCOS.includes(b.type)) ruim("Mensagem inválida na conversa."); });
    } else ruim("Mensagem inválida na conversa.");
  });
  if (JSON.stringify(mensagens).length > MAX_CONVERSA) ruim("A conversa é grande demais.");
  let ferramentas = [];
  if (data.ferramentas !== undefined && data.ferramentas !== null) {
    if (!Array.isArray(data.ferramentas) || data.ferramentas.length > MAX_FERRAMENTAS) ruim("Ferramentas inválidas.");
    data.ferramentas.forEach(f => {
      if (!f || typeof f.name !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(f.name)) ruim("Ferramenta com nome inválido.");
      if (typeof f.description !== "string" || f.description.length > MAX_DESCRICAO) ruim("Ferramenta com descrição inválida.");
      if (!f.input_schema || typeof f.input_schema !== "object" || Array.isArray(f.input_schema)) ruim("Ferramenta sem esquema.");
    });
    ferramentas = data.ferramentas;
  }
  const esforco = data.esforco === undefined || data.esforco === null ? "medium" : data.esforco;
  if (!ESFORCOS.includes(esforco)) ruim("Esforço inválido.");
  return { mensagens, ferramentas, esforco };
}

// Dia corrente em Brasília (UTC-3, sem horário de verão), no formato AAAA-MM-DD.
function diaBrasilia(agora) {
  return new Date(agora.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function chaveUso(uid, agora) {
  return uid + "_" + diaBrasilia(agora);
}

function montarConteudo(prompt, imagens) {
  return imagens
    .map(im => ({ type: "image", source: { type: "base64", media_type: im.tipo, data: im.base64 } }))
    .concat([{ type: "text", text: prompt }]);
}

async function processar({ uid, owner, data, agora }, deps) {
  if (!uid) throw new ErroApp("unauthenticated", "Entre na sua conta para usar a IA.");
  const conversa = !!data && data.mensagens !== undefined && data.mensagens !== null;
  const entrada = conversa ? validarConversa(data) : validarEntrada(data);
  if (!owner) {
    if (!(await deps.temAcesso(uid))) throw new ErroApp("permission-denied", "Sua conta ainda não tem acesso ao app.");
    if (!(await deps.registrarUso(chaveUso(uid, agora), LIMITE_DIARIO))) {
      throw new ErroApp("resource-exhausted", "Você usou todas as consultas de IA de hoje. Volte amanhã.");
    }
    if (!(await deps.registrarUso("global_" + diaBrasilia(agora), LIMITE_GLOBAL_DIARIO))) {
      throw new ErroApp("resource-exhausted", "O Tropa atingiu o limite de IA de hoje. Volte amanhã.");
    }
  }
  if (conversa) {
    const r = await deps.chamarClaudeConversa(entrada);
    return { content: r.content, stopReason: r.stopReason };
  }
  const { prompt, imagens } = entrada;
  const texto = await deps.chamarClaude({ system: SISTEMA, content: montarConteudo(prompt, imagens) });
  return { json: extrairJson(texto) };
}

module.exports = { MODELO, LIMITE_DIARIO, LIMITE_GLOBAL_DIARIO, ErroApp, extrairJson, validarEntrada, validarConversa, diaBrasilia, chaveUso, montarConteudo, processar, MAX_FERRAMENTAS };
