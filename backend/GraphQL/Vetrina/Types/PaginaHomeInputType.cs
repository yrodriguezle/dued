using GraphQL.Types;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// Esattamente i campi scrivibili della scheda <b>Sito → Home</b>, e nient'altro.
///
/// <para>🔴 <b>Perché un input per scheda invece di uno solo.</b> Con un input unico ogni scheda
/// del pannello avrebbe dovuto rispedire anche i campi che non mostra — e un campo dimenticato
/// nel rispedirlo viene <b>azzerato</b> dall'assegnazione totale, senza errore, senza avviso e
/// senza sintomo finché qualcuno non si accorge che la storia del locale è sparita dal sito. Qui
/// quel guasto non è possibile: <c>storiaTesto</c> non è nemmeno <i>nominabile</i> da questa
/// mutation, quindi <c>mutatePaginaHome</c> non ha alcun modo di toccarlo.</para>
///
/// <para>⚠️ È questa assenza a rendere sicura l'<b>assegnazione totale</b> del resolver, esattamente
/// come per <see cref="ImpostazioniVetrinaInput"/>: l'input possiede esattamente i campi scrivibili
/// <i>di questa scheda</i>, quindi non c'è nulla da ricordarsi di preservare e quindi nessuna
/// ragione di assegnare sotto condizione.</para>
///
/// <para>🔴 <b>Il grappolo della reputazione sta tutto qui.</b> <c>punteggioGoogle</c> e
/// <c>numeroRecensioniGoogle</c> si valorizzano insieme o nessuno dei due, e una regola incrociata
/// i cui due membri stessero su due input diversi sarebbe impossibile da valutare al momento del
/// salvataggio. È il vincolo che ha determinato la partizione, non una conseguenza di essa.</para>
///
/// <para>⚠️ <b>I testi dell'aperitivo NON sono qui</b>, benché la home li legga: la regola non è
/// «un campo, una pagina», è <b>un campo, un proprietario</b>. La scheda Home li mostra in sola
/// lettura, con il collegamento a <c>Sito → Aperitivo</c>.</para>
///
/// <para>🔴 <b>Nessun campo di orario</b>, per la stessa ragione e con lo stesso meccanismo di
/// <see cref="ImpostazioniVetrinaInput"/>: apertura, chiusura, giorni operativi e fuso hanno una
/// sola sorgente, <c>BusinessSettings</c>, e il rifiuto arriva dalla <b>validazione dello
/// schema</b> prima del resolver. Lo sbarramento non era pinnato su una mutation nominata proprio
/// perché una scheda scritta domani ne ereditasse la protezione.</para>
/// </summary>
public class PaginaHomeInput
{
    public string? ClaimVetrina { get; set; }

    // ── Reputazione ──────────────────────────────────────────────────────────────────────
    public decimal? PunteggioGoogle { get; set; }
    public int? NumeroRecensioniGoogle { get; set; }
    public string? UrlProfiloGoogle { get; set; }

    // ── Lo slot immagine della pagina ────────────────────────────────────────────────────
    public int? ImmagineEroeHomeId { get; set; }
}

public class PaginaHomeInputType : InputObjectGraphType<PaginaHomeInput>
{
    public PaginaHomeInputType()
    {
        Name = "PaginaHomeInput";
        Description = "Campi scrivibili della pagina Home del sito. Non contiene i testi "
            + "dell'aperitivo, che la home legge ma non possiede, né alcun campo di orario.";

        Field(x => x.ClaimVetrina, nullable: true)
            .Description("Il paragrafo sotto il titolo della home. Una o due frasi. Vuoto: la "
                + "home non mostra alcun paragrafo, invece di mostrarne uno scritto nel codice.");

        Field(x => x.PunteggioGoogle, nullable: true)
            .Description("Da 1 a 5, es. 4.7. 🔴 Va insieme a numeroRecensioniGoogle: il sito "
                + "mostra i due numeri insieme o nessuno dei due — \"4,7\" su tre recensioni e "
                + "\"4,7\" su ottocento sono due affermazioni diverse.");
        Field(x => x.NumeroRecensioniGoogle, nullable: true);
        Field(x => x.UrlProfiloGoogle, nullable: true)
            .Description("URL assoluto http/https del profilo Google del locale.");

        Field(x => x.ImmagineEroeHomeId, nullable: true)
            .Description("L'immagine grande in cima alla home. Deve esistere ed essere "
                + "pubblicata. Vuoto: la home usa la prima immagine della galleria, e cambia se "
                + "la galleria cambia.");
    }
}
