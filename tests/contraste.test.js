// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const bloco = (ini) => { const i = html.indexOf(ini); assert.ok(i >= 0, "bloco não achado: " + ini); return html.slice(i, html.indexOf("}", i)); };
const tokens = (txt) => { const o = {}; for (const m of txt.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) o[m[1]] = m[2]; return o; };
const claro = tokens(bloco(":root{")), escuroSo = tokens(bloco(':root[data-tema="escuro"]{'));
const escuro = Object.assign({}, claro, escuroSo);

const lin = c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
const lum = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126*lin(n>>16&255) + 0.7152*lin(n>>8&255) + 0.0722*lin(n&255); };
const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q-p); return (x+0.05)/(y+0.05); };

// [texto, fundo, mínimo]: 4,5 para texto, 3 para elementos gráficos
const PARES = [
  ["tx","bg",4.5], ["tx","surface",4.5], ["tx","surface-2",4.5],
  ["tx-2","bg",4.5], ["tx-2","surface",4.5], ["tx-2","surface-2",4.5],
  ["#FFFFFF","go-fill",4.5], ["#FFFFFF","go-press",4.5],
  ["go-ink","surface",4.5], ["go-ink","bg",4.5], ["go-ink","go-soft",4.5],
  ["done-ink","surface",4.5], ["done-ink","done-soft",4.5],
  ["stop-ink","surface",4.5], ["stop-ink","stop-soft",4.5],
  ["warn-ink","surface",4.5], ["warn-ink","caution-soft",4.5],
  ["go","surface",3], ["done","surface",3], ["stop","surface",3]   // --caution é só filete decorativo ao lado de texto; o texto de aviso usa --warn-ink
];
const cor = (t, nome) => t[nome] || (nome.startsWith("#") ? nome : null);

for (const [nome, tema] of [["claro", claro], ["escuro", escuro]]){
  test("contraste no tema "+nome, () => {
    for (const [a, b, min] of PARES){
      const ca = cor(tema, a), cb = cor(tema, b);
      assert.ok(ca && cb, "token faltando: " + a + " ou " + b);
      const r = razao(ca, cb);
      assert.ok(r >= min, a + " (" + ca + ") sobre " + b + " (" + cb + ") = " + r.toFixed(2) + ", mínimo " + min);
    }
  });
}
