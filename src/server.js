// Sportello del connettore (Fase 3b, Opzione 1: "ponte sul tuo server").
//
// È un piccolo server HTTP che consegna i file di un esame all'app IUCARE,
// MA solo al paziente a cui l'esame appartiene. Non mette mai niente su
// Supabase: i file viaggiano JB → questo connettore → browser del paziente →
// Drive del paziente. Legge gli esami in SOLA LETTURA dalla cartella indicata.
//
// Come verifica che la richiesta è legittima:
//   1. l'app manda il token di sessione del paziente (Authorization: Bearer ...);
//   2. il connettore lo fa validare a Supabase (/auth/v1/user) e ottiene l'id utente;
//   3. col service role controlla che quell'esame sia davvero di quell'utente
//      (riga in esami_in_attesa con stesso utente_id, origine, id_esame_origine);
//   4. solo allora legge il referto dalla cartella e lo restituisce.
//
// Uso:  node --env-file-if-exists=.env src/server.js
// Variabili (.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CARTELLA_ESAMI,
//                   PORTA_CONNETTORE (default 8787), ORIGINE_APP (default http://localhost:3000)

const http = require("http");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { scansionaCartella } = require("./scansiona-cartella");
const { preparaCartella } = require("./prepara-esame");
const { costruisciPacchetto } = require("./costruisci-pacchetto");

const BASE = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CARTELLA_ESAMI = process.env.CARTELLA_ESAMI || process.argv[2] || "";
const PORTA = Number(process.env.PORTA_CONNETTORE || 8787);
const ORIGINE_APP = process.env.ORIGINE_APP || "http://localhost:3000";

if (!BASE || !SERVICE_ROLE) {
  console.error("Mancano SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY nel .env.");
  process.exit(1);
}
if (!CARTELLA_ESAMI) {
  console.error("Manca CARTELLA_ESAMI (nel .env o come primo argomento): la cartella degli esami da leggere.");
  process.exit(1);
}

