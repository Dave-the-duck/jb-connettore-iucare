# Messa in produzione del connettore IUCARE

Appunti per installare il connettore su una macchina dedicata in JB.
Scritto in modo semplice: puoi lavorarci da qualsiasi PC.

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

## Pubblicazione su internet → `esami.iucare.it`

Due pezzi:

- **Lato server (IT di JB):** espongono la macchina su internet, con certificato
  **Let's Encrypt** (gratis, automatico) oppure dietro un loro reverse-proxy.
  Il connettore internamente gira sulla porta **8080**.
- **Lato dominio (noi, su Aruba):** nel pannello Aruba creiamo un record DNS che fa
  puntare `esami.iucare.it` all'**IP pubblico** che ci dà l'IT.

## Domande da fare al sistemista (le tre che ci sbloccano)

1. **Come leggo la cartella degli esami?** Montaggio di rete in sola lettura
   (NFS/SMB) o FTP? (Serve il tipo per configurare la lettura.)
2. **L'esposizione di `esami.iucare.it` la fate voi o la facciamo noi?**
   - Se la fate voi: ditemi solo su quale porta/indirizzo interno deve girare il
     connettore (useremo la **8080**).
   - Se la facciamo noi: serve che la macchina abbia un **IP pubblico** e sia
     raggiungibile da internet sulla porta **443**.
3. **Qual è l'IP pubblico** della macchina? (serve per il DNS su Aruba)

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
7. Collegare `esami.iucare.it` (DNS su Aruba + HTTPS).
8. Nell'app (Vercel) impostare `NEXT_PUBLIC_CONNETTORE_URL = https://esami.iucare.it`
   e controllare la CSP.

## Regole da non dimenticare

- Sul server di JB **solo lettura**: mai scrivere/installare/modificare file degli esami.
- La **service_role key** di Supabase sta **solo** nel `.env` del connettore,
  mai nell'app, nel browser o su GitHub.
- `IUCARE_CF_SECRET` deve essere **identico** tra app e connettore.
- I file degli esami **non passano mai** da Supabase (Modello C).
- L'app online su Vercel non deve mai smettere di funzionare.
