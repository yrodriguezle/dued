using GraphQL.Types;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// Esattamente i campi <b>scrivibili</b> delle impostazioni del sito, e nient'altro.
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
        Description = "Campi scrivibili delle impostazioni del sito. Non contiene "
            + "l'identificativo della riga (ce n'è una sola), né le marche temporali, né alcun "
            + "campo di orario: apertura, chiusura, giorni operativi e fuso si modificano dalle "
            + "impostazioni della cassa, che ne sono la sola sorgente.";

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
