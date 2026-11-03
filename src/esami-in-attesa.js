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

/**
 * Versione REALE (Fase 2 "collegata"): inserisce la riga nella tabella
 * esami_in_attesa di Supabase, con il service role. L'anti-doppione lo fa il
 * database (vincolo unico utente+origine+id esame): se l'esame c'è già, non
 * viene reinserito e non dà errore.
 *
 * @param {object} profilo - l'iscritto abbinato (ha .id)
 * @param {object} pacchetto - il pacchetto normalizzato dell'esame
 * @param {object} opzioni - { url, serviceRoleKey } da variabili d'ambiente
 * @returns {Promise<{riga: object, giaPresente: boolean}>}
 */
async function registraInAttesaSupabase(profilo, pacchetto, { url, serviceRoleKey } = {}) {
  if (!url || !serviceRoleKey) {
    throw new Error("registraInAttesaSupabase: mancano SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  const base = url.replace(/\/+$/, "");
  const riga = {
    utente_id: profilo.id,
    origine: pacchetto.origine,
    id_esame_origine: pacchetto.idEsameOrigine,
    riferimento_portale: pacchetto.esame.studyInstanceUID || null,
    descrizione: pacchetto.esame.descrizione || null,
    data_esame: pacchetto.esame.dataEsame || null,
    n_immagini: pacchetto.immagini.length,
    n_referti: pacchetto.referti.length,
  };
  const endpoint = `${base}/rest/v1/esami_in_attesa?on_conflict=utente_id,origine,id_esame_origine`;
  const risposta = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      // ignore-duplicates: se l'esame c'è già, non lo tocca (resta anche lo stato 'consegnato')
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify(riga),
  });
  if (!risposta.ok) {
    const testo = await risposta.text().catch(() => "");
    throw new Error(`Supabase (esami_in_attesa) ha risposto ${risposta.status}: ${testo.slice(0, 200)}`);
  }
  const righe = await risposta.json().catch(() => []);
  const inserita = Array.isArray(righe) && righe.length > 0;
  return { riga, giaPresente: !inserita };
}

module.exports = { registraInAttesaLocale, registraInAttesaSupabase, FILE_LOCALE };
