using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace duedgusto.Services.Media;

/// <summary>
/// Normalizzazione del nome file in uno <i>slug</i> sicuro e generazione del suffisso casuale
/// che rende la chiave non enumerabile.
///
/// 🔴 È anche la difesa contro il path traversal: il nome del file arriva dal client e
/// <c>"../../etc/passwd.jpg"</c> è un nome file legittimo per un browser. Lo slug prodotto
/// non contiene mai <c>/</c>, <c>\</c> né <c>..</c>, perché tutto ciò che non è
/// <c>[a-z0-9]</c> diventa un separatore: non c'è un elenco di caratteri vietati da tenere
/// aggiornato, c'è un elenco di caratteri ammessi.
/// </summary>
public static class SlugGenerator
{
    /// <summary>Lunghezza massima dello slug, suffisso escluso.</summary>
    public const int LunghezzaMassima = 60;

    /// <summary>Lunghezza del suffisso casuale accodato allo slug.</summary>
    public const int LunghezzaSuffisso = 6;

    /// <summary>
    /// Alfabeto del suffisso, senza i caratteri ambigui <c>0 O 1 l I</c>: le chiavi finiscono
    /// dentro URL che qualcuno prima o poi leggerà ad alta voce o trascriverà a mano.
    /// </summary>
    private const string AlfabetoSuffisso = "23456789abcdefghijkmnopqrstuvwxyz";

    /// <summary>
    /// Normalizza un nome file in uno slug: minuscole, diacritici rimossi, ogni carattere
    /// non alfanumerico ASCII trasformato in <c>-</c>, separatori collassati e tagliati agli
    /// estremi, troncamento a <see cref="LunghezzaMassima"/>. Se non resta nulla di
    /// utilizzabile il risultato è <c>"media"</c>: uno slug vuoto produrrebbe una chiave che
    /// inizia con il solo suffisso, illeggibile per chi guarda il filesystem.
    /// </summary>
    public static string Slugifica(string? nomeOriginale)
    {
        string senzaEstensione = Path.GetFileNameWithoutExtension(nomeOriginale ?? string.Empty);

        // Decomposizione canonica: "è" diventa "e" + segno combinante, che la categoria
        // NonSpacingMark scarta. Senza questo passo ogni accento diventerebbe un "-".
        string decomposto = senzaEstensione.Normalize(NormalizationForm.FormD);

        var costruttore = new StringBuilder(decomposto.Length);
        decomposto
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .Select(char.ToLowerInvariant)
            .Select(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' ? c : '-')
            .ToList()
            .ForEach(c => costruttore.Append(c));

        // Collasso dei separatori: "foto   del  locale" non deve dare "foto---del--locale".
        string collassato = string.Join(
            '-',
            costruttore.ToString().Split('-', StringSplitOptions.RemoveEmptyEntries));

        string troncato = collassato.Length > LunghezzaMassima
            ? collassato[..LunghezzaMassima].TrimEnd('-')
            : collassato;

        return string.IsNullOrEmpty(troncato) ? "media" : troncato;
    }

    /// <summary>
    /// Suffisso casuale crittograficamente sicuro. Serve a rendere la chiave non derivabile
    /// dal solo nome del file: due upload dello stesso <c>menu.jpg</c> devono produrre due
    /// chiavi distinte e non sovrascriversi, e nessuno deve poter indovinare l'URL di
    /// un'immagine caricata da altri.
    /// </summary>
    public static string Suffisso() =>
        new(Enumerable
            .Range(0, LunghezzaSuffisso)
            .Select(_ => AlfabetoSuffisso[RandomNumberGenerator.GetInt32(AlfabetoSuffisso.Length)])
            .ToArray());

    /// <summary>
    /// Chiave di storage completa: <c>{anno}/{mese}/{slug}-{suffisso}</c>. Anno e mese vengono
    /// dall'istante di caricamento e sono l'unico raggruppamento su disco:
    /// <c>MediaAsset.Cartella</c> è etichetta editoriale e non tocca il filesystem, così
    /// rinominarla non invalida alcuna URL già emessa.
    /// </summary>
    public static string CreaChiave(string? nomeOriginale, DateTime istante) =>
        $"{istante:yyyy}/{istante:MM}/{Slugifica(nomeOriginale)}-{Suffisso()}";
}
