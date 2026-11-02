// Entrada do navegador. Liga o Firebase ao core.js e publica window.claude (se o claude.ai não tiver feito isso).
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { criarClaude, criarChamadorApi, traduzirErroAuth } from "./core.js";
import { reduzirParaBase64 } from "./imagem.js";
import { pedirLogin } from "./login-ui.js";

if (!window.claude) {
  const cfg = Object.assign({}, window.TROPA_FIREBASE);
  const web = /^https?:$/.test(location.protocol);
  if (web) cfg.authDomain = location.host;   // o redirect do Google volta para o mesmo domínio (precisa disso no Safari)
  firebase.initializeApp(cfg);

  const auth = firebase.auth();
  const db = firebase.firestore();
  db.settings({ ignoreUndefinedProperties: true });   // campo undefined no app não pode derrubar a gravação (antes de useEmulator/enablePersistence)
  const emulador = location.hostname === "localhost" && new URLSearchParams(location.search).get("emu") === "1";
  if (emulador) {
    auth.useEmulator("http://127.0.0.1:9099");
    db.useEmulator("127.0.0.1", 8080);
  } else {
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  }

  const nativo = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  async function entrarGoogle() {
    if (nativo()) {
      const plugin = window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseAuthentication;
      if (!plugin) throw { code: "tropa/sem-google-nativo" };
      const r = await plugin.signInWithGoogle();
      const cred = firebase.auth.GoogleAuthProvider.credential(r.credential.idToken);
      await auth.signInWithCredential(cred);
      return;
    }
    await auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider());
    await new Promise(() => {});   // a página recarrega quando o Google devolve a pessoa
  }
  const entrarEmail = (email, senha) => auth.signInWithEmailAndPassword(email, senha);
  async function criarConta(nome, email, senha) {
    const c = await auth.createUserWithEmailAndPassword(email, senha);
    if (nome) await c.user.updateProfile({ displayName: nome });
  }

  async function autenticar() {
    let erroInicial = "";
    try { await auth.getRedirectResult(); } catch (e) { erroInicial = traduzirErroAuth(e && e.code); }   // a volta do Google falhou: mostra na tela de login
    let u = await new Promise(res => { const off = auth.onAuthStateChanged(x => { off(); res(x); }); });
    if (!u) {
      const acoes = { google: entrarGoogle, entrar: entrarEmail, criar: criarConta };
      if (erroInicial) acoes.erroInicial = erroInicial;
      await pedirLogin(acoes);
      u = auth.currentUser;
    }
    let claims = {};
    try { claims = (await u.getIdTokenResult(true)).claims; } catch (e) { try { claims = (await u.getIdTokenResult()).claims; } catch (e2) { /* sem rede: segue como não dono */ } }
    const nome = u.displayName || (u.email || "").split("@")[0] || "Atleta";
    // sem await: offline, com persistência ligada, o set() só resolve quando a rede volta e o app ficaria travado
    db.collection("perfis").doc(u.uid).set({ name: nome, avatarUrl: u.photoURL || "" }, { merge: true }).catch(() => {});
    return { uid: u.uid, name: nome, avatarUrl: u.photoURL || "", isOwner: claims.owner === true };
  }

  const chamarApi = criarChamadorApi({
    url: window.TROPA_API,
    obterToken: () => auth.currentUser.getIdToken(),
    fetch: (u, o) => fetch(u, o),
    timeoutMs: 180000
  });
  async function chamarIA(arg) {
    return (await chamarApi(arg)).json;
  }
  // Uma rodada do chat (o laço das ferramentas fica no core.js).
  async function conversar({ mensagens, ferramentas, esforco }) {
    const pedido = { mensagens, esforco };
    if (ferramentas) pedido.ferramentas = ferramentas;
    const d = await chamarApi(pedido);
    return { content: d.content, stopReason: d.stopReason };
  }

  const paraBase64Puro = blob => new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).slice(String(r.result).indexOf(",") + 1));
    r.onerror = () => falha(r.error);
    r.readAsDataURL(blob);
  });

  async function baixar({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: "text/plain" });
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    if (nativo() && plugins && plugins.Filesystem && plugins.Share) {
      const gravado = await plugins.Filesystem.writeFile({ path: filename, data: await paraBase64Puro(blob), directory: "CACHE" });
      await plugins.Share.share({ url: gravado.uri });
      return true;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  }

  window.claude = criarClaude({
    db,
    autenticar,
    sair: () => auth.signOut(),
    chamarIA,
    conversar,
    baixar,
    paraBase64: reduzirParaBase64
  });
}
