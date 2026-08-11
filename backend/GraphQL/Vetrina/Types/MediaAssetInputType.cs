using GraphQL.Types;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// I soli metadati <b>editoriali</b> di un media. L'identificativo non è qui: viaggia come
/// argomento della mutation, perché questo input descrive un contenuto, non un bersaglio.
/// </summary>
public class MediaAssetInput
{
    public string? TestoAlternativo { get; set; }
    public string? Didascalia { get; set; }
    public string? Focale { get; set; }
    public string Cartella { get; set; } = "generale";
    public int Ordinamento { get; set; }
    public bool Pubblicato { get; set; } = true;
}

/// <summary>
/// 🔴 <b>Nessun campo tecnico.</b> <c>chiave</c>, <c>mimeType</c>, <c>larghezza</c>,
/// <c>altezza</c>, <c>larghezzeDisponibili</c>, <c>placeholder</c> e <c>byteTotali</c>
/// descrivono file che esistono su disco: sono verità misurate dalla pipeline, non opinioni
/// dell'utente. Se comparissero qui, un client potrebbe dichiarare larghezze che nessun file
/// possiede, e il srcset costruito su quel dato emetterebbe URL a 404 — un guasto che degrada
/// in silenzio e in modo diverso da browser a browser.
///
/// Tenerli fuori dall'<i>input</i> anziché ignorarli nel resolver sposta il rifiuto dalla
/// logica applicativa alla <b>validazione dello schema</b>: la mutation viene respinta prima
/// di raggiungere il codice, e nessuna dimenticanza futura può riaprire la porta.
/// </summary>
public class MediaAssetInputType : InputObjectGraphType<MediaAssetInput>
{
    public MediaAssetInputType()
    {
        Name = "MediaAssetInput";
        Description = "Metadati editoriali di un media. I campi tecnici sono deliberatamente assenti.";

        Field(x => x.TestoAlternativo, nullable: true);
        Field(x => x.Didascalia, nullable: true);
        Field(x => x.Focale, nullable: true)
            .Description("Formato \"<0-100>% <0-100>%\" (orizzontale, poi verticale). null = centro.");
        Field(x => x.Cartella);
        Field(x => x.Ordinamento);
        Field(x => x.Pubblicato);
    }
}
