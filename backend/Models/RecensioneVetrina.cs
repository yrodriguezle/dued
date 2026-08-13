namespace duedgusto.Models;

/// <summary>
/// Una recensione <b>riportata</b> sul sito.
///
/// <para>🔴 <b>Non è una recensione ricevuta dal sito, ed è una distinzione di sostanza.</b> Il
/// sito non raccoglie giudizi: non c'è alcun form, nessuno può scrivere qui dall'esterno, e non
/// esiste una rotta pubblica che scriva su questa tabella. Sono <b>citazioni scelte
/// dall'amministratore</b> da ciò che i clienti hanno già scritto altrove — è precisamente ciò
/// che il mockup mette in pagina, con la firma «Recensione Google».</para>
///
/// <para>⚠️ <b>Conseguenza da conoscere prima di riempirla:</b> riportare una recensione altrui è
/// una citazione, e va riportata <b>fedelmente</b> e attribuita. Riscriverne il testo «perché
/// suoni meglio» e lasciarci la firma di un cliente non è marketing, è un'affermazione falsa
/// attribuita a una persona reale. Il campo <see cref="Fonte"/> esiste per dire da dove viene.</para>
///
/// <para>La via alternativa — leggere le recensioni dalla Places API di Google — non è stata
/// presa: vuole una chiave, una fatturazione, e porta con sé vincoli sul caching dei contenuti e
/// un obbligo di attribuzione. Resta una decisione aperta, non un buco.</para>
/// </summary>
public class RecensioneVetrina
{
    public int RecensioneVetrinaId { get; set; }

    /// <summary>
    /// Chi l'ha scritta, come va mostrato in pagina. Un nome di battesimo, un'iniziale, o niente
    /// più di «Recensione Google»: è una firma, non un identificativo, e <b>non deve</b> essere
    /// un dato che identifica una persona oltre a ciò che quella persona ha già reso pubblico.
    /// </summary>
    public string Autore { get; set; } = string.Empty;

    /// <summary>Il testo, riportato fedelmente.</summary>
    public string Testo { get; set; } = string.Empty;

    /// <summary>Da dove viene la citazione, es. <c>"Google"</c>. Compare sotto il testo.</summary>
    public string? Fonte { get; set; }

    /// <summary>
    /// Le stelle, da 1 a 5. Il vincolo è a database (<c>CHECK</c>) e non solo nel resolver: una
    /// recensione a sei stelle in pagina è un errore che nessuno rilegge.
    /// </summary>
    public int Punteggio { get; set; } = 5;

    /// <summary>
    /// L'ordine in pagina, deciso dall'amministratore. A parità vince la più recente — così una
    /// riga nuova con ordinamento 0, che è il default, non finisce in coda per caso.
    /// </summary>
    public int Ordinamento { get; set; }

    /// <summary>
    /// Se compare sul sito. 🔴 Default <b>false</b>: una recensione appena inserita non va
    /// online per il solo fatto di essere stata salvata — chi la scrive deve poterla rileggere
    /// prima che la legga qualcun altro.
    /// </summary>
    public bool Pubblicata { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
