// Funzioni di pulizia e normalizzazione dei dati anagrafici.
// Servono perché JB scrive gli stessi dati in formati diversi tra DICOM e PDF
// (es. data "19820916" nel DICOM, "16/09/1982" nel referto): qui li portiamo
// tutti a un formato unico, così il confronto è affidabile.

/** Toglie accenti, spazi doppi e porta in MAIUSCOLO per confrontare nomi. */
function normalizzaTesto(s) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // toglie gli accenti
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** "BOLLA^DAVIDE" (DICOM) o "BOLLA DAVIDE" (PDF) -> { cognome, nome }. */
function separaNomeCognome(grezzo) {
  if (!grezzo) return { cognome: "", nome: "" };
  let parti;
  if (grezzo.includes("^")) {
    parti = grezzo.split("^"); // formato DICOM: Cognome^Nome^...
  } else {
    parti = grezzo.trim().split(/\s+/); // formato PDF: "COGNOME NOME"
  }
  const cognome = normalizzaTesto(parti[0] || "");
  const nome = normalizzaTesto(parti.slice(1).join(" "));
  return { cognome, nome };
}

/** Qualsiasi data riconoscibile -> "YYYY-MM-DD" (o "" se non interpretabile). */
function normalizzaData(s) {
  if (!s) return "";
  const t = s.trim();
  // DICOM: YYYYMMDD
  let m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // PDF: DD/MM/YYYY o DD-MM-YYYY
  m = t.match(/^(\d{2})[/\-.](\d{2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // Già in formato ISO
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "";
}

/** Codice fiscale: toglie spazi, maiuscolo. Non valida, solo pulisce. */
function normalizzaCodiceFiscale(s) {
  if (!s) return "";
  return s.replace(/\s+/g, "").toUpperCase();
}

/** Controllo di forma del codice fiscale (16 caratteri, schema standard). */
const REGEX_CF = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;
function codiceFiscaleValido(cf) {
  return REGEX_CF.test(normalizzaCodiceFiscale(cf));
}

module.exports = {
  normalizzaTesto,
  separaNomeCognome,
  normalizzaData,
  normalizzaCodiceFiscale,
  codiceFiscaleValido,
  REGEX_CF,
};
