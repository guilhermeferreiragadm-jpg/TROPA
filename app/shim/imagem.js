// Reduz fotos no navegador antes de mandar para a função da IA (celular tira foto de vários MB).
function dimensoes(w, h, max) {
  const maior = Math.max(w, h);
  if (maior <= max) return { w, h };
  const f = max / maior;
  return { w: Math.round(w * f), h: Math.round(h * f) };
}

async function reduzirParaBase64(blob, max = 1280, qualidade = 0.8) {
  const bmp = await createImageBitmap(blob);
  const { w, h } = dimensoes(bmp.width, bmp.height, max);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff";   // PNG com transparência vira fundo branco no JPEG, não preto
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();   // libera a memória da foto original (celular)
  const url = cv.toDataURL("image/jpeg", qualidade);
  return { tipo: "image/jpeg", base64: url.slice(url.indexOf(",") + 1) };
}

module.exports = { dimensoes, reduzirParaBase64 };
