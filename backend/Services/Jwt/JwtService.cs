using System.Text;
using System.Security.Claims;
using System.Security.Cryptography;
using System.IdentityModel.Tokens.Jwt;

using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Primitives;

namespace duedgusto.Services;

public interface IJwtService
{
    string GenerateAccessToken(IEnumerable<Claim> claims);
    string GenerateRefreshToken();
    ClaimsPrincipal GetPrincipalFromExpiredToken(string token);
    int GetClaimUserIdFromToken(string token);
    string GetTokenFromHttpContextAccessor(IHttpContextAccessor accessor);
    int GetUserID();
    int GetUserID(ClaimsPrincipal principal);
    string GetUserName();
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
    public string GenerateAccessToken(IEnumerable<Claim> claims)
    {
        IConfiguration jwtSettings = _configuration.GetSection("Jwt");
        var keyString = jwtSettings["Key"];
        if (string.IsNullOrEmpty(keyString))
        {
            throw new Exception("La chiave JWT non è configurata correttamente.");
        }
        if (!double.TryParse(jwtSettings["ExpiresInMinutes"], out double duration))
        {
            throw new Exception("La durata del token non è configurata correttamente.");
        }
        var key = Encoding.UTF8.GetBytes(keyString);

        SecurityTokenDescriptor tokenDescriptor = new()
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(duration),
            Issuer = jwtSettings["Issuer"],
            Audience = jwtSettings["Audience"],
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        JwtSecurityTokenHandler tokenHandler = new();
        SecurityToken token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
    public string GenerateRefreshToken()
    {
        byte[] randomNumber = new byte[32];
        using RandomNumberGenerator rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }
    public ClaimsPrincipal GetPrincipalFromExpiredToken(string token)
    {
        IConfiguration jwtSettings = _configuration.GetSection("Jwt");
        var keyString = jwtSettings["Key"] ?? string.Empty;

        TokenValidationParameters tokenValidationParameters = new()
        {
            ValidateAudience = false,
            ValidateIssuer = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyString)),
            ValidateLifetime = false
        };

        JwtSecurityTokenHandler tokenHandler = new();
        ClaimsPrincipal principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out SecurityToken securityToken);

        if (securityToken is not JwtSecurityToken jwtSecurityToken || !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
        {
            throw new SecurityTokenException("Invalid token");
        }

        return principal;
    }
    public int GetClaimUserIdFromToken(string token)
    {
        ClaimsPrincipal principal = GetPrincipalFromExpiredToken(token);
        bool existsUserId = principal.Claims.ToList().Exists((claim) => claim.Type == "Id");
        return existsUserId ? Convert.ToInt32(principal.Claims.ToList().Find((claim) => claim.Type == "Id")?.Value) : 0;
    }
    public string GetTokenFromHttpContextAccessor(IHttpContextAccessor contextAccessor)
    {
        if (contextAccessor?.HttpContext != null)
        {
            contextAccessor.HttpContext.Request.Headers.TryGetValue("Authorization", out StringValues tokenHeader);
            string token = tokenHeader.ToString();
            return token.Replace("Bearer ", "");
        }
        return string.Empty;
    }
    public int GetUserID()
    {
        string token = GetTokenFromHttpContextAccessor(_contextAccessor);
        if (!string.IsNullOrEmpty(token))
        {
            return GetClaimUserIdFromToken(token);
        }
        return 0;
    }
    public int GetUserID(ClaimsPrincipal principal)
    {
        bool existsUserId = principal.Claims.ToList().Exists((claim) => claim.Type == "Id");
        return existsUserId ? Convert.ToInt32(principal.Claims.ToList().Find((claim) => claim.Type == "Id")?.Value) : 0;
    }
    public string GetUserName()
    {
        string token = GetTokenFromHttpContextAccessor(_contextAccessor);
        ClaimsPrincipal principal = GetPrincipalFromExpiredToken(token);
        return principal.Identity?.Name ?? throw new Exception("Error in ClaimsPrincipal");
    }
}