/** Valida il token del paziente presso Supabase e restituisce l'utente (o null). */
async function utenteDalToken(appToken) {
  if (!appToken) return null;
  try {
    const r = await fetch(`${BASE}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${appToken}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch {
    return null;
  }
}

/** True se quell'esame appartiene davvero a quell'utente (controllo col service role). */
async function possiedeEsame(utenteId, origine, idEsame) {
  const q =
    `${BASE}/rest/v1/esami_in_attesa` +
    `?utente_id=eq.${encodeURIComponent(utenteId)}` +
    `&origine=eq.${encodeURIComponent(origine)}` +
    `&id_esame_origine=eq.${encodeURIComponent(idEsame)}` +
    `&select=id&limit=1`;
  try {
    const r = await fetch(q, { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } });
    if (!r.ok) return false;
    const righe = await r.json();
    return Array.isArray(righe) && righe.length > 0;
  } catch {
    return false;
  }
}

/** Le sottocartelle dirette di una cartella. */
function sottocartelle(radice) {
  try {
    return fs
      .readdirSync(radice, { withFileTypes: true })
      .filter((v) => v.isDirectory())
      .map((v) => path.join(radice, v.name));
  } catch {
    return [];
  }
}

/**
 * Cerca nella cartella degli esami quello con (origine, id) richiesti.
 * Prova la radice e ogni sua sottocartella (una cartella = un esame).
 * Restituisce { pacchetto, pulisci } con la cartella (eventualmente estratta
 * dallo zip) ANCORA presente: i file servono al chiamante, che deve chiamare
 * pulisci() quando ha finito di leggerli. Restituisce null se non lo trova.
 */
async function trovaEsame(origine, idEsame) {
  const candidati = [CARTELLA_ESAMI, ...sottocartelle(CARTELLA_ESAMI)];
  for (const cand of candidati) {
    const prep = preparaCartella(cand);
    let trovato = null;
    try {
      for (const grezzo of scansionaCartella(prep.cartella)) {
        const pacc = await costruisciPacchetto(grezzo);
        if (pacc.origine === origine && String(pacc.idEsameOrigine) === String(idEsame)) {
          trovato = { pacchetto: pacc, pulisci: prep.pulisci };
          break;
        }
      }
    } catch {
      /* cartella non leggibile: passo alla prossima */
    }
    if (trovato) return trovato; // NON pulisco: i file servono ancora al chiamante
    prep.pulisci(); // non è questa: libero subito la cartella temporanea
  }
  return null;
}

/** Impacchetta in uno zip (in memoria) i file DICOM indicati, con nomi senza collisioni. */
function zipDaFile(percorsi) {
  const zip = new AdmZip();
  const usati = new Set();
  percorsi.forEach((p, i) => {
    let nome = path.basename(p);
    if (usati.has(nome)) nome = `${i + 1}_${nome}`; // evita due file con lo stesso nome
    usati.add(nome);
    zip.addLocalFile(p, "", nome);
  });
  return zip.toBuffer();
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGINE_APP);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Max-Age", "600");
}

function json(res, codice, oggetto) {
  if (codice >= 400) console.log(`   → ${codice} ${oggetto.errore || ""}`);
  res.writeHead(codice, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(oggetto));
}

const server = http.createServer(async (req, res) => {
  console.log(`${new Date().toISOString()}  ${req.method} ${req.url}  (origine: ${req.headers.origin || "-"})`);
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORTA}`);

  if (req.method === "GET" && url.pathname === "/salute") {
    return json(res, 200, { ok: true });
  }

  // GET /esame/referto?origine=JB&id=<id_esame_origine>  → il referto in PDF
  // GET /esame/dicom?origine=JB&id=<id_esame_origine>    → uno zip con tutti i DICOM
  const vuoleReferto = url.pathname === "/esame/referto";
  const vuoleDicom = url.pathname === "/esame/dicom";
  if (req.method === "GET" && (vuoleReferto || vuoleDicom)) {
    const origine = url.searchParams.get("origine") || "";
    const idEsame = url.searchParams.get("id") || "";
    if (!origine || !idEsame) return json(res, 400, { errore: "Mancano i parametri origine e id." });

    // Chi chiede dev'essere il paziente (token valido) e proprietario dell'esame.
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const utente = await utenteDalToken(token);
    if (!utente) return json(res, 401, { errore: "Non autenticato." });
    if (!(await possiedeEsame(utente.id, origine, idEsame)))
      return json(res, 403, { errore: "Questo esame non risulta tuo." });

    const trovato = await trovaEsame(origine, idEsame);
    if (!trovato) return json(res, 404, { errore: "Esame non trovato nella cartella esami." });

    try {
      if (vuoleReferto) {
        const refPath = trovato.pacchetto.referti[0];
        const referto = refPath ? fs.readFileSync(refPath) : null; // in memoria PRIMA di pulire
        if (!referto) return json(res, 404, { errore: "Referto non trovato nella cartella esami." });
        console.log(`   → 200 referto consegnato (${referto.length} byte) a ${utente.email || utente.id}`);
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Length": referto.length,
          "Content-Disposition": 'inline; filename="Referto.pdf"',
        });
        return res.end(referto);
      }

      // vuoleDicom: impacchetto tutti i DICOM in uno zip (in memoria, PRIMA di pulire)
      const dicom = trovato.pacchetto.immagini || [];
      if (dicom.length === 0) return json(res, 404, { errore: "Nessuna immagine DICOM in questo esame." });
      const zip = zipDaFile(dicom);
      console.log(`   → 200 DICOM consegnati (${dicom.length} file, ${zip.length} byte) a ${utente.email || utente.id}`);
      res.writeHead(200, {
        "Content-Type": "application/zip",
        "Content-Length": zip.length,
        "Content-Disposition": 'attachment; filename="DICOM.zip"',
      });
      return res.end(zip);
    } finally {
      trovato.pulisci(); // ora che ho letto/zippato i file, libero la cartella temporanea
    }
  }

  return json(res, 404, { errore: "Risorsa non trovata." });
});

server.listen(PORTA, () => {
  console.log(`Sportello connettore in ascolto su http://localhost:${PORTA}`);
  console.log(`Cartella esami (sola lettura): ${CARTELLA_ESAMI}`);
  console.log(`Origine app ammessa (CORS): ${ORIGINE_APP}`);
});
