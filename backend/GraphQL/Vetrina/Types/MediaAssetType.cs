using GraphQL.Types;

using duedgusto.Models;

namespace duedgusto.GraphQL.Vetrina.Types;

public class MediaAssetType : ObjectGraphType<MediaAsset>
{
    public MediaAssetType()
    {
        Field("mediaAssetId", x => x.MediaAssetId);
        Field("chiave", x => x.Chiave)
            .Description("Percorso relativo alla radice dei media, es. \"2026/08/caffe-a1b2c3\". "
                + "Senza prefisso \"/media\" e senza host: quelli sono dettagli di serving, e il "
                + "client li compone in un punto solo.");
        Field("nomeOriginale", x => x.NomeOriginale);
        Field("mimeType", x => x.MimeType);
        Field("larghezza", x => x.Larghezza);
        Field("altezza", x => x.Altezza);

        // La colonna è un CSV ("400,800,1200"), ma il contratto espone una lista tipata:
        // il consumatore non deve conoscere — né poter sbagliare — la codifica di persistenza.
        Field<NonNullGraphType<ListGraphType<NonNullGraphType<IntGraphType>>>>("larghezzeDisponibili")
            .Description("Larghezze effettivamente presenti su disco. Il client vi costruisce il "
                + "srcset senza riapplicare la regola di generazione: una sorgente da 900 px "
                + "produce solo [400, 800], e dedurre le altre significherebbe emettere URL a 404.")
            .Resolve(context => LeggiLarghezze(context.Source.LarghezzeDisponibili));

        Field("testoAlternativo", x => x.TestoAlternativo, nullable: true);
        Field("didascalia", x => x.Didascalia, nullable: true);
        Field("focale", x => x.Focale, nullable: true)
            .Description("Punto focale nella forma pronta per object-position, es. \"50% 40%\". "
                + "null significa centro.");
        Field("placeholder", x => x.Placeholder, nullable: true)
            .Description("LQIP base64 largo 20 px, già come data URI: il client mostra qualcosa "
                + "subito, senza una seconda richiesta e senza salto di layout.");
        Field("cartella", x => x.Cartella)
            .Description("Etichetta editoriale di raggruppamento. Non tocca il percorso su disco: "
                + "rinominarla non invalida alcuna URL già emessa.");
        Field("ordinamento", x => x.Ordinamento);
        Field("pubblicato", x => x.Pubblicato);
        Field("byteTotali", x => x.ByteTotali, type: typeof(LongGraphType));
        Field("createdAt", x => x.CreatedAt, type: typeof(DateTimeGraphType));
        Field("updatedAt", x => x.UpdatedAt, type: typeof(DateTimeGraphType));
    }

    /// <summary>
    /// Il CSV persistito non è mai vuoto per costruzione (la pipeline ricade sulla larghezza
    /// nativa quando nessuna variante qualifica), ma un record scritto a mano potrebbe esserlo:
    /// qui una stringa vuota diventa lista vuota e non un'eccezione dentro il resolver.
    /// </summary>
    internal static int[] LeggiLarghezze(string? csv) =>
        string.IsNullOrWhiteSpace(csv)
            ? []
            : csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                 .Select(v => int.TryParse(v, out int larghezza) ? larghezza : 0)
                 .Where(larghezza => larghezza > 0)
                 .ToArray();
}
