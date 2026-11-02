// Tela de login em tela cheia, desenhada fora do app (o app só começa depois que a pessoa entra).
// acoes = {google(): Promise, entrar(email, senha): Promise, criar(nome, email, senha): Promise}
const { traduzirErroAuth } = require("./core.js");

function pedirLogin(acoes) {
  return new Promise(resolve => {
    const ov = document.createElement("div");
    ov.id = "tropa-login";
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:#F2F2F7;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,system-ui,sans-serif;color:#0B0D10;overflow:auto";
    ov.innerHTML =
      '<div style="width:100%;max-width:380px">' +
      '<h1 style="font-size:34px;margin:0 0 6px;font-style:italic;font-weight:900;letter-spacing:-.5px">TROPA</h1>' +
      '<p style="margin:0 0 24px;color:#5A626C">Entre para treinar com a sua tropa.</p>' +
      '<button type="button" id="tl-g" style="width:100%;padding:14px;border:0;border-radius:14px;background:#CF4500;color:#fff;font-size:16px;font-weight:600">Entrar com Google</button>' +
      '<p style="text-align:center;color:#5A626C;margin:18px 0">ou com e-mail</p>' +
      '<form id="tl-f" style="display:grid;gap:10px">' +
      '<input id="tl-n" type="text" placeholder="Seu nome" autocomplete="name" style="display:none;padding:14px;border:1px solid #D0D0D8;border-radius:12px;font-size:16px">' +
      '<input id="tl-e" type="email" placeholder="E-mail" autocomplete="email" required style="padding:14px;border:1px solid #D0D0D8;border-radius:12px;font-size:16px">' +
      '<input id="tl-s" type="password" placeholder="Senha" autocomplete="current-password" required minlength="6" style="padding:14px;border:1px solid #D0D0D8;border-radius:12px;font-size:16px">' +
      '<button type="submit" id="tl-ok" style="padding:14px;border:0;border-radius:14px;background:#0B0D10;color:#fff;font-size:16px;font-weight:600">Entrar</button>' +
      '</form>' +
      '<button type="button" id="tl-t" style="margin-top:12px;background:none;border:0;color:#C23E00;font-size:15px;width:100%">Criar conta com e-mail</button>' +
      '<p id="tl-erro" role="alert" style="color:#C62A20;min-height:20px;text-align:center;margin-top:8px"></p>' +
      '</div>';
    document.body.appendChild(ov);

    const $ = id => ov.querySelector("#" + id);
    let criando = false;
    const botoes = [$("tl-g"), $("tl-ok"), $("tl-t")];
    const mostrar = t => { $("tl-erro").textContent = t || ""; };

    $("tl-t").addEventListener("click", () => {
      criando = !criando;
      $("tl-n").style.display = criando ? "block" : "none";
      $("tl-ok").textContent = criando ? "Criar conta" : "Entrar";
      $("tl-t").textContent = criando ? "Já tenho conta" : "Criar conta com e-mail";
      $("tl-s").autocomplete = criando ? "new-password" : "current-password";
      mostrar("");
    });

    async function executar(fn) {
      mostrar("");
      botoes.forEach(b => { b.disabled = true; });
      try {
        await fn();
        ov.remove();
        resolve();
      } catch (e) {
        mostrar(traduzirErroAuth(e && e.code));
        botoes.forEach(b => { b.disabled = false; });
      }
    }

    $("tl-g").addEventListener("click", () => executar(() => acoes.google()));
    $("tl-f").addEventListener("submit", ev => {
      ev.preventDefault();
      const email = $("tl-e").value.trim(), senha = $("tl-s").value;
      executar(() => (criando ? acoes.criar($("tl-n").value.trim(), email, senha) : acoes.entrar(email, senha)));
    });
  });
}

module.exports = { pedirLogin };
