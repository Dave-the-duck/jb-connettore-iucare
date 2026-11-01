// Log per l'amministratore: una riga JSON per ogni esame elaborato.
// Serve a te (Davide) per controllare cosa è stato trasferito e cosa no, e perché.
//
// IMPORTANTE per la privacy: nel log NON scriviamo nome e cognome per esteso.
// Teniamo codice fiscale (serve a te per capire chi è) ed esito. Niente referti,
// niente immagini, niente testo del PDF.

const fs = require("fs");
const path = require("path");

const CARTELLA_LOG = path.join(__dirname, "..", "log");

function assicuraCartella() {
  if (!fs.existsSync(CARTELLA_LOG)) fs.mkdirSync(CARTELLA_LOG, { recursive: true });
}

/** Nome file log del giorno, es. 2026-11-01.log.jsonl */
function fileDelGiorno() {
  const oggi = new Date().toISOString().slice(0, 10);
  return path.join(CARTELLA_LOG, `${oggi}.log.jsonl`);
}

/**
 * Registra l'esito di un esame.
 * @param {object} pacchetto - da costruisciPacchetto()
 * @param {object} risultato - da abbina()
 */
function registra(pacchetto, risultato) {
  assicuraCartella();
  const riga = {
    quando: new Date().toISOString(),
    origine: pacchetto.origine,
    idEsameOrigine: pacchetto.idEsameOrigine,
    codiceFiscale: pacchetto.paziente.codiceFiscale || null,
    descrizioneEsame: pacchetto.esame.descrizione || null,
    dataEsame: pacchetto.esame.dataEsame || null,
    esito: risultato.esito,
    trasferito: risultato.esito === "abbinato",
    anomaliePacchetto: pacchetto.anomalie,
    motiviAbbinamento: risultato.motivi,
    // Per diagnosi: quanti file, ma non i percorsi completi (restano sul server)
    nReferti: pacchetto.referti.length,
    nImmagini: pacchetto.immagini.length,
  };
  fs.appendFileSync(fileDelGiorno(), JSON.stringify(riga) + "\n", "utf8");
  return riga;
}

module.exports = { registra, fileDelGiorno, CARTELLA_LOG };
