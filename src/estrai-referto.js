// Estrae i dati anagrafici dal referto PDF di JB.
// È l'UNICA fonte del codice fiscale, quindi è il pezzo più importante
// per abbinare l'esame al paziente iscritto a IUCARE.

const fs = require("fs");
const pdfParse = require("pdf-parse");
const {
  normalizzaData,
  normalizzaCodiceFiscale,
  codiceFiscaleValido,
  separaNomeCognome,
  REGEX_CF,
} = require("./normalizza");

/**
 * Legge il testo del PDF e cerca i campi anagrafici.
 * @param {string} percorso - percorso del referto PDF
 */
async function estraiDaReferto(percorso) {
  const buf = fs.readFileSync(percorso);
  const dati = await pdfParse(buf);
  const testo = dati.text || "";

  // Codice fiscale: prima col prefisso "Codice Fiscale :", poi, se non trovato,
  // cercando un qualsiasi CF valido nel testo.
  let cf = "";
  const mCfEtichetta = testo.match(/Codice\s*Fiscale\s*:?\s*([A-Z0-9]{16})/i);
  if (mCfEtichetta) {
    cf = normalizzaCodiceFiscale(mCfEtichetta[1]);
  } else {
    const mCfLibero = testo.match(REGEX_CF);
    if (mCfLibero) cf = normalizzaCodiceFiscale(mCfLibero[0]);
  }

  // Data di nascita: "Nato il 16/09/1982" (gestisce anche "Natìo il", "Nata il")
  let dataNascita = "";
  const mNato = testo.match(/Nat[oìa]?o?\s*il\s*:?\s*(\d{2}[/\-.]\d{2}[/\-.]\d{4})/i);
  if (mNato) dataNascita = normalizzaData(mNato[1]);

  // Nome e cognome: "Sig. BOLLA DAVIDE" / "Sig.ra ..."
  let cognome = "";
  let nome = "";
  const mSig = testo.match(/Sig\.?(?:ra)?\.?\s+([A-ZÀ-Ù' ]{3,}?)\s*(?:\r?\n|Nat|Genere|Codice)/i);
  if (mSig) {
    const sep = separaNomeCognome(mSig[1].trim());
    cognome = sep.cognome;
    nome = sep.nome;
  }

  // Sesso: "Genere : M"
  let sesso = "";
  const mGen = testo.match(/Genere\s*:?\s*([MF])/i);
  if (mGen) sesso = mGen[1].toUpperCase();

  // Dati dell'esame, utili come riferimento nei log
  let dataEsame = "";
  const mEsame = testo.match(/Data\s*Esame\s*:?\s*(\d{2}[/\-.]\d{2}[/\-.]\d{4})/i);
  if (mEsame) dataEsame = normalizzaData(mEsame[1]);

  let numeroEsame = "";
  const mNum = testo.match(/Esame\s*N[°ro.\s]*\s*([\d.]+)/i);
  if (mNum) numeroEsame = mNum[1].replace(/\./g, "");

  return {
    fonte: "referto",
    file: percorso,
    codiceFiscale: cf,
    codiceFiscaleValido: codiceFiscaleValido(cf),
    cognome,
    nome,
    dataNascita,
    sesso,
    dataEsame,
    numeroEsame,
    testoGrezzo: testo, // tenuto per eventuale diagnosi, non esce nei log
  };
}

module.exports = { estraiDaReferto };
