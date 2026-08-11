using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;

namespace DuedGusto.Tests.Unit.Common;

/// <summary>
/// La regola della vetrina è <b>una sola</b>, e questo test lo verifica leggendo i sorgenti.
///
/// <para>Non verifica il codice di oggi: impedisce la classe di errore di domani. I due strati
/// che vengono prima — la firma di <c>PrezzoEffettivo(decimal?, decimal)</c>, utilizzabile dopo
/// una proiezione, e <c>.Where(RegoleVetrina.Pubblicato)</c>, che non lascia un posto naturale
/// dove scrivere <c>Attivo &amp;&amp;</c> — proteggono da un errore, non dalla distrazione. Chi
/// volesse comunque duplicare la regola dovrebbe scriverla, e questo test la troverebbe.</para>
///
/// <para>È il complemento di <see cref="RegoleVetrinaTests"/>: la scansione dice che la regola è
/// <b>una sola</b>, la matrice dice che è <b>giusta</b>. Nessuna delle due sostituisce l'altra.</para>
///
/// <para>⚠️ Se questo test è rosso, la correzione <b>non</b> è allargare l'elenco atteso: è
/// sostituire la scrittura di troppo con una chiamata a <c>RegoleVetrina</c>. Il messaggio di
/// fallimento nomina il file.</para>
/// </summary>
public class RegolaPubblicazioneUnicaTests
{
    /// <summary>Percorso, relativo alla radice del backend, dell'unico file ammesso.</summary>
    private const string SedeUnica = "Common/RegoleVetrina.cs";

    /// <summary>
    /// ⚠️ Confronto <b>insensibile alle maiuscole</b>: la sede unica scrive il fallback sul
    /// proprio parametro (<c>prezzoVetrina ?? prezzoListino</c>), mentre una copia scritta
    /// altrove userebbe la property (<c>p.PrezzoVetrina ?? p.Prezzo</c>). Sono la stessa regola
    /// e devono essere trovate entrambe.
    /// </summary>
    private const RegexOptions Opzioni = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;

    [Fact]
    public void LaCongiunzioneDellaRegola_CompareInUnFileSolo()
    {
        string[] fileConLaCongiunzione = FileCheContengono(@"Attivo\s*&&\s*\w*\.?VisibileSulSito");

        fileConLaCongiunzione.Should().BeEquivalentTo([SedeUnica],
            "la congiunzione fra attività in cassa e visibilità sul sito deve esistere una sola "
            + "volta: ogni altro consumatore chiama RegoleVetrina.Pubblicato o "
            + "RegoleVetrina.EPubblicato");
    }

    [Fact]
    public void IlFallbackDelPrezzo_CompareInUnFileSolo()
    {
        string[] fileConIlFallback = FileCheContengono(@"PrezzoVetrina\s*\?\?");

        fileConIlFallback.Should().BeEquivalentTo([SedeUnica],
            "il fallback fra prezzo di vetrina e prezzo di listino deve esistere una sola volta: "
            + "ogni altro consumatore chiama RegoleVetrina.PrezzoEffettivo. È la regola in cui "
            + "0 è un omaggio e solo null è assenza — riscriverla è il modo di perdere quel caso");
    }

    // ── Scansione ────────────────────────────────────────────────────────────────────────

    private static string[] FileCheContengono(string pattern)
    {
        var regex = new Regex(pattern, Opzioni);

        return SorgentiApplicative()
            .Where(percorso => regex.IsMatch(File.ReadAllText(percorso)))
            .Select(NomeRelativo)
            .OrderBy(nome => nome, StringComparer.Ordinal)
            .ToArray();
    }

    /// <summary>
    /// I sorgenti C# del backend applicativo. Esclude <c>bin/</c> e <c>obj/</c> (compilati),
    /// <c>Migrations/</c> (generate da EF: contengono i nomi delle colonne e produrrebbero falsi
    /// positivi che nessuno può correggere) e il progetto di test stesso — un test che pinna la
    /// regola deve poterla nominare.
    /// </summary>
    private static IEnumerable<string> SorgentiApplicative() =>
        Directory.EnumerateFiles(RadiceBackend(), "*.cs", SearchOption.AllDirectories)
            .Where(percorso => !EInUnaCartellaEsclusa(percorso));

    private static readonly string[] CartelleEscluse =
        ["bin", "obj", "Migrations", "DuedGusto.Tests"];

    private static bool EInUnaCartellaEsclusa(string percorso)
    {
        string relativo = NomeRelativo(percorso);
        return relativo.Split('/').Any(segmento =>
            CartelleEscluse.Contains(segmento, StringComparer.OrdinalIgnoreCase));
    }

    private static string NomeRelativo(string percorso) =>
        Path.GetRelativePath(RadiceBackend(), percorso).Replace('\\', '/');

    /// <summary>
    /// La radice del backend, risalita da <c>[CallerFilePath]</c>: è il percorso <b>assoluto</b>
    /// di questo file, inciso a compile time.
    ///
    /// <para>⚠️ È l'unico modo affidabile di risalire alla radice del repository da un test: la
    /// directory di esecuzione è <c>bin/Debug/net8.0</c> e <c>AppContext.BaseDirectory</c> cambia
    /// fra <c>dotnet test</c>, l'IDE e la CI — e cambia anche con <c>dotnet test -o &lt;altra
    /// cartella&gt;</c>, che è come si compila mentre il backend di sviluppo tiene bloccata
    /// <c>bin/</c>.</para>
    ///
    /// <para>Tre livelli: <c>Unit/Common</c> → <c>Unit</c> → <c>DuedGusto.Tests</c> →
    /// <c>backend</c>.</para>
    /// </summary>
    private static string RadiceBackend([CallerFilePath] string percorsoTest = "") =>
        Path.GetFullPath(Path.Combine(
            Path.GetDirectoryName(percorsoTest)!, "..", "..", ".."));
}
