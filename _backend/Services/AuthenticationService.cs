using GraphQL;
using Microsoft.Extensions.Primitives;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace DueD.Services
{
    public interface IAuthenticationService
    {
        SymmetricSecurityKey GetJwtKey();
        string GenerateAccessToken(IEnumerable<Claim> claims);
        string GenerateRefreshToken();
        ClaimsPrincipal GetPrincipalFromExpiredToken(string token);
        bool ValidateAccessToken();
        int GetClaimUserIdFromToken(string token);
        string GetTokenFromHttpContextAccessor(IHttpContextAccessor accessor);
        bool IsSetupMode(string token);
        int GetUserID();
        string GetUserName();
    }

    public class AuthenticationService : IAuthenticationService
    {
        private readonly IConfiguration _configuration;
        private readonly IHttpContextAccessor _contextAccessor;

        public AuthenticationService(IConfiguration configuration, IHttpContextAccessor contextAccessor)
        {
            _configuration = configuration;
            _contextAccessor = contextAccessor;
        }
        public SymmetricSecurityKey GetJwtKey()
        {
            byte[] key = Encoding.UTF8.GetBytes(_configuration.GetSection("Jwt")["Key"]);
            return new SymmetricSecurityKey(key);
        }

        public string GenerateAccessToken(IEnumerable<Claim> claims)
        {
            JwtSecurityToken jwtToken = new JwtSecurityToken(
                issuer: "DueD.zanuso.it",
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddMilliseconds(500),
                signingCredentials: new SigningCredentials(GetJwtKey(), SecurityAlgorithms.HmacSha256)
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
                string token = GetTokenFromHttpContextAccessor(_contextAccessor);
                TokenValidationParameters tokenValidationParameters = new TokenValidationParameters
                {
                    ValidateAudience = false,
                    ValidateIssuer = false,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = GetJwtKey(),
                    ValidateLifetime = true
                };

                JwtSecurityTokenHandler tokenHandler = new();
                ClaimsPrincipal principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out SecurityToken securityToken);

                if (!(securityToken is JwtSecurityToken jwtSecurityToken)
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
        public ClaimsPrincipal GetPrincipalFromExpiredToken(string token)
        {
            TokenValidationParameters tokenValidationParameters = new TokenValidationParameters
            {
                ValidateAudience = false,
                ValidateIssuer = false,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = GetJwtKey(),
                ValidateLifetime = false
            };

            JwtSecurityTokenHandler tokenHandler = new JwtSecurityTokenHandler();
            ClaimsPrincipal principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out SecurityToken securityToken);

            if (!(securityToken is JwtSecurityToken jwtSecurityToken)
                || !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
            {
                throw new SecurityTokenException("Invalid token");
            }

            return principal;
        }
        public int GetClaimUserIdFromToken(string token)
        {
            ClaimsPrincipal principal = GetPrincipalFromExpiredToken(token);
            bool existsUserId = principal.Claims.ToList()
                .Exists((claim) => claim.Type == "UserId");
            return existsUserId
                ? Convert.ToInt32(principal.Claims.ToList().Find((claim) => claim.Type == "UserId").Value)
                : 0;
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
        public bool IsSetupMode(string token = "")
        {
            if (!string.IsNullOrEmpty(token) || !string.IsNullOrWhiteSpace(token))
            {
                ClaimsPrincipal principal = GetPrincipalFromExpiredToken(token);
                return principal.Claims.ToList().Exists((claim) => claim.Type == "SetupMode" && claim.Value == "True");
            }
            return false;
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
        public string GetUserName()
        {
            string token = GetTokenFromHttpContextAccessor(_contextAccessor);
            ClaimsPrincipal principal = GetPrincipalFromExpiredToken(token);
            return principal.Identity.Name;
        }
    }
}
