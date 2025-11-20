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

    // Endpoints to rate limit
    private static readonly Dictionary<string, (int MaxRequests, int WindowMinutes)> RateLimitedPaths = new()
    {
        { "/api/auth/signin", (SignInMaxRequests, SignInWindowMinutes) },
        { "/api/auth/refresh", (RefreshMaxRequests, RefreshWindowMinutes) }
    };

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
        if (path != null && RateLimitedPaths.TryGetValue(path, out var limits))
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
                context.Response.Headers.Add("Retry-After", (limits.WindowMinutes * 60).ToString());

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
        var now = DateTime.UtcNow;
        var windowStart = now.AddMinutes(-windowMinutes);

        // Get or create request history for this key
        var history = _requestHistory.GetOrAdd(key, _ => new Queue<DateTime>());

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
        var cutoffTime = DateTime.UtcNow.AddHours(-1); // Remove entries older than 1 hour

        foreach (var kvp in _requestHistory)
        {
            var history = kvp.Value;
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
