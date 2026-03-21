using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using GraphQL.Server.Transports.AspNetCore.WebSockets;
using GraphQL.Transport;
using duedgusto.Services.Jwt;

namespace duedgusto.Services.WebSocket;

public class WebSocketAuthenticationService : IWebSocketAuthenticationService
{
    private readonly JwtHelper _jwtHelper;

    public WebSocketAuthenticationService(JwtHelper jwtHelper)
    {
        _jwtHelper = jwtHelper;
    }

    public Task AuthenticateAsync(
        IWebSocketConnection connection,
        string subProtocol,
        OperationMessage operationMessage)
    {
        var payload = operationMessage.Payload;
        if (payload is System.Text.Json.JsonElement jsonElement
            && jsonElement.TryGetProperty("authToken", out var tokenElement))
        {
            var token = tokenElement.GetString();
            if (!string.IsNullOrEmpty(token))
            {
                try
                {
                    var tokenHandler = new JwtSecurityTokenHandler();
                    var principal = tokenHandler.ValidateToken(
                        token,
                        _jwtHelper.TokenValidationParameters,
                        out SecurityToken _);

                    connection.HttpContext.User = principal;
                }
                catch
                {
                    // Token non valido — l'utente resta non autenticato
                }
            }
        }

        return Task.CompletedTask;
    }
}
