using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using duedgusto.Controllers;
using duedgusto.Services.Jwt;
using duedgusto.Services.HashPassword;
using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Unit.Controllers;

public class AuthControllerTests : IDisposable
{
    private readonly AppDbContext _dbContext;
    private readonly JwtHelper _jwtHelper;
    private readonly Mock<IWebHostEnvironment> _envMock;
    private readonly AuthController _controller;

    public AuthControllerTests()
    {
        _dbContext = TestDbContextFactory.Create();
        _jwtHelper = JwtTestHelper.CreateJwtHelper();
        _envMock = new Mock<IWebHostEnvironment>();
        _envMock.Setup(e => e.EnvironmentName).Returns("Development");
        _controller = new AuthController(_dbContext, _jwtHelper, _envMock.Object);

        // Set up HttpContext for the controller
        var httpContext = new DefaultHttpContext();
        httpContext.Response.Body = new MemoryStream();
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };
    }

    public void Dispose()
    {
        _dbContext.Dispose();
        GC.SuppressFinalize(this);
    }

    #region Sign-In Flow (REQ-1.4.1)

    [Fact]
    public async Task SignIn_ValidCredentials_ReturnsOkWithToken()
    {
        // Arrange
        var user = SeedTestUser("cashier", "Test123!");
        var request = new SignInRequest("cashier", "Test123!");

        // Act
        var result = await _controller.SignIn(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);

        // Check the response contains Token and RefreshToken
        var value = okResult.Value!;
        var tokenProp = value.GetType().GetProperty("Token");
        var refreshProp = value.GetType().GetProperty("RefreshToken");
        tokenProp.Should().NotBeNull();
        refreshProp.Should().NotBeNull();

        var token = tokenProp!.GetValue(value) as string;
        var refreshToken = refreshProp!.GetValue(value) as string;
        token.Should().NotBeNullOrWhiteSpace();
        refreshToken.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task SignIn_InvalidPassword_ReturnsUnauthorized()
    {
        // Arrange
        SeedTestUser("cashier", "Test123!");
        var request = new SignInRequest("cashier", "WrongPass");

        // Act
        var result = await _controller.SignIn(request);

        // Assert
        var unauthorizedResult = result.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorizedResult.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task SignIn_NonExistentUser_ReturnsUnauthorized()
    {
        // Arrange
        var request = new SignInRequest("nonexistent", "SomePassword");

        // Act
        var result = await _controller.SignIn(request);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task SignIn_DisabledAccount_ReturnsUnauthorized()
    {
        // Arrange
        var user = SeedTestUser("disabled_user", "Test123!");
        user.Disabilitato = true;
        await _dbContext.SaveChangesAsync();

        var request = new SignInRequest("disabled_user", "Test123!");

        // Act
        var result = await _controller.SignIn(request);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task SignIn_ValidCredentials_StoresRefreshTokenInDatabase()
    {
        // Arrange
        SeedTestUser("cashier", "Test123!");
        var request = new SignInRequest("cashier", "Test123!");

        // Act
        await _controller.SignIn(request);

        // Assert
        var user = await _dbContext.Utenti.FirstOrDefaultAsync(u => u.NomeUtente == "cashier");
        user!.TokenAggiornamento.Should().NotBeNullOrWhiteSpace();
        user.ScadenzaTokenAggiornamento.Should().NotBeNull();
        user.ScadenzaTokenAggiornamento!.Value.Should().BeAfter(DateTime.UtcNow);
    }

    #endregion

    #region Token Refresh (REQ-1.4.2)

    [Fact]
    public async Task RefreshToken_ValidRefreshToken_ReturnsNewTokens()
    {
        // Arrange
        var user = SeedTestUser("cashier", "Test123!");
        // Simulate a previous sign-in by setting refresh token
        var (refreshToken, _) = JwtTestHelper.CreateTestToken(user.Id, user.NomeUtente);
        user.TokenAggiornamento = refreshToken;
        user.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        await _dbContext.SaveChangesAsync();

        var request = new duedgusto.GraphQL.Authentication.TokenResponse("dummy", refreshToken);

        // Act
        var result = await _controller.RefreshToken(request);

        // Assert
        var okResult = result.Should().BeOfType<ObjectResult>().Subject;
        // ObjectResult defaults to 200 when StatusCode is null
        (okResult.StatusCode ?? 200).Should().Be(200);

        var value = okResult.Value!;
        var tokenProp = value.GetType().GetProperty("Token");
        tokenProp.Should().NotBeNull();
        var newToken = tokenProp!.GetValue(value) as string;
        newToken.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task RefreshToken_ExpiredRefreshToken_ReturnsUnauthorized()
    {
        // Arrange
        var user = SeedTestUser("cashier", "Test123!");
        user.TokenAggiornamento = "some-refresh-token";
        user.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(-1); // Expired
        await _dbContext.SaveChangesAsync();

        var request = new duedgusto.GraphQL.Authentication.TokenResponse("dummy", "some-refresh-token");

        // Act
        var result = await _controller.RefreshToken(request);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task RefreshToken_InvalidRefreshToken_ReturnsUnauthorized()
    {
        // Arrange — no user has this refresh token
        var request = new duedgusto.GraphQL.Authentication.TokenResponse("dummy", "nonexistent-token");

        // Act
        var result = await _controller.RefreshToken(request);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task RefreshToken_RotatesToken_OldTokenInvalidated()
    {
        // Arrange
        var user = SeedTestUser("cashier", "Test123!");
        const string oldRefreshToken = "old-refresh-token";
        user.TokenAggiornamento = oldRefreshToken;
        user.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        await _dbContext.SaveChangesAsync();

        var request = new duedgusto.GraphQL.Authentication.TokenResponse("dummy", oldRefreshToken);

        // Act
        await _controller.RefreshToken(request);

        // Assert — the old refresh token should be replaced
        var updatedUser = await _dbContext.Utenti.FirstAsync(u => u.Id == user.Id);
        updatedUser.TokenAggiornamento.Should().NotBe(oldRefreshToken);
        updatedUser.TokenAggiornamento.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task RefreshToken_DisabledAccount_ReturnsUnauthorized()
    {
        // Arrange
        var user = SeedTestUser("cashier", "Test123!");
        user.TokenAggiornamento = "valid-token";
        user.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        user.Disabilitato = true;
        await _dbContext.SaveChangesAsync();

        var request = new duedgusto.GraphQL.Authentication.TokenResponse("dummy", "valid-token");

        // Act
        var result = await _controller.RefreshToken(request);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    #endregion

    #region Sign-Out (REQ-1.4.3)

    [Fact]
    public async Task Logout_WithToken_ClearsRefreshToken()
    {
        // Arrange
        var user = SeedTestUser("cashier", "Test123!");
        var (_, accessToken) = JwtTestHelper.CreateTestToken(user.Id, user.NomeUtente);
        user.TokenAggiornamento = "some-refresh-token";
        user.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        await _dbContext.SaveChangesAsync();

        var request = new LogoutRequest(accessToken);

        // Act
        var result = await _controller.Logout(request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var updatedUser = await _dbContext.Utenti.FirstAsync(u => u.Id == user.Id);
        updatedUser.TokenAggiornamento.Should().BeNull();
        updatedUser.ScadenzaTokenAggiornamento.Should().BeNull();
    }

    [Fact]
    public async Task Logout_InvalidatedToken_CannotBeReused()
    {
        // Arrange
        var user = SeedTestUser("cashier", "Test123!");
        const string refreshToken = "valid-refresh-token";
        var (_, accessToken) = JwtTestHelper.CreateTestToken(user.Id, user.NomeUtente);
        user.TokenAggiornamento = refreshToken;
        user.ScadenzaTokenAggiornamento = DateTime.UtcNow.AddDays(7);
        await _dbContext.SaveChangesAsync();

        // Act — logout
        await _controller.Logout(new LogoutRequest(accessToken));

        // Try to refresh with the old token
        var refreshRequest = new duedgusto.GraphQL.Authentication.TokenResponse("dummy", refreshToken);
        var result = await _controller.RefreshToken(refreshRequest);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task Logout_NoTokenProvided_ReturnsOk()
    {
        // Logout with no token — should not crash, just return OK
        var result = await _controller.Logout(null);

        result.Should().BeOfType<OkObjectResult>();
    }

    #endregion

    #region Helpers

    private Utente SeedTestUser(string username, string password)
    {
        // Need a role for the user
        var role = _dbContext.Ruoli.FirstOrDefault(r => r.Nome == "TestRole");
        if (role == null)
        {
            role = new Ruolo { Nome = "TestRole", Descrizione = "Test Role" };
            _dbContext.Ruoli.Add(role);
            _dbContext.SaveChanges();
        }

        var user = JwtTestHelper.CreateTestUtente(id: 0, username: username, password: password);
        user.RuoloId = role.Id;
        _dbContext.Utenti.Add(user);
        _dbContext.SaveChanges();
        return user;
    }

    #endregion
}
