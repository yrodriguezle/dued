using GraphQL.Types;

using duedgusto.Services.Vetrina;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// Dove un testo compare: le sei pagine più <c>CORNICE</c>, che è la cornice condivisa —
/// intestazione, piè di pagina e dati strutturati — presente su ognuna.
/// </summary>
public class PaginaVetrinaGraphType : EnumerationGraphType<PaginaVetrina>
{
    public PaginaVetrinaGraphType()
    {
        Name = "PaginaVetrina";
        Description = "La pagina del sito che mostra il valore. CORNICE non è una pagina: è ciò "
            + "che intestazione, piè di pagina e dati strutturati rendono su TUTTE le pagine.";
    }
}

/// <summary>
/// Dove si <b>modifica</b> il valore. ⚠️ Due delle sette sedi non sono schede del sito: gli orari
/// vivono nelle impostazioni della cassa e le citazioni nell'anagrafica delle recensioni.
/// </summary>
public class SchedaVetrinaGraphType : EnumerationGraphType<SchedaVetrina>
{
    public SchedaVetrinaGraphType()
    {
        Name = "SchedaVetrina";
        Description = "La sede in cui il valore si modifica. IMPOSTAZIONI_CASSA e RECENSIONI_SITO "
            + "non sono schede di pagina: sono gli altri due posti in cui vive un valore che il "
            + "sito mostra.";
    }
}

/// <summary>
/// Una riga della mappa pagina → campo, servita al pannello.
///
/// <para>🔴 <b>Il pannello la legge e non ne tiene una copia.</b> Le due sezioni «testi di questa
/// pagina» e «testi ereditati» delle sei schede si costruiscono da qui: un elenco scritto a
/// mano dentro ogni scheda divergerebbe dai sorgenti del sito alla prima modifica, e nessuno se
/// ne accorgerebbe — una scheda che elenca il campo sbagliato non produce alcun errore.</para>
///
/// <para>⚠️ <c>percorso</c> esce anche se il pannello oggi non lo mostra: è il campo su cui
/// <c>sito/test/mappa-pagine.test.mjs</c> confronta la mappa con i sorgenti del sito, e servirlo
/// qui tiene la risposta di GraphQL e la dichiarazione C# la stessa cosa invece di due viste
/// della stessa cosa.</para>
/// </summary>
public class VocePaginaVetrinaType : ObjectGraphType<VoceMappaPagina>
{
    public VocePaginaVetrinaType()
    {
        Name = "VocePaginaVetrina";
        Description = "Un valore che una pagina del sito mostra, con il posto in cui si modifica.";

        Field<NonNullGraphType<PaginaVetrinaGraphType>>("pagina")
            .Description("Dove compare: una pagina, oppure CORNICE per ciò che ogni pagina mostra.")
            .Resolve(context => context.Source.Pagina);

        Field<NonNullGraphType<StringGraphType>>("campo")
            .Description("Il nome del campo del modello che porta il valore.")
            .Resolve(context => context.Source.Campo);

        Field<NonNullGraphType<StringGraphType>>("percorso")
            .Description("Il percorso nel DTO pubblico, cioè ciò che i sorgenti del sito leggono.")
            .Resolve(context => context.Source.Percorso);

        Field<NonNullGraphType<SchedaVetrinaGraphType>>("scheda")
            .Description("Dove si modifica il valore.")
            .Resolve(context => context.Source.Scheda);

        Field<NonNullGraphType<StringGraphType>>("etichetta")
            .Description("Come si chiama in pagina.")
            .Resolve(context => context.Source.Etichetta);

        Field<StringGraphType>("nota")
            .Description("Cosa c'è da sapere su questo valore, quando c'è qualcosa da sapere.")
            .Resolve(context => context.Source.Nota);
    }
}
