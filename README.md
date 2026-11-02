# Connettore JB Medica → IUCARE

Collega il gestionale **JB Medica** a **IUCARE**: legge gli esami caricati sul
portale (immagini DICOM + referto PDF), li abbina al paziente iscritto a IUCARE
e — nella fase finale — li trasferisce nella cartella IUCARE del suo Google Drive.

È pensato come **integrazione staccabile**: se un domani Davide cambia partner con
un gestionale diverso, si riscrive solo la parte di *lettura* (gli estrattori),
mentre il pacchetto normalizzato e il lato IUCARE restano uguali.

## Com'è fatto (a strati)

```
Portale JB (cartella esami)
        │
        ▼
[ connettore JB ]   ← specifico di JB, sostituibile
  scansiona-cartella.js   trova DICOM + referto e li raggruppa per esame
  estrai-dicom.js         legge nome, data nascita, sesso, ID studio dal DICOM
  estrai-referto.js       legge il CODICE FISCALE (+ anagrafica) dal referto PDF
  normalizza.js           uniforma date, nomi, codice fiscale
  costruisci-pacchetto.js unisce le due fonti e le incrocia
        │
        ▼
  PACCHETTO NORMALIZZATO   ← formato stabile che IUCARE conosce
        │
        ▼
[ nucleo IUCARE ]   ← stabile, indipendente dal gestionale
  abbina.js               cerca l'iscritto per codice fiscale e conferma i dati
  log.js                  registra ogni esito per l'amministratore
  (prossimo) trasferisci  carica referto + immagini nel Drive del paziente
```

## Scoperta chiave sul formato JB

- Nel **DICOM** c'è nome, cognome, data di nascita, sesso, ma **NON il codice
  fiscale** (il tag `PatientID` contiene l'ID interno di JB, es. `J1674`).
- Il **codice fiscale** si trova **solo nel referto PDF**.
- Perciò l'abbinamento usa **sempre tutte e due le fonti**: CF dal referto,
  conferma con nome + cognome + data di nascita incrociati tra DICOM, referto e
  profilo IUCARE.

## Regola di sicurezza dell'abbinamento

1. Si parte dal **codice fiscale** (chiave forte).
2. Si **conferma** con cognome + nome + data di nascita.
3. Se il CF trova un iscritto ma gli altri dati non coincidono → **non si
   trasferisce**, si segnala l'anomalia nel log. Meglio un esame non consegnato
   che consegnato alla persona sbagliata.

## Pacchetto normalizzato

```json
{
  "origine": "JB",
  "idEsameOrigine": "50022025",
  "paziente": { "nome": "DAVIDE", "cognome": "BOLLA",
                "codiceFiscale": "BLLDVD82P16D969S",
                "dataNascita": "1982-09-16", "sesso": "M" },
  "esame": { "descrizione": "RX GINOCCHIO DX", "modalita": "CR",
             "dataEsame": "2025-05-15", "struttura": "JB MEDICA" },
  "referti": ["...Report_Signed.pdf"],
  "immagini": ["...DICOM/00000001", "...DICOM/00000002"],
  "anomalie": []
}
```

## Come provarlo in locale

```bash
npm install
node src/prova.js "C:\percorso\cartella-esame-estratta"
```

Senza argomento usa la cartella di prova indicata in `src/prova.js`.
Il registro iscritti è finto (`dati-prova/registro-iscritti-finto.json`): in
questa fase **non** si tocca Supabase né Google Drive.

## Abbinamento tramite impronta del codice fiscale

Il codice fiscale **non** è conservato in chiaro nel database IUCARE. L'app salva
solo la sua **impronta** (`HMAC-SHA256` del CF con una chiave segreta, `src/impronta.js`).
Il connettore calcola la stessa impronta dal CF del referto e cerca il profilo con
quella `cf_hash`. La conferma fine (nome + cognome + data di nascita) la fa **l'app
del paziente**, in locale, prima di scaricare: così nessun dato anagrafico in chiaro
finisce sul server centrale.

La chiave segreta deve essere **identica** su app e connettore, nelle variabili
d'ambiente `IUCARE_CF_SECRET` (mai nel codice).

## Modello di consegna scelto (Modello C)

Il connettore **non scrive** nel Drive. Registra un "esame in attesa" (solo
riferimento, nessun file) e manda un'email di avviso. È **l'app del paziente**,
alla prossima apertura, a scaricare i file dal portale e metterli nella cartella
IUCARE del suo Drive (riusa il permesso `drive.file` già attivo). Notifica: email
ora, push PWA in futuro.

## Riprendere il lavoro da un altro PC

Su GitHub ci sono **due** progetti, da scaricare tutti e due:

```bash
git clone https://github.com/Dave-the-duck/iucare.git
git clone https://github.com/Dave-the-duck/jb-connettore-iucare.git
```

App IUCARE — prendere il ramo giusto e installare le librerie:

```bash
cd iucare
git checkout anagrafica-obbligatoria
npm install
```

Connettore — installare le librerie:

```bash
cd jb-connettore-iucare
npm install
```

**Due cose NON stanno su GitHub** (apposta) e vanno rimesse a mano:

1. **Il file `iucare/.env.local`** con i segreti, tra cui `IUCARE_CF_SECRET`.
   Non arriva col `git clone`: va **copiato dal PC principale** (chiavetta USB o
   gestore di password, mai per email/chat). La stessa `IUCARE_CF_SECRET` servirà
   poi anche al connettore, altrimenti le impronte del codice fiscale non combaciano.
2. **I dati di prova col codice fiscale vero** (`dati-prova/*.json`). Sull'altro PC
   si riparte dal file di esempio finto `dati-prova/profili-finti.esempio.json`
   (copiarlo in `dati-prova/profili-finti.json` e, se serve, metterci dati veri in locale).

## Stato

- [x] **Fase 1** — lettura DICOM + referto, pacchetto normalizzato, log. Provata
      sul campione reale di Davide.
- [x] **Fase 2 (in locale)** — impronta del CF, abbinamento ai profili (finti),
      coda "esami in attesa", email simulata. Provata.
- [ ] **Fase 2 (collegata)** — eseguire `iucare/supabase/esami.sql`, attivare
      `fonteProfiliSupabase`, scrivere `cf_hash` dall'app IUCARE (ramo a parte).
- [ ] **Fase 3** — l'app legge "esami in attesa", conferma i dati e scarica nel
      Drive del paziente.
- [ ] **Email vera** — collegare Resend/Brevo (`src/notifica-email.js`).
- [ ] **Fase 4** — esecuzione automatica più volte al giorno su un PC/serverino
      **fuori** da Contabo (su Contabo si può solo leggere e prelevare, mai scrivere).
- [ ] Gestione degli **zip** (CD compressi) e di cartelle con più esami.
```
