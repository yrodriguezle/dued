using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using duedgusto.Middleware;
using DuedGusto.Tests.Helpers;

namespace DuedGusto.Tests.Unit.Middleware;

public class AuthRateLimitMiddlewareTests : IDisposable
{
    private readonly Mock<ILogger<AuthRateLimitMiddleware>> _loggerMock;
    private bool _nextWasCalled;

    public AuthRateLimitMiddlewareTests()
    {
        _loggerMock = new Mock<ILogger<AuthRateLimitMiddleware>>();
        // Clean up static state before each test
        AuthRateLimitMiddleware.CleanupOldEntries();
    }

    public void Dispose()
    {
        // Force cleanup of all rate limit entries after each test
        AuthRateLimitMiddleware.CleanupOldEntries();
        GC.SuppressFinalize(this);
    }

    #region Non-Rate-Limited Paths (REQ-1.5.1)

    [Theory]
    [InlineData("/api/graphql")]
    [InlineData("/api/other")]
    [InlineData("/")]
    [InlineData("/health")]
    public async Task InvokeAsync_NonRateLimitedPath_PassesThrough(string path)
    {
        // Arrange
        var middleware = CreateMiddleware();
        var context = MockHttpContextFactory.Create(remoteIp: GetUniqueIp(), path: path);

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        _nextWasCalled.Should().BeTrue();
        context.Response.StatusCode.Should().NotBe(429);
    }

    #endregion

    #region Requests Within Limit (REQ-1.5.1)

    [Fact]
    public async Task InvokeAsync_SignIn_WithinLimit_PassesThrough()
    {
        // Arrange — signin allows 5 requests per 15 minutes
        var middleware = CreateMiddleware();
        var ip = GetUniqueIp();

        // Act — send exactly 5 requests
        for (int i = 0; i < 5; i++)
        {
            _nextWasCalled = false;
            var context = MockHttpContextFactory.Create(remoteIp: ip, path: "/api/auth/signin");
            await middleware.InvokeAsync(context);
            _nextWasCalled.Should().BeTrue($"request {i + 1} should pass through");
            context.Response.StatusCode.Should().NotBe(429);
        }
    }

    [Fact]
    public async Task InvokeAsync_Refresh_WithinLimit_PassesThrough()
    {
        // Arrange — refresh allows 10 requests per 1 minute
        var middleware = CreateMiddleware();
        var ip = GetUniqueIp();

        // Act — send exactly 10 requests
        for (int i = 0; i < 10; i++)
        {
            _nextWasCalled = false;
            var context = MockHttpContextFactory.Create(remoteIp: ip, path: "/api/auth/refresh");
            await middleware.InvokeAsync(context);
            _nextWasCalled.Should().BeTrue($"request {i + 1} should pass through");
        }
    }

    #endregion

    #region Exceeding Limit (REQ-1.5.1)

    [Fact]
    public async Task InvokeAsync_SignIn_ExceedingLimit_Returns429()
    {
        // Arrange
        var middleware = CreateMiddleware();
        var ip = GetUniqueIp();

        // Exhaust the limit (5 requests)
        for (int i = 0; i < 5; i++)
        {
            var ctx = MockHttpContextFactory.Create(remoteIp: ip, path: "/api/auth/signin");
            await middleware.InvokeAsync(ctx);
        }

        // Act — 6th request should be blocked
        _nextWasCalled = false;
        var context = MockHttpContextFactory.Create(remoteIp: ip, path: "/api/auth/signin");
        await middleware.InvokeAsync(context);

        // Assert
        _nextWasCalled.Should().BeFalse();
        context.Response.StatusCode.Should().Be(429);
    }

    [Fact]
    public async Task InvokeAsync_Refresh_ExceedingLimit_Returns429()
    {
        // Arrange
        var middleware = CreateMiddleware();
        var ip = GetUniqueIp();

        // Exhaust the limit (10 requests)
        for (int i = 0; i < 10; i++)
        {
            var ctx = MockHttpContextFactory.Create(remoteIp: ip, path: "/api/auth/refresh");
            await middleware.InvokeAsync(ctx);
        }

        // Act — 11th request
        _nextWasCalled = false;
        var context = MockHttpContextFactory.Create(remoteIp: ip, path: "/api/auth/refresh");
        await middleware.InvokeAsync(context);

        // Assert
        _nextWasCalled.Should().BeFalse();
        context.Response.StatusCode.Should().Be(429);
    }

