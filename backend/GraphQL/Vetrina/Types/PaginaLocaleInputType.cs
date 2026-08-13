using GraphQL.Types;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// Esattamente i campi scrivibili della scheda <b>Sito → Il locale</b>, e nient'altro.
///
/// <para>🔴 <b><c>storiaTesto</c> non riempie una pagina: decide se esiste.</b> Vuoto,
/// <c>/locale</c> risponde 404 e sparisce da intestazione, piè di pagina, pagina di errore e
/// sitemap. Il <b>titolo da solo non la fa esistere</b> — la regola del server guarda soltanto il
/// corpo del testo — ed è la ragione per cui i due campi stanno nello stesso input: separarli
/// vorrebbe dire che salvando da due schede diverse si può creare uno stato che il sito legge
/// come «non pubblicata» senza che nessuna delle due lo dica.</para>
///
/// <para>⚠️ Stessa forma e stessa ragione di <see cref="PaginaHomeInput"/>: l'assegnazione del
/// resolver è <b>totale sul proprio sottoinsieme</b>, ed è sicura perché l'input possiede
/// esattamente i campi di questa scheda. Nessun campo di orario, rifiutato dalla validazione
/// dello schema prima del resolver.</para>
/// </summary>
public class PaginaLocaleInput
{
    public string? StoriaTitolo { get; set; }
    public string? StoriaTesto { get; set; }

    // ── Lo slot immagine della pagina ────────────────────────────────────────────────────
    public int? ImmagineRitrattoLocaleId { get; set; }
}

public class PaginaLocaleInputType : InputObjectGraphType<PaginaLocaleInput>
{
    public PaginaLocaleInputType()
    {
        Name = "PaginaLocaleInput";
        Description = "Campi scrivibili della pagina «Il locale» del sito. Il testo della storia "
            + "decide se la pagina esiste; il titolo da solo no.";

        Field(x => x.StoriaTitolo, nullable: true);
        Field(x => x.StoriaTesto, nullable: true)
            .Description("La storia del locale, con nomi e date veri. Vuota: la pagina \"Il "
                + "locale\" non si rende affatto e sparisce dalla navigazione.");

        Field(x => x.ImmagineRitrattoLocaleId, nullable: true)
            .Description("Il ritratto verticale della pagina. Deve esistere ed essere "
                + "pubblicato. Vuoto: la pagina usa la seconda immagine della galleria — la "
                + "prima se ce n'è una sola.");
    }
}
