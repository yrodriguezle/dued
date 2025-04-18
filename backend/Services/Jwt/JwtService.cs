﻿using System.Text;
using System.Security.Claims;
using System.Security.Cryptography;
using System.IdentityModel.Tokens.Jwt;

using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Primitives;

namespace duedgusto.Services.Jwt;

public interface IJwtService
{
    ClaimsPrincipal GetPrincipalFromExpiredToken(string token);
    int GetClaimUserIdFromToken(string token);
    int GetUserID();
    int GetUserID(ClaimsPrincipal principal);
    string GetUserName();
    string GenerateAccessToken(IEnumerable<Claim> claims);
    string GenerateRefreshToken();
    bool ValidateAccessToken();
    string GetTokenFromAccessor(IHttpContextAccessor accessor);
}

public class JwtService : IJwtService
{
    private readonly IConfiguration _configuration;
    private readonly IHttpContextAccessor _contextAccessor;
    public JwtService(IConfiguration configuration, IHttpContextAccessor contextAccessor)
    {
        _configuration = configuration;
        _contextAccessor = contextAccessor;
    }
    public SymmetricSecurityKey GetJwtKey()
    {
        string keyString = _configuration.GetSection("Jwt")["Key"] ?? string.Empty;

        if (string.IsNullOrEmpty(keyString) || keyString.Length < 32)
        {
            throw new InvalidOperationException("JWT Key must be at least 32 characters long.");
        }

        byte[] key = Encoding.UTF8.GetBytes(keyString);
        return new SymmetricSecurityKey(key);
    }
    public string GetTokenFromAccessor(IHttpContextAccessor contextAccessor)
    {
        if (contextAccessor?.HttpContext != null)
        {
            contextAccessor.HttpContext.Request.Headers.TryGetValue("Authorization", out StringValues tokenHeader);
            string token = tokenHeader.ToString();
            return token.Replace("Bearer ", "");
        }
        return string.Empty;
    }
    public ClaimsPrincipal GetPrincipalFromExpiredToken(string token)
    {
        string keyString = _configuration.GetSection("Jwt")["Key"] ?? string.Empty;
        string validIssuer = _configuration["Jwt:Issuer"] ?? string.Empty;
        string validAudience = _configuration["Jwt:Audience"] ?? string.Empty;

        TokenValidationParameters parameters = JwtTokenParameters.GetTokenValidationParameters(keyString, validIssuer, validAudience);
        parameters.ValidateLifetime = false;
        JwtSecurityTokenHandler tokenHandler = new();
        ClaimsPrincipal principal = tokenHandler.ValidateToken(token, parameters, out SecurityToken securityToken);

        if (securityToken is not JwtSecurityToken jwtSecurityToken
            || !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
        {
            throw new SecurityTokenException("Invalid token");
        }

        return principal;
    }
    public int GetClaimUserIdFromToken(string token)
    {
        ClaimsPrincipal principal = GetPrincipalFromExpiredToken(token);
        bool existsUserId = principal.Claims.ToList().Exists((claim) => claim.Type == "UserId");
        return existsUserId ? Convert.ToInt32(principal.Claims.ToList().Find((claim) => claim.Type == "UserId")?.Value) : 0;
    }
    public int GetUserID()
    {
        string token = GetTokenFromAccessor(_contextAccessor);
        if (!string.IsNullOrEmpty(token))
        {
            return GetClaimUserIdFromToken(token);
        }
        return 0;
    }
    public int GetUserID(ClaimsPrincipal principal)
    {
        bool existsUserId = principal.Claims.ToList().Exists((claim) => claim.Type == "UserId");
        return existsUserId ? Convert.ToInt32(principal.Claims.ToList().Find((claim) => claim.Type == "UserId")?.Value) : 0;
    }
    public string GetUserName()
    {
        string token = GetTokenFromAccessor(_contextAccessor);
        ClaimsPrincipal principal = GetPrincipalFromExpiredToken(token);
        return principal.Identity?.Name ?? string.Empty;
    }
    public string GenerateAccessToken(IEnumerable<Claim> claims)
    {
        JwtSecurityToken jwtToken = new(
            issuer: _configuration.GetSection("Jwt")["Issuer"] ?? string.Empty,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: new SigningCredentials(JwtTokenParameters.GetJwtKey(_configuration.GetSection("Jwt")["Key"] ?? string.Empty), SecurityAlgorithms.HmacSha256)
        );
        return new JwtSecurityTokenHandler().WriteToken(jwtToken);
    }
    public string GenerateRefreshToken()
    {
        byte[] randomNumber = new byte[32];
        using RandomNumberGenerator rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }
    public bool ValidateAccessToken()
    {
        try
        {
            string token = GetTokenFromAccessor(_contextAccessor);
            string keyString = _configuration.GetSection("Jwt")["Key"] ?? string.Empty;
            string validIssuer = _configuration["Jwt:Issuer"] ?? string.Empty;
            string validAudience = _configuration["Jwt:Audience"] ?? string.Empty;

            TokenValidationParameters parameters = JwtTokenParameters.GetTokenValidationParameters(keyString, validIssuer, validAudience);
            JwtSecurityTokenHandler tokenHandler = new();
            ClaimsPrincipal principal = tokenHandler.ValidateToken(token, parameters, out SecurityToken securityToken);

            if (securityToken is not JwtSecurityToken jwtSecurityToken
                || !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
            {
                return false;
            }

            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }
}
