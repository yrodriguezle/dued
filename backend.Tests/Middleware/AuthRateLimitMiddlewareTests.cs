using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;

using duedgusto.Middleware;

namespace backend.Tests.Middleware;

/// <summary>
/// Test completi per AuthRateLimitMiddleware: rate limiting sugli endpoint di autenticazione.
/// Ogni test usa un IP unico per evitare collisioni con lo stato statico del middleware.
/// </summary>
public class AuthRateLimitMiddlewareTests
{
    private readonly Mock<ILogger<AuthRateLimitMiddleware>> _loggerMock;

    // Contatore statico per generare IP univoci per ogni test
    private static int _ipCounter = 100;

    public AuthRateLimitMiddlewareTests()
    {
        _loggerMock = new Mock<ILogger<AuthRateLimitMiddleware>>();
    }

    /// <summary>
    /// Genera un IP univoco per isolare ogni test dallo stato statico condiviso.
    /// </summary>
    private static string GetUniqueIp()
    {
        int counter = Interlocked.Increment(ref _ipCounter);
        return $"192.168.{counter / 256}.{counter % 256}";
    }

    private (AuthRateLimitMiddleware middleware, Mock<RequestDelegate> nextMock) CreateMiddleware()
    {
        var nextMock = new Mock<RequestDelegate>();
        nextMock.Setup(n => n(It.IsAny<HttpContext>())).Returns(Task.CompletedTask);

        var middleware = new AuthRateLimitMiddleware(nextMock.Object, _loggerMock.Object);
        return (middleware, nextMock);
    }

