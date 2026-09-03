using duedgusto.Models;

namespace duedgusto.Services.Vetrina;

/// <summary>
/// Da dove viene l'immagine che ricopre un ruolo <b>singolo</b>.
///
/// <para>È la distinzione che permette alla scheda di pagina di dire <i>«scelta da te»</i> invece
/// di <i>«è la prima della galleria, e cambierà»</i>: due promesse diverse, e la seconda scade
/// appena qualcuno carica o riordina una foto. Presentarle allo stesso modo sarebbe la stessa
/// classe di errore che questo change esiste per togliere.</para>
/// </summary>
public enum OrigineRuolo
{
    /// <summary>L'amministratore ha scelto, e la scelta sopravvive a un riordino della galleria.</summary>
    Slot,

    /// <summary>
    /// Nessuno ha scelto: il ruolo è coperto dalla <b>posizione</b> nella galleria (o non è coperto
    /// affatto, quando il ruolo non ha ripiego). Vale anche quando lo slot è valorizzato ma punta a
    /// un'immagine che la galleria non contiene — non pubblicata, o in un'altra cartella: in quel
    /// caso lo slot c'è ma non seleziona nulla, e mentire dicendo <c>Slot</c> farebbe dichiarare
    /// alla scheda una scelta che il sito non sta onorando.
    /// </summary>
    Posizione,
}

/// <summary>
/// Chi ricopre quale ruolo, adesso, su tutte e cinque le pagine che pescano dalla galleria.
///
/// <para>Un piano solo per tutte le pagine, e non uno per pagina: le finestre si sovrappongono
/// (la 2ª foto è insieme prima della griglia della home, seconda del menu e ritratto del locale)
/// e calcolarle separatamente significherebbe riscrivere gli offset in quattro posti, cioè
/// riprodurre il difetto che si sta togliendo.</para>
/// </summary>
/// <param name="EroeHome">L'immagine grande in cima a <c>/</c>.</param>
/// <param name="GrigliaHome">Le tre foto della griglia di <c>/</c>. Meno di tre se la galleria è corta.</param>
/// <param name="FotoMenu">Le tre foto in coda al listino di <c>/menu</c>.</param>
/// <param name="RitrattoLocale">Il ritratto verticale di <c>/locale</c>.</param>
/// <param name="QuadrateLocale">Le tre quadrate di <c>/locale</c>.</param>
/// <param name="EroeAperitivo">
/// L'immagine grande in cima a <c>/aperitivo</c>. 🔴 <b>Può essere <c>null</c> con una galleria
/// non vuota</b>: non ha ripiego posizionale. Vedi <see cref="RuoliImmaginiVetrina"/>.
/// </param>
/// <param name="EroePiatto">
/// La fotografia di <c>/piatto-del-giorno</c>. 🔴 <b>Come l'eroe dell'aperitivo, senza ripiego</b>
/// — e qui la ragione è più forte che altrove: quella pagina promette <i>un</i> piatto, e una foto
/// scelta dalla posizione mostrerebbe al visitatore un piatto diverso da quello descritto.
/// </param>
public sealed record PianoImmagini(
    MediaAsset? EroeHome,
    IReadOnlyList<MediaAsset> GrigliaHome,
    IReadOnlyList<MediaAsset> FotoMenu,
    MediaAsset? RitrattoLocale,
    IReadOnlyList<MediaAsset> QuadrateLocale,
    MediaAsset? EroeAperitivo,
    MediaAsset? EroePiatto,
    OrigineRuolo OrigineEroeHome,
    OrigineRuolo OrigineRitrattoLocale,
    OrigineRuolo OrigineEroeAperitivo,
    OrigineRuolo OrigineEroePiatto);

