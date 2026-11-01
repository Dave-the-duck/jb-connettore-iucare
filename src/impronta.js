// "Impronta" del codice fiscale: un hash che permette di abbinare un esame a un
// paziente SENZA conservare il codice fiscale in chiaro nel database centrale.
//
// È un HMAC-SHA256: data la stessa chiave segreta, lo stesso CF produce sempre
// la stessa impronta, ma dall'impronta NON si risale al codice fiscale.
// La STESSA chiave deve essere usata dall'app IUCARE (quando salva l'impronta)
// e dal connettore (quando cerca l'abbinamento): altrimenti le impronte non
// combaciano. Si tiene nelle variabili d'ambiente, mai nel codice.

const crypto = require("crypto");
const { normalizzaCodiceFiscale } = require("./normalizza");

/**
 * Calcola l'impronta di un codice fiscale.
 * @param {string} codiceFiscale
 * @param {string} chiaveSegreta - la stessa su app e connettore (env IUCARE_CF_SECRET)
 * @returns {string} impronta esadecimale (64 caratteri), o "" se manca il CF
 */
function improntaCodiceFiscale(codiceFiscale, chiaveSegreta) {
  const cf = normalizzaCodiceFiscale(codiceFiscale);
  if (!cf) return "";
  if (!chiaveSegreta) throw new Error("Manca la chiave segreta per l'impronta (IUCARE_CF_SECRET).");
  return crypto.createHmac("sha256", chiaveSegreta).update(cf).digest("hex");
}

module.exports = { improntaCodiceFiscale };
