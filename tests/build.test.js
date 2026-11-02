const test = require("node:test");
const assert = require("node:assert/strict");
const { lerConfig, montarIndex, versionarSw } = require("../app/scripts/montar.js");

const CFG = { apiKey: "k", authDomain: "x.firebaseapp.com", projectId: "tropa-app", appId: "1:2:web:3" };

test("lerConfig devolve o objeto quando está completo", () => {
  assert.deepEqual(lerConfig(JSON.stringify(CFG)), CFG);
});

test("lerConfig recusa config incompleta com mensagem clara", () => {
  assert.throws(() => lerConfig(JSON.stringify({ apiKey: "k" })), /projectId/);
  assert.throws(() => lerConfig("não é json"), /app\/firebase-config\.json/);
});

test("montarIndex envolve o fragmento com doctype, manifest, config e shim, nessa ordem", () => {
  const html = montarIndex("<title>Tropa</title><div id=app></div>", CFG, "https://tropa-app.web.app/");
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<meta name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icone-180\.png">/);
  const iCfg = html.indexOf("window.TROPA_FIREBASE=");
  const iShim = html.indexOf('<script src="shim.js"></script>');
  const iCorpo = html.indexOf("<div id=app>");
  assert.ok(iCfg > 0 && iShim > iCfg && iCorpo > iShim, "ordem: config, shim, corpo");
  assert.match(html, /window\.TROPA_LINK="https:\/\/tropa-app\.web\.app\/"/);
});

test("montarIndex escapa < no JSON para não fechar o script antes da hora", () => {
  const html = montarIndex("<p></p>", { ...CFG, apiKey: "a</script>b" }, "https://x/");
  assert.ok(!html.includes('a</script>b'));
  assert.match(html, /a\\u003c\/script>b/);
});

test("montarIndex registra o service worker só em https e fora do localhost", () => {
  const html = montarIndex("<p></p>", CFG, "https://x/");
  assert.match(html, /serviceWorker\.register\("sw\.js"\)/);
  assert.match(html, /location\.hostname!=="localhost"/);
});

test("versionarSw troca o marcador", () => {
  assert.equal(versionarSw('const V = "__VERSAO__";', "123"), 'const V = "123";');
});

test("firebase.json: index, sw.js, / e shim.js saem sem cache", () => {
  const cfg = JSON.parse(require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "firebase.json"), "utf8"));
  const semCache = cfg.hosting.headers.filter(h => h.headers.some(x => x.key === "Cache-Control" && x.value === "no-cache")).map(h => h.source);
  ["/", "/index.html", "/sw.js", "/shim.js"].forEach(s => assert.ok(semCache.includes(s), "falta no-cache em " + s));
});
