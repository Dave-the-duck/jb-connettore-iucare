// Abbina un pacchetto normalizzato a un paziente iscritto a IUCARE.
//
// Regola di sicurezza: l'abbinamento parte dal CODICE FISCALE (chiave forte),
// poi CONFERMA con cognome + nome + data di nascita. Se il CF trova un iscritto
// ma gli altri dati non coincidono, NON si trasferisce: si segnala l'anomalia.
// Meglio un esame non consegnato che consegnato alla persona sbagliata.

const { normalizzaTesto, normalizzaCodiceFiscale } = require("./normalizza");

/**
 * @param {object} pacchetto - da costruisciPacchetto()
 * @param {Array} iscritti - registro iscritti IUCARE: [{ nome, cognome, codiceFiscale, dataNascita, driveCartellaId, email }]
 * @returns {object} esito dell'abbinamento
 */
function abbina(pacchetto, iscritti) {
  const p = pacchetto.paziente;
  const cf = normalizzaCodiceFiscale(p.codiceFiscale);

  if (!cf) {
    return { esito: "cf-mancante", iscritto: null, motivi: ["Pacchetto senza codice fiscale."] };
  }

  const candidato = iscritti.find(
    (i) => normalizzaCodiceFiscale(i.codiceFiscale) === cf
  );

  if (!candidato) {
    return {
      esito: "nessun-iscritto",
      iscritto: null,
      motivi: [`Nessun paziente IUCARE con codice fiscale ${cf}.`],
    };
  }

  // Conferma incrociata
  const motivi = [];
  if (normalizzaTesto(candidato.cognome) !== normalizzaTesto(p.cognome))
    motivi.push(`Cognome: IUCARE "${candidato.cognome}" vs esame "${p.cognome}".`);
  if (normalizzaTesto(candidato.nome) !== normalizzaTesto(p.nome))
    motivi.push(`Nome: IUCARE "${candidato.nome}" vs esame "${p.nome}".`);
  if ((candidato.dataNascita || "") !== (p.dataNascita || ""))
    motivi.push(`Data di nascita: IUCARE "${candidato.dataNascita}" vs esame "${p.dataNascita}".`);

  if (motivi.length > 0) {
    return { esito: "dati-non-coerenti", iscritto: candidato, motivi };
  }

  return {
    esito: "abbinato",
    iscritto: candidato,
    motivi: [`Abbinato per codice fiscale e confermato con cognome, nome e data di nascita.`],
  };
}

module.exports = { abbina };
