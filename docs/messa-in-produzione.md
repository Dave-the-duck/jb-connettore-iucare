# Messa in produzione del connettore IUCARE

Appunti per installare il connettore su una macchina dedicata in JB.
Scritto in modo semplice: puoi lavorarci da qualsiasi PC.

## Stato (aggiornato)

- ✅ **Montaggio di rete**: fattibile (la cartella esami si monterà come una cartella
  sulla macchina, in sola lettura).
- ✅ **Uscita a internet**: confermata (la macchina naviga in uscita → tunnel ok).
- ⏳ In attesa: consegna della macchina dall'IT con **SSH** e la **cartella esami
  già montata in sola lettura** (ci serve il percorso, es. `/mnt/esami`).

## Idea generale

- Il connettore gira su una **macchina Linux dedicata**, **separata** da JB Online
  (JB Online **non si tocca**).
- Sta sulla stessa rete di JB, così legge gli esami.
- Legge la cartella degli esami **in sola lettura** (non scrive, non cancella mai).
- I file degli esami **passano al volo** in memoria e vengono rilanciati al browser
  del paziente: **non vengono salvati** sulla macchina, non passano da Supabase.
- Si espone su internet in HTTPS all'indirizzo **`esami.iucare.it`**.
- Il dominio `iucare.it` è su **Aruba** (per ora solo comprato).

## Scheda macchina (da chiedere all'IT di JB)

| Voce | Cosa serve |
|---|---|
| Sistema | Ubuntu Server 24.04 LTS, **senza desktop grafico** |
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disco | 20 GB (solo sistema e log — gli esami NON si salvano qui) |
| Accesso | **SSH** con un utente che abbia **sudo** |

Niente interfaccia grafica: si installa e si gestisce tutto da riga di comando (SSH).

## Collegamenti che la macchina deve avere

1. **Lettura esami in SOLA LETTURA** — deve poter leggere la cartella dove JB
   deposita gli esami (le cartelle `Folder***`), tramite montaggio di rete
   (NFS / SMB / FTP). Solo lettura: mai scrivere o cancellare lì dentro.
2. **Uscita verso internet in HTTPS** — serve per validare l'utente su Supabase.

## Pubblicazione su internet → `esami.iucare.it` (con tunnel)

Scelta fatta: **NON apriamo nessuna porta in entrata** (niente porta 443 in
ingresso, niente IP pubblico). Usiamo un **tunnel** (**Cloudflare Tunnel**, gratis):
è la macchina che chiama **fuori** e tiene aperto un canale; le richieste dei
pazienti entrano da quel canale. Così:

- non serve aprire porte verso la rete di JB (l'IT è più tranquillo);
- basta che la macchina abbia la **normale uscita a internet** (la stessa che le
  serve già per Supabase);
- `esami.iucare.it` funziona in HTTPS lo stesso.

Pezzi:

- **Sulla macchina:** gira il connettore sulla porta interna **8080** e accanto
  gira `cloudflared` (il programma del tunnel), che lo pubblica su `esami.iucare.it`.
- **Dominio `iucare.it`:** va **gestito su Cloudflare** (gratis; resta comprato su
  Aruba, si cambiano solo i *nameserver* nel pannello Aruba). Lo facciamo noi.

## Domande da fare al sistemista (le due che ci sbloccano)

1. **Come leggo la cartella degli esami?** Montaggio di rete in sola lettura
   (NFS/SMB) o FTP? (Serve il tipo per configurare la lettura.)
2. **La macchina può navigare su internet in uscita (HTTPS)?** È l'unica cosa che
   serve lato rete: niente porte da aprire in entrata.

## Checklist completa da dare all'IT (quando prepara la VM)

**1. La macchina**
- Ubuntu Server 24.04 LTS, senza desktop
- 2 vCPU, 4 GB RAM, 20 GB disco

**2. Accesso SSH**
- indirizzo della macchina (IP interno va bene: si entra in VPN)
- un utente con `sudo` + password (o chiave SSH)
- conferma che sia raggiungibile in SSH dalla rete/VPN

**3. Cartella degli esami (la parte più importante)**
- la montano loro, in **sola lettura**
- ci dicono il **percorso** dove la trovo (es. `/mnt/esami`)
- conferma esplicita: **read-only** (il connettore non deve poter scrivere/cancellare)

**4. Internet in uscita (per il tunnel)**
- uscita confermata ✅
- può uscire in **HTTPS (porta 443)** verso internet **senza proxy**? Se c'è un
  proxy aziendale, basta saperlo e si configura `cloudflared`.

**5. Dettaglio piccolo (di solito già ok)**
- ora/data sincronizzata (**NTP** attivo): serve per certificati HTTPS e token.

**Cosa NON serve chiedere:**
- ❌ nessuna porta in entrata (niente 443 in ingresso)
- ❌ nessun IP pubblico dedicato
- ❌ nessun accesso a JB Online

## Dopo le risposte: cosa faremo (riassunto, i comandi arrivano poi)

1. Collegarsi in SSH alla macchina.
2. Installare **Node.js** (versione LTS).
3. Copiare il connettore sulla macchina (da questo repository GitHub).
4. Creare il file **`.env`** con i segreti (NON va su GitHub):
   - dati Supabase (URL + service_role key),
   - `IUCARE_CF_SECRET` (identico a quello dell'app),
   - percorso della cartella esami montata in sola lettura.
5. Montare la cartella degli esami in **sola lettura**.
6. Far partire il connettore come **servizio** (riparte da solo se la macchina si
   riavvia).
7. Mettere `iucare.it` su **Cloudflare** (cambio nameserver su Aruba) e installare
   **`cloudflared`** sulla macchina per pubblicare `esami.iucare.it` tramite tunnel
   (anche lui come servizio).
8. Nell'app (Vercel) impostare `NEXT_PUBLIC_CONNETTORE_URL = https://esami.iucare.it`
   e controllare la CSP.

## Regole da non dimenticare

- Sul server di JB **solo lettura**: mai scrivere/installare/modificare file degli esami.
- La **service_role key** di Supabase sta **solo** nel `.env` del connettore,
  mai nell'app, nel browser o su GitHub.
- `IUCARE_CF_SECRET` deve essere **identico** tra app e connettore.
- I file degli esami **non passano mai** da Supabase (Modello C).
- L'app online su Vercel non deve mai smettere di funzionare.
