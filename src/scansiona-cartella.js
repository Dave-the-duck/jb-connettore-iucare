// Scansiona una cartella di esami e raggruppa i file in "esami grezzi":
// per ogni studio (StudyInstanceUID) i suoi file DICOM + il referto PDF.
//
// Riconosce un DICOM dal "magic number" DICM al byte 128, così non dipende
// dall'estensione (i file di JB si chiamano 00000001, senza .dcm).

const fs = require("fs");
const path = require("path");

/** Elenca ricorsivamente tutti i file dentro una cartella. */
function elencaFile(radice) {
  const risultato = [];
  for (const voce of fs.readdirSync(radice, { withFileTypes: true })) {
    const p = path.join(radice, voce.name);
    if (voce.isDirectory()) risultato.push(...elencaFile(p));
    else if (voce.isFile()) risultato.push(p);
  }
  return risultato;
}

/** True se il file è un DICOM (firma "DICM" al byte 128). */
function eDicom(percorso) {
  let fd;
  try {
    fd = fs.openSync(percorso, "r");
    const b = Buffer.alloc(4);
    fs.readSync(fd, b, 0, 4, 128); // "DICM" sta subito dopo il preambolo di 128 byte
    return b.toString("ascii") === "DICM";
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Sceglie il referto "firmato" se c'è, altrimenti il primo PDF sensato. */
function scegliReferto(pdf) {
  if (pdf.length === 0) return null;
  const perPriorita = (p) => {
    const n = path.basename(p).toLowerCase();
    if (n.includes("signed") || n.includes("firmat")) return 0; // referto firmato
    if (n.includes("referto") || n.includes("report")) return 1;
    return 2;
  };
  return [...pdf].sort((a, b) => perPriorita(a) - perPriorita(b))[0];
}

const dicomParser = require("dicom-parser");
function studyUID(percorso) {
  try {
    const ds = dicomParser.parseDicom(new Uint8Array(fs.readFileSync(percorso)));
    return (ds.string("x0020000d") || "").trim();
  } catch {
    return "";
  }
}

/**
 * @param {string} cartella - cartella di un esame già estratto (no zip)
 * @returns {Array} esami grezzi: { studyInstanceUID, fileDicom[], refertoPdf }
 */
function scansionaCartella(cartella) {
  const tutti = elencaFile(cartella);
  // DICOMDIR è l'indice del CD, non un'immagine: va escluso anche se ha la firma DICM.
  const dicom = tutti.filter((p) => path.basename(p).toUpperCase() !== "DICOMDIR" && eDicom(p));
  const pdf = tutti.filter((p) => path.extname(p).toLowerCase() === ".pdf");
  const referto = scegliReferto(pdf);

  // Raggruppo i DICOM per studio
  const perStudio = new Map();
  for (const d of dicom) {
    const uid = studyUID(d) || "SENZA-UID";
    if (!perStudio.has(uid)) perStudio.set(uid, []);
    perStudio.get(uid).push(d);
  }

  const esami = [];
  for (const [uid, fileDicom] of perStudio) {
    esami.push({
      studyInstanceUID: uid,
      fileDicom,
      refertoPdf: referto, // in una cartella = un esame; con più studi va raffinato
      cartella,
    });
  }
  return esami;
}

module.exports = { scansionaCartella, eDicom, elencaFile };