/// <summary>
/// Chi sta ricoprendo quale ruolo, adesso. 🔴 <b>Sede UNICA della regola</b>: fino a questo change
/// viveva scritta <b>quattro volte, dentro quattro file <c>.astro</c></b>, e il backend non ne
/// aveva copia — motivo per cui la domanda <i>«quante immagini ospita questa pagina»</i> non aveva
/// risposta da nessuna parte, nemmeno per chi leggeva il codice.
///
/// <para>Logica pura, senza <c>DbContext</c>: esercitabile dai test senza montare niente, e
/// raggiungibile sia dal controller pubblico sia dal ramo GraphQL di amministrazione senza che
/// nessuno dei due dipenda dall'altro. Stessa collocazione e stessa ragione di
/// <c>MenuLimiti</c> e di <c>RegoleVetrina</c>.</para>
///
/// <para>🔴 <b>A slot vuoti il piano riproduce, immagine per immagine, ciò che il sito rende
/// oggi — con UNA eccezione deliberata, l'eroe dell'aperitivo.</b> (Il sesto ruolo, l'eroe del
/// piatto, non ha un «com'era»: la sua pagina nasce con questo ruolo.) Le cinque coincidenze
/// sono verificate una a una, su gallerie da 0, 1, 2, 3, 5 e 6 immagini, in
/// <c>Unit/Services/RuoliImmaginiVetrinaTests.cs</c>:</para>
///
/// <list type="table">
///   <listheader><term>Ruolo</term><description>Regola · ripiego a slot vuoto · com'era nel sito</description></listheader>
///   <item><term>EroeHome</term><description>slot · <c>galleria[0]</c> · <c>index.astro:85</c> — <c>const [eroe, ...altre] = galleria</c></description></item>
///   <item><term>GrigliaHome</term><description>finestra <c>[1..4)</c> · — · <c>index.astro:86</c> — <c>altre.slice(0, 3)</c></description></item>
///   <item><term>FotoMenu</term><description>finestra <c>[0..3)</c> · — · <c>menu.astro:68</c> — <c>galleria.slice(0, 3)</c></description></item>
///   <item><term>RitrattoLocale</term><description>slot · <c>galleria[1] ?? galleria[0]</c> · <c>locale.astro:38</c></description></item>
///   <item><term>QuadrateLocale</term><description>finestra <c>[2..5)</c> · — · <c>locale.astro:39</c> — <c>galleria.slice(2, 5)</c></description></item>
///   <item><term>EroeAperitivo</term><description>slot · 🔴 <b>NESSUN ripiego</b> · <c>aperitivo.astro:50</c> era <c>galleria.at(-1)</c></description></item>
///   <item><term>EroePiatto</term><description>slot · 🔴 <b>NESSUN ripiego</b> · ruolo nuovo, non esisteva nel sito</description></item>
/// </list>
///
/// <para>🔴 <b>Perché l'eroe dell'aperitivo non ha ripiego, e perché è una differenza voluta.</b>
/// Il design (D5, risoluzione 6 di <c>tasks.md</c>) proponeva di conservare <c>galleria.at(-1)</c>
/// per non cambiare il sito a contenuti invariati. La decisione presa è l'opposta, ed è
/// consapevole: <c>at(-1)</c> è la regola peggiore delle sei, perché fa sì che <b>caricare una
/// foto qualsiasi</b> — anche per un'altra pagina — sposti di nascosto l'immagine di testata
/// dell'aperitivo. Tenerla significherebbe tenere quel difetto per sempre, dato che il ripiego
/// non è un ponte verso una migrazione ma la <b>semantica permanente</b> dello slot vuoto (D5 ③,
/// nessun backfill). Con lo slot vuoto la pagina esce dunque <b>senza</b> immagine di testata, che
/// è la stessa regola che governa già tutto il resto del sito: <i>una sezione senza il suo dato
/// non si rende</i>. La conseguenza visibile è dichiarata: finché nessuno valorizza lo slot,
/// <c>/aperitivo</c> perde l'immagine grande che oggi mostra. Il rimedio è a un clic ed è nella
/// scheda della pagina.</para>
///
/// <para>⚠️ <b>Una sola regola in più rispetto agli indici di oggi: la finestra salta l'immagine
/// che ha già un ruolo singolo nella stessa pagina, e scorre.</b> Serve perché con uno slot
/// esplicito la stessa foto potrebbe comparire due volte sulla stessa pagina, e renderebbe
/// <b>falso</b> il numero di immagini che la scheda dichiara. A slot vuoti la regola <b>non ha
/// alcun effetto</b> — l'eroe della home è <c>galleria[0]</c> e la griglia parte da <c>[1]</c>;
/// il ritratto del locale è <c>[1]</c> e le quadrate partono da <c>[2]</c> — quindi non altera il
/// comportamento attuale: si attiva solo quando l'amministratore ha scelto, cioè quando è utile.
/// <c>/menu</c> non ha ruoli singoli, quindi la sua finestra non salta nulla.</para>
/// </summary>
public static class RuoliImmaginiVetrina
{
    /// <summary>
    /// Quante immagini entrano in ciascuna delle tre griglie.
    ///
    /// <para>🔴 <b>Sede UNICA del numero</b>, e <c>internal</c> per questo: il pannello lo chiede
    /// al server (<c>vetrina { ruoliImmagini { ampiezzaGriglia } }</c>) invece di scriverlo una
    /// seconda volta nel proprio sorgente. Prima di questa esposizione il 3 esisteva due volte —
    /// qui e in <c>ruoliPagine.tsx</c> — e allargare la finestra avrebbe fatto rendere al sito
    /// quattro fotografie mentre la scheda continuava a dichiararne tre, con sicurezza e senza
    /// alcun errore da nessuna parte.</para>
    /// </summary>
    internal const int AmpiezzaFinestra = 3;

