using System.Security.Cryptography;
using System.Text;

namespace duedgusto.Services.Csrf;

/// <summary>
/// Generates and validates CSRF tokens using the double-submit cookie pattern.
/// Each token is a cryptographically secure random value that must match
/// between the cookie and request header.
/// </summary>
public class CsrfTokenGenerator
{
    private readonly ILogger<CsrfTokenGenerator> _logger;

    public CsrfTokenGenerator(ILogger<CsrfTokenGenerator> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Generates a new CSRF token.
    /// Returns a base64-encoded cryptographically secure random value.
    /// </summary>
    public string GenerateToken()
    {
        using var rng = RandomNumberGenerator.Create();
        var tokenBytes = new byte[32];
        rng.GetBytes(tokenBytes);

        return Convert.ToBase64String(tokenBytes);
    }

    /// <summary>
    /// Validates that the CSRF token from the request header matches the token in the cookie.
    /// This implements the double-submit cookie pattern.
    /// </summary>
    /// <param name="headerToken">CSRF token from X-CSRF-Token header</param>
    /// <param name="cookieToken">CSRF token from csrfToken cookie</param>
    /// <returns>true if tokens match, false otherwise</returns>
    public bool ValidateToken(string? headerToken, string? cookieToken)
    {
        if (string.IsNullOrWhiteSpace(headerToken) || string.IsNullOrWhiteSpace(cookieToken))
        {
            _logger.LogWarning("CSRF validation failed: Missing token in header or cookie");
            return false;
        }

        var isValid = headerToken.Equals(cookieToken, StringComparison.Ordinal);

        if (!isValid)
        {
            _logger.LogWarning("CSRF validation failed: Token mismatch (potential CSRF attack)");
        }

        return isValid;
    }
}
