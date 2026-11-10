// Embute o dicionário (app/i18n/en.json) e os padrões (app/i18n/padroes-en.json) no publicar.html, entre os marcadores.
// Uso: node app/scripts/i18n-embutir.js [--conferir]   (--conferir só compara e sai com 1 se estiver desatualizado)
const fs = require("node:fs");
const path = require("node:path");
const raiz = path.join(__dirname, "..", "..");
const alvo = path.join(raiz, "publicar.html");

function json(arq, padrao) {
  const p = path.join(raiz, "app", "i18n", arq);
  const t = fs.existsSync(p) ? JSON.stringify(JSON.parse(fs.readFileSync(p, "utf8"))) : padrao;
  return t.replace(/<\//g, "<\\/").split(String.fromCharCode(8232)).join("\\u2028").split(String.fromCharCode(8233)).join("\\u2029");
}
function embutir(html) {
  const troca = (h, ini, fim, texto) => {
    const a = h.indexOf(ini), b = h.indexOf(fim, a);
    if (a < 0 || b < 0) throw new Error("marcador não encontrado: " + ini);
    return h.slice(0, a + ini.length) + texto + h.slice(b);
  };
  let h = troca(html, "/* @i18n:dict */", "/* @i18n:dictend */", json("en.json", "{}"));
  h = troca(h, "/* @i18n:pad */", "/* @i18n:padend */", json("padroes-en.json", "[]"));
  return h;
}
module.exports = { embutir };
if (require.main === module) {
  const atual = fs.readFileSync(alvo, "utf8"), novo = embutir(atual);
  if (process.argv.includes("--conferir")) { if (atual !== novo) { console.error("publicar.html está com o dicionário desatualizado: rode node app/scripts/i18n-embutir.js"); process.exit(1); } console.log("dicionário em dia"); }
  else { fs.writeFileSync(alvo, novo); console.log("dicionário embutido (" + Math.round(novo.length / 1024) + " KB no arquivo)"); }
}
