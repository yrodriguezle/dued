using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace duedgusto.Services.Jwt;

public static class JwtTokenParameters
{
    public static SymmetricSecurityKey GetJwtKey(string keyString)
    {
        if (string.IsNullOrEmpty(keyString) || keyString.Length < 32)
        {
            throw new InvalidOperationException("JWT Key must be at least 32 characters long.");
        }

        byte[] key = Encoding.UTF8.GetBytes(keyString);
        return new SymmetricSecurityKey(key);
    }
    public static TokenValidationParameters GetTokenValidationParameters(string keyString, string validIssuer, string validAudience)
    {
        return new()
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = GetJwtKey(keyString),
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidIssuer = validIssuer,
            ValidAudience = validAudience,
            ValidateLifetime = true
        };
    }
}