    /// <summary>
    /// Il piano dei ruoli a partire dai <b>quattro identificativi</b> degli slot e dalla galleria già
    /// selezionata e ordinata dal chiamante (cartella <c>galleria</c>, pubblicate, per
    /// <c>Ordinamento</c>).
    ///
    /// <para>🔴 <b>Prende i quattro <c>int?</c> e non l'entità</b>, per la stessa ragione per cui
    /// <c>RegoleVetrina.PrezzoEffettivo</c> prende i due valori e non il <c>Prodotto</c>: così
    /// resta chiamabile dopo una proiezione SQL, dove l'entità non esiste più, e resta esercitabile
    /// dai test senza costruire un'<c>ImpostazioniVetrina</c>. L'overload di comodo che accetta
    /// l'entità arriva insieme alle colonne e <b>delega</b> a questa firma — mai reimplementa.</para>
    ///
    /// <para>⚠️ La galleria è un <b>input</b> e non viene filtrata qui: questa funzione non sa
    /// cosa sia una cartella né cosa sia la pubblicazione. Di conseguenza uno slot che punti a
    /// un'immagine non pubblicata o fuori cartella semplicemente <b>non si trova</b> nella lista
    /// ricevuta, e il ruolo ricade sul ripiego con <see cref="OrigineRuolo.Posizione"/>. È la
    /// forma che rende impossibile attribuire un ruolo a un'immagine che la rotta pubblica non
    /// selezionerebbe.</para>
    /// </summary>
    public static PianoImmagini Risolvi(
        int? eroeHomeId,
        int? ritrattoLocaleId,
        int? eroeAperitivoId,
        int? eroePiattoId,
        IReadOnlyList<MediaAsset> galleria)
    {
        ArgumentNullException.ThrowIfNull(galleria);

        MediaAsset? slotEroeHome = DallaGalleria(galleria, eroeHomeId);
        MediaAsset? slotRitrattoLocale = DallaGalleria(galleria, ritrattoLocaleId);
        MediaAsset? slotEroeAperitivo = DallaGalleria(galleria, eroeAperitivoId);
        MediaAsset? slotEroePiatto = DallaGalleria(galleria, eroePiattoId);

        // Ripieghi, uno per ruolo singolo, identici agli indici che i .astro usavano — tranne
        // l'aperitivo e il piatto, che non ne hanno (vedi la docstring di classe).
        MediaAsset? eroeHome = slotEroeHome ?? galleria.ElementAtOrDefault(0);
        MediaAsset? ritrattoLocale = slotRitrattoLocale
            ?? galleria.ElementAtOrDefault(1)
            ?? galleria.ElementAtOrDefault(0);
        MediaAsset? eroeAperitivo = slotEroeAperitivo;
        MediaAsset? eroePiatto = slotEroePiatto;

        return new PianoImmagini(
            EroeHome: eroeHome,
            GrigliaHome: Finestra(galleria, da: 1, escluso: eroeHome),
            FotoMenu: Finestra(galleria, da: 0, escluso: null),
            RitrattoLocale: ritrattoLocale,
            QuadrateLocale: Finestra(galleria, da: 2, escluso: ritrattoLocale),
            EroeAperitivo: eroeAperitivo,
            EroePiatto: eroePiatto,
            OrigineEroeHome: Origine(slotEroeHome),
            OrigineRitrattoLocale: Origine(slotRitrattoLocale),
            OrigineEroeAperitivo: Origine(slotEroeAperitivo),
            OrigineEroePiatto: Origine(slotEroePiatto));
    }

