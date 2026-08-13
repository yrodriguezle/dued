using GraphQL.Types;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// Esattamente i campi scrivibili della scheda <b>Sito → Aperitivo</b>, e nient'altro.
///
/// <para>🔴 <b>Questi campi sono letti anche dalla home, e appartengono comunque qui.</b> È il
/// caso che rende falsa la regola «un campo, una pagina» e vera quella <b>«un campo, un
/// proprietario»</b>: la home li mostra, la scheda Aperitivo li scrive. Metterli anche in
/// <see cref="PaginaHomeInput"/> sarebbe la violazione esatta che questa change esiste per
/// togliere — due schede che scrivono lo stesso campo sono due verità, e vince l'ultima che
/// salva.</para>
///
/// <para>🔴 <c>aperitivoTesto</c> vuoto significa che <c>/aperitivo</c> <b>non esiste</b>,
/// esattamente come per <c>/locale</c>: risponde 404 e sparisce dalla navigazione e dalla
/// sitemap.</para>
///
/// <para>⚠️ Assegnazione <b>totale sul proprio sottoinsieme</b> nel resolver, sicura perché
/// l'input possiede esattamente i campi di questa scheda. Nessun campo di orario, rifiutato dalla
/// validazione dello schema prima del resolver.</para>
/// </summary>
public class PaginaAperitivoInput
{
    public string? AperitivoTitolo { get; set; }
    public string? AperitivoTesto { get; set; }
    public string? AperitivoPunti { get; set; }
    public string? AperitivoCategorie { get; set; }

    // ── Lo slot immagine della pagina ────────────────────────────────────────────────────
    public int? ImmagineEroeAperitivoId { get; set; }
}

public class PaginaAperitivoInputType : InputObjectGraphType<PaginaAperitivoInput>
{
    public PaginaAperitivoInputType()
    {
        Name = "PaginaAperitivoInput";
        Description = "Campi scrivibili della pagina «Aperitivo» del sito. Sono letti anche dalla "
            + "home, che li mostra ma non li possiede.";

        Field(x => x.AperitivoTitolo, nullable: true);
        Field(x => x.AperitivoTesto, nullable: true)
            .Description("Vuoto: la pagina dell'aperitivo non si rende affatto.");
        Field(x => x.AperitivoPunti, nullable: true)
            .Description("Cosa è compreso, UNA VOCE PER RIGA. Righe vuote e spazi vengono "
                + "ignorati; se ne pubblicano al massimo sei.");
        Field(x => x.AperitivoCategorie, nullable: true)
            .Description("Quali categorie di vetrina mostrare nella pagina dell'aperitivo, UNA "
                + "PER RIGA, con il nome esatto. 🔴 Esiste per non indovinare: cercare la parola "
                + "\"cocktail\" nel nome smette di funzionare alla prima rinomina, e la pagina "
                + "mostrerebbe le cose sbagliate senza lasciare traccia.");

        Field(x => x.ImmagineEroeAperitivoId, nullable: true)
            .Description("L'immagine grande in cima alla pagina. Deve esistere ed essere "
                + "pubblicata. 🔴 Vuoto: la pagina esce SENZA immagine di testata. È l'unico "
                + "slot senza ripiego, e la ragione è che il ripiego di prima — l'ultima foto "
                + "caricata — faceva cambiare questa immagine a ogni caricamento in galleria, "
                + "anche fatto per un'altra pagina.");
    }
}
