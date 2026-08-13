using GraphQL.Types;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// Esattamente i campi scrivibili della scheda <b>Impostazioni sito</b>, e nient'altro: identità,
/// indirizzo, coordinate, contatti, social, SEO di default, anteprima social, aspetto e ganci
/// spenti. <b>Venti campi.</b>
///
/// <para>🔴 <b>Da questa change l'input NON possiede più i testi editoriali né la reputazione.</b>
/// Erano dieci campi (claim, storia, aperitivo, reputazione) e sono passati ai tre input di
/// pagina — <see cref="PaginaHomeInput"/>, <see cref="PaginaLocaleInput"/>,
/// <see cref="PaginaAperitivoInput"/> — perché appartengono a <b>una</b> pagina e la scheda di
/// quella pagina è l'unico posto da cui si scrivono. È una modifica <b>breaking</b> della forma
/// dell'input, dichiarata e accettata: l'unico consumatore è il frontend di questo repository,
/// che si deploya insieme. La conseguenza operativa è che backend e frontend di questa fase vanno
/// <b>nello stesso deploy</b>, e che un rollback deve <b>prima</b> riespandere l'input e
/// <b>poi</b> revertire il frontend, mai il contrario.</para>
///
/// <para>🔴 <b>La riduzione è ciò che rende la partizione vera, non solo dichiarata.</b> Se
/// <c>claimVetrina</c> restasse qui <i>e</i> stesse in <see cref="PaginaHomeInput"/>, due schede
/// scriverebbero lo stesso campo e vincerebbe l'ultima che salva — senza alcun errore da nessuna
/// parte. Il test di disgiunzione per riflessione lo verifica a ogni build proprio perché questa
/// è la forma in cui l'errore si commetterebbe: aggiungendo, non togliendo.</para>
///
/// <para>🔴 <b>Nessun identificativo.</b> C'è una riga sola e il resolver sa quale: accettare un
/// id sarebbe invitare qualcuno a passarne un altro. Il resolver fa upsert sulla costante di
/// dominio, quindi non esiste alcun percorso per scrivere su una riga diversa — nemmeno
/// sbagliando.</para>
///
/// <para>🔴 <b>Nessuna marca temporale</b>: <c>createdAt</c> e <c>updatedAt</c> sono ciò che il
/// sistema ha osservato, non ciò che un client dichiara.</para>
///
/// <para>🔴 <b>Nessun campo di orario.</b> Apertura, chiusura, giorni operativi e fuso non sono
/// qui e non sono nel modello: hanno una sola sorgente, <c>BusinessSettings</c>. Una mutation
/// che tentasse di passare <c>openingTime</c> è rifiutata dalla <b>validazione dello schema</b>,
/// prima ancora di raggiungere il resolver — che è il posto giusto dove rifiutare un campo che
/// non esiste.</para>
///
/// <para>⚠️ È questa assenza a rendere sicura l'<b>assegnazione totale</b> del resolver: se
/// l'input possiede esattamente i campi scrivibili, non c'è nulla da ricordarsi di preservare, e
/// quindi non c'è alcuna ragione di assegnare sotto condizione. È lo stesso argomento di
/// <see cref="ProdottoVetrinaInput"/>.</para>
/// </summary>
public class ImpostazioniVetrinaInput
{
    // ── Identità pubblica ────────────────────────────────────────────────────────────────
    public string InsegnaPubblica { get; set; } = string.Empty;

    // ── Indirizzo ────────────────────────────────────────────────────────────────────────
    public string Via { get; set; } = string.Empty;
    public string Cap { get; set; } = string.Empty;
    public string Citta { get; set; } = string.Empty;
    public string Provincia { get; set; } = string.Empty;
    public string Paese { get; set; } = string.Empty;

    public decimal? Latitudine { get; set; }
    public decimal? Longitudine { get; set; }

    // ── Contatti e social ────────────────────────────────────────────────────────────────
    public string? Telefono { get; set; }
    public string? Email { get; set; }
    public string? UrlInstagram { get; set; }
    public string? UrlFacebook { get; set; }

    // ── SEO ──────────────────────────────────────────────────────────────────────────────
    public string? MetaTitoloDefault { get; set; }
    public string? MetaDescrizioneDefault { get; set; }
    public int? ImmagineOgId { get; set; }

    // ── Tema ─────────────────────────────────────────────────────────────────────────────
    public string OraInizioTemaSera { get; set; } = "18:00";

    // ── Testi editoriali e reputazione: NON sono più qui ─────────────────────────────────
    // claimVetrina, punteggioGoogle, numeroRecensioniGoogle e urlProfiloGoogle stanno in
    // PaginaHomeInput; storiaTitolo e storiaTesto in PaginaLocaleInput; i quattro campi
    // dell'aperitivo in PaginaAperitivoInput. Ogni campo ha un proprietario solo, e questa
    // assenza è ciò che lo rende vero: non essendo nominabili da qui, non c'è alcun percorso
    // per cui un salvataggio delle impostazioni del sito li tocchi.

    // ── Ganci spenti ─────────────────────────────────────────────────────────────────────
    public bool PrenotazioniAttive { get; set; }
    public int PrenotazioniPreavvisoOre { get; set; }
    public int PrenotazioniCopertiMax { get; set; }
    public string? TurnstileSiteKey { get; set; }
}

public class ImpostazioniVetrinaInputType : InputObjectGraphType<ImpostazioniVetrinaInput>
{
    public ImpostazioniVetrinaInputType()
    {
        Name = "ImpostazioniVetrinaInput";
        Description = "Campi scrivibili della scheda «Impostazioni sito»: identità, indirizzo, "
            + "coordinate, contatti, social, SEO di default, anteprima social, aspetto e ganci "
            + "spenti. Non contiene l'identificativo della riga (ce n'è una sola), né le marche "
            + "temporali, né alcun campo di orario: apertura, chiusura, giorni operativi e fuso "
            + "si modificano dalle impostazioni della cassa, che ne sono la sola sorgente. Non "
            + "contiene nemmeno i testi editoriali e la reputazione: appartengono alle pagine "
            + "che li rendono e si scrivono da mutatePaginaHome, mutatePaginaLocale e "
            + "mutatePaginaAperitivo.";

        Field(x => x.InsegnaPubblica);
        Field(x => x.Via);
        Field(x => x.Cap);
        Field(x => x.Citta);
        Field(x => x.Provincia);
        Field(x => x.Paese);

        Field(x => x.Latitudine, nullable: true)
            .Description("Da valorizzare insieme alla longitudine o nessuna delle due.");
        Field(x => x.Longitudine, nullable: true);

        Field(x => x.Telefono, nullable: true);
        Field(x => x.Email, nullable: true);
        Field(x => x.UrlInstagram, nullable: true)
            .Description("URL assoluto http/https, non un identificativo utente: \"@2dgusto\" "
                + "viene rifiutato.");
        Field(x => x.UrlFacebook, nullable: true);

        Field(x => x.MetaTitoloDefault, nullable: true);
        Field(x => x.MetaDescrizioneDefault, nullable: true);
        Field(x => x.ImmagineOgId, nullable: true)
            .Description("Deve esistere ed essere pubblicato. null rimuove il riferimento e "
                + "lascia il media in libreria.");

        Field(x => x.OraInizioTemaSera).Description("Forma \"HH:mm\", es. \"18:00\".");

        Field(x => x.PrenotazioniAttive);
        Field(x => x.PrenotazioniPreavvisoOre);
        Field(x => x.PrenotazioniCopertiMax);
        Field(x => x.TurnstileSiteKey, nullable: true);
    }
}
