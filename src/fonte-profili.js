// Da dove il connettore prende i profili IUCARE per abbinare l'impronta del CF.
//
// Due implementazioni con la STESSA interfaccia:
//   - fonteProfiliFinta:   per le prove in locale (nessuna rete, nessuna produzione)
//   - fonteProfiliSupabase: per la Fase 2 vera (legge Supabase col service role)
// Così il resto del codice non cambia quando si passa dal finto al reale.

const { improntaCodiceFiscale } = require("./impronta");

/**
 * Fonte FINTA: riceve profili di prova con il CF in chiaro (solo per il test),
 * ne calcola l'impronta e costruisce l'indice impronta -> profilo. Simula quello
 * che in produzione avrà già fatto l'app IUCARE salvando cf_hash in Supabase.
 */
function fonteProfiliFinta(profiliProva, chiaveSegreta) {
  const perImpronta = new Map();
  for (const p of profiliProva) {
    const imp = improntaCodiceFiscale(p._cfProva, chiaveSegreta);
    if (imp) {
      perImpronta.set(imp, {
        id: p.id,
        email: p.email,
        nome: p.nome,
        cognome: p.cognome,
        driveCartellaId: p.driveCartellaId,
      });
    }
  }
  return {
    async cercaPerImpronta(imp) {
      return perImpronta.get(imp) || null;
    },
  };
}

/**
 * Fonte REALE (Fase 2 "collegata"): cerca nella tabella profili di Supabase il
 * profilo con quella cf_hash. Usa il SERVICE ROLE key, che scavalca le RLS: va
 * tenuto solo lato server (nel connettore, mai nell'app né nel repository).
 *
 * Interroga l'API REST di Supabase (PostgREST), così non servono librerie extra:
 *   GET {url}/rest/v1/profili?cf_hash=eq.<impronta>&select=id,email,nome,cognome,drive_cartella_id&limit=1
 *
 * @param {object} opzioni - { url, serviceRoleKey } dalle variabili d'ambiente
 */
function fonteProfiliSupabase({ url, serviceRoleKey } = {}) {
  if (!url || !serviceRoleKey) {
    throw new Error("fonteProfiliSupabase: mancano SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (vedi .env).");
  }
  const base = url.replace(/\/+$/, "");
  return {
    async cercaPerImpronta(imp) {
      if (!imp) return null;
      const endpoint =
        `${base}/rest/v1/profili?cf_hash=eq.${encodeURIComponent(imp)}` +
        `&select=id,email,nome,cognome,drive_cartella_id&limit=1`;
      const risposta = await fetch(endpoint, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: "application/json",
        },
      });
      if (!risposta.ok) {
        const testo = await risposta.text().catch(() => "");
        throw new Error(`Supabase ha risposto ${risposta.status}: ${testo.slice(0, 200)}`);
      }
      const righe = await risposta.json();
      const p = Array.isArray(righe) ? righe[0] : null;
      if (!p) return null;
      return {
        id: p.id,
        email: p.email,
        nome: p.nome,
        cognome: p.cognome,
        driveCartellaId: p.drive_cartella_id,
      };
    },
  };
}

module.exports = { fonteProfiliFinta, fonteProfiliSupabase };
