// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const a = html.indexOf("/* @i18n:start */"), b = html.indexOf("/* @i18n:end */");
assert.ok(a > 0 && b > a, "bloco @i18n não achado");
const bloco = html.slice(a, b);
const T = new Function('let IDIOMA = "pt", UNIDADES = "metrico"; const LOC = () => IDIOMA==="en" ? "en-US" : "pt-BR";\n' + bloco +
  "\nreturn {traduzir, i18nPreparar, usar:(i,u)=>{ IDIOMA=i; UNIDADES=u; I18N_CACHE.clear(); }, unidades:i18nUnidades};")();

const DIC = {
  "Hoje": "Today", "Treino": "Workout", "Foguinho apagado · faça o check-in": "Streak out · check in",
  " dias de foguinho": " day streak", "de foguinho": "streak", "dias": "days", "dia": "day", "faltam": "left"
};
const PAD = [["^(\\d+) dias de foguinho$", "i", "$1-day streak"]];
test.beforeEach(() => { T.i18nPreparar(DIC, PAD); T.usar("en", "metrico"); });

test("em português o texto passa direto", () => {
  T.usar("pt", "metrico");
  assert.equal(T.traduzir("Hoje"), "Hoje");
  assert.equal(T.traduzir("12 km"), "12 km");
});
test("busca exata, preservando espaços das pontas", () => {
  assert.equal(T.traduzir("Hoje"), "Today");
  assert.equal(T.traduzir("  Treino "), "  Workout ");
});
test("a primeira letra segue o texto original (hoje/Hoje)", () => {
  assert.equal(T.traduzir("hoje"), "today");
  assert.equal(T.traduzir("treino"), "workout");
});
test("padrão com número", () => {
  assert.equal(T.traduzir("3 dias de foguinho"), "3-day streak");
});
test("troca de trechos em fronteira de palavra, sem quebrar palavras maiores", () => {
  assert.equal(T.traduzir("faltam 2 dias"), "left 2 days");
  assert.equal(T.traduzir("media"), "media");        // "dia" dentro de "media" não é trocado
});
test("texto sem letras e texto desconhecido ficam como estão", () => {
  assert.equal(T.traduzir("12:30"), "12:30");
  assert.equal(T.traduzir("Zzz desconhecido"), "Zzz desconhecido");
});
test("km vira milhas, kg vira libras, cm vira polegadas, ml vira onças (só no imperial)", () => {
  assert.equal(T.traduzir("10 km"), "10 km");
  T.usar("en", "imperial");
  assert.equal(T.traduzir("10 km"), "6.2 mi");
  assert.equal(T.traduzir("12,5 km"), "7.8 mi");
  assert.equal(T.traduzir("72 kg"), "158.7 lb");
  assert.equal(T.traduzir("180 cm"), "70.9 in");
  assert.equal(T.traduzir("500 ml"), "17 fl oz");
  assert.equal(T.traduzir("12 km/h"), "7.5 mph");
});
test("ritmo por km vira ritmo por milha", () => {
  T.usar("en", "imperial");
  assert.equal(T.traduzir("5:30 /km"), "8:51 /mi");
  assert.equal(T.traduzir("5:00/km"), "8:03 /mi");
});
test("imperial funciona também com o app em português", () => {
  T.usar("pt", "imperial");
  assert.equal(T.traduzir("10 km"), "6,2 mi");
  assert.equal(T.traduzir("Hoje"), "Hoje");
});
test("o dicionário embutido está em dia e cobre o básico", () => {
  const { embutir } = require("../app/scripts/i18n-embutir.js");
  assert.equal(embutir(html), html, "rode: node app/scripts/i18n-embutir.js");
  const m = /\/\* @i18n:dict \*\/([\s\S]*?)\/\* @i18n:dictend \*\//.exec(html);
  const dic = JSON.parse(m[1].replace(/<\\\//g, "</"));
  assert.ok(Object.keys(dic).length > 3000, "dicionário muito pequeno: " + Object.keys(dic).length);
  assert.equal(dic["Hoje"], "Today");
});
