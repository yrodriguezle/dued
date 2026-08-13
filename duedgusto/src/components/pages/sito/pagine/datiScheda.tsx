import { useQuery } from "@apollo/client";

import { getImpostazioniVetrina, getRuoliImmaginiVetrina } from "../../../../graphql/vetrina/queries";

/**
 * I due dati che **ogni** scheda di pagina legge: la riga delle impostazioni e il piano dei
 * ruoli immagine.
 *
 * 🔴 Il piano arriva da `vetrina { ruoliImmagini }`, cioè dalla **stessa funzione C#** che
 *    compone `/api/public/galleria` per il sito. È la ragione per cui una scheda non può
 *    dichiarare che la sua pagina usa una foto mentre il sito ne rende un'altra: non c'è un
 *    secondo calcolo da far divergere. Il pannello non ricostruisce mai i ruoli dagli indici.
 *
 * ⚠️ `cache-and-network` su entrambe: la scheda si apre subito con ciò che è in cache e si
 *    corregge appena il server risponde. Su un dato che un altro amministratore può aver
 *    cambiato un minuto fa, mostrare la cache **e basta** vorrebbe dire mostrare uno stato di
 *    pubblicazione vecchio — che è esattamente l'informazione per cui la scheda esiste.
 */
export function useDatiScheda() {
  const { data, loading, error } = useQuery(getImpostazioniVetrina, { fetchPolicy: "cache-and-network" });
  const { data: datiRuoli, loading: caricamentoPiano } = useQuery(getRuoliImmaginiVetrina, { fetchPolicy: "cache-and-network" });

  return {
    impostazioni: data?.vetrina?.impostazioni ?? null,
    piano: datiRuoli?.vetrina?.ruoliImmagini ?? null,
    /** Solo il primo caricamento: un aggiornamento in volo non deve svuotare la scheda. */
    caricamento: loading && !data,
    caricamentoPiano: caricamentoPiano && !datiRuoli,
    errore: error,
  };
}
