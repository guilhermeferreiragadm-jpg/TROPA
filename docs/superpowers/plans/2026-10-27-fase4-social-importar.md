# Fase 4: grupos reais, parceiro de responsa e importar treino, plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grupos reais por código de convite (com desafio coletivo), dupla "parceiro de responsa" com cutucada e importação de treino GPX, TCX e FIT (com `.gz`).

**Architecture:** Funções puras novas no bloco `/* @pure:start */ ... /* @pure:end */` de `publicar.html` (testadas em Node). Dados dos grupos ficam em `grupos/<id>` no banco compartilhado (cada pessoa escreve só o próprio documento; o app lê a coleção inteira e filtra por gid). A importação lê o arquivo no navegador, resume e grava no mesmo registro de treino feito (`ck_`). Nenhuma mudança de dados de `LOG` além de chaves pequenas (`gcod_`, `gc_`, `gaviso`, `cdp_`) e do campo `imp` dentro do `ck_`.

**Tech Stack:** HTML/JS de arquivo único (`publicar.html`), `node --test tests/*.test.js` (Node 24), `crypto.subtle`, `DecompressionStream`.

**Spec:** `docs/superpowers/specs/2026-10-27-fase4-social-importar-design.md`

## Global Constraints

- Idioma da interface e das mensagens: português do Brasil; nada de hífen ou travessão no lugar de vírgula em textos escritos para o usuário.
- `publicar.html` tem linhas muito longas: edite com trechos curtos e únicos e confira a unicidade com `grep -c` antes de usar Edit. Nunca reescreva o arquivo inteiro.
- Funções puras ficam entre `/* @pure:start */` e `/* @pure:end */`, inseridas imediatamente antes da linha `const fotoValida = s =>`, e só dependem de helpers do trecho de `tests` (`DAY`, `key`, `addDays`, `parseD`, `norm`, `num`) e de globais do navegador/Node (`crypto`, `TextEncoder`, `Date`).
- Os nomes novos não colidem com nenhum nome existente (verificado em 2026-10-27 com grep). Não renomeie.
- **Nunca** vão para `grupos`: peso, medidas, fotos, comida, calorias, saúde, lesão, ciclo, plano, trajeto, e-mail. Só `ap`, `up` e, por grupo, `g, nome, tipo, formato, meta, ini, fim, dupla, v, t, f, cut`.
- O código do grupo nunca é gravado em `grupos`; só o gid (SHA-256 de `"tropa:"+codigo`, 16 caracteres hexadecimais). O código fica em `LOG["gcod_"+gid]`.
- Grupos: máximo 5 por pessoa, 8 membros (2 na dupla). Cutucada: 1 por dia por dupla, 4 frases prontas. Sem chat.
- O trajeto (lat/lon) e o horário exato do arquivo importado nunca são guardados. Só `km`, `min`, `fc`, `subida`, `pace` no `ck_`.
- Escrita em `grupos` só com `gruposOk()` (realDb existe, `me` existe, não é DEMO, não é LOCAL). Sem isso a aba mostra aviso e não tenta escrever.
- Cada commit termina com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Comando de teste: `node --test tests/*.test.js` (precisa passar inteiro ao fim de cada tarefa; hoje são 69 testes antes da fase).

---

### Task 1: Funções puras de grupos e identificador (gid)

**Files:**
- Modify: `publicar.html` (inserir o bloco antes de `const fotoValida = s =>`, dentro do bloco `@pure`)
- Create: `tests/fase4-grupos.test.js`

**Interfaces:**
- Produces (todas dentro do bloco `@pure`): `FRASES_CUT`, `normalizarCodigo(s)`, `novoCodigoGrupo(rand?)`, `gidDeCodigo(codigo)` (async), `membrosDoGrupo(docs, gid)`, `definicaoDoGrupo(membros)`, `placarGrupo(membros, eu, def)`, `podarGrupos(gs, hoje)`, `cutucadaPermitida(cut, hoje)`, `cutucadaRecebida(par, hoje)`, `resumoDupla(membros, eu)`, `situacaoEntrada(membros, eu)`, `gravarGrupo(gs, e)`, `sairDoGrupo(gs, gid)`.

- [ ] **Step 1: Escrever o teste**

Crie `tests/fase4-grupos.test.js` com exatamente:

````js
// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const nodeCrypto = require("node:crypto");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const ajudas = trecho("const DAY = 864e5;", "const dow = d => (d.getDay()+6)%7;");
const puro = trecho("/* @pure:start */", "/* @pure:end */");
const F = new Function(ajudas + "\n" + puro + "\nreturn {normalizarCodigo, novoCodigoGrupo, gidDeCodigo, membrosDoGrupo, definicaoDoGrupo, placarGrupo, podarGrupos, cutucadaPermitida, cutucadaRecebida, resumoDupla, situacaoEntrada, gravarGrupo, sairDoGrupo, FRASES_CUT};")();

const doc = (id, gs, ap = "X") => ({id, data: {ap, up: "2026-10-27T10:00:00Z", gs}});
const gA = {g: "abc", nome: "Tropa", tipo: "km", formato: "juntos", meta: 100, ini: "2026-10-26", fim: "2026-11-01", dupla: false, v: 12.34, t: 3, f: 2, cut: {d: "2026-10-27", k: 2}};

test("normalizarCodigo aceita hífen, espaço e minúsculas; recusa símbolos fora do alfabeto e tamanho errado", () => {
  assert.equal(F.normalizarCodigo("abcd-efgh"), "ABCDEFGH");
  assert.equal(F.normalizarCodigo(" ABCD EFGH "), "ABCDEFGH");
  assert.equal(F.normalizarCodigo("ABCD EFG0"), "");
  assert.equal(F.normalizarCodigo("ABC"), "");
  assert.equal(F.normalizarCodigo(null), "");
});

test("novoCodigoGrupo usa só o alfabeto e tem 8 caracteres", () => {
  assert.equal(F.novoCodigoGrupo(() => 0), "AAAAAAAA");
  assert.equal(F.novoCodigoGrupo(() => 0.999999), "99999999");
  const c = F.novoCodigoGrupo();
  assert.equal(c.length, 8);
  assert.equal(F.normalizarCodigo(c), c);
});

test("gidDeCodigo é o SHA-256 de 'tropa:' + código, 16 caracteres hexadecimais", async () => {
  const esperado = nodeCrypto.createHash("sha256").update("tropa:ABCDEFGH").digest("hex").slice(0, 16);
  assert.equal(await F.gidDeCodigo("ABCDEFGH"), esperado);
  assert.notEqual(await F.gidDeCodigo("ABCDEFGJ"), esperado);
});

test("membrosDoGrupo ignora documentos malformados e limita valores", () => {
  const ms = F.membrosDoGrupo([
    doc("u1", [gA], "Ana"),
    doc("u2", [Object.assign({}, gA, {v: 99999999, tipo: "x", formato: "y", ini: "lixo"})], "Beto"),
    doc("u3", [{g: "outro"}]), {id: "u4", data: null}, {id: 5, data: {gs: [gA]}}, doc("u5", "naoarray"),
    doc("u6", [null, gA], "Y".repeat(50))
  ], "abc");
  assert.equal(ms.length, 3);
  assert.equal(ms[0].v, 12.3);
  assert.equal(ms[1].v, 100000);
  assert.equal(ms[1].def.tipo, "treinos");
  assert.equal(ms[1].def.formato, "mais");
  assert.equal(ms[1].def.ini, "");
  assert.equal(ms[2].ap.length, 30);
});

test("definicaoDoGrupo pega a definição de quem tem o ini mais antigo", () => {
  const ms = F.membrosDoGrupo([doc("u1", [Object.assign({}, gA, {nome: "Novo", ini: "2026-10-28"})]), doc("u2", [gA])], "abc");
  assert.equal(F.definicaoDoGrupo(ms).nome, "Tropa");
  assert.equal(F.definicaoDoGrupo([]), null);
});

test("placarGrupo ordena por valor e calcula a porcentagem só no formato juntos", () => {
  const ms = F.membrosDoGrupo([doc("u1", [gA], "Ana"), doc("u2", [Object.assign({}, gA, {v: 90})], "Beto")], "abc");
  const pl = F.placarGrupo(ms, "u1", F.definicaoDoGrupo(ms));
  assert.equal(pl.lista[0].id, "u2");
  assert.equal(pl.total, 102.3);
  assert.equal(pl.pct, 100);
  assert.equal(pl.lista.find(x => x.eu).id, "u1");
  assert.equal(F.placarGrupo(ms, "u1", {formato: "mais", meta: 100}).pct, null);
});

test("podarGrupos remove grupos vencidos há mais de 30 dias e mantém os sem fim", () => {
  const gs = [{g: "a", fim: "2026-09-20"}, {g: "b", fim: "2026-09-27"}, {g: "c", fim: ""}, {g: "d", fim: "2026-11-01"}];
  assert.equal(F.podarGrupos(gs, "2026-10-27").map(x => x.g).join(), "b,c,d");
});

test("cutucada: uma por dia e leitura da recebida", () => {
  assert.equal(F.cutucadaPermitida({d: "2026-10-27", k: 1}, "2026-10-27"), false);
  assert.equal(F.cutucadaPermitida({d: "2026-10-26", k: 1}, "2026-10-27"), true);
  assert.equal(F.cutucadaPermitida(null, "2026-10-27"), true);
  assert.equal(F.cutucadaRecebida({cut: {d: "2026-10-27", k: 2}}, "2026-10-27"), 2);
  assert.equal(F.cutucadaRecebida({cut: {d: "2026-10-26", k: 2}}, "2026-10-27"), -1);
  assert.equal(F.cutucadaRecebida(null, "2026-10-27"), -1);
  assert.equal(F.FRASES_CUT.length, 4);
});

