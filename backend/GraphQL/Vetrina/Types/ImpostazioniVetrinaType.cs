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

        // ── I tre slot immagine delle pagine ─────────────────────────────────────────────
        // ⚠️ Stanno nel tipo di OUTPUT unico, insieme a tutto il resto. La divisione per pagina
        //    riguarda la SCRITTURA, non la lettura: quattro tipi di output vorrebbero dire
        //    quattro fragment, quattro refetch e quattro copie in cache della stessa riga.
        //
        // 🔴 Ogni descrizione dice cosa succede a lasciare lo slot vuoto, con le stesse parole
        //    della scheda: è la risposta alla domanda «cosa perdo se non lo compilo», e l'unico
        //    posto in cui esiste per chi legge lo schema invece del pannello.
        Field("immagineEroeHomeId", x => x.ImmagineEroeHomeId, nullable: true)
            .Description("L'immagine grande in cima alla Home. Vuota: il sito usa la prima della "
                + "galleria, che è il comportamento di oggi.");
        Field<MediaAssetType>("immagineEroeHome")
            .Resolve(context => context.Source.ImmagineEroeHome);

        Field("immagineRitrattoLocaleId", x => x.ImmagineRitrattoLocaleId, nullable: true)
            .Description("Il ritratto verticale della pagina «Il locale». Vuoto: il sito usa la "
                + "seconda della galleria — la prima se ce n'è una sola.");
        Field<MediaAssetType>("immagineRitrattoLocale")
            .Resolve(context => context.Source.ImmagineRitrattoLocale);

        Field("immagineEroeAperitivoId", x => x.ImmagineEroeAperitivoId, nullable: true)
            .Description("L'immagine grande in cima alla pagina «Aperitivo». 🔴 Vuota: la pagina "
                + "esce SENZA immagine di testata. È l'unico slot senza ripiego, e la ragione è "
                + "che il ripiego di prima — l'ultima foto caricata — faceva cambiare questa "
                + "immagine a ogni caricamento in galleria, anche fatto per un'altra pagina.");
        Field<MediaAssetType>("immagineEroeAperitivo")
            .Resolve(context => context.Source.ImmagineEroeAperitivo);

        // ── Tema ─────────────────────────────────────────────────────────────────────────
        Field("oraInizioTemaSera", x => x.OraInizioTemaSera)
            .Description("Forma \"HH:mm\". È un dato, non un calcolo: il confronto con l'ora "
                + "corrente resta lato client, dove l'orologio è quello del visitatore.");

        // ── Testi editoriali del sito ────────────────────────────────────────────────────
        // 🔴 Stanno qui e non nel codice del sito perché il sito non deve contenere frasi sul
        //    locale: una riga di prosa dentro un componente Astro è una verità che invecchia
        //    lontano da chi la conosce. Ogni sezione che li usa non si rende affatto quando
        //    sono vuoti — meglio una sezione in meno che una sezione che mente.
        Field("claimVetrina", x => x.ClaimVetrina, nullable: true)
            .Description("Il paragrafo sotto il titolo della home.");
        Field("storiaTitolo", x => x.StoriaTitolo, nullable: true);
        Field("storiaTesto", x => x.StoriaTesto, nullable: true);
        Field("aperitivoTitolo", x => x.AperitivoTitolo, nullable: true);
        Field("aperitivoTesto", x => x.AperitivoTesto, nullable: true);
        Field("aperitivoPunti", x => x.AperitivoPunti, nullable: true)
            .Description("Cosa è compreso nell'aperitivo, una voce per riga.");
        Field("aperitivoCategorie", x => x.AperitivoCategorie, nullable: true)
            .Description("Quali categorie di vetrina mostra la pagina dell'aperitivo, una per "
                + "riga. Esiste per non dedurle: ogni deduzione si romperebbe in silenzio.");

        // ── Reputazione ──────────────────────────────────────────────────────────────────
        Field("punteggioGoogle", x => x.PunteggioGoogle, nullable: true)
            .Description("Si aggiorna a mano, e questo è il suo limite dichiarato: invecchia. "
                + "Leggerlo dalla Places API vuole chiave, fatturazione e vincoli di caching.");
        Field("numeroRecensioniGoogle", x => x.NumeroRecensioniGoogle, nullable: true);
        Field("urlProfiloGoogle", x => x.UrlProfiloGoogle, nullable: true);

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
