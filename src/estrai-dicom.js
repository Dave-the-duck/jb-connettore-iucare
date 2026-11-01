// Estrae i dati anagrafici e di studio da un file DICOM.
// Nota importante: nel DICOM di JB NON c'è il codice fiscale (il tag PatientID
// contiene l'ID interno del gestionale, es. "J1674"). Il CF arriva dal referto.

const fs = require("fs");
const dicomParser = require("dicom-parser");
const { separaNomeCognome, normalizzaData } = require("./normalizza");

/**
 * Legge un file .dcm e restituisce i campi che ci servono.
 * @param {string} percorso - percorso del file DICOM
 */
function estraiDaDicom(percorso) {
  const buf = fs.readFileSync(percorso);
  const ds = dicomParser.parseDicom(new Uint8Array(buf));

  const leggi = (tag) => {
    try {
      const v = ds.string(tag);
      return v === undefined ? "" : v.trim();
    } catch {
      return "";
    }
  };

  const nomeGrezzo = leggi("x00100010"); // PatientName "COGNOME^NOME"
  const { cognome, nome } = separaNomeCognome(nomeGrezzo);

  return {
    fonte: "dicom",
    file: percorso,
    cognome,
    nome,
    dataNascita: normalizzaData(leggi("x00100030")), // PatientBirthDate
    sesso: leggi("x00100040"), // PatientSex
    idInternoGestionale: leggi("x00100020"), // PatientID (NON è il CF)
    // dati dello studio: identificano univocamente l'esame
    studyInstanceUID: leggi("x0020000d"),
    accessionNumber: leggi("x00080050"),
    dataEsame: normalizzaData(leggi("x00080020")), // StudyDate
    descrizioneEsame: leggi("x00081030"), // StudyDescription
    modalita: leggi("x00080060"), // Modality (CR, CT, MR...)
    struttura: leggi("x00080080"), // InstitutionName
  };
}

module.exports = { estraiDaDicom };
