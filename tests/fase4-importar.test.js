// Rodar: node --test tests/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "publicar.html"), "utf8");
const trecho = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); assert.ok(i >= 0 && j > i, "marcador não achado: " + a); return html.slice(i, j + b.length); };
const ajudas = trecho("const DAY = 864e5;", "const dow = d => (d.getDay()+6)%7;");
const puro = trecho("/* @pure:start */", "/* @pure:end */");
const F = new Function(ajudas + "\n" + puro + "\nreturn {lerGPX, lerTCX, lerFIT, crcFIT, esporteDoApp, resumirAtividade, validarAtividade, paceTexto};")();


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
