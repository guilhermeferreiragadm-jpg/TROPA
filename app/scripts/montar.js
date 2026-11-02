// Funções puras do build da PWA. O build-www.js só lê e grava arquivos em volta delas.
function lerConfig(texto) {
  let cfg;
  try { cfg = JSON.parse(texto); } catch (e) { throw new Error("app/firebase-config.json não é um JSON válido."); }
  for (const k of ["apiKey", "projectId", "appId"]) {
    if (!cfg || !cfg[k]) throw new Error("app/firebase-config.json está sem \"" + k + "\". Copie a config web do console do Firebase.");
  }
  return cfg;
}

const json = v => JSON.stringify(v).replace(/</g, "\\u003c");

function montarIndex(fragmento, config, linkApp) {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="theme-color" content="#F2F2F7">' +
    '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">' +
    '<meta name="apple-mobile-web-app-title" content="Tropa"><meta name="apple-mobile-web-app-status-bar-style" content="default">' +
    '<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icone-180.png">' +
    "<script>window.TROPA_FIREBASE=" + json(config) + ";window.TROPA_LINK=" + json(linkApp) + ";" +
    'if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)&&location.hostname!=="localhost"){window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}</script>' +
    '<script src="shim.js"></script></head><body>' + fragmento + "</body></html>";
}

function versionarSw(texto, versao) {
  return texto.replace("__VERSAO__", versao);
}

module.exports = { lerConfig, montarIndex, versionarSw };
