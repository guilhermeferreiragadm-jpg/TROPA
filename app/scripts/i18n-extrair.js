// Lista todo texto em português que o app pode mostrar (literais do publicar.html, do shim e do servidor).
// Uso: node app/scripts/i18n-extrair.js [--lotes=<pasta>]   (sem flag: imprime a contagem; --lotes grava <pasta>/NN.json para traduzir em partes)
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("./vendor/acorn.js");

const raiz = path.join(__dirname, "..", "..");

function literais(codigo) {
  const out = [];
  let ast;
  try { ast = acorn.parse(codigo, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true }); }
  catch (e) { ast = acorn.parse(codigo, { ecmaVersion: "latest", sourceType: "module" }); }
  (function andar(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(andar); return; }
    if (n.type === "Literal" && typeof n.value === "string") out.push(n.value);
    else if (n.type === "TemplateElement" && typeof n.value.cooked === "string") out.push(n.value.cooked);
    for (const k in n) { if (k === "type" || k === "start" || k === "end") continue; andar(n[k]); }
  })(ast);
  return out;
}

// um literal pode ser HTML (ou pedaço dele, cortado no meio de uma tag): o que a pessoa lê são os trechos de texto
// entre as tags e os valores de alguns atributos (placeholder, aria-label, title, alt)
function trechos(s) {
  const t = [];
  if (/[<>]/.test(s) || /\b(?:placeholder|aria-label|title|alt)="/.test(s)) {
    s.replace(/\b(?:placeholder|aria-label|title|alt)="([^"<>]*)/g, (_, v) => { t.push(v); return ""; });
    let x = s.replace(/^[^<]*?"?\s*>/, m => (/[="']/.test(m) ? "\u0001" : m)); // sobra do fim de uma tag aberta em outro literal
    x = x.replace(/<[^>]*>/g, "\u0001").replace(/<[^>]*$/, "\u0001");        // tags inteiras e tag aberta no fim
    x.split("\u0001").forEach(y => t.push(y));
  } else t.push(s);
  return t;
}

const CODIGO = [
  /^[a-z][a-zA-Z0-9]*[A-Z]\w*$/,               // camelCase
  /^[a-z0-9]+([_-][a-z0-9]+)+$/i,              // snake_case e kebab-case
  /^(https?:|data:|\/|\.\/|#[0-9a-f]{3,8}$)/i, // urls, caminhos, cores
  /[{};]\s*[a-z-]+\s*:|:\s*[^;]+;\s*[a-z-]+\s*:/i, // css
  /^[\w.#\[\]=:>~* ,"'()-]*$/ // seletores e coisas só de ascii sem espaço útil (filtrado abaixo)
];

function candidato(s) {
  s = s.replace(/^[",;.)'\s]+(?=\p{L})/u, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&middot;/g, "·").replace(/&hellip;/g, "…").trim();
  if (s.length < 2 || s.length > 4000) return null;
  if (/^[A-Za-z0-9+\/=]{60,}$/.test(s)) return null;                 // base64
  if (!/\p{L}{2}/u.test(s)) return null;                              // precisa de letras de verdade
  if (/^\p{Extended_Pictographic}+$/u.test(s)) return null;
  if (/[=\[\]{}<>]|data-|\bM\d|^\W*\d[\d.,\s-]*\W*$|\.(png|jpg|svg|js|css|json|html)\b/.test(s)) return null;   // atributos, seletores, caminhos de svg, arquivos
  if (/^(true|false|null|undefined|submit|button|click|change|input|block|none|flex|grid|dialog|alert|listbox|image|full|middle|CACHE)$/i.test(s) || /var\(--|^\w+\(/.test(s)) return null;
  if (/^[A-Za-z0-9]+(_[A-Za-z0-9-]+)+$/.test(s) || /_-_/.test(s)) return null;                                    // ids de exercício
  const temEspaco = /\s/.test(s), temAcento = /[à-úÀ-Ú]/.test(s), temMaiuscula = /^[A-ZÀ-Ú]/.test(s);
  if (!temEspaco && !temAcento) {
    if (/^[a-z0-9_.\-:#\/]+$/.test(s) && !/^[a-z]{4,}$/.test(s)) return null; // ids e chaves
    if (CODIGO.slice(0, 4).some(r => r.test(s))) return null;
  }
  if (temEspaco && /^[\w.#\[\]=:>~*,"'()\- /]+$/.test(s) && !temAcento && !temMaiuscula && s.split(/\s+/).every(w => /^[a-z0-9_.\-:#\[\]=>~*,"'()\/]+$/.test(w)) && s.split(/\s+/).length <= 4 && /[-_.#\[\]=:>]/.test(s)) return null; // listas de classes e seletores
  if (CODIGO[3].test(s)) return null;
  return s;
}

function dosArquivos() {
  const fontes = [];
  const html = fs.readFileSync(path.join(raiz, "publicar.html"), "utf8");
  const a = html.indexOf("<script>") + 8, b = html.indexOf("</script>", a);
  // o dicionário embutido não é texto do app: sem isto o extrator leria o próprio dicionário
  const semDic = html.slice(a, b).replace(/(\/\* @i18n:dict \*\/)[\s\S]*?(\/\* @i18n:dictend \*\/)/, "$1{}$2").replace(/(\/\* @i18n:pad \*\/)[\s\S]*?(\/\* @i18n:padend \*\/)/, "$1[]$2");
  fontes.push(["publicar.html", semDic]);
  const shim = path.join(raiz, "app", "shim");
  fs.readdirSync(shim).filter(f => f.endsWith(".js")).forEach(f => fontes.push(["app/shim/" + f, fs.readFileSync(path.join(shim, f), "utf8")]));
  fontes.push(["functions/lib.js", fs.readFileSync(path.join(raiz, "functions", "lib.js"), "utf8")]);
  return fontes;
}

function extrair() {
  const mapa = new Map();
  for (const [nome, codigo] of dosArquivos()) {
    for (const lit of literais(codigo)) for (const tr of trechos(lit)) {
      // tira a base de conhecimento do coach e os dados de foto: texto do modelo, não da tela
      if (lit.length > 20000) continue;
      const c = candidato(tr); if (c && !mapa.has(c)) mapa.set(c, nome);
    }
  }
  return [...mapa.entries()].map(([texto, onde]) => ({ texto, onde })).sort((x, y) => x.texto.localeCompare(y.texto, "pt"));
}

function lotes(lista) {
  const curtos = lista.filter(x => x.texto.length <= 60), longos = lista.filter(x => x.texto.length > 60);
  const dividir = (arr, orcamento) => { const g = []; let atual = [], tam = 0; for (const x of arr) { if (tam + x.texto.length > orcamento && atual.length) { g.push(atual); atual = []; tam = 0; } atual.push(x); tam += x.texto.length + 20; } if (atual.length) g.push(atual); return g; };
  return dividir(curtos, 9000).concat(dividir(longos, 14000));
}

module.exports = { literais, trechos, candidato, extrair, lotes };

if (require.main === module) {
  const lista = extrair();
  const total = lista.reduce((n, x) => n + x.texto.length, 0);
  console.log("textos:", lista.length, "caracteres:", total);
  const arg = process.argv.find(a => a.startsWith("--lotes="));
  if (arg) {
    const dir = path.resolve(arg.slice(8));
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    lotes(lista).forEach((g, i) => { const o = {}; g.forEach(x => { o[x.texto] = ""; }); fs.writeFileSync(path.join(dir, String(i + 1).padStart(2, "0") + ".json"), JSON.stringify(o, null, 1)); });
    console.log("lotes:", fs.readdirSync(dir).length);
  }
}
