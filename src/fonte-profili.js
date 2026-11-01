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
 * Fonte REALE (Fase 2): legge la tabella profili di Supabase cercando cf_hash.
 * Usa il service role key (solo lato server, dentro la VM). Non ancora attiva:
 * richiede la colonna cf_hash in Supabase (vedi supabase/esami.sql).
 *
 * @param {object} opzioni - { url, serviceRoleKey } da variabili d'ambiente
 */
function fonteProfiliSupabase(opzioni) {
  // Implementazione rimandata alla Fase 2 "collegata": qui resta la forma della
  // query, così è chiaro cosa farà.
  //   select id, email, nome, cognome, drive_cartella_id
  //   from profili where cf_hash = :impronta limit 1
  return {
    async cercaPerImpronta(_imp) {
      throw new Error(
        "fonteProfiliSupabase non ancora attiva: serve la colonna cf_hash su Supabase (vedi supabase/esami.sql)."
      );
    },
    _opzioni: opzioni,
  };
}

module.exports = { fonteProfiliFinta, fonteProfiliSupabase };
