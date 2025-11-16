using duedgusto.Services.Csrf;

namespace duedgusto.Middleware;

/// <summary>
/// CSRF protection middleware using the double-submit cookie pattern.
/// Validates that state-changing requests (POST, PUT, DELETE, PATCH) include
/// a CSRF token that matches the token in the request cookies.
/// </summary>
public class CsrfProtectionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CsrfProtectionMiddleware> _logger;

    // Endpoints that don't require CSRF validation
    // These are public endpoints or endpoints with their own security
    private static readonly string[] ExemptPaths =
    [
        "/api/auth/signin",      // Public endpoint, no auth yet
        "/graphql",              // GraphQL handles mutations with separate validation
    ];

    // HTTP methods that require CSRF validation (state-changing)
    private static readonly string[] StatefulMethods = ["POST", "PUT", "DELETE", "PATCH"];

    public CsrfProtectionMiddleware(
        RequestDelegate next,
        ILogger<CsrfProtectionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(
        HttpContext context,
        CsrfTokenGenerator csrfGenerator)
    {
        var request = context.Request;

        // Skip CSRF validation if:
        // 1. Path is exempt (public endpoints)
        // 2. Method is not state-changing (GET, HEAD, OPTIONS)
        if (IsExemptPath(request.Path) || !IsStatefulMethod(request.Method))
        {
            await _next(context);
            return;
        }

        // Extract CSRF token from request header
        var headerToken = request.Headers["X-CSRF-Token"].ToString();

        // Extract CSRF token from cookies
        var cookieToken = request.Cookies["csrfToken"];

        // Validate tokens
        if (!csrfGenerator.ValidateToken(headerToken, cookieToken))
        {
            _logger.LogWarning(
                "CSRF validation failed for {Method} {Path} - potential attack detected",
                request.Method,
                request.Path);

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(
                new { message = "CSRF validation failed" });

            return;
        }

        // Tokens valid, continue to next middleware
        await _next(context);
    }

    /// <summary>
    /// Checks if the request path is exempt from CSRF validation.
    /// </summary>
    private static bool IsExemptPath(PathString path)
    {
        return ExemptPaths.Any(exemptPath =>
            path.StartsWithSegments(exemptPath, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Checks if the HTTP method is state-changing and requires CSRF validation.
    /// </summary>
    private static bool IsStatefulMethod(string method)
    {
        return StatefulMethods.Contains(method.ToUpperInvariant());
    }
}
