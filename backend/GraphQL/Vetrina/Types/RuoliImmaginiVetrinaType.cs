using GraphQL.Types;

using duedgusto.Models;
using duedgusto.Services.Vetrina;

namespace duedgusto.GraphQL.Vetrina.Types;

/// <summary>
/// Un ruolo <b>singolo</b> — l'eroe della home, il ritratto del locale, l'eroe dell'aperitivo, la
/// fotografia del piatto — con l'immagine che lo ricopre adesso e <b>da dove viene</b>.
///
/// <para>🔴 L'oggetto esiste <b>sempre</b>, anche quando nessuna immagine ricopre il ruolo:
/// <c>immagine</c> è <c>null</c> e <c>origine</c> continua a dire perché. Un ruolo che sparisse
/// dalla risposta costringerebbe la scheda a indovinare la differenza fra «vuoto perché nessuno ha
/// scelto e non c'è nemmeno un ripiego» e «vuoto perché la galleria è vuota».</para>
/// </summary>
/// <param name="Immagine">L'immagine che ricopre il ruolo adesso, oppure <c>null</c>.</param>
/// <param name="Origine">Scelta dall'amministratore (<c>SLOT</c>) o dedotta dalla posizione in galleria (<c>POSIZIONE</c>).</param>
public sealed record RuoloImmagineVetrina(MediaAsset? Immagine, OrigineRuolo Origine);

/// <summary>
/// L'enum <c>SLOT | POSIZIONE</c> di <see cref="OrigineRuolo"/>, nel CONSTANT_CASE che GraphQL.NET
/// applica di default agli enum — la forma canonica degli enum in GraphQL, e quella che il
/// frontend legge come union di stringhe.
///
/// <para>⚠️ È il contrario della scelta fatta per <c>CategoriaSpesaGraphType</c>, e per una ragione
/// precisa: quel valore è <b>persistito come stringa PascalCase</b> e viaggia identico su database,
/// API e client, quindi cambiarne il casing all'API romperebbe la coercizione. Questo invece non è
/// persistito da nessuna parte — è <b>calcolato a ogni lettura</b> da
/// <see cref="RuoliImmaginiVetrina"/> — quindi non esiste alcuna terza forma con cui restare
/// allineati.</para>
/// </summary>
public class OrigineRuoloGraphType : EnumerationGraphType<OrigineRuolo>
{
    public OrigineRuoloGraphType()
    {
        Name = "OrigineRuolo";
        Description = "SLOT: l'amministratore ha scelto, e la scelta sopravvive a un riordino "
            + "della galleria. POSIZIONE: nessuno ha scelto, e il ruolo è coperto dalla posizione "
            + "in galleria — o non è coperto affatto, quando il ruolo non ha ripiego.";
    }
}

public class RuoloImmagineVetrinaType : ObjectGraphType<RuoloImmagineVetrina>
{
    public RuoloImmagineVetrinaType()
    {
        Name = "RuoloImmagineVetrina";
        Description = "Chi ricopre un ruolo singolo di pagina, adesso, e da dove viene.";

        Field<IntGraphType>("mediaAssetId")
            .Description("L'identificativo dell'immagine che ricopre il ruolo, o null se nessuna "
                + "lo ricopre.")
            .Resolve(context => context.Source.Immagine?.MediaAssetId);

        Field<MediaAssetType>("immagine")
            .Description("L'immagine per intero: la scheda ne mostra l'anteprima senza una "
                + "seconda lettura.")
            .Resolve(context => context.Source.Immagine);

        Field<NonNullGraphType<OrigineRuoloGraphType>>("origine")
            .Description("🔴 È ciò che permette alla scheda di dire «scelta da te» invece di «è "
                + "la prima della galleria, e cambierà»: due promesse diverse, e la seconda scade "
                + "appena qualcuno carica o riordina una foto.")
            .Resolve(context => context.Source.Origine);
    }
}

