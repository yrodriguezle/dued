using System.Collections.Concurrent;

namespace duedgusto.Middleware;

/// <summary>
/// Rate limiting middleware for authentication endpoints to prevent brute force attacks.
/// Implements sliding window rate limiting per IP address.
/// </summary>
public class AuthRateLimitMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AuthRateLimitMiddleware> _logger;

    // Store request timestamps per IP address
    private static readonly ConcurrentDictionary<string, Queue<DateTime>> _requestHistory = new();

    // Rate limit configuration
    private const int SignInMaxRequests = 5;      // Max 5 login attempts
    private const int SignInWindowMinutes = 15;   // per 15 minutes
    private const int RefreshMaxRequests = 10;    // Max 10 refresh attempts
    private const int RefreshWindowMinutes = 1;   // per 1 minute

    // ── Il criterio, scritto qui perché è qui che si aggiunge una voce ───────────────────
    //
    // 🔴 CRITERIO: lettura cacheabile a costo fisso → NO. Scrittura che persiste dati o invia
    //    email → SÌ.
    //
    // Le tre GET pubbliche (/api/public/menu, /site, /galleria) NON sono in questo dizionario, e
    // non è una dimenticanza: su quelle rotte questo meccanismo non fa ciò che sembra fare.
    //
    //  1. La chiave è FALSIFICABILE. GetClientIpAddress (più sotto) legge X-Forwarded-For senza
    //     validarlo e senza sapere se davanti c'è un proxy fidato: la chiave del contatore la
    //     sceglie il chiamante. Un abusatore ruota l'header e ha contatori illimitati, mentre un
    //     client onesto — che l'header non lo manda — resta l'unico davvero limitato. Un
    //     limitatore che frena solo chi non sta abusando non è una mitigazione.
    //  2. Il dizionario NON viene mai ripulito. _requestHistory è statica e cresce di una voce
    //     per coppia (ip, path); CleanupOldEntries() esiste ed è documentata come "da invocare
    //     periodicamente", ma nessun servizio la invoca — la chiamano solo i test. Oggi il danno
    //     è contenuto perché le due rotte limitate sono di login, con pochi IP distinti.
    //     Agganciare qui la rotta più richiesta di un sito pubblico significa una voce
    //     permanente per ogni visitatore: una perdita di memoria PROPORZIONALE al traffico
    //     anonimo, su un VPS piccolo.
    //  3. La protezione vera esiste già e non è un contatore. Ogni risposta pubblica ha costo
    //     FISSO — nessun parametro di query, nessun filtro libero, nessuna paginazione, tetto di
    //     300 elementi — e gli header Cache-Control emessi dal controller permettono al reverse
    //     proxy di collassare le richieste concorrenti identiche in una sola verso .NET.
    //
    // ⚠️ La fase delle prenotazioni farà la scelta OPPOSTA, e non è una contraddizione: quando
    //    nascerà POST /api/public/prenotazioni andrà aggiunta qui (indicativamente 3 richieste
    //    per 60 minuti). Quella rotta SCRIVE a database e MANDA EMAIL, non è cacheabile e il suo
    //    costo per richiesta non è limitato da nulla — è il lato "sì" dello stesso criterio.
    //    Nota che i punti 1 e 2 restano veri anche lì: il limite sarà imperfetto, ma il danno da
    //    prevenire (righe e email che si accumulano) giustifica un contatore imperfetto, mentre
    //    per una lettura cacheabile non giustificava niente.
    //
    // Rischio residuo dichiarato: finché non esiste il micro-cache nel reverse proxy, un flusso
    // anonimo intenso arriva a MySQL con una query limitata a 300 righe. Se servirà una
    // mitigazione, il posto giusto è un limit_req_zone in nginx — che vede l'IP reale della
    // connessione e non può essere ingannato da un header — non una riga qui dentro.
    private static readonly Dictionary<string, (int MaxRequests, int WindowMinutes)> RateLimitedPaths = new()
    {
        { "/api/auth/signin", (SignInMaxRequests, SignInWindowMinutes) },
        { "/api/auth/refresh", (RefreshMaxRequests, RefreshWindowMinutes) }
    };

    /// <summary>
    /// L'elenco delle rotte limitate, esposto ai soli test. Il dizionario è privato perché
    /// nessun altro codice deve poterlo leggere né modificare a runtime; ma il criterio scritto
    /// qui sopra vale finché qualcuno non ci aggiunge una GET pubblica, e questa proprietà è ciò
    /// che permette a un test di accorgersene invece di fidarsi del commento.
    /// </summary>
    internal static IReadOnlyCollection<string> PercorsiLimitati => RateLimitedPaths.Keys;

    public AuthRateLimitMiddleware(
        RequestDelegate next,
        ILogger<AuthRateLimitMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value?.ToLowerInvariant();

        // Check if this path needs rate limiting
        if (path != null && RateLimitedPaths.TryGetValue(path, out (int MaxRequests, int WindowMinutes) limits))
        {
            var clientIp = GetClientIpAddress(context);
            var key = $"{clientIp}:{path}";

            if (!IsRequestAllowed(key, limits.MaxRequests, limits.WindowMinutes))
            {
                _logger.LogWarning(
                    "Rate limit exceeded for IP {IpAddress} on endpoint {Path}",
                    clientIp,
                    path);

                context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.Response.Headers.Append("Retry-After", (limits.WindowMinutes * 60).ToString());

                await context.Response.WriteAsJsonAsync(new
                {
                    message = "Troppi tentativi. Riprova più tardi.",
                    retryAfter = $"{limits.WindowMinutes} minuti"
                });

                return;
            }
        }

        await _next(context);
    }

    /// <summary>
    /// Checks if a request is allowed based on rate limiting rules.
    /// Uses sliding window algorithm.
    /// </summary>
    private static bool IsRequestAllowed(string key, int maxRequests, int windowMinutes)
    {
        DateTime now = DateTime.UtcNow;
        DateTime windowStart = now.AddMinutes(-windowMinutes);

        // Get or create request history for this key
        Queue<DateTime> history = _requestHistory.GetOrAdd(key, _ => new Queue<DateTime>());

        lock (history)
        {
            // Remove old requests outside the time window
            while (history.Count > 0 && history.Peek() < windowStart)
            {
                history.Dequeue();
            }

            // Check if limit is exceeded
            if (history.Count >= maxRequests)
            {
                return false;
            }

            // Add current request
            history.Enqueue(now);
            return true;
        }
    }

    /// <summary>
    /// Gets the client IP address from the request, considering proxy headers.
    /// </summary>
    private static string GetClientIpAddress(HttpContext context)
    {
        // Check for forwarded IP (behind proxy/load balancer)
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            // Take the first IP if multiple are present
            return forwardedFor.Split(',')[0].Trim();
        }

        // Check for real IP header
        var realIp = context.Request.Headers["X-Real-IP"].FirstOrDefault();
        if (!string.IsNullOrEmpty(realIp))
        {
            return realIp;
        }

        // Fall back to connection remote IP
        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    /// <summary>
    /// Cleans up old entries from the request history to prevent memory leaks.
    /// Should be called periodically by a background service.
    /// </summary>
    public static void CleanupOldEntries()
    {
        DateTime cutoffTime = DateTime.UtcNow.AddHours(-1); // Remove entries older than 1 hour

        foreach (KeyValuePair<string, Queue<DateTime>> kvp in _requestHistory)
        {
            Queue<DateTime> history = kvp.Value;
            lock (history)
            {
                while (history.Count > 0 && history.Peek() < cutoffTime)
                {
                    history.Dequeue();
                }

                // If queue is empty, remove the entry entirely
                if (history.Count == 0)
                {
                    _requestHistory.TryRemove(kvp.Key, out _);
                }
            }
        }
    }
}
