namespace duedgusto.Services.Vetrina;

/// <summary>
/// Il tetto di elementi che la rotta pubblica del menu può restituire.
///
/// <para>🔴 <b>Costante del backend, non impostazione dell'amministratore.</b> Un numero che
/// protegge da un guasto non va messo dove chi subisce il guasto può alzarlo: il giorno in cui
/// un listino importato a mano arrivasse a migliaia di righe, la risposta anonima crescerebbe
/// senza limite e la prima reazione — "alzo il limite dalle impostazioni" — sarebbe esattamente
/// la mossa che toglie la protezione. Stesso argomento di <c>MediaLimiti</c>.</para>
///
/// <para>⚠️ Il troncamento non è silenzioso: la risposta dichiara il totale reale, il limite
/// applicato e un indicatore booleano, e il server registra un avviso. <b>Chi guarda il sito
/// vede meno piatti; chi guarda i log sa perché.</b> Un <c>Take(300)</c> nudo è la stessa classe
/// di guasto della sparizione di un prodotto senza categoria: un dato che manca senza che nulla
/// lo dica.</para>
/// </summary>
public static class MenuLimiti
{
    /// <summary>
    /// Numero massimo di prodotti restituiti da <c>GET /api/public/menu</c>. Non è configurabile
    /// e non è influenzabile dal chiamante: le rotte pubbliche non accettano parametri.
    /// </summary>
    public const int MaxItem = 300;
}
