import { useQuery } from "@apollo/client";

import { getImpostazioniVetrina, getMappaPagineVetrina, getRuoliImmaginiVetrina } from "../../../../graphql/vetrina/queries";

/**
 * I tre dati che **ogni** scheda di pagina legge: la riga delle impostazioni, il piano dei
 * ruoli immagine e la mappa pagina → campo.
 *
 * 🔴 Il piano arriva da `vetrina { ruoliImmagini }`, cioè dalla **stessa funzione C#** che
 *    compone `/api/public/galleria` per il sito. È la ragione per cui una scheda non può
 *    dichiarare che la sua pagina usa una foto mentre il sito ne rende un'altra: non c'è un
 *    secondo calcolo da far divergere. Il pannello non ricostruisce mai i ruoli dagli indici.
 *
 * 🔴 La **mappa** arriva da `vetrina { mappaPagine }`, cioè da `MappaPagineVetrina.cs`: le due
 *    sezioni dei testi si costruiscono da lì e non da un elenco scritto dentro la scheda. Un
 *    elenco scritto qui divergerebbe dai sorgenti del sito alla prima modifica, e la divergenza
 *    sarebbe **muta**: la scheda continuerebbe a elencare con sicurezza i campi di ieri.
 *
 * ⚠️ `cache-and-network` sulle prime due: la scheda si apre subito con ciò che è in cache e si
 *    corregge appena il server risponde. Su un dato che un altro amministratore può aver
 *    cambiato un minuto fa, mostrare la cache **e basta** vorrebbe dire mostrare uno stato di
 *    pubblicazione vecchio — che è esattamente l'informazione per cui la scheda esiste.
 *
 * ⚠️ La mappa no, ed è una distinzione di sostanza: è una **costante compilata nel server**, non
 *    uno stato che qualcun altro può aver cambiato un minuto fa. `cache-first` è la politica
 *    onesta per un dato di forma.
 */
export function useDatiScheda() {
  const { data, loading, error } = useQuery(getImpostazioniVetrina, { fetchPolicy: "cache-and-network" });
  const { data: datiRuoli, loading: caricamentoPiano } = useQuery(getRuoliImmaginiVetrina, { fetchPolicy: "cache-and-network" });
  const { data: datiMappa } = useQuery(getMappaPagineVetrina, { fetchPolicy: "cache-first" });

  return {
    impostazioni: data?.vetrina?.impostazioni ?? null,
    piano: datiRuoli?.vetrina?.ruoliImmagini ?? null,
    mappa: datiMappa?.vetrina?.mappaPagine ?? null,
    /** Solo il primo caricamento: un aggiornamento in volo non deve svuotare la scheda. */
    caricamento: loading && !data,
    caricamentoPiano: caricamentoPiano && !datiRuoli,
    errore: error,
  };
}
