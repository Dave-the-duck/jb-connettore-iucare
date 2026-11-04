// Prepara una cartella d'esame per lo scanner.
//
// JB consegna ogni esame come una cartella "Folder<data>_<id>" che contiene
// uno ZIP del CD (dentro: DICOM/ e il referto PS/Report_Signed.pdf). Lo scanner
// legge file su disco, non dentro gli zip: qui scompattiamo gli eventuali zip
// in una cartella temporanea e restituiamo quella da scansionare.
//
// Non tocca mai la cartella d'origine (coerente con la regola "sola lettura"
// sul server JB): scrive solo in una temporanea nostra, che poi ripuliamo.

const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");
const { elencaFile } = require("./scansiona-cartella");

/**
 * @param {string} cartella - cartella dell'esame (può contenere uno o più .zip)
 * @returns {{ cartella: string, pulisci: () => void }}
 *   `cartella`: quella da passare a scansionaCartella (la temporanea se c'erano zip,
 *   altrimenti l'originale). `pulisci()`: rimuove la temporanea (no-op se non creata).
 */
function preparaCartella(cartella) {
  const zip = elencaFile(cartella).filter((p) => path.extname(p).toLowerCase() === ".zip");
  if (zip.length === 0) return { cartella, pulisci: () => {} };

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "jb-esame-"));
  for (const z of zip) {
    new AdmZip(z).extractAllTo(temp, /* overwrite */ true);
  }
  return {
    cartella: temp,
    pulisci: () => {
      try {
        fs.rmSync(temp, { recursive: true, force: true });
      } catch {
        /* se non riesce a cancellare la temporanea, pazienza: non è grave */
      }
    },
  };
}

module.exports = { preparaCartella };