/// <summary>
/// Il piano dei ruoli immagine di tutte le pagine, letto dal <b>pannello</b>.
///
/// <para>🔴 <b>Stessa funzione che alimenta il sito</b>, <see cref="RuoliImmaginiVetrina"/>: il
/// pannello e <c>/api/public/galleria</c> leggono lo <b>stesso</b> piano, quindi la scheda non può
/// dichiarare che una pagina usa una foto mentre il sito ne rende un'altra. Era precisamente il
/// modo in cui la regola posizionale, scritta quattro volte nei <c>.astro</c>, poteva divergere da
/// qualunque cosa il pannello avesse detto.</para>
///
/// <para>🔴 <b><c>origine</c> esiste solo qui e non esce in pubblico.</b> Il sito non ha nulla da
/// farci: rende l'immagine che riceve, e sapere se qualcuno l'ha scelta o se è la prima della
/// galleria non cambia una riga del suo HTML. Il DTO di <c>/api/public/galleria</c> non ha quel
/// campo, ed è il test strutturale della superficie pubblica a impedire che ce lo si aggiunga
/// distrattamente.</para>
/// </summary>
public class RuoliImmaginiVetrinaType : ObjectGraphType<PianoImmagini>
{
    public RuoliImmaginiVetrinaType()
    {
        Name = "RuoliImmaginiVetrina";
        Description = "Quale immagine ricopre quale ruolo su ciascuna pagina del sito, adesso.";

        Field<NonNullGraphType<RuoloImmagineVetrinaType>>("eroeHome")
            .Description("L'immagine grande in cima alla home. Ripiego a slot vuoto: la prima "
                + "della galleria.")
            .Resolve(context => new RuoloImmagineVetrina(
                context.Source.EroeHome, context.Source.OrigineEroeHome));

        Field<NonNullGraphType<RuoloImmagineVetrinaType>>("ritrattoLocale")
            .Description("Il ritratto verticale di «Il locale». Ripiego a slot vuoto: la seconda "
                + "della galleria, la prima se ce n'è una sola.")
            .Resolve(context => new RuoloImmagineVetrina(
                context.Source.RitrattoLocale, context.Source.OrigineRitrattoLocale));

        Field<NonNullGraphType<RuoloImmagineVetrinaType>>("eroeAperitivo")
            .Description("L'immagine grande di «Aperitivo». 🔴 NESSUN ripiego: a slot vuoto la "
                + "pagina esce senza immagine di testata.")
            .Resolve(context => new RuoloImmagineVetrina(
                context.Source.EroeAperitivo, context.Source.OrigineEroeAperitivo));

        Field<NonNullGraphType<RuoloImmagineVetrinaType>>("eroePiatto")
            .Description("La fotografia del piatto della settimana. 🔴 NESSUN ripiego, e qui la "
                + "ragione è più forte che altrove: la pagina promette UN piatto, e una foto "
                + "presa dalla posizione mostrerebbe al visitatore un piatto diverso da quello "
                + "descritto.")
            .Resolve(context => new RuoloImmagineVetrina(
                context.Source.EroePiatto, context.Source.OrigineEroePiatto));

        // ── Le tre griglie: posizione, e la posizione qui è ancora onesta ────────────────
        // Sono davvero «foto del locale», e va bene che compaiano su più pagine: non hanno un
        // ruolo singolo e riconoscibile, quindi non hanno origine da dichiarare.
        Field<NonNullGraphType<ListGraphType<NonNullGraphType<MediaAssetType>>>>("grigliaHome")
            .Description("Le tre foto della griglia della home. Meno di tre se la galleria è corta.")
            .Resolve(context => context.Source.GrigliaHome);

        Field<NonNullGraphType<ListGraphType<NonNullGraphType<MediaAssetType>>>>("fotoMenu")
            .Description("Le tre foto in coda al listino di «Menu».")
            .Resolve(context => context.Source.FotoMenu);

        Field<NonNullGraphType<ListGraphType<NonNullGraphType<MediaAssetType>>>>("quadrateLocale")
            .Description("Le tre quadrate di «Il locale».")
            .Resolve(context => context.Source.QuadrateLocale);

        // 🔴 LA CAPACITÀ DELLE GRIGLIE ESCE DA QUI, e non è un dato di comodo: è la fine di un
        //    numero scritto due volte. Fino a questo campo il pannello dichiarava «3 posti» con
        //    un 3 scritto nel proprio sorgente, mentre il 3 vero era `AmpiezzaFinestra` nel
        //    server — due scritture che nessuna build metteva a confronto. Allargando la finestra
        //    a quattro, il sito avrebbe reso quattro fotografie e la scheda avrebbe continuato a
        //    dichiararne tre, con sicurezza e senza alcun errore. Adesso c'è una scrittura sola.
        Field<NonNullGraphType<IntGraphType>>("ampiezzaGriglia")
            .Description("Quante immagini entrano in CIASCUNA delle tre griglie (griglia della "
                + "home, foto del listino, quadrate del locale). 🔴 È la capacità, non il "
                + "riempimento: una galleria corta ne rende meno, e la scheda distingue le due "
                + "grandezze.")
            .Resolve(_ => RuoliImmaginiVetrina.AmpiezzaFinestra);
    }
}
