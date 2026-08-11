using GraphQL.Types;

using duedgusto.Models;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// Le impostazioni del sito viste da un <b>amministratore</b>.
///
/// <para>🔴 <b>Non è il contratto pubblico.</b> Questo tipo espone anche
/// <c>turnstileSiteKey</c>, i tre parametri delle prenotazioni e le marche temporali, che
/// <c>/api/public/site</c> non contiene e non deve contenere. È precisamente questa asimmetria
/// la ragione per cui la lettura è riservata agli amministratori benché una parte degli stessi
/// dati esca anonima: aprirla dopo è una riga, accorgersi che era aperta è un incidente.</para>
///
/// <para>⚠️ <b>Nessun campo di orario</b>: apertura, chiusura, giorni operativi e fuso vivono in
/// <c>BusinessSettings</c> e hanno una sola sorgente. Aggiungerli qui — anche solo in lettura,
/// anche solo "per comodità della pagina" — sarebbe il primo passo verso «il sito dice aperto
/// fino alle 21, la cassa alle 19».</para>
/// </summary>
public class ImpostazioniVetrinaType : ObjectGraphType<ImpostazioniVetrina>
{
    public ImpostazioniVetrinaType()
    {
        Field("impostazioniVetrinaId", x => x.ImpostazioniVetrinaId)
            .Description("Vale sempre 1: è un valore di dominio che significa \"la riga\", non un "
                + "contatore. Il database lo impone con un CHECK.");

        // ── Identità pubblica ────────────────────────────────────────────────────────────
        Field("insegnaPubblica", x => x.InsegnaPubblica)
            .Description("L'insegna che legge il cliente. Distinta da businessSettings.businessName, "
                + "che resta il nome del gestionale: sono due nomi con due pubblici.");

        // ── Indirizzo, scomposto perché lo pretende schema.org/PostalAddress ─────────────
        Field("via", x => x.Via);
        Field("cap", x => x.Cap);
        Field("citta", x => x.Citta);
        Field("provincia", x => x.Provincia).Description("Sigla, es. \"VI\".");
        Field("paese", x => x.Paese).Description("Codice ISO 3166-1 alpha-2, es. \"IT\".");

        Field("latitudine", x => x.Latitudine, nullable: true)
            .Description("Valorizzata insieme alla longitudine o nessuna delle due: mezza "
                + "coordinata è un punto sull'equatore, cioè una mappa che indica con sicurezza "
                + "il posto sbagliato.");
        Field("longitudine", x => x.Longitudine, nullable: true);

        // ── Contatti e social ────────────────────────────────────────────────────────────
        Field("telefono", x => x.Telefono, nullable: true);
        Field("email", x => x.Email, nullable: true);
        Field("urlInstagram", x => x.UrlInstagram, nullable: true)
            .Description("URL completo del profilo, non l'identificativo utente: si persiste "
                + "\"https://www.instagram.com/2dgusto/\" e non \"@2dgusto\", così nessun "
                + "consumatore deve sapere come si costruisce un indirizzo Instagram.");
        Field("urlFacebook", x => x.UrlFacebook, nullable: true);

        // ── SEO ──────────────────────────────────────────────────────────────────────────
        Field("metaTitoloDefault", x => x.MetaTitoloDefault, nullable: true);
        Field("metaDescrizioneDefault", x => x.MetaDescrizioneDefault, nullable: true);

        Field("immagineOgId", x => x.ImmagineOgId, nullable: true);
        Field<MediaAssetType>("immagineOg")
            .Description("Immagine di anteprima social. 🔴 È il secondo referente dei media: "
                + "finché è valorizzata, l'eliminazione di quel media viene rifiutata prima che "
                + "i file vengano toccati.")
            .Resolve(context => context.Source.ImmagineOg);

        // ── Tema ─────────────────────────────────────────────────────────────────────────
        Field("oraInizioTemaSera", x => x.OraInizioTemaSera)
            .Description("Forma \"HH:mm\". È un dato, non un calcolo: il confronto con l'ora "
                + "corrente resta lato client, dove l'orologio è quello del visitatore.");

        // ── Ganci SPENTI delle fasi successive ───────────────────────────────────────────
        // Si espongono all'amministratore perché la pagina li salva già, e nessuno di essi
        // compare in alcuna risposta pubblica.
        Field("prenotazioniAttive", x => x.PrenotazioniAttive)
            .Description("Gancio spento: le prenotazioni non sono ancora attive sul sito. Il "
                + "valore si salva e verrà usato quando la funzione sarà disponibile.");
        Field("prenotazioniPreavvisoOre", x => x.PrenotazioniPreavvisoOre);
        Field("prenotazioniCopertiMax", x => x.PrenotazioniCopertiMax);
        Field("turnstileSiteKey", x => x.TurnstileSiteKey, nullable: true)
            .Description("Chiave pubblica del servizio antispam del futuro form di prenotazione. "
                + "🔴 Non esce da /api/public/site.");

        Field("createdAt", x => x.CreatedAt, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.UpdatedAt, type: typeof(DateTimeGraphType));
    }
}
