# Idee e nodi da sciogliere — connettore JB → IUCARE

## Il nodo vero: scrivere nel Google Drive del paziente

Il consenso che il paziente firma su carta in JB è la **base legale** (autorizza
JB a mandare gli esami a IUCARE), ma **non** è il permesso tecnico di Google.
Per scrivere nella cartella IUCARE del Drive del paziente serve che il paziente
abbia dato a IUCARE un'**autorizzazione OAuth con accesso offline** (un
*refresh token*), che l'app conserva per poter caricare file anche quando il
paziente non è online.

Oggi IUCARE usa lo scope `drive.file` dal browser del paziente (token che dura
poco). Opzioni per la Fase 3:

1. **Refresh token per paziente** (consigliata): quando il paziente collega il
   Drive, IUCARE chiede l'accesso *offline* e conserva il refresh token (cifrato,
   lato server). Il connettore lo usa per caricare. Da valutare con la
   verifica Google (CASA) perché l'app diventa "server-side".
2. **Cartella condivisa IUCARE → paziente**: gli esami arrivano in un Drive di
   IUCARE e vengono condivisi col paziente. Più semplice tecnicamente, ma i file
   non sono "del paziente" e cambia il modello privacy che abbiamo raccontato.

Decisione da prendere con Davide prima della Fase 3.

## Formato JB: cose imparate dal campione

- Codice fiscale **solo nel referto PDF**, mai nel DICOM.
- Il referto esiste in più copie: `PS/Report_Signed.pdf` (firmato, da usare),
  `Report_Unsigned.pdf`, e `CDPatient/Referto.pdf`.
- L'esame arriva come cartella `Folder<data><ora>_<id>` con dentro uno **zip**
  (il CD completo) e una cartella `CDPatient` col referto. Da capire come si
  presenta la cartella sul portale Contabo: zip già pronti? estratti?
- ID studio (`StudyInstanceUID`) e `AccessionNumber` identificano l'esame: utili
  per non trasferire due volte lo stesso.

## Evitare i doppioni

Tenere un piccolo archivio degli esami già trasferiti (per `idEsameOrigine` +
`StudyInstanceUID`), così le scansioni ripetute nella giornata non ricaricano
sempre gli stessi file.

## Log e privacy

I log servono a Davide amministratore per controllare errori. Contengono il
codice fiscale (serve a capire chi è) ma **non** nome/cognome per esteso, né i
referti, né le immagini. Restano sul server, non nel repository.

## Vincolo importante sul server Contabo

Su Contabo si può **solo leggere e prelevare** i file degli esami: **non si può
scrivere né modificare nulla** sul server, e quindi nemmeno installarci il
connettore. Conseguenza: il connettore **non gira dentro Contabo**, ma **fuori**
(PC di Davide o un piccolo server separato) e accede al portale in **sola
lettura** (es. SFTP/SCP in lettura o l'HTTPS del portale). Questo è compatibile
col Modello C, che su Contabo non scrive mai: legge gli esami e scrive solo su
Supabase e sul Drive del paziente, che stanno altrove.

## Da chiarire con JB / sul portale

- Come si accede in **lettura** alla cartella sul server Contabo (SFTP? HTTPS?).
- Ogni quanto arrivano nuovi esami e con quale struttura di cartelle.
- Se esiste già un database/indice degli esami sul portale (eviterebbe di
  scandire le cartelle a tappeto).
