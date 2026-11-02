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
  cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const url = cv.toDataURL("image/jpeg", qualidade);
  return { tipo: "image/jpeg", base64: url.slice(url.indexOf(",") + 1) };
}

module.exports = { dimensoes, reduzirParaBase64 };
