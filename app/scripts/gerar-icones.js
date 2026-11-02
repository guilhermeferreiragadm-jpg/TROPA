const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const svg = fs.readFileSync(path.join(raiz, "icone.svg"));
fs.mkdirSync(path.join(raiz, "icones"), { recursive: true });

Promise.all([180, 192, 512].map(n =>
  sharp(svg).resize(n, n).png().toFile(path.join(raiz, "icones", "icone-" + n + ".png"))
)).then(() => console.log("ícones gerados em app/icones"));
