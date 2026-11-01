// Unisce i dati del DICOM e del referto in un unico "pacchetto normalizzato".
// Questo è il formato stabile che il lato IUCARE conosce: se un domani cambi
// gestionale, riscrivi solo gli estrattori, non questo pacchetto.

const { estraiDaDicom } = require("./estrai-dicom");
const { estraiDaReferto } = require("./estrai-referto");

/**
 * @param {object} esameGrezzo - da scansionaCartella(): { fileDicom[], refertoPdf, studyInstanceUID }
 * @returns {object} pacchetto normalizzato + elenco anomalie
 */
async function costruisciPacchetto(esameGrezzo) {
  const anomalie = [];

  // --- DICOM (primo file come riferimento anagrafico) ---
  let dicom = null;
  if (esameGrezzo.fileDicom && esameGrezzo.fileDicom.length > 0) {
    dicom = estraiDaDicom(esameGrezzo.fileDicom[0]);
  } else {
    anomalie.push("Nessun file DICOM nell'esame.");
  }

  // --- Referto PDF (unica fonte del codice fiscale) ---
  let referto = null;
  if (esameGrezzo.refertoPdf) {
    referto = await estraiDaReferto(esameGrezzo.refertoPdf);
  } else {
    anomalie.push("Referto PDF mancante: senza referto non c'è il codice fiscale.");
  }

  // --- Anagrafica unita: CF dal referto, resto con conferma incrociata ---
  const codiceFiscale = referto ? referto.codiceFiscale : "";
  if (!codiceFiscale) anomalie.push("Codice fiscale non trovato nel referto.");
  else if (referto && !referto.codiceFiscaleValido)
    anomalie.push(`Codice fiscale di forma non valida: ${codiceFiscale}.`);

  const cognome = (referto && referto.cognome) || (dicom && dicom.cognome) || "";
  const nome = (referto && referto.nome) || (dicom && dicom.nome) || "";
  const dataNascita = (referto && referto.dataNascita) || (dicom && dicom.dataNascita) || "";
  const sesso = (referto && referto.sesso) || (dicom && dicom.sesso) || "";

  // --- Conferme incrociate DICOM vs referto ---
  if (dicom && referto) {
    if (dicom.cognome && referto.cognome && dicom.cognome !== referto.cognome)
      anomalie.push(`Cognome diverso tra DICOM (${dicom.cognome}) e referto (${referto.cognome}).`);
    if (dicom.nome && referto.nome && dicom.nome !== referto.nome)
      anomalie.push(`Nome diverso tra DICOM (${dicom.nome}) e referto (${referto.nome}).`);
    if (dicom.dataNascita && referto.dataNascita && dicom.dataNascita !== referto.dataNascita)
      anomalie.push(`Data di nascita diversa tra DICOM (${dicom.dataNascita}) e referto (${referto.dataNascita}).`);
  }

  const idEsameOrigine =
    (dicom && (dicom.accessionNumber || dicom.studyInstanceUID)) ||
    esameGrezzo.studyInstanceUID ||
    "";

  return {
    origine: "JB",
    idEsameOrigine,
    paziente: { nome, cognome, codiceFiscale, dataNascita, sesso },
    esame: {
      descrizione: (dicom && dicom.descrizioneEsame) || "",
      modalita: (dicom && dicom.modalita) || "",
      dataEsame: (dicom && dicom.dataEsame) || (referto && referto.dataEsame) || "",
      struttura: (dicom && dicom.struttura) || "",
      studyInstanceUID: esameGrezzo.studyInstanceUID || (dicom && dicom.studyInstanceUID) || "",
    },
    referti: esameGrezzo.refertoPdf ? [esameGrezzo.refertoPdf] : [],
    immagini: esameGrezzo.fileDicom || [],
    anomalie,
  };
}

module.exports = { costruisciPacchetto };
