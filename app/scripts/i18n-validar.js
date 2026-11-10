// Confere uma tradução (saida.json) contra o lote de origem (entrada.json).
// Uso: node app/scripts/i18n-validar.js <entrada.json> <saida.json>   (sai com 1 se houver erro)
const fs = require("node:fs");

const pegar = (s, re) => (s.match(re) || []).slice().sort().join("\u0001");

function validarPar(pt, en) {
  const erros = [], avisos = [];
  if (typeof en !== "string" || !en.trim()) { erros.push("vazio"); return { erros, avisos }; }
  if (pegar(pt, /<[^>]+>/g) !== pegar(en, /<[^>]+>/g)) erros.push("tags HTML diferentes");
  if (pegar(pt, /&[#\w]+;/g) !== pegar(en, /&[#\w]+;/g)) erros.push("entidades HTML diferentes");
  if (pegar(pt, /\p{Extended_Pictographic}/gu) !== pegar(en, /\p{Extended_Pictographic}/gu)) erros.push("emojis diferentes");
  if (pegar(pt, /\$\{[^}]*\}|\{\w+\}|%[sd]/g) !== pegar(en, /\$\{[^}]*\}|\{\w+\}|%[sd]/g)) erros.push("marcadores diferentes");
  if (pegar(pt, /\d+/g) !== pegar(en, /\d+/g)) avisos.push("números diferentes");
  if (/[ãõçáéíóúâêô]/i.test(en) && !/açaí|pão|Tropa|café|jalapeño|crème|à la|São/i.test(en)) avisos.push("ainda parece português");
  if (/^\s|\s$/.test(en) !== /^\s|\s$/.test(pt) && /^\s|\s$/.test(pt)) avisos.push("espaço nas pontas");
  return { erros, avisos };
}

function validar(entrada, saida) {
  const erros = [], avisos = [];
  const k1 = Object.keys(entrada), k2 = new Set(Object.keys(saida));
  k1.filter(k => !k2.has(k)).forEach(k => erros.push([k, "falta na saída"]));
  [...k2].filter(k => !(k in entrada)).forEach(k => erros.push([k, "chave que não existe na entrada"]));
  for (const k of k1) if (k2.has(k)) { const r = validarPar(k, saida[k]); r.erros.forEach(e => erros.push([k, e])); r.avisos.forEach(a => avisos.push([k, a])); }
  return { erros, avisos };
}

module.exports = { validarPar, validar };

if (require.main === module) {
  const [a, b] = process.argv.slice(2);
  const r = validar(JSON.parse(fs.readFileSync(a, "utf8")), JSON.parse(fs.readFileSync(b, "utf8")));
  r.erros.slice(0, 60).forEach(([k, m]) => console.log("ERRO  ", m, "|", k.slice(0, 80)));
  r.avisos.slice(0, 30).forEach(([k, m]) => console.log("aviso ", m, "|", k.slice(0, 80)));
  console.log("erros:", r.erros.length, "avisos:", r.avisos.length);
  process.exit(r.erros.length ? 1 : 0);
}