    private static HttpContext CreateHttpContext(string path, string ipAddress)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = "POST";
        context.Connection.RemoteIpAddress = IPAddress.Parse(ipAddress);
        return context;
    }

    // ==========================================
    // ENDPOINT NON PROTETTI
    // ==========================================

    [Fact]
    public async Task InvokeAsync_EndpointNonProtetto_NonRateLimitato()
    {
        // Arrange
        var (middleware, nextMock) = CreateMiddleware();
        var ip = GetUniqueIp();
        var context = CreateHttpContext("/api/graphql", ip);

        // Act
        await middleware.InvokeAsync(context);

        // Assert - La richiesta passa al next middleware
        nextMock.Verify(n => n(context), Times.Once);
        Assert.NotEqual(StatusCodes.Status429TooManyRequests, context.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_EndpointCasualeNonAuth_NonRateLimitato()
    {
        // Arrange
        var (middleware, nextMock) = CreateMiddleware();
        var ip = GetUniqueIp();

        // Invia 20 richieste a un endpoint non protetto - devono passare tutte
        for (int i = 0; i < 20; i++)
        {
            var context = CreateHttpContext("/api/products", ip);
            await middleware.InvokeAsync(context);

            // Assert - Ogni richiesta passa
            Assert.NotEqual(StatusCodes.Status429TooManyRequests, context.Response.StatusCode);
        }
    }

    // ==========================================
    // SIGNIN RATE LIMITING (max 5 per 15 min)
    // ==========================================

    [Fact]
    public async Task InvokeAsync_PrimaRichiestaSignIn_Permessa()
    {
        // Arrange
        var (middleware, nextMock) = CreateMiddleware();
        var ip = GetUniqueIp();
        var context = CreateHttpContext("/api/auth/signin", ip);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextMock.Verify(n => n(context), Times.Once);
        Assert.NotEqual(StatusCodes.Status429TooManyRequests, context.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_CinqueRichiesteSignIn_TuttePermesse()
    {
        // Arrange
        var (middleware, nextMock) = CreateMiddleware();
        var ip = GetUniqueIp();

        // Act - Invia 5 richieste (il limite e' 5)
        for (int i = 0; i < 5; i++)
        {
            var context = CreateHttpContext("/api/auth/signin", ip);
            await middleware.InvokeAsync(context);

            // Assert - Tutte e 5 devono passare
            Assert.NotEqual(StatusCodes.Status429TooManyRequests, context.Response.StatusCode);
        }
    }

    [Fact]
    public async Task InvokeAsync_SestaRichiestaSignIn_Bloccata429()
    {
        // Arrange
        var (middleware, nextMock) = CreateMiddleware();
        var ip = GetUniqueIp();

        // Invia 5 richieste (raggiunge il limite)
        for (int i = 0; i < 5; i++)
        {
            var context = CreateHttpContext("/api/auth/signin", ip);
            await middleware.InvokeAsync(context);
        }

        // Act - La 6a richiesta deve essere bloccata
        var blockedContext = CreateHttpContext("/api/auth/signin", ip);
        await middleware.InvokeAsync(blockedContext);

        // Assert
        Assert.Equal(StatusCodes.Status429TooManyRequests, blockedContext.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_SignInBloccato_ContieneHeaderRetryAfter()
    {
        // Arrange
        var (middleware, _) = CreateMiddleware();
        var ip = GetUniqueIp();

        // Raggiunge il limite
        for (int i = 0; i < 5; i++)
        {
            var context = CreateHttpContext("/api/auth/signin", ip);
            await middleware.InvokeAsync(context);
        }

        // Act - 6a richiesta bloccata
        var blockedContext = CreateHttpContext("/api/auth/signin", ip);
        await middleware.InvokeAsync(blockedContext);

        // Assert - Deve includere header Retry-After con valore corretto (15 * 60 = 900 secondi)
        Assert.Equal(StatusCodes.Status429TooManyRequests, blockedContext.Response.StatusCode);
        Assert.True(blockedContext.Response.Headers.ContainsKey("Retry-After"));
        Assert.Equal("900", blockedContext.Response.Headers["Retry-After"].ToString());
    }

    // ==========================================
    // REFRESH RATE LIMITING (max 10 per 1 min)
    // ==========================================

    [Fact]
    public async Task InvokeAsync_PrimaRichiestaRefresh_Permessa()
    {
        // Arrange
        var (middleware, nextMock) = CreateMiddleware();
        var ip = GetUniqueIp();
        var context = CreateHttpContext("/api/auth/refresh", ip);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        nextMock.Verify(n => n(context), Times.Once);
        Assert.NotEqual(StatusCodes.Status429TooManyRequests, context.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_DieciRichiesteRefresh_TuttePermesse()
    {
        // Arrange
        var (middleware, _) = CreateMiddleware();
        var ip = GetUniqueIp();

        // Act - Invia 10 richieste (il limite e' 10)
        for (int i = 0; i < 10; i++)
        {
            var context = CreateHttpContext("/api/auth/refresh", ip);
            await middleware.InvokeAsync(context);

            // Assert
            Assert.NotEqual(StatusCodes.Status429TooManyRequests, context.Response.StatusCode);
        }
    }

    [Fact]
    public async Task InvokeAsync_UndicesimaRichiestaRefresh_Bloccata429()
    {
        // Arrange
        var (middleware, _) = CreateMiddleware();
        var ip = GetUniqueIp();

        // Invia 10 richieste (raggiunge il limite)
        for (int i = 0; i < 10; i++)
        {
            var context = CreateHttpContext("/api/auth/refresh", ip);
            await middleware.InvokeAsync(context);
        }

        // Act - L'11a richiesta deve essere bloccata
        var blockedContext = CreateHttpContext("/api/auth/refresh", ip);
        await middleware.InvokeAsync(blockedContext);

        // Assert
        Assert.Equal(StatusCodes.Status429TooManyRequests, blockedContext.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_RefreshBloccato_ContieneHeaderRetryAfter()
    {
        // Arrange
        var (middleware, _) = CreateMiddleware();
        var ip = GetUniqueIp();

        // Raggiunge il limite
        for (int i = 0; i < 10; i++)
        {
            var context = CreateHttpContext("/api/auth/refresh", ip);
            await middleware.InvokeAsync(context);
        }

        // Act - 11a richiesta bloccata
        var blockedContext = CreateHttpContext("/api/auth/refresh", ip);
        await middleware.InvokeAsync(blockedContext);

        // Assert - Retry-After = 60 secondi (1 minuto)
        Assert.Equal(StatusCodes.Status429TooManyRequests, blockedContext.Response.StatusCode);
        Assert.True(blockedContext.Response.Headers.ContainsKey("Retry-After"));
        Assert.Equal("60", blockedContext.Response.Headers["Retry-After"].ToString());
    }

    // ==========================================
    // IP INDIPENDENTI
    // ==========================================

    [Fact]
    public async Task InvokeAsync_IpDiversi_TracciatiIndipendentemente()
    {
        // Arrange
        var (middleware, _) = CreateMiddleware();
        var ip1 = GetUniqueIp();
        var ip2 = GetUniqueIp();

        // Esaurisce il limite per IP1 (5 richieste a signin)
        for (int i = 0; i < 5; i++)
        {
            var ctx = CreateHttpContext("/api/auth/signin", ip1);
            await middleware.InvokeAsync(ctx);
        }

        // Act - IP1 dovrebbe essere bloccato, IP2 dovrebbe passare
        var ip1Blocked = CreateHttpContext("/api/auth/signin", ip1);
        await middleware.InvokeAsync(ip1Blocked);

        var ip2Allowed = CreateHttpContext("/api/auth/signin", ip2);
        await middleware.InvokeAsync(ip2Allowed);

        // Assert
        Assert.Equal(StatusCodes.Status429TooManyRequests, ip1Blocked.Response.StatusCode);
        Assert.NotEqual(StatusCodes.Status429TooManyRequests, ip2Allowed.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_SignInERefresh_TracciatiSeparatamente()
    {
        // Arrange - Lo stesso IP ha limiti separati per signin e refresh
        var (middleware, _) = CreateMiddleware();
        var ip = GetUniqueIp();

        // Esaurisce il limite signin (5 richieste)
        for (int i = 0; i < 5; i++)
        {
            var ctx = CreateHttpContext("/api/auth/signin", ip);
            await middleware.InvokeAsync(ctx);
        }

        // Act - Il refresh dallo stesso IP dovrebbe ancora passare
        var refreshContext = CreateHttpContext("/api/auth/refresh", ip);
        await middleware.InvokeAsync(refreshContext);

        // Assert - Signin bloccato ma refresh permesso
        var signinBlocked = CreateHttpContext("/api/auth/signin", ip);
        await middleware.InvokeAsync(signinBlocked);

        Assert.Equal(StatusCodes.Status429TooManyRequests, signinBlocked.Response.StatusCode);
        Assert.NotEqual(StatusCodes.Status429TooManyRequests, refreshContext.Response.StatusCode);
    }

    // ==========================================
    // X-FORWARDED-FOR SUPPORT
    // ==========================================

    [Fact]
    public async Task InvokeAsync_ConXForwardedFor_UsaIpForwarded()
    {
        // Arrange
        var (middleware, _) = CreateMiddleware();
        var forwardedIp = GetUniqueIp();

        // Invia richieste con X-Forwarded-For
        for (int i = 0; i < 5; i++)
        {
            var ctx = CreateHttpContext("/api/auth/signin", "127.0.0.1");
            ctx.Request.Headers["X-Forwarded-For"] = forwardedIp;
            await middleware.InvokeAsync(ctx);
        }

        // Act - 6a richiesta dallo stesso IP forwarded
        var blockedCtx = CreateHttpContext("/api/auth/signin", "127.0.0.1");
        blockedCtx.Request.Headers["X-Forwarded-For"] = forwardedIp;
        await middleware.InvokeAsync(blockedCtx);

        // Assert - Deve essere bloccato basandosi sull'IP forwarded
        Assert.Equal(StatusCodes.Status429TooManyRequests, blockedCtx.Response.StatusCode);
    }

    // ==========================================
    // CLEANUP
    // ==========================================

    [Fact]
    public void CleanupOldEntries_NonLanciaEccezioni()
    {
        // Act & Assert - non deve lanciare eccezioni
        AuthRateLimitMiddleware.CleanupOldEntries();
    }
}
