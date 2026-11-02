const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const fonte = fs.readFileSync(path.join(raiz, "icone.png"));   // 1024x1024, quadrado cheio (o iOS arredonda sozinho)
fs.mkdirSync(path.join(raiz, "icones"), { recursive: true });

Promise.all([180, 192, 512].map(n =>
  sharp(fonte).resize(n, n).png().toFile(path.join(raiz, "icones", "icone-" + n + ".png"))
)).then(() => console.log("ícones gerados em app/icones"));
