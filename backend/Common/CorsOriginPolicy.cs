using System.Net;

namespace duedgusto.Common;

/// <summary>
/// Decide quali origini cross-origin la policy CORS del backend ammette.
///
/// <para>La policy è combinata con <c>AllowCredentials()</c>: un'origine ammessa può chiamare
/// l'API con i cookie dell'utente. Per questo un'origine è ammessa solo se <b>dichiarata</b>,
/// mai <b>dedotta</b> da una proprietà dell'host. In particolare un IP pubblico parsabile non
/// è ammesso per il solo fatto di essere un IP: era la deduzione che permetteva a qualunque
/// sito ospitato su un IP nudo di chiamare l'API con i cookie dell'utente.</para>
///
/// <para>La logica vive qui e non come lambda inline in <c>Program.cs</c> perché è un
/// controllo di sicurezza: nei top-level statements sarebbe irraggiungibile dai test e una
/// modifica futura non verrebbe intercettata dalla CI. <c>Program.cs</c> si limita a leggere
/// le variabili d'ambiente e a delegare.</para>
/// </summary>
public static class CorsOriginPolicy
{
    /// <summary>Host ammesso quando <c>ALLOWED_ORIGINS</c> non è impostata.</summary>
    public const string AllowlistDefault = "app.duedgusto.com";

    /// <summary>
    /// Costruisce l'allowlist degli host dichiarati.
    /// </summary>
    /// <param name="allowedOrigins">
    /// Valore di <c>ALLOWED_ORIGINS</c>: elenco di soli host separati da virgola, senza schema
    /// né porta. <c>null</c> (variabile non impostata) equivale a <see cref="AllowlistDefault"/>.
    /// </param>
    /// <param name="serverIp">
    /// Valore di <c>SERVER_IP</c>: se valorizzato viene aggiunto all'allowlist, così l'IP del VPS
    /// non deve essere duplicato in <c>ALLOWED_ORIGINS</c>.
    /// </param>
    /// <returns>Set di host con confronto case-insensitive.</returns>
    public static HashSet<string> CostruisciAllowlist(string? allowedOrigins, string? serverIp)
    {
        HashSet<string> hosts = new(
            (allowedOrigins ?? AllowlistDefault)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            StringComparer.OrdinalIgnoreCase);

        if (!string.IsNullOrWhiteSpace(serverIp))
        {
            hosts.Add(serverIp.Trim());
        }

        return hosts;
    }

    /// <summary>
    /// Verdetto della policy su una singola origine.
    /// </summary>
    /// <param name="origin">Header <c>Origin</c> della richiesta (URI assoluto).</param>
    /// <param name="allowlist">Allowlist prodotta da <see cref="CostruisciAllowlist"/>.</param>
    /// <returns>
    /// <c>true</c> se l'host è <c>localhost</c>/<c>127.0.0.1</c>, se è dichiarato nell'allowlist,
    /// oppure se è un IPv4 di rete privata. <c>false</c> in ogni altro caso, inclusa un'origine
    /// non parsabile come URI assoluto.
    /// </returns>
    public static bool OrigineAmmessa(string? origin, ISet<string> allowlist)
    {
        if (!Uri.TryCreate(origin, UriKind.Absolute, out Uri? uri))
            return false;

        string host = uri.Host;

        // Sviluppo in locale
        if (host == "localhost" || host == "127.0.0.1")
            return true;

        // Host dichiarati esplicitamente (dominio dell'app, vetrina, IP del VPS)
        if (allowlist.Contains(host))
            return true;

        // LAN privata: test su più dispositivi in rete locale.
        // Gli IP PUBBLICI non sono ammessi per deduzione: prima bastava che l'origin
        // fosse un IP qualsiasi e, con AllowCredentials(), qualunque sito ospitato su
        // un IP nudo poteva chiamare l'API con i cookie dell'utente.
        if (IPAddress.TryParse(host, out IPAddress? ip))
        {
            byte[] bytes = ip.GetAddressBytes();
            if (bytes.Length == 4)
            {
                if (bytes[0] == 192 && bytes[1] == 168) return true;   // 192.168.x.x
                if (bytes[0] == 10) return true;                        // 10.x.x.x
                if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true; // 172.16-31.x.x
            }
        }

        return false;
    }
}
