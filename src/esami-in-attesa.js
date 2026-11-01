// Registra un "esame in attesa" per un paziente abbinato.
// NON contiene il referto né le immagini né il codice fiscale in chiaro:
// solo il riferimento all'esame sul portale e pochi metadati. Il file vero
// verrà scaricato dall'app del paziente, al momento, direttamente dal portale.
//
// In locale scrive su un file JSON (log/esami-in-attesa.json) così vedi il
// risultato. In Fase 2 la stessa funzione farà un insert nella tabella
// esami_in_attesa di Supabase.

const fs = require("fs");
const path = require("path");

const FILE_LOCALE = path.join(__dirname, "..", "log", "esami-in-attesa.json");

function leggiLocale() {
  try {
    return JSON.parse(fs.readFileSync(FILE_LOCALE, "utf8"));
  } catch {
    return [];
  }
}

/**
 * @param {object} profilo - l'iscritto abbinato (da fonteProfili)
 * @param {object} pacchetto - il pacchetto normalizzato dell'esame
 * @returns {object} la riga registrata
 */
function registraInAttesaLocale(profilo, pacchetto) {
  const righe = leggiLocale();
  const riga = {
    utenteId: profilo.id,
    origine: pacchetto.origine,
    idEsameOrigine: pacchetto.idEsameOrigine,
    riferimentoPortale: pacchetto.esame.studyInstanceUID, // da dove ripescare i file
    descrizione: pacchetto.esame.descrizione,
    dataEsame: pacchetto.esame.dataEsame,
    nImmagini: pacchetto.immagini.length,
    nReferti: pacchetto.referti.length,
    stato: "in_attesa",
    creatoIl: new Date().toISOString(),
  };
  // evita doppioni sullo stesso esame per lo stesso utente
  const esiste = righe.some(
    (r) => r.utenteId === riga.utenteId && r.idEsameOrigine === riga.idEsameOrigine
  );
  if (!esiste) {
    righe.push(riga);
    fs.writeFileSync(FILE_LOCALE, JSON.stringify(righe, null, 2), "utf8");
  }
  return { riga, giaPresente: esiste };
}

module.exports = { registraInAttesaLocale, FILE_LOCALE };
