using System.Linq.Expressions;

using duedgusto.Models;

namespace duedgusto.Common;

/// <summary>
/// Le due regole della vetrina, in un punto solo. Non è un helper di comodo: è il posto che
/// esiste perché non ce ne sia un secondo.
///
/// <para>Vive in <c>Common/</c> per la stessa ragione di <see cref="CorsOriginPolicy"/>: è
/// logica pura — nessun <c>DbContext</c>, nessun GraphQL, nessun <c>HttpContext</c> — quindi è
/// esercitabile dai test senza montare niente, ed è raggiungibile sia da un resolver sia da un
/// controller senza che nessuno dei due dipenda dall'altro.</para>
///
/// <para>Una seconda scrittura di queste due regole è vietata e la CI lo verifica leggendo i
/// sorgenti: vedi <c>Unit/Common/RegolaPubblicazioneUnicaTests.cs</c>.</para>
/// </summary>
public static class RegoleVetrina
{
    /// <summary>
    /// L'UNICA espressione della regola di pubblicazione: attivo in cassa <b>e</b> marcato per
    /// il sito.
    ///
    /// <para>🔴 <c>Expression</c> e non <c>Func</c>: EF Core la traduce in SQL, quindi il filtro
    /// gira nel database e non in memoria. Un <c>Func&lt;&gt;</c> costringerebbe a materializzare
    /// l'intero listino a ogni richiesta anonima per poi scartarne la maggior parte — e sarebbe
    /// invisibile finché il listino resta piccolo.</para>
    /// </summary>
    public static readonly Expression<Func<Prodotto, bool>> Pubblicato =
        prodotto => prodotto.Attivo && prodotto.VisibileSulSito;

    // ⚠️ Ordine testuale vincolante: gli inizializzatori di campo statici girano nell'ordine di
    //    dichiarazione. Compilato DEVE stare dopo Pubblicato — invertirli compila null, senza
    //    alcun errore, e il guasto salta fuori solo alla prima chiamata di EPubblicato.
    private static readonly Func<Prodotto, bool> Compilato = Pubblicato.Compile();

    /// <summary>
    /// La stessa regola su un oggetto già in memoria. Non è una seconda scrittura: è la stessa
    /// espressione di <see cref="Pubblicato"/>, compilata una volta sola.
    /// </summary>
    public static bool EPubblicato(Prodotto prodotto) => Compilato(prodotto);

    /// <summary>
    /// Il fallback del prezzo di vetrina.
    ///
    /// <para>🔴 <b>0 è un prezzo valido (omaggio) e NON ricade sul listino: solo <c>null</c> è
    /// assenza.</b> Chi lo riscrive con <c>&gt; 0</c> trasforma un omaggio nel prezzo pieno sul
    /// sito, senza alcun errore, e nessuno se ne accorge finché non arriva il cliente. Il test
    /// del caso zero è separato da quello del <c>null</c> proprio per poter fallire da solo.</para>
    ///
    /// <para>Prende i <b>due valori</b> e non il <see cref="Prodotto"/> perché è così che resta
    /// usabile dopo una proiezione SQL, dove l'entità non esiste più. Una firma che accettasse
    /// solo l'entità costringerebbe il consumatore a riscrivere il <c>??</c> dentro la
    /// <c>Select</c>: la duplicazione sarebbe imposta dal design invece che prevenuta.</para>
    /// </summary>
    public static decimal PrezzoEffettivo(decimal? prezzoVetrina, decimal prezzoListino) =>
        prezzoVetrina ?? prezzoListino;

    /// <summary>
    /// Zucchero per chi ha l'entità sotto mano. <b>Delega, non reimplementa</b>: due scritture
    /// dello stesso fallback sono due regole il giorno in cui una delle due cambia.
    /// </summary>
    public static decimal PrezzoEffettivo(Prodotto prodotto) =>
        PrezzoEffettivo(prodotto.PrezzoVetrina, prodotto.Prezzo);
}
