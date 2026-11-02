// Uso: GOOGLE_APPLICATION_CREDENTIALS=/caminho/chave-service-account.json node functions/scripts/definir-dono.js email@exemplo.com
// Dá o papel de dono (custom claim owner=true) à conta com esse e-mail. A pessoa precisa entrar no app de novo.
const admin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");

async function main() {
  const email = process.argv[2];
  if (!email) { console.error("Passe o e-mail da conta do dono."); process.exit(1); }
  admin.initializeApp();
  const u = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(u.uid, { owner: true });
  console.log("Pronto. uid " + u.uid + " agora é o dono. Feche e abra o app para valer.");
}
main().catch(e => { console.error(e.message); process.exit(1); });
