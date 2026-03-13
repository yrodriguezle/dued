using duedgusto.SeedData;
using duedgusto.Services.Jwt;
using duedgusto.Services.HashPassword;
using System.Security.Claims;

namespace DuedGusto.Tests.Helpers;

/// <summary>
/// Helper per generare token JWT e utenti di test.
/// Usa le credenziali dell'utente e2e (SeedTestUser) come default.
/// </summary>
public static class JwtTestHelper
{
    public const string TestSymmetricKey = "TestSecretKeyForUnitTests_MustBe32+Chars!";

    /// <summary>
    /// Credenziali e2e — allineate con SeedTestUser per i test end-to-end.
    /// </summary>
    public const string E2eUsername = SeedTestUser.TestUsername;
    public const string E2ePassword = SeedTestUser.TestPassword;

    /// <summary>
    /// Crea un'istanza di JwtHelper configurata per i test.
    /// </summary>
    public static JwtHelper CreateJwtHelper()
    {
        return new JwtHelper(TestSymmetricKey, SecurityKeyType.SymmetricSecurityKey);
    }

    /// <summary>
    /// Genera un token JWT valido per un utente di test.
    /// </summary>
    public static (string RefreshToken, string Token) CreateTestToken(
        int userId = 1,
        string userName = E2eUsername)
    {
        var jwtHelper = CreateJwtHelper();
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, userName),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim("UserId", userId.ToString()),
        };
        return jwtHelper.CreateSignedToken(claims);
    }

    /// <summary>
    /// Crea un utente di test con hash/salt della password.
    /// </summary>
    public static Utente CreateTestUtente(
        int id = 1,
        string username = E2eUsername,
        string password = E2ePassword)
    {
        PasswordService.HashPassword(password, out byte[] hash, out byte[] salt);

        return new Utente
        {
            Id = id,
            NomeUtente = username,
            Hash = hash,
            Salt = salt,
            Disabilitato = false,
            ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7),
        };
    }
}
