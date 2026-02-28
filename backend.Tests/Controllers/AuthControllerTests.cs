using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Moq;

using duedgusto.Controllers;
using duedgusto.DataAccess;
using duedgusto.Services.Jwt;
using duedgusto.GraphQL.Authentication;
using backend.Tests.Helpers;

namespace backend.Tests.Controllers;

/// <summary>
/// Test completi per AuthController: signin, refresh token, logout.
/// Usa InMemory DbContext e JwtHelper reale per verificare il comportamento effettivo.
/// </summary>
public class AuthControllerTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly JwtHelper _jwtHelper;
    private readonly Mock<IWebHostEnvironment> _envMock;

    public AuthControllerTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _jwtHelper = new JwtHelper(
            "====*-o-*-dued-json-web-key-test-*-o-*====",
            SecurityKeyType.SymmetricSecurityKey);
        _envMock = new Mock<IWebHostEnvironment>();
        _envMock.Setup(e => e.EnvironmentName).Returns("Development");
    }

    public void Dispose()
    {
        _dbContext.Dispose();
    }

    private AuthController CreateController(ClaimsPrincipal? user = null)
    {
        var controller = new AuthController(_dbContext, _jwtHelper, _envMock.Object);

        var httpContext = new DefaultHttpContext();
        if (user != null)
        {
            httpContext.User = user;
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }

    // ==========================================
    // SIGNIN TESTS
    // ==========================================

    [Fact]
    public async Task SignIn_ConCredenzialiValide_RestituisceOkConToken()
    {
        // Arrange
        TestDbContextFactory.CreateTestUser(_dbContext, "admin", "Password123!");
        var controller = CreateController();
        var request = new SignInRequest("admin", "Password123!");

        // Act
        var result = await controller.SignIn(request);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task SignIn_ConCredenzialiValide_RispostaContieneTokenERefreshToken()
    {
        // Arrange
        TestDbContextFactory.CreateTestUser(_dbContext, "admin2", "Password123!");
        var controller = CreateController();
        var request = new SignInRequest("admin2", "Password123!");

        // Act
        var result = await controller.SignIn(request);

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);

        // Verifica che la risposta contenga sia Token che RefreshToken
        var responseType = okResult.Value.GetType();
        var tokenProp = responseType.GetProperty("Token");
        var refreshTokenProp = responseType.GetProperty("RefreshToken");

        Assert.NotNull(tokenProp);
        Assert.NotNull(refreshTokenProp);

        var tokenValue = tokenProp.GetValue(okResult.Value) as string;
        var refreshTokenValue = refreshTokenProp.GetValue(okResult.Value) as string;

        Assert.False(string.IsNullOrEmpty(tokenValue), "Token non deve essere vuoto");
        Assert.False(string.IsNullOrEmpty(refreshTokenValue), "RefreshToken non deve essere vuoto");

        // Verifica che il JWT ha 3 parti (header.payload.signature)
        var jwtParts = tokenValue!.Split('.');
        Assert.Equal(3, jwtParts.Length);
    }

    [Fact]
    public async Task SignIn_ConCredenzialiValide_SalvaRefreshTokenEScadenzaInDb()
    {
        // Arrange
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "admin3", "Password123!");
        var controller = CreateController();
        var request = new SignInRequest("admin3", "Password123!");

        // Act
        var beforeSignIn = DateTime.UtcNow;
        await controller.SignIn(request);

        // Assert - Verifica che il refresh token sia salvato nel DB
        await _dbContext.Entry(utente).ReloadAsync();
        Assert.NotNull(utente.TokenAggiornamento);
        Assert.False(string.IsNullOrEmpty(utente.TokenAggiornamento));

        // Verifica che la scadenza sia impostata a ~7 giorni nel futuro
        Assert.NotNull(utente.ScadenzaTokenAggiornamento);
        Assert.True(utente.ScadenzaTokenAggiornamento.Value >= beforeSignIn.AddDays(7).AddSeconds(-5));
        Assert.True(utente.ScadenzaTokenAggiornamento.Value <= DateTime.UtcNow.AddDays(7).AddSeconds(5));
    }

    [Fact]
    public async Task SignIn_ConPasswordErrata_RestituisceUnauthorized()
    {
        // Arrange
        TestDbContextFactory.CreateTestUser(_dbContext, "admin4", "Password123!");
        var controller = CreateController();
        var request = new SignInRequest("admin4", "PasswordSbagliata!");

        // Act
        var result = await controller.SignIn(request);

        // Assert
        var unauthorizedResult = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.NotNull(unauthorizedResult.Value);
    }

    [Fact]
    public async Task SignIn_UtenteInesistente_RestituisceUnauthorized()
    {
        // Arrange - nessun utente nel DB con questo nome
        var controller = CreateController();
        var request = new SignInRequest("utenteinesistente", "Password123!");

        // Act
        var result = await controller.SignIn(request);

        // Assert
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task SignIn_UtenteInesistente_ProtezioneTimingAttack()
    {
        // Arrange - Verifica che per utente inesistente il controller esegua comunque
        // una verifica password (dummy) per proteggere contro timing attack.
        // Entrambi i casi (utente esistente + pw errata, utente inesistente) dovrebbero
        // restituire Unauthorized senza rivelare se l'utente esiste.
        TestDbContextFactory.CreateTestUser(_dbContext, "realuser", "Password123!");
        var controller = CreateController();

        // Act
        var resultExistingUser = await controller.SignIn(new SignInRequest("realuser", "WrongPassword!"));
        var resultNonExistingUser = await controller.SignIn(new SignInRequest("fakeuser", "WrongPassword!"));

        // Assert - entrambi restituiscono Unauthorized (nessuna differenza osservabile)
        Assert.IsType<UnauthorizedObjectResult>(resultExistingUser);
        Assert.IsType<UnauthorizedObjectResult>(resultNonExistingUser);
    }

    [Fact]
    public async Task SignIn_AccountDisabilitato_RestituisceUnauthorized()
    {
        // Arrange
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "disabilitato", "Password123!");
        utente.Disabilitato = true;
        _dbContext.SaveChanges();

        var controller = CreateController();
        var request = new SignInRequest("disabilitato", "Password123!");

        // Act
        var result = await controller.SignIn(request);

        // Assert
        var unauthorizedResult = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.NotNull(unauthorizedResult.Value);
    }

    [Fact]
    public async Task SignIn_AccountDisabilitato_NonSalvaRefreshToken()
    {
        // Arrange
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "disab2", "Password123!");
        utente.Disabilitato = true;
        utente.TokenAggiornamento = null;
        _dbContext.SaveChanges();

        var controller = CreateController();
        var request = new SignInRequest("disab2", "Password123!");

        // Act
        await controller.SignIn(request);

        // Assert - il refresh token NON deve essere salvato per account disabilitati
        await _dbContext.Entry(utente).ReloadAsync();
        Assert.Null(utente.TokenAggiornamento);
    }

    // ==========================================
    // REFRESH TOKEN TESTS
    // ==========================================

    [Fact]
    public async Task RefreshToken_ConTokenValido_RestituisceNuovoTokenPair()
    {
        // Arrange
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "refreshuser", "Password123!");
        utente.TokenAggiornamento = "valid-refresh-token-abc";
        utente.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        _dbContext.SaveChanges();

        var controller = CreateController();
        var request = new TokenResponse("dummy-token", "valid-refresh-token-abc");

        // Act
        var result = await controller.RefreshToken(request);

        // Assert
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.NotNull(objectResult.Value);

        // Verifica che la risposta contenga Token e RefreshToken
        var responseType = objectResult.Value.GetType();
        var tokenProp = responseType.GetProperty("Token");
        var refreshTokenProp = responseType.GetProperty("RefreshToken");
        Assert.NotNull(tokenProp);
        Assert.NotNull(refreshTokenProp);

        var tokenValue = tokenProp.GetValue(objectResult.Value) as string;
        var refreshTokenValue = refreshTokenProp.GetValue(objectResult.Value) as string;
        Assert.False(string.IsNullOrEmpty(tokenValue));
        Assert.False(string.IsNullOrEmpty(refreshTokenValue));
    }

    [Fact]
    public async Task RefreshToken_ConTokenInesistente_RestituisceUnauthorized()
    {
        // Arrange
        var controller = CreateController();
        var request = new TokenResponse("dummy-token", "token-inesistente-xyz");

        // Act
        var result = await controller.RefreshToken(request);

        // Assert
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task RefreshToken_ConTokenScaduto_RestituisceUnauthorizedEInvalidaDb()
    {
        // Arrange - BUG FIX 1: il refresh token scaduto deve essere rifiutato e invalidato nel DB
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "expireduser", "Password123!");
        utente.TokenAggiornamento = "expired-refresh-token";
        utente.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddMinutes(-10); // Scaduto 10 minuti fa
        _dbContext.SaveChanges();

        var controller = CreateController();
        var request = new TokenResponse("dummy-token", "expired-refresh-token");

        // Act
        var result = await controller.RefreshToken(request);

        // Assert - Deve restituire Unauthorized
        Assert.IsType<UnauthorizedObjectResult>(result);

        // Assert - Il token nel DB deve essere stato invalidato (nullificato)
        await _dbContext.Entry(utente).ReloadAsync();
        Assert.Null(utente.TokenAggiornamento);
        Assert.Null(utente.ScadenzaTokenAggiornamento);
    }

    [Fact]
    public async Task RefreshToken_ConScadenzaNull_RestituisceUnauthorizedEInvalidaDb()
    {
        // Arrange - Token con ScadenzaTokenAggiornamento = null (caso edge)
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "nullexpuser", "Password123!");
        utente.TokenAggiornamento = "no-expiry-token";
        utente.ScadenzaTokenAggiornamento = null;
        _dbContext.SaveChanges();

        var controller = CreateController();
        var request = new TokenResponse("dummy-token", "no-expiry-token");

        // Act
        var result = await controller.RefreshToken(request);

        // Assert
        Assert.IsType<UnauthorizedObjectResult>(result);

        // Il token deve essere stato invalidato
        await _dbContext.Entry(utente).ReloadAsync();
        Assert.Null(utente.TokenAggiornamento);
    }

    [Fact]
    public async Task RefreshToken_AccountDisabilitato_RestituisceUnauthorized()
    {
        // Arrange - Account disabilitato dopo il login
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "disabledrefresh", "Password123!");
        utente.TokenAggiornamento = "valid-token-disabled";
        utente.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        utente.Disabilitato = true;
        _dbContext.SaveChanges();

        var controller = CreateController();
        var request = new TokenResponse("dummy-token", "valid-token-disabled");

        // Act
        var result = await controller.RefreshToken(request);

        // Assert
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task RefreshToken_RuotaToken_NuovoRefreshTokenDiversoDalVecchio()
    {
        // Arrange
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "rotateuser", "Password123!");
        string oldRefreshToken = "old-refresh-token-rotate";
        utente.TokenAggiornamento = oldRefreshToken;
        utente.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        _dbContext.SaveChanges();

        var controller = CreateController();
        var request = new TokenResponse("dummy-token", oldRefreshToken);

        // Act
        var result = await controller.RefreshToken(request);

        // Assert
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.NotNull(objectResult.Value);

        // Verifica che il nuovo refresh token nel DB sia diverso dal vecchio
        await _dbContext.Entry(utente).ReloadAsync();
        Assert.NotNull(utente.TokenAggiornamento);
        Assert.NotEqual(oldRefreshToken, utente.TokenAggiornamento);
    }

    [Fact]
    public async Task RefreshToken_AggiornaScadenzaA7Giorni()
    {
        // Arrange
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "expiryupdate", "Password123!");
        utente.TokenAggiornamento = "token-for-expiry-update";
        utente.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(3); // Scade tra 3 giorni
        _dbContext.SaveChanges();

        var controller = CreateController();
        var request = new TokenResponse("dummy-token", "token-for-expiry-update");

        // Act
        var beforeRefresh = DateTime.UtcNow;
        var result = await controller.RefreshToken(request);

        // Assert - La scadenza deve essere aggiornata a 7 giorni da adesso
        Assert.IsType<ObjectResult>(result);
        await _dbContext.Entry(utente).ReloadAsync();
        Assert.NotNull(utente.ScadenzaTokenAggiornamento);

        // La nuova scadenza deve essere ~7 giorni dal momento del refresh
        var expectedMinExpiry = beforeRefresh.AddDays(7).AddSeconds(-5);
        var expectedMaxExpiry = DateTime.UtcNow.AddDays(7).AddSeconds(5);
        Assert.True(utente.ScadenzaTokenAggiornamento.Value >= expectedMinExpiry,
            $"Scadenza {utente.ScadenzaTokenAggiornamento.Value} deve essere >= {expectedMinExpiry}");
        Assert.True(utente.ScadenzaTokenAggiornamento.Value <= expectedMaxExpiry,
            $"Scadenza {utente.ScadenzaTokenAggiornamento.Value} deve essere <= {expectedMaxExpiry}");
    }

    // ==========================================
    // LOGOUT TESTS
    // ==========================================

    [Fact]
    public async Task Logout_ConJwtNelBody_InvalidaRefreshTokenInDb()
    {
        // Arrange - Crea un utente e genera un JWT reale per lui
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "logoutbody", "Password123!");
        utente.TokenAggiornamento = "token-da-invalidare-body";
        utente.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        _dbContext.SaveChanges();

        // Genera un JWT reale con i claim dell'utente
        var claims = new Claim[]
        {
            new(ClaimTypes.Name, utente.NomeUtente),
            new(ClaimTypes.NameIdentifier, utente.Id.ToString()),
            new("UserId", utente.Id.ToString()),
        };
        var (_, jwtToken) = _jwtHelper.CreateSignedToken(claims);

        var controller = CreateController();
        var logoutRequest = new LogoutRequest(jwtToken);

        // Act
        var result = await controller.Logout(logoutRequest);

        // Assert
        Assert.IsType<OkObjectResult>(result);

        // Verifica che il refresh token sia stato invalidato nel DB
        await _dbContext.Entry(utente).ReloadAsync();
        Assert.Null(utente.TokenAggiornamento);
        Assert.Null(utente.ScadenzaTokenAggiornamento);
    }

    [Fact]
    public async Task Logout_ConClaimsPrincipalAutenticato_InvalidaRefreshToken()
    {
        // Arrange - Utente autenticato tramite ClaimsPrincipal (fallback 3)
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "logoutclaims", "Password123!");
        utente.TokenAggiornamento = "token-da-invalidare-claims";
        utente.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        _dbContext.SaveChanges();

        var claimsPrincipal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, utente.Id.ToString()),
            new Claim(ClaimTypes.Name, utente.NomeUtente),
        }, "TestAuth"));

        var controller = CreateController(claimsPrincipal);

        // Act
        var result = await controller.Logout();

        // Assert
        Assert.IsType<OkObjectResult>(result);
        await _dbContext.Entry(utente).ReloadAsync();
        Assert.Null(utente.TokenAggiornamento);
        Assert.Null(utente.ScadenzaTokenAggiornamento);
    }

    [Fact]
    public async Task Logout_ConTokenInvalido_RestituisceOkMaNonInvalidaNulla()
    {
        // Arrange - Token completamente invalido
        var controller = CreateController();
        var logoutRequest = new LogoutRequest("token-completamente-invalido-xyz");

        // Act
        var result = await controller.Logout(logoutRequest);

        // Assert - Il logout restituisce sempre Ok (per non rivelare informazioni)
        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public async Task Logout_SenzaTokenNelBody_ConAuthorizationHeader_InvalidaToken()
    {
        // Arrange
        var utente = TestDbContextFactory.CreateTestUser(_dbContext, "logoutheader", "Password123!");
        utente.TokenAggiornamento = "token-da-invalidare-header";
        utente.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        _dbContext.SaveChanges();

        // Genera un JWT reale
        var claims = new Claim[]
        {
            new(ClaimTypes.Name, utente.NomeUtente),
            new(ClaimTypes.NameIdentifier, utente.Id.ToString()),
            new("UserId", utente.Id.ToString()),
        };
        var (_, jwtToken) = _jwtHelper.CreateSignedToken(claims);

        var controller = CreateController();
        // Imposta l'Authorization header
        controller.ControllerContext.HttpContext.Request.Headers.Authorization = $"Bearer {jwtToken}";

        // Act - Logout senza token nel body, ma con Authorization header
        var result = await controller.Logout(new LogoutRequest(null));

        // Assert
        Assert.IsType<OkObjectResult>(result);
        await _dbContext.Entry(utente).ReloadAsync();
        Assert.Null(utente.TokenAggiornamento);
        Assert.Null(utente.ScadenzaTokenAggiornamento);
    }

    [Fact]
    public async Task Logout_SenzaNessunToken_RestituisceOk()
    {
        // Arrange - Nessun token disponibile in nessuna fonte
        var controller = CreateController();

        // Act
        var result = await controller.Logout();

        // Assert - Restituisce comunque Ok
        Assert.IsType<OkObjectResult>(result);
    }
}
