using System.Security.Claims;

using Microsoft.EntityFrameworkCore;
using duedgusto.Services;
using duedgusto.Models.Database;
using duedgusto.Models.Common;

namespace duedgusto.DataAccess;


public interface IUserRepository : IRepositoryBase<User>
{
    Task<TokenResponse?> SignIn(string Username, string Password);
    Task<TokenResponse?> RefreshToken(string RefreshToken);
}

public class UserRepository : RepositoryBase<User>, IUserRepository
{
    private readonly ApplicationDbContext DbContext;
    private readonly IJwtService Jwt;
    private readonly IHttpContextAccessor HttpContext;

    public UserRepository(ApplicationDbContext context, IJwtService jwtService, IHttpContextAccessor httpContextAccessor) : base(context)
    {
        DbContext = context;
        Jwt = jwtService;
        HttpContext = httpContextAccessor;
    }
    public async Task<TokenResponse?> SignIn(string Username, string Password)
    {
        User? user = await DbContext.Users.FirstOrDefaultAsync((x) => x.Username == Username);
        if (user == null || !BCrypt.Net.BCrypt.Verify(Password, user.PasswordHash))
        {
            return null;
        }

        Claim[] usersClaims =
        [
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role?.Name ?? string.Empty)
        ];

        string jwtToken = Jwt.GenerateAccessToken(usersClaims);
        string jwtRefreshToken = Jwt.GenerateRefreshToken();
        user.RefreshToken = jwtRefreshToken;

        await DbContext.SaveChangesAsync();
        return new TokenResponse(jwtToken, jwtRefreshToken);
    }
    public async Task<TokenResponse?> RefreshToken(string RefreshToken)
    {
        string token = Jwt.GetTokenFromHttpContextAccessor(HttpContext);
        ClaimsPrincipal principal = Jwt.GetPrincipalFromExpiredToken(token);

        int userId = Jwt.GetUserID(principal);
        User? user = await DbContext.Users.FirstOrDefaultAsync((x) => x.Id == userId);

        if (user == null || string.IsNullOrEmpty(user.RefreshToken) || !user.RefreshToken.Equals(RefreshToken))
        {
            return null;
        }
        string newJwtToken = Jwt.GenerateAccessToken(principal.Claims);
        string jwtRefreshToken = Jwt.GenerateRefreshToken();
        user.RefreshToken = jwtRefreshToken;

        await DbContext.SaveChangesAsync();
        return new TokenResponse(newJwtToken, jwtRefreshToken);
    }
}
