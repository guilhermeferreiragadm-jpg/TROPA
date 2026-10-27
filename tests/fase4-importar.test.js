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