    /// <summary>
    /// Lo stesso piano, a partire dall'<b>entità</b>: la forma comoda per chi ha già in mano la
    /// riga delle impostazioni — il controller pubblico e il ramo GraphQL di amministrazione.
    ///
    /// <para>🔴 <b>Delega, mai reimplementa.</b> Il corpo è una riga sola e deve restarlo: due
    /// implementazioni della stessa regola divergerebbero nel modo peggiore — il pannello
    /// direbbe che una pagina usa una foto e il sito ne renderebbe un'altra, senza alcun errore
    /// da nessuna parte. È lo stesso idioma di <c>RegoleVetrina.PrezzoEffettivo</c>, e il test
    /// <c>Risolvi_DallEntita_CoincideConLaFirmaAtreIdentificativi</c> confronta le due forme su
    /// tutta la matrice, slot vuoti e slot valorizzati.</para>
    /// </summary>
    public static PianoImmagini Risolvi(
        ImpostazioniVetrina impostazioni, IReadOnlyList<MediaAsset> galleria) =>
        Risolvi(
            (impostazioni ?? throw new ArgumentNullException(nameof(impostazioni))).ImmagineEroeHomeId,
            impostazioni.ImmagineRitrattoLocaleId,
            impostazioni.ImmagineEroeAperitivoId,
            impostazioni.ImmagineEroePiattoId,
            galleria);

    /// <summary>
    /// L'immagine indicata dallo slot, <b>se e solo se</b> è una di quelle che la galleria ricevuta
    /// contiene. Uno slot vuoto e uno slot che punta fuori dalla galleria si comportano allo stesso
    /// modo, ed è voluto: in entrambi i casi il sito non ha nulla da rendere per quella scelta.
    /// </summary>
    private static MediaAsset? DallaGalleria(IReadOnlyList<MediaAsset> galleria, int? mediaAssetId) =>
        mediaAssetId is int id
            ? galleria.FirstOrDefault(immagine => immagine.MediaAssetId == id)
            : null;

    /// <summary>
    /// La finestra di tre immagini che parte da <paramref name="da"/> saltando
    /// <paramref name="escluso"/> e <b>scorrendo</b>, cioè pescandone una in più per restare a tre.
    ///
    /// <para>⚠️ Il confronto è per <b>riferimento</b> e non per identificativo, ed è corretto per
    /// costruzione: <paramref name="escluso"/> esce sempre da <paramref name="galleria"/> — o dalla
    /// ricerca dello slot, o da un <c>ElementAtOrDefault</c>. Il confronto per identificativo
    /// aggiungerebbe un modo di sbagliare senza toglierne nessuno, perché scarterebbe anche le
    /// entità non ancora persistite, che hanno tutte <c>MediaAssetId == 0</c>.</para>
    /// </summary>
    private static IReadOnlyList<MediaAsset> Finestra(
        IReadOnlyList<MediaAsset> galleria, int da, MediaAsset? escluso) =>
        galleria
            .Skip(da)
            .Where(immagine => !ReferenceEquals(immagine, escluso))
            .Take(AmpiezzaFinestra)
            .ToList();

    /// <summary>
    /// <see cref="OrigineRuolo.Slot"/> <b>se e solo se</b> lo slot era valorizzato e la sua immagine
    /// è nella galleria ricevuta: è la stessa condizione che ha già deciso se il ripiego serviva,
    /// quindi origine e immagine non possono divergere.
    /// </summary>
    private static OrigineRuolo Origine(MediaAsset? daSlot) =>
        daSlot is null ? OrigineRuolo.Posizione : OrigineRuolo.Slot;
}