    [Fact]
    public async Task InvokeAsync_ExceedingLimit_IncludesRetryAfterHeader()
    {
        // Arrange
        var middleware = CreateMiddleware();
        var ip = GetUniqueIp();

        // Exhaust signin limit
        for (int i = 0; i < 5; i++)
        {
            var ctx = MockHttpContextFactory.Create(remoteIp: ip, path: "/api/auth/signin");
            await middleware.InvokeAsync(ctx);
        }

        // Act
        var context = MockHttpContextFactory.Create(remoteIp: ip, path: "/api/auth/signin");
        await middleware.InvokeAsync(context);

        // Assert — Retry-After should be 900 seconds (15 minutes * 60)
        context.Response.Headers.Should().ContainKey("Retry-After");
        context.Response.Headers["Retry-After"].ToString().Should().Be("900");
    }

    #endregion

    #region Per-IP Isolation (REQ-1.5.1)

    [Fact]
    public async Task InvokeAsync_DifferentIPs_HaveIndependentLimits()
    {
        // Arrange
        var middleware = CreateMiddleware();
        var ip1 = GetUniqueIp();
        var ip2 = GetUniqueIp();

        // Exhaust limit for ip1
        for (int i = 0; i < 5; i++)
        {
            var ctx = MockHttpContextFactory.Create(remoteIp: ip1, path: "/api/auth/signin");
            await middleware.InvokeAsync(ctx);
        }

        // Act — ip2 should still be able to make requests
        _nextWasCalled = false;
        var context = MockHttpContextFactory.Create(remoteIp: ip2, path: "/api/auth/signin");
        await middleware.InvokeAsync(context);

        // Assert
        _nextWasCalled.Should().BeTrue();
        context.Response.StatusCode.Should().NotBe(429);
    }

    [Fact]
    public async Task InvokeAsync_SameIP_DifferentEndpoints_HaveIndependentLimits()
    {
        // Arrange
        var middleware = CreateMiddleware();
        var ip = GetUniqueIp();

        // Exhaust signin limit (5)
        for (int i = 0; i < 5; i++)
        {
            var ctx = MockHttpContextFactory.Create(remoteIp: ip, path: "/api/auth/signin");
            await middleware.InvokeAsync(ctx);
        }

        // Act — same IP, but refresh endpoint should still be available
        _nextWasCalled = false;
        var context = MockHttpContextFactory.Create(remoteIp: ip, path: "/api/auth/refresh");
        await middleware.InvokeAsync(context);

        // Assert
        _nextWasCalled.Should().BeTrue();
        context.Response.StatusCode.Should().NotBe(429);
    }

    #endregion

    #region X-Forwarded-For Header

    [Fact]
    public async Task InvokeAsync_WithForwardedForHeader_UsesForwardedIp()
    {
        // Arrange
        var middleware = CreateMiddleware();
        var realIp = GetUniqueIp();

        // Exhaust limit using X-Forwarded-For header
        for (int i = 0; i < 5; i++)
        {
            var ctx = MockHttpContextFactory.CreateWithHeaders(
                new Dictionary<string, string> { { "X-Forwarded-For", realIp } },
                remoteIp: "10.0.0.1",
                path: "/api/auth/signin");
            await middleware.InvokeAsync(ctx);
        }

        // Act — 6th request with same forwarded IP
        _nextWasCalled = false;
        var context = MockHttpContextFactory.CreateWithHeaders(
            new Dictionary<string, string> { { "X-Forwarded-For", realIp } },
            remoteIp: "10.0.0.1",
            path: "/api/auth/signin");
        await middleware.InvokeAsync(context);

        // Assert
        _nextWasCalled.Should().BeFalse();
        context.Response.StatusCode.Should().Be(429);
    }

    #endregion

    #region Helpers

    private static int _ipCounter;

    /// <summary>
    /// Generate a unique IP for each test to avoid static state interference.
    /// </summary>
    private static string GetUniqueIp()
    {
        var counter = Interlocked.Increment(ref _ipCounter);
        return $"192.168.{(counter / 256) % 256}.{counter % 256}";
    }

    private AuthRateLimitMiddleware CreateMiddleware()
    {
        _nextWasCalled = false;

        RequestDelegate next = (HttpContext context) =>
        {
            _nextWasCalled = true;
            return Task.CompletedTask;
        };

        return new AuthRateLimitMiddleware(next, _loggerMock.Object);
    }

    #endregion
}