test("resumoDupla e situacaoEntrada (limite 2 na dupla, 8 no grupo)", () => {
  const d1 = Object.assign({}, gA, {dupla: true});
  const so = F.membrosDoGrupo([doc("u1", [d1], "Ana")], "abc");
  assert.equal(F.resumoDupla(so, "u1").vazia, true);
  assert.equal(F.resumoDupla(so, "u1").eu.t, 3);
  const dois = F.membrosDoGrupo([doc("u1", [d1], "Ana"), doc("u2", [d1], "Beto")], "abc");
  assert.equal(F.resumoDupla(dois, "u1").par.ap, "Beto");
  assert.equal(F.situacaoEntrada([], "u9"), "nao_achei");
  assert.equal(F.situacaoEntrada(so, "u1"), "ja");
  assert.equal(F.situacaoEntrada(so, "u9"), "ok");
  assert.equal(F.situacaoEntrada(dois, "u9"), "cheio");
  const oito = F.membrosDoGrupo(Array.from({length: 8}, (_, k) => doc("m" + k, [gA])), "abc");
  assert.equal(F.situacaoEntrada(oito, "u9"), "cheio");
  assert.equal(F.situacaoEntrada(oito.slice(0, 7), "u9"), "ok");
});

test("gravarGrupo limita a 5 grupos e substitui o mesmo gid; sairDoGrupo remove", () => {
  let gs = [];
  for (let k = 0; k < 5; k++) gs = F.gravarGrupo(gs, {g: "g" + k});
  assert.equal(F.gravarGrupo(gs, {g: "g9"}), null);
  assert.equal(F.gravarGrupo(gs, {g: "g1", v: 3}).length, 5);
  assert.equal(F.gravarGrupo(gs, {g: "g1", v: 3}).find(x => x.g === "g1").v, 3);
  assert.equal(F.sairDoGrupo(gs, "g2").length, 4);
  assert.equal(F.sairDoGrupo(undefined, "g2").length, 0);
});
````

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/fase4-grupos.test.js`
Expected: FAIL (`F.normalizarCodigo is not a function` ou similar), porque as funções ainda não existem.

- [ ] **Step 3: Inserir o código**

Confira que a linha `const fotoValida = s =>` existe uma vez (`grep -c "^const fotoValida = s =>" publicar.html` deve dar 1). Insira, imediatamente antes dela (e depois da função anterior), o bloco abaixo, exatamente:

````js
/* ---- fase 4: grupos (sem DOM, sem banco) ---- */
const ALFA_GRUPO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TIPOS_GRUPO = ["km","treinos","forca","foguinho"], FORMATOS_GRUPO = ["mais","juntos"];
const FRASES_CUT = ["Bora treinar?","Vi que você treinou, boa!","Não esquece de hoje","Descansa e volta amanhã"];
const normalizarCodigo = s => { const c = String(s||"").toUpperCase().replace(/[\s-]/g,""); return c.length===8 && c.split("").every(x=>ALFA_GRUPO.includes(x)) ? c : ""; };
const novoCodigoGrupo = rand => { const r = rand || (()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296); let c = ""; for (let i=0;i<8;i++) c += ALFA_GRUPO[Math.min(ALFA_GRUPO.length-1, Math.floor(r()*ALFA_GRUPO.length))]; return c; };
const dataValida = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s||"")) ? String(s) : "";
const numLimitado = (v, mx) => { v = +v; return isFinite(v) ? Math.min(mx, Math.max(0, Math.round(v*10)/10)) : 0; };
const membrosDoGrupo = (docs, gid) => {
  const out = [];
  (Array.isArray(docs) ? docs : []).forEach(x => {
    const d = x && x.data; if (!x || typeof x.id !== "string" || !d || typeof d !== "object" || !Array.isArray(d.gs)) return;
    const g = d.gs.find(e => e && e.g === gid); if (!g) return;
    const cut = g.cut && dataValida(g.cut.d) ? {d:g.cut.d, k:[0,1,2,3].includes(g.cut.k) ? g.cut.k : 0} : null;
    out.push({id:x.id, ap:String(d.ap||"").slice(0,30) || "Atleta", up:typeof d.up === "string" ? d.up.slice(0,30) : "",
      def:{nome:String(g.nome||"Grupo").slice(0,30), tipo:TIPOS_GRUPO.includes(g.tipo) ? g.tipo : "treinos", formato:FORMATOS_GRUPO.includes(g.formato) ? g.formato : "mais", meta:numLimitado(g.meta,100000) || 100, ini:dataValida(g.ini), fim:dataValida(g.fim), dupla:g.dupla === true},
      v:numLimitado(g.v,100000), t:Math.round(numLimitado(g.t,100)), f:Math.round(numLimitado(g.f,3650)), cut});
  });
  return out;
};
const definicaoDoGrupo = membros => { const l = (membros||[]).slice().sort((a,b)=>{ const x = a.def.ini||"9999", y = b.def.ini||"9999"; return x<y ? -1 : x>y ? 1 : String(a.up)<String(b.up) ? -1 : String(a.up)>String(b.up) ? 1 : 0; }); return l.length ? l[0].def : null; };
const placarGrupo = (membros, eu, def) => {
  const lista = (membros||[]).map(m=>({id:m.id, ap:m.ap, v:m.v, up:m.up, eu:m.id===eu})).sort((a,b)=>b.v-a.v || (a.ap<b.ap ? -1 : a.ap>b.ap ? 1 : 0));
  const total = Math.round(lista.reduce((a,x)=>a+x.v,0)*10)/10;
  return {lista, total, pct: def && def.formato==="juntos" && def.meta>0 ? Math.min(100, Math.round(100*total/def.meta)) : null};
};
const podarGrupos = (gs, hoje) => { const h = parseD(hoje); if (!h) return Array.isArray(gs) ? gs.slice() : []; const lim = key(addDays(h,-30)); return (Array.isArray(gs) ? gs : []).filter(g => !g || !g.fim || g.fim >= lim); };
const cutucadaPermitida = (cut, hoje) => !(cut && cut.d === hoje);
const cutucadaRecebida = (par, hoje) => par && par.cut && par.cut.d === hoje ? par.cut.k : -1;
const resumoDupla = (membros, eu) => { const m = (membros||[]).find(x=>x.id===eu), p = (membros||[]).find(x=>x.id!==eu); return {eu:m ? {t:m.t, f:m.f} : {t:0, f:0}, par:p ? {ap:p.ap, t:p.t, f:p.f, cut:p.cut, up:p.up} : null, vazia:!p}; };
const situacaoEntrada = (membros, eu) => { const l = membros||[]; if (!l.length) return "nao_achei"; if (l.some(m=>m.id===eu)) return "ja"; const lim = l[0].def && l[0].def.dupla ? 2 : 8; return l.length >= lim ? "cheio" : "ok"; };
const gravarGrupo = (gs, e) => { const l = Array.isArray(gs) ? gs.filter(Boolean) : []; const i = l.findIndex(x=>x.g===e.g); if (i>=0){ l[i] = e; return l; } if (l.length >= 5) return null; return l.concat([e]); };
const sairDoGrupo = (gs, gid) => (Array.isArray(gs) ? gs : []).filter(x=>x && x.g!==gid);
const gidDeCodigo = async codigo => { const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("tropa:" + codigo)); return Array.from(new Uint8Array(buf)).slice(0, 8).map(x=>x.toString(16).padStart(2, "0")).join(""); };
````

- [ ] **Step 4: Rodar tudo**

Run: `node --test tests/*.test.js`
Expected: PASS, 69 testes antigos mais 10 novos (79 no total).

- [ ] **Step 5: Commit**

```bash
git add publicar.html tests/fase4-grupos.test.js
git commit -m "feat: funções puras dos grupos (código, gid, membros, placar, dupla)"
```

---

### Task 2: Funções puras de importação (GPX, TCX, resumo e validação)

**Files:**
- Modify: `publicar.html` (inserir antes de `const fotoValida = s =>`, logo depois do bloco da Task 1)
- Create: `tests/fase4-importar.test.js`

**Interfaces:**
- Produces: `atributosXML`, `lerGPX(texto)` e `lerTCX(texto)` (devolvem `{pontos:[{t,lat,lon,alt,dist,fc}], esporte, sessao, parcial}`), `esporteDoApp(s)` (`run|bike|swim|walk|gym|outro`), `resumirAtividade(leitura)` (devolve `{esporte,data,min,km,paceMinKm,subidaM,fcMedia,fcMax,parcial,pontos}`), `validarAtividade(r, hoje)` (string de erro ou `""`), `paceTexto(minPorKm)` (ex.: `"5:30"`).
- Consumes: `norm`, `key`, `addDays`, `parseD` (do trecho de ajudas).

- [ ] **Step 1: Escrever o teste**

Crie `tests/fase4-importar.test.js` com exatamente:

````js
// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const ajudas = trecho("const DAY = 864e5;", "const dow = d => (d.getDay()+6)%7;");
const puro = trecho("/* @pure:start */", "/* @pure:end */");
const F = new Function(ajudas + "\n" + puro + "\nreturn {lerGPX, lerTCX, esporteDoApp, resumirAtividade, validarAtividade, paceTexto};")();


