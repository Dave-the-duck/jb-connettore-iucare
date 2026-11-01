// Avvisa il paziente via email che c'è un nuovo documento.
// REGOLA: niente contenuto medico nella mail (né tipo esame né diagnosi).
// Solo "c'è un nuovo documento, accedi per vederlo".
//
// Per ora è SIMULATA: stampa cosa invierebbe, senza chiamare nessun servizio.
// In Fase 2 si collega un provider (Resend o Brevo) con una chiave in env.

const APP_URL = process.env.IUCARE_APP_URL || "https://youcare-five.vercel.app";

function testoEmail() {
  return {
    oggetto: "IUCARE — hai un nuovo documento",
    corpo:
      "Ciao,\n\n" +
      "è disponibile un nuovo documento nella tua area IUCARE.\n" +
      `Accedi per vederlo: ${APP_URL}\n\n` +
      "Questo messaggio non contiene dati clinici per tua sicurezza.\n" +
      "Il team IUCARE",
  };
}

/**
 * @param {object} profilo - deve avere .email
 * @returns {object} esito dell'invio
 */
async function inviaEmail(profilo) {
  const { oggetto, corpo } = testoEmail();
  const provider = process.env.IUCARE_EMAIL_PROVIDER; // es. "resend" (non attivo)

  if (!provider) {
    // Modalità prova: non invia davvero, mostra solo cosa farebbe.
    return {
      inviata: false,
      simulata: true,
      a: profilo.email,
      oggetto,
      corpo,
    };
  }

  // Fase 2: qui andrà la chiamata al provider (Resend/Brevo) con la sua API key.
  throw new Error(`Provider email "${provider}" non ancora collegato.`);
}

module.exports = { inviaEmail, testoEmail };
