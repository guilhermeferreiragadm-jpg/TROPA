// Junta os lotes traduzidos (pasta com NN.json) com os textos manuais (app/i18n/extra-en.json) em app/i18n/en.json.
// Uso: node app/scripts/i18n-juntar.js <pasta-dos-lotes>
const fs = require("node:fs");
const path = require("node:path");
const dir = path.resolve(process.argv[2] || ".");
const raiz = path.join(__dirname, "..", "..");
const saida = {};
for (const f of fs.readdirSync(dir).filter(x => /^\d+\.json$/.test(x)).sort()) {
  const o = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const k in o) if (typeof o[k] === "string" && o[k] && o[k] !== k) saida[k] = o[k];
}
const extra = path.join(raiz, "app", "i18n", "extra-en.json");
if (fs.existsSync(extra)) Object.assign(saida, JSON.parse(fs.readFileSync(extra, "utf8")));
const ordenado = {}; Object.keys(saida).sort((a, b) => a.localeCompare(b, "pt")).forEach(k => { ordenado[k] = saida[k]; });
fs.mkdirSync(path.join(raiz, "app", "i18n"), { recursive: true });
fs.writeFileSync(path.join(raiz, "app", "i18n", "en.json"), JSON.stringify(ordenado, null, 0).replace(/","/g, '",\n"'));
console.log("entradas:", Object.keys(ordenado).length);
