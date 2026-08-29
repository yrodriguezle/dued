using duedgusto.Models;

namespace duedgusto.GraphQL.Vendite.Types;

/// <summary>
/// Una delle parti in cui si chiude un ordine: <b>un metodo di pagamento e le voci che vanno
/// pagate con quel metodo</b>.
///
/// <para>🔴 <b>Le voci, non un importo.</b> La divisione per importo sullo stesso insieme di voci
/// («30 € totali, 20 in contanti e 10 con carta») non è supportata, ed è il motivo per cui qui non
/// esiste un campo <c>importo</c>: il taglio non può nemmeno essere espresso. Il limite è
/// dichiarato nella issue #24 e va detto <b>in pagina</b>, prima che l'operatore ci arrivi alla
/// cassa.</para>
/// </summary>
public class TaglioOrdineInput
{
    /// <summary>Uno dei valori di <c>MetodiPagamentoVendita</c>. Obbligatorio.</summary>
    public string MetodoPagamento { get; set; } = string.Empty;

    /// <summary>
    /// Le <c>RigaOrdine</c> che finiscono in questa parte. Devono essere <b>tutte</b> dell'ordine
    /// che si sta chiudendo, e insieme agli altri tagli devono partizionarlo <b>esattamente</b>:
    /// nessuna voce fuori, nessuna voce in due parti.
    /// </summary>
    public List<int> RigheOrdineId { get; set; } = [];

    /// <summary>
    /// Quanto ha dato il cliente, solo per i metodi in contanti. <c>null</c> significa «importo
    /// esatto, non serve il conto» ed è il caso normale.
    ///
    /// <para>⚠️ Non è un dato contabile: serve a mostrare il <b>resto da rendere</b>. Non tocca
    /// alcun secchio. Vedi <c>Ordine.ContanteRicevuto</c> per il perché non si chiama
    /// <c>Resto</c>.</para>
    /// </summary>
    public decimal? ContanteRicevuto { get; set; }
}

/// <summary>
/// L'ingresso della chiusura: un ordine e i suoi tagli.
///
/// <para>🔴 <b>Una sola mutation, anche per lo split.</b> Un taglio è una chiusura semplice, due o
/// più sono uno split, e in entrambi i casi è <b>una transizione, una transazione, un commit</b>.
/// L'alternativa — n chiusure indipendenti orchestrate dal client — sarebbe n occasioni di doppio
/// incasso su un delta che non è idempotente, e una sequenza interrotta a metà lascerebbe un
/// ordine spaccato che nessuno stato sa descrivere.</para>
/// </summary>
public class ChiudiOrdineInput
{
    public int OrdineId { get; set; }

    /// <summary>1 = chiusura semplice · 2..n = split. Vuoto non è ammesso.</summary>
    public List<TaglioOrdineInput> Tagli { get; set; } = [];
}

/// <summary>
/// L'esito della chiusura. <see cref="OrdiniGenerati"/> è vuoto per una chiusura semplice e
/// contiene gli n figli <c>CHIUSO</c> per uno split.
/// </summary>
public class EsitoChiusuraOrdine
{
    /// <summary>L'ordine di partenza: <c>CHIUSO</c> con un taglio, <c>SPLITTATO</c> con n.</summary>
    public Ordine Ordine { get; set; } = null!;

    public List<Ordine> OrdiniGenerati { get; set; } = [];

    /// <summary>
    /// Somma di <c>ContanteRicevuto − totale</c> sui soli tagli in contanti che l'hanno
    /// dichiarato. <b>Derivato, mai persistito</b>: è una sottrazione fra due numeri già presenti,
    /// e salvarlo creerebbe una seconda fonte di verità da tenere allineata.
    /// </summary>
    public decimal RestoDaRendere { get; set; }
}
