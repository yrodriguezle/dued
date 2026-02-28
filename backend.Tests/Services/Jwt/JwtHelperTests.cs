using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using duedgusto.Services.Jwt;

namespace backend.Tests.Services.Jwt;

/// <summary>
/// Test completi per JwtHelper: generazione token, validazione, estrazione claim,
/// GetPrincipalFromExpiredToken e configurazione TokenValidationParameters.
/// </summary>
public class JwtHelperTests
{
    private const string TestKey = "====*-o-*-dued-json-web-key-test-*-o-*====";
    private readonly JwtHelper _jwtHelper;

    public JwtHelperTests()
    {
        _jwtHelper = new JwtHelper(TestKey, SecurityKeyType.SymmetricSecurityKey);
    }

    // ==========================================
    // CreateSignedToken TESTS
    // ==========================================

    [Fact]
    public void CreateSignedToken_RestituisceJwtValido_ConTrePartiSeparateDaPunti()
    {
        // Arrange
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, "testuser"),
            new Claim(ClaimTypes.NameIdentifier, "1"),
            new Claim("UserId", "1"),
        };

        // Act
        var (refreshToken, token) = _jwtHelper.CreateSignedToken(claims);

        // Assert
        Assert.False(string.IsNullOrEmpty(token));
        Assert.False(string.IsNullOrEmpty(refreshToken));

        // Un JWT valido ha 3 parti: header.payload.signature
        var parts = token.Split('.');
        Assert.Equal(3, parts.Length);
    }

    [Fact]
    public void CreateSignedToken_TokenContieneClaimUserId()
    {
        // Arrange
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, "testuser"),
            new Claim(ClaimTypes.NameIdentifier, "42"),
            new Claim("UserId", "42"),
        };

        // Act
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadJwtToken(token);
        Assert.Contains(jwtToken.Claims, c => c.Type == "UserId" && c.Value == "42");
    }

    [Fact]
    public void CreateSignedToken_TokenContieneClaimUserName()
    {
        // Arrange
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, "mario.rossi"),
            new Claim(ClaimTypes.NameIdentifier, "7"),
            new Claim("UserId", "7"),
        };

        // Act
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadJwtToken(token);
        // ClaimTypes.Name viene mappato a "unique_name" nel JWT
        Assert.Contains(jwtToken.Claims,
            c => (c.Type == ClaimTypes.Name || c.Type == "unique_name") && c.Value == "mario.rossi");
    }

    [Fact]
    public void CreateSignedToken_TokenHaIssuerCorretto()
    {
        // Arrange
        var claims = new[] { new Claim(ClaimTypes.Name, "testuser") };

        // Act
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadJwtToken(token);
        Assert.Equal("duedgusto-api", jwtToken.Issuer);
    }

    [Fact]
    public void CreateSignedToken_TokenHaAudienceCorretto()
    {
        // Arrange
        var claims = new[] { new Claim(ClaimTypes.Name, "testuser") };

        // Act
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadJwtToken(token);
        Assert.Contains("duedgusto-clients", jwtToken.Audiences);
    }

    [Fact]
    public void CreateSignedToken_TokenScadeIn5Minuti()
    {
        // Arrange
        var claims = new[] { new Claim(ClaimTypes.Name, "testuser") };
        var beforeCreation = DateTime.UtcNow;

        // Act
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Assert
        var handler = new JwtSecurityTokenHandler();
        var jwtToken = handler.ReadJwtToken(token);

        // Il token deve scadere in 5 minuti (non 1 minuto - verifica del fix)
        var expectedMinExpiry = beforeCreation.AddMinutes(5).AddSeconds(-5);
        var expectedMaxExpiry = DateTime.UtcNow.AddMinutes(5).AddSeconds(5);

        Assert.True(jwtToken.ValidTo >= expectedMinExpiry,
            $"Il token scade a {jwtToken.ValidTo:O} ma dovrebbe scadere dopo {expectedMinExpiry:O} (5 min)");
        Assert.True(jwtToken.ValidTo <= expectedMaxExpiry,
            $"Il token scade a {jwtToken.ValidTo:O} ma dovrebbe scadere prima di {expectedMaxExpiry:O} (5 min)");

        // Verifica negativa: NON deve scadere in 1 minuto
        var oneMinuteFromNow = DateTime.UtcNow.AddMinutes(1).AddSeconds(10);
        Assert.True(jwtToken.ValidTo > oneMinuteFromNow,
            "Il token NON deve scadere in 1 minuto - deve scadere in 5 minuti");
    }

    // ==========================================
    // GenerateRefreshToken TESTS
    // ==========================================

    [Fact]
    public void GenerateRefreshToken_RestituisceStringaNonVuota()
    {
        // Act
        var refreshToken = _jwtHelper.GenerateRefreshToken();

        // Assert
        Assert.NotNull(refreshToken);
        Assert.False(string.IsNullOrEmpty(refreshToken));
    }

    [Fact]
    public void GenerateRefreshToken_RestituisceBase64Valido()
    {
        // Act
        var refreshToken = _jwtHelper.GenerateRefreshToken();

        // Assert - Deve essere un Base64 valido
        byte[] bytes = Convert.FromBase64String(refreshToken);
        Assert.Equal(32, bytes.Length); // 32 bytes = ~44 caratteri base64
    }

    [Fact]
    public void GenerateRefreshToken_OgniChiamataProdiceTokenDiverso()
    {
        // Act
        var token1 = _jwtHelper.GenerateRefreshToken();
        var token2 = _jwtHelper.GenerateRefreshToken();
        var token3 = _jwtHelper.GenerateRefreshToken();

        // Assert
        Assert.NotEqual(token1, token2);
        Assert.NotEqual(token2, token3);
        Assert.NotEqual(token1, token3);
    }

    [Fact]
    public void GenerateRefreshToken_HaLunghezzaRagionevole()
    {
        // Act
        var refreshToken = _jwtHelper.GenerateRefreshToken();

        // Assert - 32 bytes in Base64 = 44 caratteri (con padding)
        Assert.True(refreshToken.Length >= 40 && refreshToken.Length <= 48,
            $"La lunghezza del refresh token ({refreshToken.Length}) deve essere tra 40 e 48 caratteri");
    }

    // ==========================================
    // GetUserID TESTS
    // ==========================================

    [Fact]
    public void GetUserID_EstraeIdCorrettoDaClaimsPrincipal()
    {
        // Arrange
        var claims = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("UserId", "42"),
            new Claim(ClaimTypes.Name, "testuser"),
        }));

        // Act
        var userId = _jwtHelper.GetUserID(claims);

        // Assert
        Assert.Equal(42, userId);
    }

    [Fact]
    public void GetUserID_SenzaClaimUserId_Restituisce0()
    {
        // Arrange
        var claims = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.Name, "testuser"),
        }));

        // Act
        var userId = _jwtHelper.GetUserID(claims);

        // Assert
        Assert.Equal(0, userId);
    }

    [Fact]
    public void GetUserID_ClaimsVuoti_Restituisce0()
    {
        // Arrange
        var claims = new ClaimsPrincipal(new ClaimsIdentity());

        // Act
        var userId = _jwtHelper.GetUserID(claims);

        // Assert
        Assert.Equal(0, userId);
    }

    // ==========================================
    // GetPrincipalFromExpiredToken TESTS
    // ==========================================

    [Fact]
    public void GetPrincipalFromExpiredToken_TokenValidoNonScaduto_RestituisceClaimsPrincipal()
    {
        // Arrange - Genera un token valido (non ancora scaduto)
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, "testuser"),
            new Claim(ClaimTypes.NameIdentifier, "99"),
            new Claim("UserId", "99"),
        };
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Act
        var principal = _jwtHelper.GetPrincipalFromExpiredToken(token);

        // Assert
        Assert.NotNull(principal);
    }

    [Fact]
    public void GetPrincipalFromExpiredToken_TokenValidoNonScaduto_ContieneClaimCorretti()
    {
        // Arrange
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, "mario"),
            new Claim(ClaimTypes.NameIdentifier, "55"),
            new Claim("UserId", "55"),
        };
        var (_, token) = _jwtHelper.CreateSignedToken(claims);

        // Act
        var principal = _jwtHelper.GetPrincipalFromExpiredToken(token);

        // Assert
        Assert.NotNull(principal);
        var userId = _jwtHelper.GetUserID(principal);
        Assert.Equal(55, userId);
    }

    [Fact]
    public void GetPrincipalFromExpiredToken_TokenConFirmaInvalida_RestituisceNull()
    {
        // Arrange - Crea un token con una chiave diversa (firma invalida)
        var differentJwtHelper = new JwtHelper(
            "chiave-completamente-diversa-per-test-invalido",
            SecurityKeyType.SymmetricSecurityKey);
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, "testuser"),
            new Claim("UserId", "1"),
        };
        var (_, invalidToken) = differentJwtHelper.CreateSignedToken(claims);

        // Act - Prova a validare con la chiave originale
        var principal = _jwtHelper.GetPrincipalFromExpiredToken(invalidToken);

        // Assert
        Assert.Null(principal);
    }

    [Fact]
    public void GetPrincipalFromExpiredToken_StringaCompletamenteInvalida_RestituisceNull()
    {
        // Act
        var principal = _jwtHelper.GetPrincipalFromExpiredToken("questa-non-e-un-jwt-valido");

        // Assert
        Assert.Null(principal);
    }

    [Fact]
    public void GetPrincipalFromExpiredToken_StringaVuota_RestituisceNull()
    {
        // Act
        var principal = _jwtHelper.GetPrincipalFromExpiredToken("");

        // Assert
        Assert.Null(principal);
    }

    // ==========================================
    // TokenValidationParameters TESTS
    // ==========================================

    [Fact]
    public void TokenValidationParameters_ValidateIssuer_True()
    {
        // Act
        var parameters = _jwtHelper.TokenValidationParameters;

        // Assert
        Assert.True(parameters.ValidateIssuer);
        Assert.Equal("duedgusto-api", parameters.ValidIssuer);
    }

    [Fact]
    public void TokenValidationParameters_ValidateAudience_True()
    {
        // Act
        var parameters = _jwtHelper.TokenValidationParameters;

        // Assert
        Assert.True(parameters.ValidateAudience);
        Assert.Equal("duedgusto-clients", parameters.ValidAudience);
    }

    [Fact]
    public void TokenValidationParameters_ValidateLifetime_True()
    {
        // Act
        var parameters = _jwtHelper.TokenValidationParameters;

        // Assert
        Assert.True(parameters.ValidateLifetime);
    }

    [Fact]
    public void TokenValidationParameters_ClockSkew_6Secondi()
    {
        // Act
        var parameters = _jwtHelper.TokenValidationParameters;

        // Assert
        Assert.Equal(TimeSpan.FromSeconds(6), parameters.ClockSkew);
    }

    [Fact]
    public void TokenValidationParameters_RequireExpirationTime_True()
    {
        // Act
        var parameters = _jwtHelper.TokenValidationParameters;

        // Assert
        Assert.True(parameters.RequireExpirationTime);
    }

    [Fact]
    public void TokenValidationParameters_RequireSignedTokens_True()
    {
        // Act
        var parameters = _jwtHelper.TokenValidationParameters;

        // Assert
        Assert.True(parameters.RequireSignedTokens);
    }

    [Fact]
    public void TokenValidationParameters_ValidateIssuerSigningKey_True()
    {
        // Act
        var parameters = _jwtHelper.TokenValidationParameters;

        // Assert
        Assert.True(parameters.ValidateIssuerSigningKey);
    }

    // ==========================================
    // GetUserName TESTS
    // ==========================================

    [Fact]
    public void GetUserName_EstraeNomeCorretto()
    {
        // Arrange
        var claims = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.Name, "mario.rossi"),
        }, "TestAuth"));

        // Act
        var username = _jwtHelper.GetUserName(claims);

        // Assert
        Assert.Equal("mario.rossi", username);
    }

    [Fact]
    public void GetUserName_SenzaIdentity_RestituisceStringaVuota()
    {
        // Arrange
        var claims = new ClaimsPrincipal(new ClaimsIdentity());

        // Act
        var username = _jwtHelper.GetUserName(claims);

        // Assert
        Assert.Equal(string.Empty, username);
    }

    // ==========================================
    // Key Generation TESTS
    // ==========================================

    [Fact]
    public void CreateNewSymmetricKey_GeneraChiaveBase64Valida()
    {
        // Act
        var key = JwtHelper.CreateNewSymmetricKey();

        // Assert
        Assert.False(string.IsNullOrEmpty(key));
        var bytes = Convert.FromBase64String(key);
        Assert.Equal(32, bytes.Length);
    }

    [Fact]
    public void CreateNewAsymmetricKeyPair_GeneraCoppiaChiavi()
    {
        // Act
        var (publicKey, privateKey) = JwtHelper.CreateNewAsymmetricKeyPair();

        // Assert
        Assert.False(string.IsNullOrEmpty(publicKey));
        Assert.False(string.IsNullOrEmpty(privateKey));
        Assert.NotEqual(publicKey, privateKey);
    }
}