const GPX = `<?xml version="1.0"?><gpx><metadata><type>ignorar</type></metadata><trk><name>x</name><type>running</type><trkseg>
<trkpt lat="-23.5000" lon="-46.6000"><ele>760.0</ele><time>2026-10-20T10:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
<trkpt lat="-23.5010" lon="-46.6000"><ele>765.0</ele><time>2026-10-20T10:01:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
<trkpt lat="-23.5020" lon="-46.6000"><ele>770.0</ele><time>2026-10-20T10:02:00Z</time></trkpt>
<trkpt lat="-23.5030" lon="-46.6000"><ele>770.5</ele><time>2026-10-20T10:12:00Z</time></trkpt>
<trkpt lat="-23.5040" lon="-46.6000"><ele>771</ele><time>2026-10-20T10:13:00Z</time></trkpt>
</trkseg></trk></gpx>`;
const TCX = `<TrainingCenterDatabase><Activities><Activity Sport="Biking"><Lap><Track>
<Trackpoint><Time>2026-10-21T10:00:00Z</Time><DistanceMeters>0</DistanceMeters><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
<Trackpoint><Time>2026-10-21T10:30:00Z</Time><DistanceMeters>12000.5</DistanceMeters><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;

test("lerGPX lê pontos, frequência cardíaca e o esporte do trk (não o do metadata)", () => {
  const g = F.lerGPX(GPX);
  assert.equal(g.pontos.length, 5);
  assert.equal(g.esporte, "running");
  assert.equal(g.pontos[0].fc, 140);
  assert.equal(g.pontos[0].alt, 760);
  assert.equal(g.pontos[2].fc, null);
});

test("resumirAtividade (GPX): distância por Haversine, pausa longa parada fora do tempo, subida com filtro de 3 m", () => {
  const r = F.resumirAtividade(F.lerGPX(GPX));
  assert.equal(r.esporte, "run");
  assert.equal(r.data, "2026-10-20");
  assert.equal(r.min, 3);
  assert.ok(r.km > 0.4 && r.km < 0.5, "km " + r.km);
  assert.equal(r.subidaM, 10);
  assert.equal(r.fcMedia, 145);
  assert.equal(r.fcMax, 150);
  assert.equal(r.pontos, 5);
  assert.equal(F.validarAtividade(r, "2026-10-27"), "");
});

test("lerTCX usa a distância acumulada e conta intervalo longo quando houve deslocamento", () => {
  const t = F.lerTCX(TCX);
  assert.equal(t.esporte, "Biking");
  const r = F.resumirAtividade(t);
  assert.equal(r.esporte, "bike");
  assert.equal(r.km, 12);
  assert.equal(r.min, 30);
  assert.equal(r.fcMedia, 130);
});

test("esporteDoApp e paceTexto", () => {
  assert.equal(F.esporteDoApp("Running"), "run");
  assert.equal(F.esporteDoApp("Trail run"), "run");
  assert.equal(F.esporteDoApp("cycling"), "bike");
  assert.equal(F.esporteDoApp("Swimming"), "swim");
  assert.equal(F.esporteDoApp("walking"), "walk");
  assert.equal(F.esporteDoApp("training"), "gym");
  assert.equal(F.esporteDoApp("surf"), "outro");
  assert.equal(F.paceTexto(5.5), "5:30");
  assert.equal(F.paceTexto(6.999), "7:00");
});

test("validarAtividade recusa arquivo vazio, datas fora da faixa, km e duração absurdos", () => {
  const ok = F.resumirAtividade(F.lerGPX(GPX));
  assert.ok(F.validarAtividade(F.resumirAtividade({pontos: []}), "2026-10-27"));
  assert.ok(F.validarAtividade(Object.assign({}, ok, {data: "2024-01-01"}), "2026-10-27"));
  assert.ok(F.validarAtividade(Object.assign({}, ok, {data: "2026-12-01"}), "2026-10-27"));
  assert.ok(F.validarAtividade(Object.assign({}, ok, {km: 600}), "2026-10-27"));
  assert.ok(F.validarAtividade(Object.assign({}, ok, {min: 1500}), "2026-10-27"));
  assert.ok(F.validarAtividade(Object.assign({}, ok, {pontos: 60001}), "2026-10-27"));
  assert.equal(F.validarAtividade(Object.assign({}, ok, {data: ""}), "2026-10-27"), "");
});
````

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/fase4-importar.test.js`
Expected: FAIL (`F.lerGPX is not a function`).

- [ ] **Step 3: Inserir o código**

Insira antes de `const fotoValida = s =>` (depois do bloco da Task 1):

