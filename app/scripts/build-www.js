// Uso: npm run build:www   (gera app/www/ pronto para o Firebase Hosting e para o Capacitor)
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const esbuild = require("esbuild");
const { lerConfig, lerApi, montarIndex, versionarSw } = require("./montar.js");

const raiz = path.join(__dirname, "..", "..");
const app = path.join(raiz, "app");
const www = path.join(app, "www");

function ler(nome) {
  try { return fs.readFileSync(path.join(app, nome), "utf8"); }
  catch (e) { console.error("Falta o arquivo app/" + nome + ". Veja o README, seção \"Rodar fora do claude.ai\"."); process.exit(1); }
}
const config = lerConfig(ler("firebase-config.json"));
const apiUrl = lerApi(ler("api-config.json"));
const link = "https://" + config.projectId + ".web.app/";

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

esbuild.buildSync({
  entryPoints: [path.join(app, "shim", "claude-shim.js")],
  bundle: true, minify: true, format: "iife", target: ["safari15", "chrome100"],
  outfile: path.join(www, "shim.js")
});

const fragmento = fs.readFileSync(path.join(raiz, "publicar.html"), "utf8");
fs.writeFileSync(path.join(www, "index.html"), montarIndex(fragmento, config, link, apiUrl, crypto.createHash("sha1").update(fs.readFileSync(path.join(app, "icone.png"))).digest("hex").slice(0, 8)));
fs.writeFileSync(path.join(www, "sw.js"), versionarSw(fs.readFileSync(path.join(app, "sw.js"), "utf8"), String(Date.now())));
fs.copyFileSync(path.join(app, "manifest.webmanifest"), path.join(www, "manifest.webmanifest"));
fs.cpSync(path.join(app, "exercicios"), path.join(www, "ex"), { recursive: true });   // fotos dos exercícios (free-exercise-db, domínio público)
for (const n of [180, 192, 512]) fs.copyFileSync(path.join(app, "icones", "icone-" + n + ".png"), path.join(www, "icone-" + n + ".png"));

console.log("app/www pronto (" + fs.readdirSync(www).join(", ") + ")");
