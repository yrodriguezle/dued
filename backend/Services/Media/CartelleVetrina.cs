namespace duedgusto.Services.Media;

/// <summary>
/// Le etichette editoriali di raggruppamento dei media, e l'unica forma canonica che possono
/// assumere quando vengono persistite.
///
/// <para>🔴 <b>Italiano, minuscolo.</b> Non <c>"gallery"</c>: il codebase è italiano fin dentro
/// i valori dei dati (<c>generale</c>, <c>Pubblicato</c>, <c>NomeVetrina</c>), e la rotta
/// pubblica che filtra questo valore si chiama <c>/api/public/galleria</c>. Una rotta italiana
/// che filtra un valore inglese è una traduzione che esiste solo nella testa di chi l'ha
/// scritta; con lo stesso nome la relazione è ispezionabile con un <c>grep</c>. La scelta è
/// gratuita <b>oggi</b> — nessun media ha mai avuto <c>"gallery"</c> — e non lo sarà più dopo
/// il primo caricamento in galleria.</para>
/// </summary>
public static class CartelleVetrina
{
    /// <summary>Raggruppamento di default: ciò che non è stato assegnato a niente.</summary>
    public const string Generale = "generale";

    /// <summary>Il raggruppamento che alimenta la galleria pubblica del sito.</summary>
    public const string Galleria = "galleria";

    /// <summary>
    /// Elenco <b>suggerito</b>, non insieme chiuso. Le fasi successive del sito ne porteranno
    /// almeno tre (<c>eventi</c>, <c>promozioni</c>, <c>hero</c>): un enum o una colonna
    /// vincolata richiederebbero una migrazione e un deploy per ognuna, mentre l'unico
    /// problema vero da risolvere è la <b>scopribilità</b> — un campo di testo nudo non fa
    /// sapere a nessuno che esiste una cartella chiamata "galleria".
    ///
    /// <para>Il frontend lo legge da <c>GET /api/media/configurazione</c> e non ne possiede
    /// una copia: non può divergere ciò di cui non si ha una seconda scrittura. Qui la
    /// divergenza avrebbe una forma insidiosa — l'amministratore etichetta con un valore
    /// scritto dal frontend, la rotta pubblica filtra su un valore diverso, e la galleria del
    /// sito resta vuota <b>senza alcun errore da nessuna parte</b>.</para>
    /// </summary>
    public static readonly string[] Suggerite = [Generale, Galleria];

    /// <summary>
    /// La forma canonica di una cartella: spazi rimossi e caratteri a minuscolo, con il
    /// default quando non c'è nulla da normalizzare.
    ///
    /// <para>🔴 Si chiama <b>in scrittura</b> (caricamento e modifica dei metadati) e
    /// <b>mai in lettura</b>. Una lettura che normalizzasse produrrebbe
    /// <c>LOWER(Cartella) = …</c> in SQL: non sargabile, e l'indice
    /// <c>(Cartella, Ordinamento)</c> smetterebbe di essere utilizzabile per la selezione
    /// ordinata della galleria.</para>
    ///
    /// <para>⚠️ E non ci si affida alla collazione: MySQL usa <c>utf8mb4_unicode_ci</c> e
    /// confronta ignorando le maiuscole, mentre il provider InMemory dei test confronta in
    /// modo <b>ordinale</b>. Un test verde non direbbe nulla sulla produzione, e viceversa.
    /// Normalizzare in scrittura fa coincidere i due mondi e rende il valore persistito
    /// <b>canonico</b> invece che soltanto equivalente.</para>
    ///
    /// <para><c>ToLowerInvariant</c> e non <c>ToLower</c>: la cultura del processo non deve
    /// entrare in un valore di dato — in turco <c>"I".ToLower()</c> produce <c>"ı"</c>, e la
    /// stessa etichetta diventerebbe due raggruppamenti a seconda del server.</para>
    /// </summary>
    public static string Normalizza(string? valore) =>
        string.IsNullOrWhiteSpace(valore) ? Generale : valore.Trim().ToLowerInvariant();
}
