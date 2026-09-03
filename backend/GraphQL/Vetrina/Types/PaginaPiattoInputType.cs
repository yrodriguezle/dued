using GraphQL.Types;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// Esattamente i campi scrivibili della scheda <b>Sito → Piatto della settimana</b>, e nient'altro.
///
/// <para>🔴 <b><c>piattoTesto</c> non riempie una pagina: decide se esiste.</b> Vuoto,
/// <c>/piatto-del-giorno</c> risponde 404 e sparisce da intestazione, piè di pagina, pagina di
/// errore e sitemap. Il <b>titolo da solo non la fa esistere</b> — la regola del server guarda
/// soltanto il corpo del testo — ed è la ragione per cui i campi stanno nello stesso input:
/// separarli vorrebbe dire che salvando da due schede diverse si può creare uno stato che il sito
/// legge come «non pubblicata» senza che nessuna delle due lo dica.</para>
///
/// <para>🔴 <b><c>piattoGiorno</c> non è nullable, a differenza di ogni altro campo qui.</b> È un
/// indice — 0 = lunedì … 6 = domenica — e non ha uno stato «non scelto» che qualcuno possa
/// leggere: la pagina non esiste finché non c'è il testo, e quando esiste il giorno le serve per
/// intitolarsi. Un campo nullable qui avrebbe aggiunto al sito un ramo irraggiungibile («che
/// titolo scrivo se il giorno manca?») e alla scheda un terzo stato da disegnare.</para>
///
/// <para>⚠️ Stessa forma e stessa ragione di <see cref="PaginaAperitivoInput"/>: l'assegnazione
/// del resolver è <b>totale sul proprio sottoinsieme</b>, ed è sicura perché l'input possiede
/// esattamente i campi di questa scheda.</para>
/// </summary>
public class PaginaPiattoInput
{
    public string? PiattoTitolo { get; set; }
    public string? PiattoTesto { get; set; }

    /// <summary>0 = lunedì … 6 = domenica. Il resolver rifiuta tutto il resto.</summary>
    public int PiattoGiorno { get; set; }

    // ── Lo slot immagine della pagina ────────────────────────────────────────────────────
    public int? ImmagineEroePiattoId { get; set; }
}

public class PaginaPiattoInputType : InputObjectGraphType<PaginaPiattoInput>
{
    public PaginaPiattoInputType()
    {
        Name = "PaginaPiattoInput";
        Description = "Campi scrivibili della pagina «Piatto della settimana». La descrizione "
            + "decide se la pagina esiste; il nome del piatto da solo no.";

        Field(x => x.PiattoTitolo, nullable: true)
            .Description("Il nome del piatto. Vuoto: la pagina si intitola col solo giorno.");

        Field(x => x.PiattoTesto, nullable: true)
            .Description("La descrizione del piatto. Vuota: la pagina «Piatto della settimana» "
                + "non si rende affatto e sparisce dalla navigazione.");

        Field(x => x.PiattoGiorno)
            .Description("Il giorno della settimana: 0 = lunedì … 6 = domenica. 🔴 Stessa "
                + "indicizzazione dei giorni operativi della cassa, NON quella di DayOfWeek, dove "
                + "0 è la domenica. Decide la parola nel titolo e nella navigazione «Piatto del "
                + "mercoledì»; l'indirizzo della pagina resta /piatto-del-giorno e non cambia mai.");

        Field(x => x.ImmagineEroePiattoId, nullable: true)
            .Description("La fotografia del piatto. Deve esistere ed essere pubblicata. 🔴 Vuota: "
                + "la pagina esce SENZA fotografia — nessun ripiego sulla galleria, perché una "
                + "foto qualsiasi mostrerebbe un piatto diverso da quello descritto.");
    }
}
