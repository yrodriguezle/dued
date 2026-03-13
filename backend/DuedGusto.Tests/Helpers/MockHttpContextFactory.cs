using Microsoft.AspNetCore.Http;
using System.Text;
using System.Text.Json;

namespace DuedGusto.Tests.Helpers;

/// <summary>
/// Factory per creare istanze di HttpContext configurabili per i test.
/// Supporta IP remoto, path, body JSON, headers e cookie.
/// </summary>
public static class MockHttpContextFactory
{
    /// <summary>
    /// Crea un DefaultHttpContext con IP remoto e path configurabili.
    /// </summary>
    public static HttpContext Create(string? remoteIp = "127.0.0.1", string path = "/")
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(remoteIp ?? "127.0.0.1");
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();
        return context;
    }

    /// <summary>
    /// Crea un HttpContext con un body JSON serializzato.
    /// </summary>
    public static HttpContext CreateWithBody<T>(T body, string path = "/") where T : class
    {
        var context = Create(path: path);
        var json = JsonSerializer.Serialize(body);
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(json));
        context.Request.ContentType = "application/json";
        return context;
    }

    /// <summary>
    /// Crea un HttpContext con headers personalizzati.
    /// </summary>
    public static HttpContext CreateWithHeaders(
        Dictionary<string, string> headers,
        string? remoteIp = "127.0.0.1",
        string path = "/")
    {
        var context = Create(remoteIp, path);
        foreach (var header in headers)
        {
            context.Request.Headers[header.Key] = header.Value;
        }
        return context;
    }

    /// <summary>
    /// Crea un HttpContext con cookie per test di autenticazione.
    /// </summary>
    public static HttpContext CreateWithCookies(
        Dictionary<string, string> cookies,
        string? remoteIp = "127.0.0.1",
        string path = "/")
    {
        var context = Create(remoteIp, path);
        var cookieHeader = string.Join("; ", cookies.Select(c => $"{c.Key}={c.Value}"));
        context.Request.Headers["Cookie"] = cookieHeader;
        return context;
    }

    /// <summary>
    /// Crea un HttpContext con Authorization Bearer token.
    /// </summary>
    public static HttpContext CreateWithBearerToken(
        string token,
        string? remoteIp = "127.0.0.1",
        string path = "/")
    {
        var context = Create(remoteIp, path);
        context.Request.Headers["Authorization"] = $"Bearer {token}";
        return context;
    }
}
