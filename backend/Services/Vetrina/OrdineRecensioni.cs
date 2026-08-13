using duedgusto.Models;

namespace duedgusto.Services.Vetrina;

/// <summary>
/// L'ordine in cui le recensioni compaiono, in un posto solo.
///
/// <para>🔴 <b>Due lettori, un ordine.</b> Le recensioni si leggono da due parti — la rotta
/// pubblica che le mostra al visitatore e il ramo GraphQL che le mostra all'amministratore che le
/// sta riordinando — e sono esattamente le due viste che <b>devono</b> coincidere: l'anteprima in
/// amministrazione non serve a niente se l'ordine di pagina è un altro. Scritto due volte, l'ordine
/// diverge il giorno in cui uno dei due aggiunge un criterio.</para>
///
/// <para>⚠️ Il secondo criterio non è un vezzo: <c>Ordinamento</c> ha default <c>0</c>, quindi senza
/// di esso ogni riga nuova finirebbe in un gruppo di pari merito che il database ordina come gli
/// pare — cioè in un ordine che può cambiare fra due letture identiche, e che una risposta
/// cacheata servirebbe diverso a visitatori diversi. A parità vince la <b>più recente</b>, così una
/// recensione appena inserita compare in cima invece che in una posizione a caso.</para>
///
/// <para>Stessa collocazione e stesso argomento di <c>RegoleVetrina</c>: una regola condivisa fra
/// la corsia pubblica (REST) e quella privata (GraphQL) non appartiene a nessuna delle due.</para>
/// </summary>
public static class OrdineRecensioni
{
    public static IOrderedQueryable<RecensioneVetrina> Applica(
        IQueryable<RecensioneVetrina> query) =>
        query
            .OrderBy(recensione => recensione.Ordinamento)
            .ThenByDescending(recensione => recensione.RecensioneVetrinaId);
}
