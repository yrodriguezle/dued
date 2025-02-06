using System.Security.Claims;

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