````js
/* ---- fase 4: importar treino (GPX, TCX, FIT), sem DOM ---- */
const atributosXML = s => { const o = {}; String(s||"").replace(/([\w:]+)="([^"]*)"/g, (_, k, v) => { o[k] = v; return ""; }); return o; };
const lerGPX = texto => {
  const t = String(texto||""), pontos = [], re = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g; let m;
  while ((m = re.exec(t))){
    const a = atributosXML(m[1]), corpo = m[2] || "", lat = parseFloat(a.lat), lon = parseFloat(a.lon); if (!isFinite(lat) || !isFinite(lon)) continue;
    const ele = /<ele>\s*([-+\d.eE]+)\s*<\/ele>/.exec(corpo), tm = /<time>\s*([^<\s]+)\s*<\/time>/.exec(corpo), hr = /<(?:\w+:)?hr>\s*(\d+)\s*<\/(?:\w+:)?hr>/i.exec(corpo);
    pontos.push({t:tm ? Date.parse(tm[1]) : NaN, lat, lon, alt:ele && isFinite(+ele[1]) ? +ele[1] : null, dist:null, fc:hr ? +hr[1] : null});
  }
  const ty = /<trk>[\s\S]*?<type>\s*([^<]+?)\s*<\/type>/.exec(t);
  return {pontos, esporte:ty ? ty[1] : "", sessao:null, parcial:false};
};
const lerTCX = texto => {
  const t = String(texto||""), pontos = [], re = /<Trackpoint>([\s\S]*?)<\/Trackpoint>/g; let m;
  const campo = (c, n) => { const r = new RegExp("<"+n+">\\s*([^<]+?)\\s*</"+n+">").exec(c); return r && isFinite(+r[1]) ? +r[1] : null; };
  while ((m = re.exec(t))){
    const c = m[1], tm = /<Time>\s*([^<\s]+)\s*<\/Time>/.exec(c), hr = /<HeartRateBpm[^>]*>\s*<Value>\s*(\d+)/.exec(c);
    pontos.push({t:tm ? Date.parse(tm[1]) : NaN, lat:campo(c,"LatitudeDegrees"), lon:campo(c,"LongitudeDegrees"), alt:campo(c,"AltitudeMeters"), dist:campo(c,"DistanceMeters"), fc:hr ? +hr[1] : null});
  }
  const sp = /<Activity\s+Sport="([^"]*)"/.exec(t);
  return {pontos, esporte:sp ? sp[1] : "", sessao:null, parcial:false};
};
const esporteDoApp = s => { const n = norm(String(s||"")); if (/run|corrida|trail/.test(n)) return "run"; if (/bik|cycl|ciclis|ride/.test(n)) return "bike"; if (/swim|nata/.test(n)) return "swim"; if (/walk|hik|cami/.test(n)) return "walk"; if (/train|fitness|strength|weight|gym|forca|row/.test(n)) return "gym"; return "outro"; };
const resumirAtividade = l => {
  const pts = l && Array.isArray(l.pontos) ? l.pontos : [], s = l && l.sessao;
  const ts = pts.map(p=>p.t).filter(t=>isFinite(t));
  const rad = x => x * Math.PI / 180, hav = (a, b) => { const dLa = rad(b.lat - a.lat), dLo = rad(b.lon - a.lon), q = Math.sin(dLa/2)**2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLo/2)**2; return 12742000 * Math.asin(Math.min(1, Math.sqrt(q))); };
  const movido = (a, b) => a.dist != null && b.dist != null ? Math.abs(b.dist - a.dist) : a.lat != null && a.lon != null && b.lat != null && b.lon != null ? hav(a, b) : 0;
  let ms = 0; const comT = pts.filter(p=>isFinite(p.t));
  for (let i = 1; i < comT.length; i++){ const dt = comT[i].t - comT[i-1].t; if (dt > 0 && (dt <= 120000 || movido(comT[i-1], comT[i]) / (dt / 1000) > 0.5)) ms += dt; }
  const acum = pts.map(p=>p.dist).filter(v=>v != null && isFinite(v));
  let m = 0;
  if (acum.length > 1) m = Math.max.apply(null, acum) - Math.min.apply(null, acum);
  else { const g = pts.filter(p=>p.lat != null && p.lon != null); for (let i = 1; i < g.length; i++){ const seg = hav(g[i-1], g[i]), dt = (g[i].t - g[i-1].t) / 1000; if (seg < 1) continue; if (isFinite(dt) && dt > 0 && seg / dt > 50) continue; m += seg; } }
  let sub = 0, ref = null; pts.forEach(p => { if (p.alt == null) return; if (ref == null) ref = p.alt; else if (p.alt - ref >= 3){ sub += p.alt - ref; ref = p.alt; } else if (ref - p.alt >= 3) ref = p.alt; });
  const fcs = pts.map(p=>p.fc).filter(v=>v != null && v > 0);
  let min = Math.round(ms / 60000), km = Math.round(m / 10) / 100, subidaM = Math.round(sub), fcMedia = fcs.length ? Math.round(fcs.reduce((a,v)=>a+v,0) / fcs.length) : null, fcMax = fcs.length ? Math.max.apply(null, fcs) : null;
  if (s){ if (s.timerS) min = Math.round(s.timerS / 60); if (s.distM) km = Math.round(s.distM / 10) / 100; if (s.subidaM) subidaM = s.subidaM; if (s.fcMedia) fcMedia = s.fcMedia; if (s.fcMax) fcMax = s.fcMax; }
  return {esporte:esporteDoApp(l && l.esporte), data:ts.length ? key(new Date(ts[0])) : "", min, km, paceMinKm:km > 0 && min > 0 ? Math.round(min / km * 100) / 100 : null, subidaM, fcMedia, fcMax, parcial:!!(l && l.parcial), pontos:pts.length};
};
const validarAtividade = (r, hoje) => {
  if (!r || !(r.pontos > 0)) return "Não achei pontos de treino nesse arquivo.";
  if (r.pontos > 60000) return "Arquivo grande demais (mais de 60.000 pontos).";
  if (!(r.min > 0)) return "Não consegui calcular a duração do treino.";
  if (r.min > 1440) return "Duração acima de 24 horas, confira o arquivo.";
  if (r.km > 500) return "Distância acima de 500 km, confira o arquivo.";
  if (r.data){ const h = parseD(hoje), d = parseD(r.data); if (!h || !d || d < addDays(h,-365) || d > addDays(h,1)) return "A data do treino está fora do período aceito (até 1 ano atrás)."; }
  return "";
};
const paceTexto = v => { const s = Math.round(v * 60); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
````

- [ ] **Step 4: Rodar tudo**

Run: `node --test tests/*.test.js`
Expected: PASS (79 mais 5 novos, 84 no total).

- [ ] **Step 5: Commit**

```bash
git add publicar.html tests/fase4-importar.test.js
git commit -m "feat: leitura e resumo de GPX e TCX (funções puras)"
```

---

### Task 3: Leitor de FIT

**Files:**
- Modify: `publicar.html` (inserir o bloco do FIT logo antes de `const esporteDoApp =`)
- Modify: `tests/fase4-importar.test.js`

**Interfaces:**
- Produces: `CRC_FIT`, `crcFIT(bytes, ini, fim)`, `ESPORTE_FIT`, `lerFIT(bytes)` (devolve o mesmo formato de `lerGPX`, mais `invalido:true` quando o cabeçalho não é FIT ou o CRC do cabeçalho está errado, e `parcial:true` quando o arquivo está cortado).

- [ ] **Step 1: Escrever os testes**

No `tests/fase4-importar.test.js`: (a) troque a linha do loader `return {lerGPX, lerTCX, esporteDoApp, ...` para incluir `lerFIT, crcFIT` logo depois de `lerTCX,`; (b) acrescente ao fim do arquivo exatamente:

````js
// codificador mínimo de FIT para os testes (little endian)
function fitBytes(msgs, {hs = 14, crcCab = 0, cortar = 0} = {}){
  const dados = [];
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  const T = {u8:[2,1], u16:[4,2], u32:[6,4], s32:[5,4], enum:[0,1]};
  msgs.forEach(m => {
    dados.push(0x40 | m.loc, 0, 0, ...u16(m.gnum), m.campos.length);
    m.campos.forEach(([n, tipo]) => dados.push(n, T[tipo][1], T[tipo][0]));
    m.linhas.forEach(l => {
      dados.push(m.loc);
      m.campos.forEach(([n, tipo], i) => { const v = l[i]; if (tipo === "u8" || tipo === "enum") dados.push(v & 255); else if (tipo === "u16") dados.push(...u16(v)); else dados.push(...u32(v)); });
    });
  });
  const cab = [hs, 0x20, 0, 0, ...u32(dados.length), 0x2E, 0x46, 0x49, 0x54];
  if (hs === 14) cab.push(...u16(crcCab));
  const todo = cab.concat(dados, [0, 0]);
  return new Uint8Array(cortar ? todo.slice(0, todo.length - cortar) : todo);
}
test("crcFIT bate com o valor de referência do CRC-16/ARC", () => {
  assert.equal(F.crcFIT(new TextEncoder().encode("123456789"), 0, 9), 0xBB3D);
});
const SC = 2147483648 / 180, T0 = Math.floor(Date.parse("2026-10-22T10:00:00Z") / 1000) - 631065600;
const rec = {loc: 0, gnum: 20, campos: [[253, "u32"], [0, "s32"], [1, "s32"], [2, "u16"], [5, "u32"], [3, "u8"]], linhas: []};
for (let k = 0; k < 5; k++) rec.linhas.push([T0 + k * 60, Math.round((-23.5 - k * 0.001) * SC), Math.round(-46.6 * SC), (760 + 500) * 5 + k * 20, k * 20000, 130 + k * 5]);
const ses = {loc: 1, gnum: 18, campos: [[5, "enum"], [8, "u32"], [9, "u32"]], linhas: [[1, 240000, 41000]]};

test("lerFIT lê records e a sessão (esporte, tempo e distância totais)", () => {
  const f = F.lerFIT(fitBytes([rec, ses]));
  assert.equal(f.invalido, undefined);
  assert.equal(f.parcial, false);
  assert.equal(f.pontos.length, 5);
  assert.equal(f.esporte, "running");
  assert.ok(Math.abs(f.pontos[0].lat + 23.5) < 1e-5);
  assert.equal(f.pontos[1].alt, 764);
  assert.equal(f.pontos[4].dist, 800);
  const r = F.resumirAtividade(f);
  assert.equal(r.km, 0.41);
  assert.equal(r.min, 4);
  assert.equal(r.data, "2026-10-22");
  assert.equal(r.esporte, "run");
});

test("lerFIT: arquivo truncado devolve o que leu e marca parcial; cabeçalho de 12 bytes funciona", () => {
  const ft = F.lerFIT(fitBytes([rec, ses], {cortar: 20}));
  assert.equal(ft.parcial, true);
  assert.ok(ft.pontos.length >= 3);
  assert.equal(F.lerFIT(fitBytes([rec], {hs: 12})).pontos.length, 5);
});

test("lerFIT: lixo e CRC de cabeçalho errado são inválidos", () => {
  assert.equal(F.lerFIT(new Uint8Array([1, 2, 3])).invalido, true);
  assert.equal(F.lerFIT(new Uint8Array(20)).invalido, true);
  assert.equal(F.lerFIT(fitBytes([rec], {crcCab: 1234})).invalido, true);
});
````

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/fase4-importar.test.js`
Expected: FAIL nos testes de FIT (`F.lerFIT is not a function`).

- [ ] **Step 3: Inserir o código**

Em `publicar.html`, insira imediatamente antes de `const esporteDoApp = s =>` (que veio da Task 2):

````js
const CRC_FIT = [0x0000,0xCC01,0xD801,0x1400,0xF001,0x3C00,0x2800,0xE401,0xA001,0x6C00,0x7800,0xB401,0x5000,0x9C01,0x8801,0x4400];
const crcFIT = (b, ini, fim) => { let crc = 0; for (let i = ini; i < fim; i++){ let tmp = CRC_FIT[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc = crc ^ tmp ^ CRC_FIT[b[i] & 0xF]; tmp = CRC_FIT[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc = crc ^ tmp ^ CRC_FIT[(b[i] >> 4) & 0xF]; } return crc; };
const ESPORTE_FIT = {1:"running", 2:"cycling", 4:"fitness", 5:"swimming", 10:"training", 11:"walking", 15:"rowing", 17:"hiking"};
const lerFIT = bytes => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []), out = {pontos:[], esporte:"", sessao:null, parcial:false};
  if (b.length < 14 || String.fromCharCode(b[8], b[9], b[10], b[11]) !== ".FIT") return Object.assign(out, {invalido:true});
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), hs = b[0];
  if (hs !== 12 && hs !== 14) return Object.assign(out, {invalido:true});
  if (hs === 14){ const c = dv.getUint16(12, true); if (c !== 0 && c !== crcFIT(b, 0, 12)) return Object.assign(out, {invalido:true}); }
  const dataSize = dv.getUint32(4, true), fim = Math.min(b.length, hs + dataSize); if (hs + dataSize + 2 > b.length) out.parcial = true;
  const defs = {}; let i = hs, tsBase = 0;
  const leCampo = (pos, size, tipo, le) => {
    const t = tipo & 0x1F;
    if (t === 1 && size === 1){ const v = dv.getInt8(pos); return v === 0x7F ? null : v; }
    if ((t === 0 || t === 2 || t === 10 || t === 13) && size === 1){ const v = b[pos]; return v === 0xFF ? null : v; }
    if (t === 3 && size === 2){ const v = dv.getInt16(pos, le); return v === 0x7FFF ? null : v; }
    if ((t === 4 || t === 11) && size === 2){ const v = dv.getUint16(pos, le); return v === 0xFFFF ? null : v; }
    if (t === 5 && size === 4){ const v = dv.getInt32(pos, le); return v === 0x7FFFFFFF ? null : v; }
    if ((t === 6 || t === 12) && size === 4){ const v = dv.getUint32(pos, le); return v === 0xFFFFFFFF ? null : v; }
    return null;
  };
  const usa = (gnum, c) => {
    if (gnum === 20){
      const lat = c[0], lon = c[1], alt = c[78] != null ? c[78] : c[2], ts = c[253];
      out.pontos.push({t:ts != null ? (ts + 631065600) * 1000 : NaN, lat:lat != null ? lat * 180 / 2147483648 : null, lon:lon != null ? lon * 180 / 2147483648 : null, alt:alt != null ? alt / 5 - 500 : null, dist:c[5] != null ? c[5] / 100 : null, fc:c[3] != null ? c[3] : null});
    } else if (gnum === 18){
      out.sessao = {timerS:c[8] != null ? c[8] / 1000 : null, distM:c[9] != null ? c[9] / 100 : null, subidaM:c[22], fcMedia:c[16], fcMax:c[17]};
      if (c[5] != null) out.esporte = ESPORTE_FIT[c[5]] || "";
    }
  };
  while (i < fim){
    const h = b[i++]; let loc, d, comp = false, off = 0;
    if (h & 0x80){ loc = (h >> 5) & 3; comp = true; off = h & 0x1F; d = defs[loc]; }
    else if (h & 0x40){
      if (i + 5 > fim){ out.parcial = true; break; }
      const le = b[i + 1] === 0, gnum = dv.getUint16(i + 2, le), nf = b[i + 4]; let p = i + 5;
      if (p + nf * 3 > fim){ out.parcial = true; break; }
      const campos = []; for (let f = 0; f < nf; f++){ campos.push({n:b[p], size:b[p + 1], tipo:b[p + 2]}); p += 3; }
      let devSize = 0;
      if (h & 0x20){ if (p >= fim){ out.parcial = true; break; } const nd = b[p++]; if (p + nd * 3 > fim){ out.parcial = true; break; } for (let f = 0; f < nd; f++){ devSize += b[p + 1]; p += 3; } }
      defs[h & 0x0F] = {le, gnum, campos, devSize}; i = p; continue;
    } else { loc = h & 0x0F; d = defs[loc]; }
    if (!d){ out.parcial = true; break; }
    const tam = d.campos.reduce((a,f)=>a + f.size, 0) + d.devSize; if (i + tam > fim){ out.parcial = true; break; }
    const c = {}; let p = i; d.campos.forEach(f => { c[f.n] = leCampo(p, f.size, f.tipo, d.le); p += f.size; });
    if (c[253] != null) tsBase = c[253];
    if (comp){ let ts = (tsBase & ~0x1F) + off; if (ts < tsBase) ts += 0x20; tsBase = ts; c[253] = ts; }
    usa(d.gnum, c); i += tam;
  }
  return out;
};
````

- [ ] **Step 4: Rodar tudo**

Run: `node --test tests/*.test.js`
Expected: PASS (84 mais 4 novos, 88 no total).

- [ ] **Step 5: Commit**

```bash
git add publicar.html tests/fase4-importar.test.js
git commit -m "feat: leitor de arquivo FIT (funções puras)"
```

---

### Task 4: Grupos reais (dados, criar, entrar, tela do grupo)

**Files:**
- Modify: `publicar.html`
- Test: `tests/*.test.js` (checagem de compilação já existente) e conferência manual descrita no fim

**Interfaces:**
- Consumes (Task 1): `membrosDoGrupo, definicaoDoGrupo, placarGrupo, podarGrupos, gravarGrupo, sairDoGrupo, normalizarCodigo, novoCodigoGrupo, gidDeCodigo, situacaoEntrada`. Do app: `realDb, me, meName, DEMO, LOCAL, user, P, LOG, today, key, addDays, parseD, dow, DAY, num, esc, tela, bindGo, bindForm, seg, draft, toast, copiar, comTempo, ir, render, salvarLog, salvarSocial, SOC, treinosDe, feito, foguinho(), meuProgresso(dz), UNI, relTempo, ini, $`.
- Produces: variáveis `GRUPOS` (lista `[{id, data}]` de todos os documentos de `grupos`), `MEUS_GS` (meus grupos), funções `gruposOk()`, `meuApelido()`, `carregarGrupos()`, `agendarGrupos()`, `escreverGrupos(gs)`, `criarGrupo(def)`, `entrarComCodigo(txt)`, `deixarGrupo(gid)`, `avisoGrupos(seguir)`, `gruposSecaoHTML()`, `bindGrupos(app)`, `telaNovoGrupo()`, `telaGrupo(gid)`, `avatarNome(ap, eu)`. Rotas `perf|ngrupo` e `perf|grupo|<gid>`.

- [ ] **Step 1: Inserir o bloco de dados e telas**

Insira, imediatamente antes da linha `/* ---- desafios ---- */` (confira com `grep -c "^/\* ---- desafios ---- \*/" publicar.html` = 1), o bloco abaixo:

````js
/* ---- grupos reais e parceiro de responsa (fase 4) ---- */
let GRUPOS = [], MEUS_GS = [], gruposOn = false, gruposUlt = "", gruposT = null, gruposEnv = 0;
const gruposOk = () => !!(realDb && me && !DEMO && !LOCAL);
const gruposEscreve = () => !(user && typeof user.can === "function" && user.can("data.write") === false);
const meuApelido = () => String((P && P.perfil && P.perfil.apelido) || meName || "Atleta").slice(0,30);
const sigGrupos = (ap, gs) => JSON.stringify([ap, gs.map(g=>Object.keys(g).sort().map(k=>[k, g[k]]))]);
function treinosFeitosSemana(){ let n = 0; const ini0 = addDays(today, -dow(today)); for (let i=0;i<7;i++){ const d = addDays(ini0,i); if (d>today) break; treinosDe(d).forEach((t,j)=>{ if (feito(d,j)) n++; }); } return n; }
async function escreverGrupos(gs){ const ap = meuApelido(); await realDb.collection("grupos").doc(me).set({ap, up:new Date().toISOString(), gs}); MEUS_GS = gs; gruposUlt = sigGrupos(ap, gs); }
async function publicarGrupos(){
  if (!gruposOk() || !MEUS_GS.length) return;
  const gs = podarGrupos(MEUS_GS, key(today)), t = treinosFeitosSemana(), f = foguinho().n;
  const novo = gs.map(g=>Object.assign({}, g, {v:g.dupla ? 0 : meuProgresso(g), t:g.dupla ? t : 0, f:g.dupla ? f : 0}));
  if (sigGrupos(meuApelido(), novo) === gruposUlt) return;
  gruposEnv = Date.now();
  try{ await escreverGrupos(novo); }catch(e){}
}
function agendarGrupos(){ if (!gruposOk() || !gruposOn || !MEUS_GS.length) return; clearTimeout(gruposT); gruposT = setTimeout(publicarGrupos, Math.max(1500, 30000 - (Date.now() - gruposEnv))); }
function carregarGrupos(){
  if (gruposOn || !gruposOk()) return; gruposOn = true;
  try{ realDb.collection("grupos").onSnapshot(s=>{
    GRUPOS = s.docs.map(d=>({id:d.id, data:d.data()||{}}));
    const eu = GRUPOS.find(x=>x.id===me); if (eu && Array.isArray(eu.data.gs)) MEUS_GS = eu.data.gs.filter(Boolean);
    agendarGrupos();
    const ov = $("ov"), at = document.activeElement; if ((ov && ov.innerHTML) || (at && at.tagName==="INPUT")) return;
    if ((R.tab==="perf" && ["desafios","grupo","dupla"].includes(R.sub)) || (R.tab==="hoje" && !R.sub)) render(true);
  }, ()=>{ gruposOn = false; }); }catch(e){ gruposOn = false; }
}
function avisoGrupos(seguir){
  if (LOG.gaviso){ seguir(); return; }
  const ov = $("ov");
  ov.innerHTML = '<div class="dim" id="dim"></div><div class="sheet"><span class="grab"></span><h2 class="h2" style="font-size:1.7rem">O que os outros veem</h2><p>Quem estiver no grupo vê o seu apelido, o nome do grupo e os seus números do desafio: km, treinos ou dias de foguinho. Na dupla, também os treinos da semana e o foguinho.</p><p class="s">Nunca aparecem peso, fotos, comida, saúde ou trajetos. Quem tem acesso ao app e sabe mexer no banco de dados consegue ler esses mesmos números.</p><button type="button" class="btn go" id="gav">Entendi, continuar</button></div>';
  $("dim").addEventListener("click", ()=>{ ov.innerHTML = ""; });
  $("gav").addEventListener("click", async ()=>{ ov.innerHTML = ""; await salvarLog("gaviso", true); seguir(); });
}
async function criarGrupo(def){
  if (!gruposOk()) return null;
  const codigo = novoCodigoGrupo(), g = await gidDeCodigo(codigo);
  const gs = gravarGrupo(MEUS_GS, Object.assign({g, v:0, t:0, f:0, cut:null}, def));
  if (!gs){ toast("Você já está em 5 grupos. Saia de um antes."); return null; }
  try{ await escreverGrupos(gs); }catch(e){ toast("Não consegui criar agora. Tente de novo."); return null; }
  await salvarLog("gcod_"+g, codigo); agendarGrupos(); return g;
}
async function entrarComCodigo(txt){
  if (!gruposOk()) return {erro:"Grupos precisam do app publicado."};
  const cod = normalizarCodigo(txt); if (!cod) return {erro:"Código inválido. São 8 letras e números."};
  const gid = await gidDeCodigo(cod); let docs;
  try{ const s = await comTempo(realDb.collection("grupos").get(), 10000); docs = s.docs.map(d=>({id:d.id, data:d.data()||{}})); }catch(e){ return {erro:"Não consegui falar com o servidor. Tente de novo."}; }
  const mem = membrosDoGrupo(docs, gid), sit = situacaoEntrada(mem, me), def = definicaoDoGrupo(mem);
  if (sit==="nao_achei") return {erro:"Não achei esse grupo. Confira o código."};
  if (sit==="cheio") return {erro:"Esse grupo está cheio."};
  if (sit==="ok"){
    const gs = gravarGrupo(MEUS_GS, Object.assign({g:gid, v:0, t:0, f:0, cut:null}, def));
    if (!gs) return {erro:"Você já está em 5 grupos. Saia de um antes."};
    try{ await escreverGrupos(gs); }catch(e){ return {erro:"Não consegui entrar agora. Tente de novo."}; }
  }
  await salvarLog("gcod_"+gid, cod); agendarGrupos(); return {gid, dupla:!!(def && def.dupla)};
}
async function deixarGrupo(gid){ try{ await escreverGrupos(sairDoGrupo(MEUS_GS, gid)); await salvarLog("gcod_"+gid, null); return true; }catch(e){ toast("Não consegui sair agora. Tente de novo."); return false; } }
const avatarNome = (ap, eu) => '<span class="av" style="width:32px;height:32px;background:'+(eu?'#0B0D10':'#5A626C')+'">'+esc(ini(ap))+'</span>';
function gruposSecaoHTML(){
  if (!gruposOk()) return '<span class="k">grupos de verdade</span><p class="s">Grupos só funcionam no app publicado, com a sua conta.</p>';
  const lista = MEUS_GS.filter(g=>!g.dupla), dp = MEUS_GS.find(g=>g.dupla);
  return '<span class="k">grupos de verdade</span>'+
    (lista.length ? lista.map(g=>{ const mem = membrosDoGrupo(GRUPOS, g.g), def = definicaoDoGrupo(mem) || g, pc = placarGrupo(mem, me, def), pos = pc.lista.findIndex(x=>x.eu)+1, acabou = !!def.fim && parseD(def.fim) < today, dias = def.fim ? Math.max(0, Math.ceil((parseD(def.fim)-today)/DAY)+1) : 0;
      return '<button type="button" class="box" data-go="perf|grupo|'+esc(g.g)+'" style="text-align:left;width:100%"><div class="between"><b>'+esc(def.nome)+'</b><b class="n" style="color:var(--go-ink)">'+(acabou?'encerrado':dias+'d')+'</b></div><span class="s">'+mem.length+' pessoa'+(mem.length===1?'':'s')+' · '+(def.formato==="juntos" ? num(pc.total,1)+'/'+def.meta+' '+UNI[def.tipo] : 'você '+(pos||"-")+'º')+'</span></button>'; }).join("") : '<p class="s">Você não está em nenhum grupo ainda.</p>')+
    (gruposEscreve() ? '<div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn sm go" data-go="perf|ngrupo">Criar grupo</button>'+(dp ? '' : '<button type="button" class="btn sm" id="gdupla">Chamar um parceiro</button>')+'</div>'+
      '<div class="row" style="flex-wrap:nowrap"><input class="inp" id="gcod" maxlength="12" placeholder="Código de 8 letras" autocapitalize="characters" autocomplete="off"><button type="button" class="btn sm" id="gent">Entrar</button></div><p class="msg" id="gmsg"></p>'
      : '<p class="s">Peça acesso de colaborador ao dono do app para criar ou entrar em grupos.</p>')+
    (dp ? '<button type="button" class="box" data-go="perf|dupla" style="text-align:left;width:100%"><b>Parceiro de responsa</b><span class="s">ver a dupla e cutucar</span></button>' : '');
}
function bindGrupos(app){
  const gd = $("gdupla"); if (gd) gd.addEventListener("click", ()=>avisoGrupos(async ()=>{ const g = await criarGrupo({nome:"Dupla", tipo:"treinos", formato:"mais", meta:0, ini:"", fim:"", dupla:true}); if (g) ir("perf","dupla"); }));
  const ge = $("gent"); if (ge) ge.addEventListener("click", ()=>avisoGrupos(async ()=>{ const m = $("gmsg"); m.textContent = "Procurando…"; m.className = "msg"; const r = await entrarComCodigo($("gcod").value); if (r.erro){ m.textContent = r.erro; m.className = "msg err"; return; } if (r.dupla) ir("perf","dupla"); else ir("perf","grupo",r.gid); }));
}
function telaNovoGrupo(){
  draft.ng_tipo = draft.ng_tipo||"km"; draft.ng_formato = draft.ng_formato||"mais"; draft.ng_prazo = draft.ng_prazo||"dom";
  const app = tela('<button type="button" class="back" data-go="perf|desafios">← Desafios</button><h1 class="h1">Novo grupo</h1>'+
    '<div class="fld"><label for="ngn">Nome do grupo (até 30 letras)</label><input class="inp" id="ngn" data-f="ng_nome" maxlength="30" placeholder="Tropa da manhã"></div>'+
    '<span class="k">tipo</span>'+seg("ng_tipo",[["km","Km"],["treinos","Treinos"],["forca","Força"],["foguinho","Foguinho"]])+
    '<span class="k">formato</span>'+seg("ng_formato",[["mais","Quem faz mais"],["juntos","Meta juntos"]])+
    (draft.ng_formato==="juntos" ? '<div class="fld"><label for="ngm">Meta do grupo ('+UNI[draft.ng_tipo]+')</label><input class="inp" id="ngm" data-f="ng_meta" type="number" inputmode="numeric" placeholder="100"></div>' : '')+
    '<span class="k">até</span>'+seg("ng_prazo",[["dom","Domingo"],["7","7 dias"],["30","30 dias"]],3)+
    '<button type="button" class="btn go" id="ngok">Criar grupo</button><p class="msg" id="ngm2"></p>', {});
  bindGo(app); bindForm(app, n=>{ if (["ng_formato","ng_tipo"].includes(n)) telaNovoGrupo(); });
  $("ngok").addEventListener("click", ()=>{
    const nome = String(draft.ng_nome||"").trim().slice(0,30); if (!nome){ $("ngm2").textContent = "Dê um nome ao grupo."; return; }
    if (!gruposOk() || !gruposEscreve()){ $("ngm2").textContent = "Peça acesso de colaborador ao dono do app."; return; }
    avisoGrupos(async ()=>{
      const fim = draft.ng_prazo==="dom" ? addDays(today, 6-dow(today)) : addDays(today, +draft.ng_prazo-1);
      const g = await criarGrupo({nome, tipo:draft.ng_tipo, formato:draft.ng_formato, meta:draft.ng_formato==="juntos" ? (+draft.ng_meta||100) : 0, ini:key(today), fim:key(fim), dupla:false});
      if (!g) return; ["ng_nome","ng_meta"].forEach(x=>delete draft[x]); ir("perf","grupo",g);
    });
  });
}
function bonusGrupo(gid, def, pc, acabou){
  if (LOG["gc_"+gid] || pc.lista.length < 2) return;
  const bateu = def.formato==="juntos" ? pc.pct >= 100 : (acabou && pc.lista[0].eu && pc.lista[0].v > 0);
  if (!bateu) return;
  salvarLog("gc_"+gid, true); SOC.desafiosGanhos = (SOC.desafiosGanhos||0)+1; salvarSocial(); if (def.formato==="juntos") toast("Meta batida: +200 XP");
}
function telaGrupo(gid){
  const mine = MEUS_GS.find(x=>x.g===gid && !x.dupla); if (!mine){ ir("perf","desafios"); return; }
  const mem = membrosDoGrupo(GRUPOS, gid), def = definicaoDoGrupo(mem) || mine, pc = placarGrupo(mem, me, def);
  const acabou = !!def.fim && parseD(def.fim) < today, rest = def.fim ? Math.max(0, (addDays(parseD(def.fim),1) - new Date())/3600000) : 0, mx = Math.max(1, pc.lista.length ? pc.lista[0].v : 1);
  const cod = LOG["gcod_"+gid] || "", codTxt = cod ? cod.slice(0,4)+"-"+cod.slice(4) : "";
  let h = '<button type="button" class="back" data-go="perf|desafios">← Desafios</button><span class="k">grupo · '+(def.formato==="juntos" ? "meta juntos" : "quem faz mais")+'</span><h1 class="h1">'+esc(def.nome)+'</h1>';
  h += acabou
    ? '<div class="box strong"><span class="k">grupo encerrado</span><h2 class="h2">'+(def.formato==="juntos" ? (pc.pct>=100 ? "Meta batida!" : "Meta não batida: "+pc.pct+"%") : esc(pc.lista[0] && pc.lista[0].eu ? "Você venceu!" : ((pc.lista[0]||{}).ap||"Alguém")+" venceu."))+'</h2></div>'
    : '<div class="big3"><div><b>'+Math.floor(rest/24)+'</b><span>dias</span></div><div><b>'+Math.floor(rest%24)+'</b><span>horas</span></div><div><b>'+(def.formato==="juntos" ? pc.pct+'%' : (pc.lista.findIndex(x=>x.eu)+1)+'º')+'</b><span>'+(def.formato==="juntos" ? 'da meta' : 'sua posição')+'</span></div></div>';
  h += pc.lista.map((x,i)=>{ const velho = !!x.up && Date.now()-Date.parse(x.up) > 7*DAY;
    return '<div class="rk'+(x.eu?' me':'')+'" style="grid-template-columns:18px 32px minmax(0,1fr) auto'+(velho?';opacity:.55':'')+'"><b class="n">'+(i+1)+'</b>'+avatarNome(x.ap, x.eu)+'<span style="min-width:0"><b style="font-size:.88rem">'+esc(x.eu ? "Você" : x.ap)+'</b><span class="xpbar" style="display:block;height:6px;margin-top:4px"><i style="width:'+Math.round(100*x.v/mx)+'%;background:'+(i===0?'var(--done)':'var(--ink)')+'"></i></span>'+(x.up ? '<span class="s">atualizado '+esc(relTempo(x.up))+'</span>' : '')+'</span><b class="n">'+num(x.v,1)+(def.tipo==="km" ? ' km' : '')+'</b></div>'; }).join("");
  h += (def.formato==="juntos" ? '<p class="s">Batendo a meta, todo mundo ganha +200 XP.</p>' : '')+
    (codTxt ? '<span class="k">convide pelo código</span><div class="box"><div class="between"><b class="n" style="font-size:1.2rem">'+esc(codTxt)+'</b><button type="button" class="btn sm" id="gcp">Copiar convite</button></div></div>' : '<p class="s">O código deste grupo não está guardado neste aparelho. Peça a quem criou.</p>')+
    '<button type="button" class="btn ghost" id="gsai">Sair do grupo</button><p class="s">Sair apaga o seu progresso deste grupo. Os outros continuam vendo o grupo.</p>';
  const app = tela(h, {tabs:true, fab:true}); bindGo(app);
  const cp = $("gcp"); if (cp) cp.addEventListener("click", ()=>copiar("Entra no meu grupo da Tropa! Código: "+codTxt+" (Performance, Desafios, Entrar com código)"));
  $("gsai").addEventListener("click", async e=>{ const b = e.currentTarget; if (b.dataset.armed!=="1"){ b.dataset.armed = "1"; b.textContent = "Confirmar saída"; return; } if (await deixarGrupo(gid)) ir("perf","desafios"); });
  bonusGrupo(gid, def, pc, acabou);
}
````

- [ ] **Step 2: Ligar a tela Desafios e as rotas**

(a) Em `telaDesafios` (`grep -n "^function telaDesafios" publicar.html`, definida uma vez): troque `'<button type="button" class="btn go" data-go="perf|novo">Criar desafio</button>'+` por `'<button type="button" class="btn go" data-go="perf|novo">Criar desafio</button>'+gruposSecaoHTML()+'<span class="k">desafios com amigos de exemplo (simulados)</span>'+` (o trecho `data-go="perf|novo">Criar desafio</button>'+` é único: confira). Na mesma função, troque `bindGo(app);\n}` final por `bindGo(app); bindGrupos(app);\n}`: a última linha da função é `  bindGo(app);` seguida de `}` e depois `function telaNovoDesafio(){`; use esse contexto para um Edit único.

(b) Na linha de roteamento `if (t==="perf"){ if (s==="nivel") ...` (`grep -n 'if (t==="perf"){' publicar.html`, uma ocorrência), acrescente, logo depois de `if (s==="desafios") return telaDesafios();`, o texto ` if (s==="ngrupo") return telaNovoGrupo(); if (s==="grupo") return telaGrupo(R.arg); if (s==="dupla") return telaDupla();`. (`telaDupla` vem na Task 5; para esta tarefa passar, defina antes um `function telaDupla(){ ir("perf","desafios"); }` provisório logo após `telaGrupo`, que a Task 5 substitui.)

(c) Em `salvarLog` (`grep -n "^async function salvarLog" publicar.html`): troque `if (!db || !me) return;\n  clearTimeout(logT);` por `if (!db || !me) return;\n  agendarGrupos();\n  clearTimeout(logT);`.

(d) No fim do bootstrap, troque a linha `  carregarPostsDono(realDb);\n  entrou = !!(P && P.perfil);` por `  carregarPostsDono(realDb);\n  carregarGrupos();\n  entrou = !!(P && P.perfil);` (a linha `carregarPostsDono(realDb);` aparece duas vezes no arquivo; use o contexto com `entrou = !!(P && P.perfil);` para unicidade).

- [ ] **Step 3: Conferir**

Run: `node --test tests/*.test.js`
Expected: PASS (88 testes; inclui a checagem de que o script compila).
Run: `grep -c "carregarGrupos()" publicar.html` → 2 (definição e chamada) e `grep -c "agendarGrupos()" publicar.html` → 4 ou mais.

- [ ] **Step 4: Commit**

```bash
git add publicar.html
git commit -m "feat: grupos reais por código (criar, entrar, placar, sair)"
```

---

### Task 5: Parceiro de responsa (dupla) e cutucada

**Files:**
- Modify: `publicar.html`

**Interfaces:**
- Consumes (Tasks 1 e 4): `MEUS_GS, GRUPOS, membrosDoGrupo, resumoDupla, cutucadaPermitida, cutucadaRecebida, FRASES_CUT, escreverGrupos, deixarGrupo, avisoGrupos, gruposOk, gruposEscreve, relTempo, copiar`.
- Produces: `duplaAtual()`, `telaDupla()` (substitui o provisório da Task 4), cartões na tela Hoje.

- [ ] **Step 1: Substituir o `telaDupla` provisório**

Apague a linha `function telaDupla(){ ir("perf","desafios"); }` criada na Task 4 e, no mesmo lugar (logo depois de `telaGrupo`), insira:

````js
function duplaAtual(){ const g = MEUS_GS.find(x=>x.dupla); if (!g) return null; const mem = membrosDoGrupo(GRUPOS, g.g); return {g, mem, rd:resumoDupla(mem, me)}; }
function telaDupla(){
  const dp = duplaAtual(); if (!dp){ ir("perf","desafios"); return; }
  const {g, rd} = dp, hoje = key(today), cod = LOG["gcod_"+g.g] || "", codTxt = cod ? cod.slice(0,4)+"-"+cod.slice(4) : "";
  const jaCut = !cutucadaPermitida(g.cut, hoje);
  let h = '<button type="button" class="back" data-go="perf|desafios">← Desafios</button><span class="k">parceiro de responsa</span><h1 class="h1">'+esc(rd.par ? rd.par.ap : "Dupla")+'</h1>';
  if (rd.vazia){
    h += '<div class="box"><b>Chame alguém para treinar com você</b><span class="s">A dupla tem 2 pessoas e cada um vê só os treinos da semana e o foguinho do outro.</span>'+
      (codTxt ? '<div class="between" style="margin-top:8px"><b class="n" style="font-size:1.2rem">'+esc(codTxt)+'</b><button type="button" class="btn sm" id="dcp">Copiar convite</button></div>' : '<span class="s">O código desta dupla não está guardado neste aparelho.</span>')+'</div>';
  } else {
    const col = (tit, x, extra) => '<div class="box"><span class="k">'+esc(tit)+'</span><b class="n" style="font-size:1.4rem">'+x.t+' treino'+(x.t===1?'':'s')+'</b><span class="s">foguinho '+x.f+(extra||'')+'</span></div>';
    h += '<div class="grid2">'+col("você", rd.eu)+col(rd.par.ap, rd.par, rd.par.up ? ' · atualizado '+relTempo(rd.par.up) : '')+'</div>'+
      '<span class="k">cutucada de hoje</span>'+(jaCut ? '<p class="s">Você já cutucou hoje. Amanhã tem outra.</p>' : '<div class="chips" id="cuts">'+FRASES_CUT.map((f,k)=>'<button type="button" class="chip" data-k="'+k+'">'+esc(f)+'</button>').join("")+'</div>');
  }
  h += '<button type="button" class="btn ghost" id="dsai">Sair da dupla</button><p class="s">Sair apaga o seu lado da dupla. O parceiro continua com a dupla e pode chamar outra pessoa.</p>';
  const app = tela(h, {tabs:true, fab:true}); bindGo(app);
  const cp = $("dcp"); if (cp) cp.addEventListener("click", ()=>copiar("Vamos ser parceiros de responsa na Tropa! Código: "+codTxt+" (Performance, Desafios, Entrar com código)"));
  app.querySelectorAll("#cuts [data-k]").forEach(b=>b.addEventListener("click", async ()=>{
    const gs = MEUS_GS.map(x=>x.g===g.g ? Object.assign({}, x, {cut:{d:hoje, k:+b.dataset.k}}) : x);
    try{ await escreverGrupos(gs); toast("Cutucada enviada."); render(true); }catch(e){ toast("Não consegui enviar agora. Tente de novo."); }
  }));
  $("dsai").addEventListener("click", async e=>{ const b = e.currentTarget; if (b.dataset.armed!=="1"){ b.dataset.armed = "1"; b.textContent = "Confirmar saída"; return; } if (await deixarGrupo(g.g)) ir("perf","desafios"); });
}
````

- [ ] **Step 2: Cartões na tela Hoje**

Em `extrasHoje()` (`grep -n "^function extrasHoje" publicar.html`), imediatamente antes do `return out;` final da função (o `return out;` que vem depois do bloco `if (lembretePesagem(...)){ ... }`), insira:

````js
  const dp = gruposOk() ? duplaAtual() : null;
  if (dp && !dp.rd.vazia){
    const rec = cutucadaRecebida(dp.rd.par, key(today)), kd = "cdp_"+dp.g.g+"_"+key(today);
    if (rec >= 0 && !LOG[kd]){
      const b = document.createElement("button"); b.type = "button"; b.className = "ci hot"; b.id = "cutbtn";
      b.innerHTML = '<span><b>'+esc(dp.rd.par.ap)+' te cutucou</b><small>'+esc(FRASES_CUT[rec] || FRASES_CUT[0])+'</small></span><span class="n">→</span>';
      b.addEventListener("click", ()=>{ salvarLog(kd, true).then(()=>ir("perf","dupla")); });
      out.push(b);
    }
    const b2 = document.createElement("button"); b2.type = "button"; b2.className = "ci"; b2.id = "dpbtn";
    b2.innerHTML = '<span><b>Parceiro: '+esc(dp.rd.par.ap)+'</b><small>você '+dp.rd.eu.t+' · '+esc(dp.rd.par.ap)+' '+dp.rd.par.t+' treinos na semana</small></span><span class="n">→</span>';
    b2.addEventListener("click", ()=>ir("perf","dupla"));
    out.push(b2);
  }
````

- [ ] **Step 3: Conferir**

Run: `node --test tests/*.test.js`
Expected: PASS (88 testes). Run: `grep -c "^function telaDupla" publicar.html` → 1.

- [ ] **Step 4: Commit**

```bash
git add publicar.html
git commit -m "feat: parceiro de responsa (dupla, cutucada diária e cartões na tela Hoje)"
```

---

### Task 6: Importar treino na tela do treino

**Files:**
- Modify: `publicar.html`

**Interfaces:**
- Consumes (Tasks 2 e 3): `lerGPX, lerTCX, lerFIT, resumirAtividade, validarAtividade, esporteDoApp, paceTexto`. Do app: `argTreino(a)`, `treinosDe`, `feito`, `salvarLog`, `nivelAntes`, `checarNivel`, `ir`, `toast`, `fmt`, `parseD`, `key`, `today`, `num`, `esc`, `NOMEK`, `$`.
- Produces: `lerArquivoTreino(file)`, `jaImportado(r, k)`, `importarTreino(a, file)`, `sheetPreviaImport(a, r)` e o botão "Importar do relógio ou Strava" em `telaTreino`.

- [ ] **Step 1: Inserir as funções**

Insira, imediatamente antes de `function sheetFeito(a){` (uma ocorrência), o bloco:

````js
async function lerArquivoTreino(file){
  const MAX = 10*1024*1024;
  if (file.size > 25*1024*1024) throw new Error("Arquivo grande demais.");
  let buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0]===0x1f && buf[1]===0x8b){
    if (typeof DecompressionStream === "undefined") throw new Error("Seu navegador não abre .gz. Descompacte o arquivo antes.");
    const rd = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip")).getReader(), partes = []; let tot = 0;
    for (;;){ const {done, value} = await rd.read(); if (done) break; tot += value.length; if (tot > MAX){ rd.cancel(); throw new Error("Arquivo grande demais (mais de 10 MB descompactado)."); } partes.push(value); }
    buf = new Uint8Array(tot); let o = 0; partes.forEach(p=>{ buf.set(p, o); o += p.length; });
  }
  if (!buf.length) throw new Error("O arquivo está vazio.");
  if (buf.length > MAX) throw new Error("Arquivo grande demais (mais de 10 MB).");
  if (buf.length >= 12 && String.fromCharCode(buf[8], buf[9], buf[10], buf[11]) === ".FIT") return lerFIT(buf);
  const txt = new TextDecoder("utf-8").decode(buf);
  if (/<gpx[\s>]/i.test(txt)) return lerGPX(txt);
  if (/<TrainingCenterDatabase/.test(txt)) return lerTCX(txt);
  throw new Error("Não reconheci o formato. Use GPX, TCX ou FIT.");
}
function jaImportado(r, k){ const dd = parseD(r.data || k); return !!dd && treinosDe(dd).some((_,j)=>{ const c = feito(dd,j); return c && c.imp && c.imp.km===r.km && c.min===r.min; }); }
async function importarTreino(a, file){
  const {k} = argTreino(a); let leit;
  try{ leit = await lerArquivoTreino(file); }catch(e){ toast(e.message || "Não consegui ler o arquivo."); return; }
  if (leit.invalido){ toast("Esse arquivo FIT está inválido ou corrompido."); return; }
  const r = resumirAtividade(leit), erro = validarAtividade(r, key(today));
  if (erro){ toast(erro); return; }
  if (jaImportado(r, k)){ toast("Esse treino já foi importado."); return; }
  sheetPreviaImport(a, r);
}
function sheetPreviaImport(a, r){
  const {d,k,i,t} = argTreino(a), ov = $("ov"), st = {rpe:"ok"};
  const esp = {run:"corrida", bike:"bike", swim:"natação", walk:"caminhada", gym:"força", outro:"outro esporte"}[r.esporte] || "outro esporte";
  const dif = !!r.data && r.data !== k, difEsp = r.esporte !== "outro" && r.esporte !== t.k;
  ov.innerHTML = '<div class="dim" id="dim"></div><div class="sheet"><span class="grab"></span><h2 class="h2" style="font-size:1.7rem">Treino importado</h2>'+
    '<div class="big3"><div><b>'+(r.km ? num(r.km,1) : "—")+'</b><span>km</span></div><div><b>'+r.min+'</b><span>min</span></div><div><b>'+(r.paceMinKm && (r.esporte==="run" || r.esporte==="walk") ? paceTexto(r.paceMinKm) : "—")+'</b><span>/km</span></div></div>'+
    '<p class="s">'+esc(esp)+(r.data ? ' · '+esc(fmt(parseD(r.data))) : '')+(r.subidaM ? ' · subida '+r.subidaM+' m' : '')+(r.fcMedia ? ' · FC média '+r.fcMedia+(r.fcMax ? ' (máx '+r.fcMax+')' : '') : '')+'</p>'+
    (r.parcial ? '<div class="flag">O arquivo parece cortado, os números podem estar incompletos.</div>' : '')+
    (dif ? '<div class="flag red">O arquivo é de '+esc(fmt(parseD(r.data)))+' e este treino é de '+esc(fmt(d))+'.</div>' : '')+
    (difEsp ? '<div class="flag">O arquivo parece ser de '+esc(esp)+' e este treino é de '+esc(NOMEK[t.k] || t.k)+'.</div>' : '')+
    '<span class="k">como foi?</span><div class="seg" style="--c:4" id="rp">'+[["leve","Leve"],["ok","Ok"],["pesado","Pesado"],["limite","No limite"]].map(([v,l])=>'<button type="button" data-v="'+v+'" aria-pressed="'+(v===st.rpe)+'">'+l+'</button>').join("")+'</div>'+
    '<p class="s">O trajeto não é guardado, só estes números.</p><button type="button" class="btn go" id="svi">'+(dif || difEsp ? "Registrar mesmo assim" : "Registrar neste treino")+'</button></div>';
  $("dim").addEventListener("click", ()=>{ ov.innerHTML = ""; });
  $("rp").addEventListener("click", e=>{ const b = e.target.closest("button[data-v]"); if (!b) return; st.rpe = b.dataset.v; $("rp").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", String(x===b))); });
  $("svi").addEventListener("click", async ()=>{
    const antes = nivelAntes(), swim = t.k==="swim", km = swim ? 0 : r.km, metros = swim ? Math.round(r.km*1000) : 0;
    const comoPlano = swim ? (!t.m || metros>=t.m*0.85) : (!t.km || (km>=t.km*0.9 && km<=t.km*1.15));
    await salvarLog("ck_"+k+"_"+i, {at:new Date().toISOString(), rpe:st.rpe, km, m:metros||null, min:r.min, comoPlano, teste:false, junto:null, imp:{km:r.km, fc:r.fcMedia, sub:r.subidaM, pace:r.paceMinKm}});
    ov.innerHTML = ""; ir("treino","fim",a); checarNivel(antes);
  });
}
````

- [ ] **Step 2: Botão em `telaTreino`**

Em `telaTreino`, troque (texto único, confira com `grep -c 'id="fiz">Fiz o treino</button>' publicar.html` = 1) o trecho `'<button type="button" class="btn go" id="fiz">Fiz o treino</button>'` por:

````js
'<button type="button" class="btn go" id="fiz">Fiz o treino</button><button type="button" class="btn" id="imp">Importar do relógio ou Strava</button><input type="file" id="impf" accept=".gpx,.tcx,.fit,.gz,application/gzip" hidden><p class="s">GPX, TCX ou FIT, também compactado (.gz). Só guardo km, tempo, ritmo, subida e batimentos, nunca o trajeto. No Strava: abra a atividade, menu de três pontos, Exportar GPX.</p>'
````

E logo depois da linha `const f = $("fiz"); if (f) f.addEventListener("click", ()=>sheetFeito(a));` (única), acrescente na linha seguinte:

````js
  const ib = $("imp"), inf = $("impf"); if (ib && inf){ ib.addEventListener("click", ()=>inf.click()); inf.addEventListener("change", ()=>{ const fl = inf.files && inf.files[0]; inf.value = ""; if (fl) importarTreino(a, fl); }); }
````

- [ ] **Step 3: Conferir**

Run: `node --test tests/*.test.js`
Expected: PASS (88 testes). Run: `grep -c "function importarTreino" publicar.html` → 1.

- [ ] **Step 4: Commit**

```bash
git add publicar.html
git commit -m "feat: importar treino de GPX, TCX e FIT (com .gz) na tela do treino"
```

---

### Task 7: README e conferência final

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Atualizar o README**

Leia `README.md` e siga o estilo das seções das fases 2 e 3. Acrescente: (a) nas funcionalidades, "Grupos reais por código com desafio coletivo", "Parceiro de responsa (dupla com cutucada diária)" e "Importar treino de GPX, TCX e FIT (inclusive .gz)"; (b) em `tests/`, as funções novas (grupos, importação, FIT); (c) em pendências, que as regras de banco `grupos` e `grupos/{self}` precisam ser declaradas no publish e que o fluxo de grupos e a importação ainda não foram exercitados no app publicado.

- [ ] **Step 2: Rodar tudo**

Run: `node --test tests/*.test.js`
Expected: PASS (88 testes).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README da fase 4"
```
