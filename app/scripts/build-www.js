// Uso: npm run build:www   (gera app/www/ pronto para o Firebase Hosting e para o Capacitor)
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");
const { lerConfig, montarIndex, versionarSw } = require("./montar.js");

const raiz = path.join(__dirname, "..", "..");
const app = path.join(raiz, "app");
const www = path.join(app, "www");

const config = lerConfig(fs.readFileSync(path.join(app, "firebase-config.json"), "utf8"));
const link = "https://" + config.projectId + ".web.app/";

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

esbuild.buildSync({
  entryPoints: [path.join(app, "shim", "claude-shim.js")],
  bundle: true, minify: true, format: "iife", target: ["safari15", "chrome100"],
  outfile: path.join(www, "shim.js")
});

const fragmento = fs.readFileSync(path.join(raiz, "publicar.html"), "utf8");
fs.writeFileSync(path.join(www, "index.html"), montarIndex(fragmento, config, link));
fs.writeFileSync(path.join(www, "sw.js"), versionarSw(fs.readFileSync(path.join(app, "sw.js"), "utf8"), String(Date.now())));
fs.copyFileSync(path.join(app, "manifest.webmanifest"), path.join(www, "manifest.webmanifest"));
for (const n of [180, 192, 512]) fs.copyFileSync(path.join(app, "icones", "icone-" + n + ".png"), path.join(www, "icone-" + n + ".png"));

console.log("app/www pronto (" + fs.readdirSync(www).join(", ") + ")");
