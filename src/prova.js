// Prova completa Fase 2, in locale, con dati di prova.
// Scansiona una cartella di esami, costruisce i pacchetti, calcola l'IMPRONTA
// del codice fiscale, abbina ai profili (finti) tramite impronta, registra
// l'"esame in attesa" e simula l'email. Non tocca Supabase né Google Drive.
//
// Uso:  node src/prova.js "C:\\percorso\\cartella-esame"

const fs = require("fs");
const path = require("path");
const { scansionaCartella } = require("./scansiona-cartella");
const { costruisciPacchetto } = require("./costruisci-pacchetto");
const { improntaCodiceFiscale } = require("./impronta");
const { fonteProfiliFinta, fonteProfiliSupabase } = require("./fonte-profili");
const { registraInAttesaLocale, registraInAttesaSupabase } = require("./esami-in-attesa");
const { inviaEmail } = require("./notifica-email");
const { registra, fileDelGiorno } = require("./log");

const CARTELLA_PROVA =
  "C:\\Users\\david\\AppData\\Local\\Temp\\claude\\c--Users-david-Documents-GitHub-IUCARE\\2527fde5-59ea-4e02-ae4e-ad7b2d6ec1ff\\scratchpad\\jb-campione";

const PROFILI = path.join(__dirname, "..", "dati-prova", "profili-finti.json");

// In produzione questa chiave sta SOLO nelle variabili d'ambiente, uguale su
// app IUCARE e connettore. Qui un valore di prova per far girare il test.
const CHIAVE = process.env.IUCARE_CF_SECRET || "chiave-di-prova-solo-locale";

const URL_SUPABASE = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const cartella = process.argv[2] || CARTELLA_PROVA;

  // Fonte dei profili: se nelle variabili d'ambiente ci sono le chiavi di Supabase
  // si cerca nel DATABASE VERO; altrimenti si usano i profili finti (prova locale).
  let fonte;
  let descrizioneFonte;
  if (URL_SUPABASE && SERVICE_ROLE) {
    fonte = fonteProfiliSupabase({ url: URL_SUPABASE, serviceRoleKey: SERVICE_ROLE });
    descrizioneFonte = "Supabase (database vero)";
    if (CHIAVE === "chiave-di-prova-solo-locale") {
      console.log("⚠  ATTENZIONE: stai usando Supabase vero ma la CHIAVE è quella di prova.");
      console.log("   L'impronta NON combacerà con quella salvata dall'app: imposta IUCARE_CF_SECRET");
      console.log("   nel file .env con lo STESSO valore dell'app IUCARE.\n");
    }
  } else {
    const profiliProva = JSON.parse(fs.readFileSync(PROFILI, "utf8"));
    fonte = fonteProfiliFinta(profiliProva, CHIAVE);
    descrizioneFonte = `finti (${profiliProva.length} profili di prova)`;
  }

  console.log("Cartella esami:", cartella);
  console.log("Fonte profili:", descrizioneFonte);
  console.log("Chiave impronta:", CHIAVE === "chiave-di-prova-solo-locale" ? "(di prova)" : "(da ambiente)", "\n");

  const esami = scansionaCartella(cartella);
  console.log("Esami trovati:", esami.length, "\n");

  for (const grezzo of esami) {
    const pacchetto = await costruisciPacchetto(grezzo);
    const imp = improntaCodiceFiscale(pacchetto.paziente.codiceFiscale, CHIAVE);
    const profilo = imp ? await fonte.cercaPerImpronta(imp) : null;

    console.log("────────────────────────────────────────────");
    console.log("Esame:", pacchetto.esame.descrizione, "|", pacchetto.esame.dataEsame);
    console.log("Paziente nell'esame:",
      pacchetto.paziente.cognome, pacchetto.paziente.nome,
      "| nato:", pacchetto.paziente.dataNascita);
    console.log("Impronta CF:", imp ? imp.slice(0, 16) + "…" : "(CF mancante)");
    if (pacchetto.anomalie.length) console.log("Anomalie:", pacchetto.anomalie);

    let esito;
    let risultato = { esito: "", motivi: [], iscritto: profilo };

    if (!imp) {
      esito = "cf-mancante";
      risultato.motivi = ["Nessun codice fiscale nel referto."];
    } else if (!profilo) {
      esito = "nessun-iscritto";
      risultato.motivi = ["Nessun profilo IUCARE con questa impronta."];
    } else {
      esito = "abbinato";
      risultato.motivi = ["Abbinato per impronta del codice fiscale."];
      // Se siamo collegati a Supabase, scrive nella tabella vera; altrimenti nel file locale.
      const { giaPresente } =
        URL_SUPABASE && SERVICE_ROLE
          ? await registraInAttesaSupabase(profilo, pacchetto, { url: URL_SUPABASE, serviceRoleKey: SERVICE_ROLE })
          : registraInAttesaLocale(profilo, pacchetto);
      const mail = await inviaEmail(profilo);
      console.log("ABBINATO →", profilo.email, giaPresente ? "(esame già in attesa, non duplicato)" : "(registrato esame in attesa)");
      console.log("  Email", mail.simulata ? "SIMULATA" : "inviata", "a", mail.a, "— oggetto:", JSON.stringify(mail.oggetto));
    }
    risultato.esito = esito;
    console.log("ESITO:", esito.toUpperCase());
    if (esito !== "abbinato") console.log("  motivo:", risultato.motivi.join(" "));

    registra(pacchetto, risultato);
  }

  console.log("\n✓ Log esiti:", fileDelGiorno());
  console.log(
    "✓ Esami in attesa:",
    URL_SUPABASE && SERVICE_ROLE
      ? "tabella esami_in_attesa su Supabase"
      : path.join(__dirname, "..", "log", "esami-in-attesa.json")
  );
}

main().catch((e) => {
  console.error("Errore:", e);
  process.exit(1);
});
